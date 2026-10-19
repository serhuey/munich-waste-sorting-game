#!/usr/bin/env python3
"""
Сборка игрового контента: проверка авторского слоя и запись dist/content.json.

    python3 build_data.py                 # собрать на сегодняшнюю дату
    python3 build_data.py --date 2027-01-15   # собрать так, будто наступил переход
    python3 build_data.py --check         # только проверить, ничего не писать

Только стандартная библиотека.

Смысл этого шага — R15. В игру не попадает ни один предмет, у которого нет
отметки о ручной сверке с источником, у которого источник исчез или у которого
адресаты источника изменились с момента сверки. Такой предмет не «чинится
автоматически» — он исключается из сборки и попадает в отчёт, чтобы человек
открыл страницу AWM и посмотрел глазами.

Код возврата: 0 — всё чисто, 1 — что-то исключено или есть предупреждения,
2 — сборка невозможна (нет данных о местах или снимка лексикона).
"""

import argparse, datetime, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

LANGS = ("de", "en")
ATTRS = {"borderline", "examine", "separable"}
# awm  — запись Abfalllexikon, сверяется со снимком;
# page — отдельная страница AWM, которой в лексиконе нет (например, состав
#        контейнеров на острове или переход 2027 года);
# law  — норма федерального закона, к AWM отношения не имеющая.
AUTHORITIES = {"awm", "page", "law"}
FUTURE_PROBE = "2027-01-01"   # дата, на которой проверяем переход на Gelbe Tonne
ID = re.compile(r"^[a-z0-9][a-z0-9_]*$")


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def iso(value):
    return datetime.date.fromisoformat(value)


def in_window(item, date):
    """Действует ли объект с полями from/until на дату date. until не включается."""
    f, u = item.get("from"), item.get("until")
    if f and date < iso(f):
        return False
    if u and date >= iso(u):
        return False
    return True


def newest_snapshot(repo):
    d = os.path.join(repo, "data", "verified")
    if not os.path.isdir(d):
        return None, None
    files = sorted(f for f in os.listdir(d) if f.startswith("lexikon-") and f.endswith(".json"))
    if not files:
        return None, None
    path = os.path.join(d, files[-1])
    return path, load_json(path)


def load_places(repo):
    """-> (places, все контейнеры как id -> описание, список фатальных ошибок)"""
    path = os.path.join(repo, "data", "places.json")
    if not os.path.exists(path):
        return None, {}, ["нет data/places.json"]
    try:
        data = load_json(path)
    except ValueError as ex:
        return None, {}, ["data/places.json не разбирается: %s" % ex]

    places, containers, fatal = data.get("places"), {}, []
    if not isinstance(places, list) or not places:
        return None, {}, ["data/places.json: places должен быть непустым списком"]
    # Ступени лестницы (U6). Тир — это не порядковый номер в файле, а данные:
    # именно из него движок собирает, что открывается когда. Поэтому на каждой
    # ступени ровно одно место (R6: открывается по одному) и ступени идут подряд
    # с первой — иначе игрок увидит прыжок с тира 2 на тир 4 без объяснения.
    tiers = {}
    for p in places:
        tier = p.get("tier")
        if not isinstance(tier, int) or isinstance(tier, bool) or tier < 1:
            fatal.append("%s: tier должен быть целым числом от 1" % (p.get("id"),))
        elif tier in tiers:
            fatal.append("тир %d занят дважды: %s и %s — на ступени одно место"
                         % (tier, tiers[tier], p.get("id")))
        else:
            tiers[tier] = p.get("id")
    if tiers and sorted(tiers) != list(range(1, len(tiers) + 1)):
        fatal.append("тиры идут с пропусками: %s — лестница поднимается по одной ступени"
                     % ", ".join(str(t) for t in sorted(tiers)))
    for p in places:
        pid = p.get("id")
        if not isinstance(pid, str) or not ID.match(pid):
            fatal.append("место без корректного id: %r" % (pid,))
            continue
        for c in p.get("containers") or []:
            cid = c.get("id")
            if not isinstance(cid, str) or not ID.match(cid):
                fatal.append("%s: контейнер без корректного id: %r" % (pid, cid))
                continue
            if cid in containers:
                fatal.append("контейнер %s объявлен дважды" % cid)
                continue
            containers[cid] = dict(c, place=pid)
    return places, containers, fatal


PLACEHOLDER = re.compile(r"\{(\w+)\}")


def load_i18n(repo):
    """Строки интерфейса: data/i18n/<язык>.json. -> (словарь языков, фатальные ошибки)

    Эталон — немецкий: на нём пишется первым и он длиннее. Третий язык
    добавляется одним файлом, без правки кода (R21), но только полным: ключ,
    которого нет в одном из файлов, — это экран, где игрок увидит идентификатор
    вместо слова, и сборка его не пропускает.
    """
    d = os.path.join(repo, "data", "i18n")
    if not os.path.isdir(d):
        return {}, ["нет data/i18n/ — строк интерфейса нет"]
    bundle, fatal = {}, []
    for name in sorted(os.listdir(d)):
        if not name.endswith(".json"):
            continue
        try:
            bundle[name[:-5]] = load_json(os.path.join(d, name))
        except ValueError as ex:
            fatal.append("data/i18n/%s не разбирается: %s" % (name, ex))
    if "de" not in bundle:
        fatal.append("нет data/i18n/de.json — эталонного языка")
        return bundle, fatal
    ref = bundle["de"]
    for lang, strings in bundle.items():
        for key in sorted(set(ref) - set(strings)):
            fatal.append("data/i18n/%s.json: нет ключа %s" % (lang, key))
        for key in sorted(set(strings) - set(ref)):
            fatal.append("data/i18n/%s.json: лишний ключ %s, которого нет в de" % (lang, key))
        for key in set(ref) & set(strings):
            a, b = set(PLACEHOLDER.findall(str(ref[key]))), set(PLACEHOLDER.findall(str(strings[key])))
            if a != b:
                fatal.append("data/i18n/%s.json: %s — подстановки {%s}, а в de {%s}"
                             % (lang, key, ",".join(sorted(b)), ",".join(sorted(a))))
            if not str(strings[key]).strip():
                fatal.append("data/i18n/%s.json: %s пуст" % (lang, key))
    return bundle, fatal


def version_of(paths):
    """Отпечаток содержимого движка и рисунков: меняется любой файл — меняется версия."""
    import hashlib
    h = hashlib.sha1()
    for p in paths:
        h.update(p.encode("utf-8"))
        with open(p, "rb") as f:
            h.update(f.read())
    return h.hexdigest()[:10]


IMPORT = re.compile(r"""((?:from|import)\s*\(?\s*['"])(\./[\w./-]+\.js)(['"])""")
ASSET = re.compile(r"""((?:src|href)=")((?:js|css)/[\w./-]+\.(?:js|css))(")""")


def stamp(text, version):
    """Метка версии на каждом адресе модуля, стиля и скрипта.

    Браузер на сайте может держать старые копии модулей. После обновления это
    даёт новый main.js при старом fall.js — игра ломается так, будто ошибка в
    коде. С меткой адрес каждой версии свой, и смешаться им негде.
    """
    text = IMPORT.sub(lambda m: m.group(1) + m.group(2) + "?v=" + version + m.group(3), text)
    return ASSET.sub(lambda m: m.group(1) + m.group(2) + "?v=" + version + m.group(3), text)


def png_size(path):
    """Ширина и высота из заголовка PNG — больше сборке ничего не нужно."""
    import struct
    with open(path, "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return list(struct.unpack(">II", head[16:24]))


def list_art(repo):
    """Все картинки игры: game/art/<вид>/<имя>.png, с размером каждой.
    Список нужен игре, чтобы не запрашивать файлы, которых нет, а размер — чтобы
    разложить картинку на экране до того, как она загрузится."""
    base = os.path.join(repo, "game", "art")
    out = {}
    if os.path.isdir(base):
        for kind in sorted(os.listdir(base)):
            d = os.path.join(base, kind)
            if os.path.isdir(d):
                for f in sorted(os.listdir(d)):
                    if f.endswith(".png"):
                        size = png_size(os.path.join(d, f))
                        if size:
                            out["%s/%s" % (kind, f)] = size
    return out


def signed(sources):
    return bool(sources) and all((s.get("verified_by") or "").strip() for s in sources)


def check_window(w, where, problems):
    try:
        f = iso(w["from"]) if w.get("from") else None
        u = iso(w["until"]) if w.get("until") else None
    except (ValueError, TypeError) as ex:
        problems.append("%s: некорректная дата: %s" % (where, ex))
        return
    if f and u and f >= u:
        problems.append("%s: from %s не раньше until %s" % (where, f, u))


def load_finale(repo, langs=LANGS):
    """Ёлка (R7). Маршрут — отдельное измерение данных: у каждого либо окно
    дат, либо круглый год, либо пометка, что так нельзя. Финал обязан быть
    доступен круглый год — значит, хотя бы один маршрут круглогодичный."""
    path = os.path.join(repo, "data", "finale", "christbaum.json")
    if not os.path.exists(path):
        return None, []
    try:
        data = load_json(path)
    except ValueError as ex:
        return None, ["data/finale/christbaum.json не разбирается: %s" % ex]
    problems = []
    routes = data.get("routes") or []
    if not routes:
        problems.append("финал: нет маршрутов")
    for r in routes:
        where = "финал, маршрут %s" % r.get("id")
        kinds = [k for k in ("year_round", "windows", "illegal") if r.get(k)]
        if len(kinds) != 1:
            problems.append("%s: нужен ровно один из year_round, windows, illegal" % where)
        for i, w in enumerate(r.get("windows") or []):
            check_window(w, "%s, окно %d" % (where, i), problems)
        check_text_map(r.get("labels"), where + " labels", problems, langs)
        check_text_map(r.get("rule"), where + " rule", problems, langs)
    if not any(r.get("year_round") for r in routes):
        problems.append("финал: нет круглогодичного маршрута — в июле ёлку было бы некуда деть")
    for d in data.get("decorations") or []:
        check_text_map(d.get("labels"), "финал, украшение %s" % d.get("id"), problems, langs)
    check_text_map(data.get("strip_reason"), "финал strip_reason", problems, langs)
    for scene in data.get("scenes") or []:
        try:
            day = iso(scene)
        except ValueError:
            problems.append("финал: сцена %r — не дата" % scene)
            continue
        legal = [r for r in routes if not r.get("illegal") and (r.get("year_round") or any(
            in_window(w, day) for w in r.get("windows") or []))]
        if not legal:
            problems.append("финал: в сцене %s не открыт ни один законный маршрут" % scene)
    data = {k: v for k, v in data.items() if not k.startswith("_")}
    return data, problems


def load_notices(repo, date, langs=LANGS):
    path = os.path.join(repo, "data", "notices.json")
    if not os.path.exists(path):
        return None, []
    try:
        data = load_json(path)
    except ValueError as ex:
        return None, ["data/notices.json не разбирается: %s" % ex]
    problems = []
    for group in ("intro", "notices"):
        for i, n in enumerate(data.get(group) or []):
            check_window(n, "%s[%d]" % (group, i), problems)
            check_text_map(n.get("text"), "%s[%d] text" % (group, i), problems, langs)
    # Вступление не должно пережить правила, которые описывает (R20): на любую
    # дату действует ровно одна его редакция.
    for probe in (date, iso(FUTURE_PROBE)):
        live = [n for n in data.get("intro") or [] if in_window(n, probe)]
        if len(live) != 1:
            problems.append("intro: на %s действует редакций: %d, нужна ровно одна" % (probe, len(live)))
    data = {k: v for k, v in data.items() if not k.startswith("_") or k == "_source"}
    return data, problems


def normalise_destinations(raw):
    """'papier' и {'id': 'papier', 'until': ...} приводим к одному виду."""
    out = []
    for d in raw:
        if isinstance(d, str):
            out.append({"id": d})
        elif isinstance(d, dict) and isinstance(d.get("id"), str):
            out.append(dict(d))
        else:
            return None
    return out


def check_text_map(value, where, problems, langs):
    if not isinstance(value, dict):
        problems.append("%s: ожидается объект с языками %s" % (where, ", ".join(langs)))
        return
    for lang in langs:
        text = value.get(lang)
        if not isinstance(text, str) or not text.strip():
            problems.append("%s: нет текста на языке %s" % (where, lang))


def check_destinations(raw, where, containers, date, problems):
    dests = normalise_destinations(raw) if isinstance(raw, list) else None
    if not dests:
        problems.append("%s: адресаты должны быть непустым списком" % where)
        return []
    live = 0
    for d in dests:
        cid = d["id"]
        container = containers.get(cid)
        if container is None:
            problems.append("%s: адресат %s не объявлен ни в одном месте" % (where, cid))
            continue
        try:
            if in_window(d, date) and in_window(container, date):
                live += 1
        except ValueError as ex:
            problems.append("%s: некорректная дата у адресата %s: %s" % (where, cid, ex))
    if dests and live == 0 and not problems:
        problems.append("%s: на дату сборки ни один адресат не действует" % where)
    return dests


def check_optional_text_map(value, where, problems, langs):
    """Необязательный текст: пусто — и ладно, но начал — заполни на всех языках.

    Пустой объект считается отсутствующим: форма и заготовки создают
    {"de": "", "en": ""} заранее, и требовать от такого текста было бы
    требованием заполнить то, что решено не заполнять.
    """
    if value is None:
        return
    if isinstance(value, dict) and not any((v or "").strip() for v in value.values()):
        return
    check_text_map(value, where, problems, langs)


def check_variant(v, where, containers, date, problems, langs, named=True):
    kind = v.get("kind")
    # Название варианта различает версии предмета. Когда версия одна, различать
    # нечего: на карточке оно просто повторяло бы имя предмета.
    if named:
        check_text_map(v.get("labels"), where + " labels", problems, langs)
    else:
        check_optional_text_map(v.get("labels"), where + " labels", problems, langs)
    check_optional_text_map(v.get("explanation"), where + " explanation", problems, langs)
    if kind == "simple":
        if "parts" in v:
            problems.append("%s: у простого варианта не может быть parts" % where)
        check_destinations(v.get("destinations"), where, containers, date, problems)
    elif kind == "composite":
        if "destinations" in v:
            problems.append("%s: у составного варианта адресаты живут в частях, не в самом варианте" % where)
        parts = v.get("parts")
        if not isinstance(parts, list) or len(parts) < 2:
            problems.append("%s: составной вариант должен иметь минимум две части" % where)
            return
        seen = set()
        for i, part in enumerate(parts):
            pw = "%s.parts[%d]" % (where, i)
            pid = part.get("id")
            if not isinstance(pid, str) or not ID.match(pid):
                problems.append("%s: некорректный id части: %r" % (pw, pid))
            elif pid in seen:
                problems.append("%s: id части %s повторяется" % (pw, pid))
            else:
                seen.add(pid)
            if "variants" in part or "parts" in part:
                problems.append("%s: вложенность запрещена — у части не может быть "
                                "ни variants, ни parts (R14). Предмет, которому нужны "
                                "два уровня, заводится как два предмета" % pw)
            check_text_map(part.get("labels"), pw + " labels", problems, langs)
            check_optional_text_map(part.get("explanation"), pw + " explanation", problems, langs)
            check_destinations(part.get("destinations"), pw, containers, date, problems)
    else:
        problems.append("%s: kind должен быть simple или composite, а не %r" % (where, kind))


def check_source(source, snapshot_index, today, problems, where="source", require_signature=True):
    if not isinstance(source, dict):
        problems.append("нет блока %s" % where)
        return
    authority = source.get("authority")
    if authority not in AUTHORITIES:
        problems.append("%s.authority должен быть awm или law, а не %r" % (where, authority))
    if not isinstance(source.get("url"), str) or not source["url"].startswith("http"):
        problems.append("%s.url отсутствует или не похож на ссылку" % where)
    if require_signature and (not isinstance(source.get("verified_by"), str)
                              or not source["verified_by"].strip()):
        problems.append("%s.verified_by пуст — предмет никто не сверял" % where)

    if not require_signature:
        return

    raw_date = source.get("verified_on")
    if not isinstance(raw_date, str) or not raw_date:
        problems.append("нет %s.verified_on — предмет не сверялся вручную (R15)" % where)
    else:
        try:
            when = iso(raw_date)
        except ValueError:
            problems.append("%s.verified_on не дата в формате ГГГГ-ММ-ДД: %r" % (where, raw_date))
        else:
            if when > today:
                problems.append("%s.verified_on в будущем: %s" % (where, raw_date))

    if authority in ("law", "page"):
        what = "нормой закона" if authority == "law" else "названием страницы"
        if not isinstance(source.get("reference"), str) or not source["reference"].strip():
            problems.append("для authority=%s нужен %s.reference с %s" % (authority, where, what))
        if source.get("key"):
            problems.append("для authority=%s поле %s.key лишнее: этого источника нет в "
                            "лексиконе" % (authority, where))
        return

    key = source.get("key")
    if not isinstance(key, str) or not key:
        problems.append("нет %s.key — не с чем сверять снимок лексикона" % where)
        return
    entry = snapshot_index.get(key)
    if entry is None:
        problems.append("записи %s нет в свежем снимке лексикона — термин исчез или "
                        "переименован, нужна пересверка" % key)
        return
    declared = source.get("destinations_at_verification")
    if not isinstance(declared, list):
        problems.append("нет %s.destinations_at_verification — нечего сравнивать со снимком" % where)
        return
    now, then = sorted(entry.get("destinations") or []), sorted(str(x) for x in declared)
    if now != then:
        problems.append("адресаты источника изменились с момента сверки: было [%s], "
                        "стало [%s] — открой %s и пересверь"
                        % (", ".join(then), ", ".join(now), source.get("url") or key))


def reachable_containers(places, tier, date):
    """Контейнеры, доступные игроку на его тире: место открывается не раньше
    своего тира, и адресат в ещё закрытом месте ответить нельзя."""
    out = {}
    for p in places or []:
        if not in_window(p, date) or (p.get("tier") or 1) > tier:
            continue
        for c in p.get("containers") or []:
            if in_window(c, date):
                out[c["id"]] = p["id"]
    return out


def check_item(raw, stem, containers, snapshot_index, date, today, langs=LANGS,
               require_signature=True, places=None):
    problems = []
    item_id = raw.get("id")
    if not isinstance(item_id, str) or not ID.match(item_id):
        problems.append("некорректный id: %r" % (item_id,))
    elif item_id != stem:
        problems.append("id %s не совпадает с именем файла %s.json" % (item_id, stem))

    tier = raw.get("tier")
    if not isinstance(tier, int) or not 1 <= tier <= 5:
        problems.append("tier должен быть числом от 1 до 5, а не %r" % (tier,))

    attrs = raw.get("attrs", [])
    if not isinstance(attrs, list) or any(a not in ATTRS for a in attrs):
        problems.append("attrs может содержать только %s" % ", ".join(sorted(ATTRS)))
        attrs = []

    check_text_map(raw.get("labels"), "labels", problems, langs)
    if require_signature:
        check_text_map(raw.get("explanation"), "explanation", problems, langs)
    check_source(raw.get("source"), snapshot_index, today, problems,
                 require_signature=require_signature)
    extra = raw.get("sources", [])
    if not isinstance(extra, list):
        problems.append("sources должен быть списком дополнительных источников")
    else:
        for i, src in enumerate(extra):
            check_source(src, snapshot_index, today, problems, "sources[%d]" % i,
                         require_signature=require_signature)

    variants = raw.get("variants")
    if not isinstance(variants, list) or not variants:
        problems.append("variants должен быть непустым списком")
        return problems

    seen = set()
    for i, v in enumerate(variants):
        where = "variants[%d]" % i
        vid = v.get("id")
        if not isinstance(vid, str) or not ID.match(vid):
            problems.append("%s: некорректный id варианта: %r" % (where, vid))
        elif vid in seen:
            problems.append("%s: id варианта %s повторяется" % (where, vid))
        else:
            seen.add(vid)
        check_variant(v, where, containers, date, problems, langs, named=len(variants) > 1)

    if len(variants) > 1 and "examine" not in attrs:
        problems.append("у предмета больше одного варианта, но нет атрибута examine — "
                        "игрок не сможет их различить (R4)")
    if any(v.get("kind") == "composite" for v in variants) and "separable" not in attrs:
        problems.append("есть составной вариант, но нет атрибута separable (R5)")

    # Предмет, все адресаты которого лежат в ещё закрытых местах, играть нельзя:
    # нужного контейнера просто нет на ленте.
    if places is not None and isinstance(tier, int) and 1 <= tier <= 5:
        reachable = reachable_containers(places, tier, date)
        for i, v in enumerate(variants):
            for holder, where in ([(v, "variants[%d]" % i)] if v.get("kind") != "composite"
                                  else [(p, "variants[%d].parts[%d]" % (i, j))
                                        for j, p in enumerate(v.get("parts") or [])]):
                dests = normalise_destinations(holder.get("destinations") or []) or []
                live = [d["id"] for d in dests
                        if d["id"] in reachable and in_window(d, date)]
                if dests and not live:
                    problems.append(
                        "%s: на тире %d ни один адресат не доступен — место ещё "
                        "не открыто" % (where, tier))
    return problems


def build(repo, date, today=None, langs=LANGS, fixtures=False):
    today = today or datetime.date.today()
    report = {"included": [], "excluded": [], "warnings": [], "fatal": []}

    places, containers, fatal = load_places(repo)
    report["fatal"].extend(fatal)
    try:
        marks = load_json(os.path.join(repo, "data", "places.json")).get("_source") or {}
        if not (marks.get("confirmed_by") or "").strip():
            report["warnings"].append(
                "data/places.json: состав мест и контейнеров никем не подтверждён — "
                "открой _source.url, проверь и впиши _source.confirmed_by")
    except (OSError, ValueError):
        pass
    snap_path, snapshot = newest_snapshot(repo)
    if snapshot is None:
        report["fatal"].append("нет снимка лексикона в data/verified/ — "
                               "сначала: python3 tools/awm_lexikon.py fetch --details")
    if report["fatal"]:
        return None, report
    report["snapshot"] = os.path.basename(snap_path)
    index = {e["key"]: e for e in snapshot.get("entries", [])}

    items_dir = os.path.join(repo, "data", "items")
    names = sorted(f for f in os.listdir(items_dir)
                   if f.endswith(".json") and not f.startswith("_")) if os.path.isdir(items_dir) else []

    items = []
    for name in names:
        stem = name[:-5]
        try:
            raw = load_json(os.path.join(items_dir, name))
        except ValueError as ex:
            report["excluded"].append((stem, ["файл не разбирается как JSON: %s" % ex]))
            continue
        problems = check_item(raw, stem, containers, index, date, today, langs,
                              places=places)
        unverified = False
        if problems and fixtures:
            # Подписанный предмет, который потом дополнили — новый источник ещё
            # без подписи. В выпуск он не идёт, но стенд — это как раз место для
            # несверенного, и пропадать из игры он не должен.
            if not check_item(raw, stem, containers, index, date, today, langs,
                              require_signature=False, places=places):
                report["warnings"].append("%s: есть неподписанный источник — на стенде, в выпуск не пойдёт" % stem)
                problems, unverified = [], True
        if problems:
            report["excluded"].append((stem, problems))
            continue
        # тот же предмет на дату перехода: не исключаем, но предупреждаем
        future = check_item(raw, stem, containers, index, iso(FUTURE_PROBE), today, langs,
                            places=places)
        for p in future:
            if p not in problems and "не действует" in p:
                report["warnings"].append("%s: после %s %s" % (stem, FUTURE_PROBE, p))
        raw = {k: v for k, v in raw.items() if not k.startswith("_")}
        if unverified:
            raw["unverified"] = True
        items.append(raw)
        report["included"].append(stem)

    if fixtures:
        drafts_dir = os.path.join(repo, "data", "drafts")
        names = sorted(f for f in os.listdir(drafts_dir)
                       if f.endswith(".json") and not f.startswith("_")) if os.path.isdir(drafts_dir) else []
        for name in names:
            stem = name[:-5]
            try:
                raw = load_json(os.path.join(drafts_dir, name))
            except ValueError:
                continue
            fill = (raw.get("labels") or {}).get("de") or stem
            named = len(raw.get("variants") or []) > 1
            for holder in [raw] + (list(raw.get("variants") or []) if named else []):
                labels = holder.setdefault("labels", {})
                for lang in langs:
                    if not (labels.get(lang) or "").strip():
                        labels[lang] = fill
            for holder in list(raw.get("variants") or []):
                for part in holder.get("parts") or []:
                    pl = part.setdefault("labels", {})
                    for lang in langs:
                        if not (pl.get(lang) or "").strip():
                            pl[lang] = part.get("id", fill)
            problems = check_item(raw, stem, containers, index, date, today, langs,
                                  require_signature=False, places=places)
            if problems:
                report["excluded"].append((stem + " (черновик)", problems))
                continue
            raw = {k: v for k, v in raw.items() if not k.startswith("_")}
            raw["unverified"] = True
            items.append(raw)
            report["included"].append(stem + " (черновик)")

    i18n, fatal = load_i18n(repo)
    report["fatal"].extend(fatal)

    # Финал и сообщения подписываются так же, как предметы: без подписи они
    # попадают только на стенд. В выпуск без них игра заканчивается после
    # пятой ступени, а не показывает непроверенные даты.
    finale, problems = load_finale(repo, langs)
    if problems:
        report["excluded"].append(("финал", problems))
        finale = None
    elif finale is not None and not signed(finale.get("sources")):
        if fixtures:
            finale["unverified"] = True
            report["included"].append("финал (черновик)")
        else:
            report["excluded"].append(("финал", ["источники финала никем не подписаны"]))
            finale = None

    notices, problems = load_notices(repo, date, langs)
    if problems:
        report["excluded"].append(("сообщения", problems))
        notices = None
    elif notices is not None and not signed([notices.get("_source") or {}]) and not fixtures:
        report["excluded"].append(("сообщения", ["источник сообщений никем не подписан"]))
        notices = None
    if notices is not None:
        notices.pop("_source", None)

    if report["fatal"]:
        return None, report

    content = {
        "built": today.isoformat(),
        "source_snapshot": os.path.basename(snap_path),
        "fixture": bool(fixtures),
        "places": places,
        "items": items,
        "i18n": i18n,
        "finale": finale,
        "notices": notices,
        "art": list_art(repo),
    }
    return content, report


def print_report(report, date):
    if report["fatal"]:
        print("сборка невозможна:")
        for f in report["fatal"]:
            print("  ", f)
        return 2
    print("дата сборки: %s   снимок: %s" % (date.isoformat(), report.get("snapshot")))
    print("в сборке предметов: %d" % len(report["included"]))
    if report["excluded"]:
        print("исключено: %d" % len(report["excluded"]))
        for stem, problems in report["excluded"]:
            print("  %s:" % stem)
            for p in problems:
                print("     %s" % p)
    if report["warnings"]:
        print("предупреждения:")
        for w in report["warnings"]:
            print("  ", w)
    if not report["excluded"] and not report["warnings"]:
        print("замечаний нет")
    return 1 if (report["excluded"] or report["warnings"]) else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", default=None, help="дата, на которую собираем (ГГГГ-ММ-ДД)")
    ap.add_argument("--check", action="store_true", help="только проверить, ничего не писать")
    ap.add_argument("--repo", default=REPO, help="корень репозитория")
    ap.add_argument("--fixtures", action="store_true",
                    help="добавить неподписанные черновики — только для разработки движка, "
                         "такую сборку publish.py не выложит")
    a = ap.parse_args()

    date = iso(a.date) if a.date else datetime.date.today()
    content, report = build(a.repo, date, fixtures=a.fixtures)
    code = print_report(report, date)
    if content is None or a.check:
        return code

    out_dir = os.path.join(a.repo, "dist")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "content.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=2)
    print("записано: %s" % os.path.relpath(out, a.repo))

    # dist — это ровно то, что уедет на сервер: движок рядом с данными, теми же
    # путями. Иначе игра в разработке и игра на домене расходятся в мелочах,
    # которые видно только в проде.
    game = os.path.join(a.repo, "game")
    if os.path.isdir(game):
        files = []
        for base, _, names in os.walk(game):
            if os.sep + "test" in base:
                continue
            for name in names:
                if name.startswith(".") or name.endswith(".test.html"):
                    continue
                files.append(os.path.join(base, name))
        version = version_of(sorted(files))
        # Папки движка собираются заново: файл, удалённый из game/, иначе так и
        # лежал бы в dist/ и уехал бы на сервер. Юридические страницы лежат в
        # корне dist/, рядом, и их это не касается.
        for name in os.listdir(game):
            stale = os.path.join(out_dir, name)
            if name != "test" and os.path.isdir(os.path.join(game, name)) and os.path.isdir(stale):
                shutil.rmtree(stale)
        copied = 0
        for src in files:
            dst = os.path.join(out_dir, os.path.relpath(src, game))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if src.endswith((".js", ".html", ".css")):
                with open(src, encoding="utf-8") as f:
                    text = stamp(f.read(), version)
                with open(dst, "w", encoding="utf-8") as f:
                    f.write(text)
            else:
                shutil.copy2(src, dst)
            copied += 1
        # Версия попадает и в content.json: по ней игра помечает адреса рисунков.
        content["version"] = version
        with open(out, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        print("движок скопирован: %d файлов, версия %s" % (copied, version))
    if a.fixtures:
        print("ВНИМАНИЕ: в сборке есть неподписанные черновики. Это стенд для разработки,")
        print("          выкладывать его нельзя — publish.py откажется.")
    return code


if __name__ == "__main__":
    sys.exit(main())
