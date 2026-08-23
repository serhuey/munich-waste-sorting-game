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

import argparse, datetime, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

LANGS = ("de", "en")
ATTRS = {"borderline", "examine", "separable"}
AUTHORITIES = {"awm", "law"}
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


def check_variant(v, where, containers, date, problems, langs):
    kind = v.get("kind")
    check_text_map(v.get("labels"), where + " labels", problems, langs)
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
            check_destinations(part.get("destinations"), pw, containers, date, problems)
    else:
        problems.append("%s: kind должен быть simple или composite, а не %r" % (where, kind))


def check_source(source, snapshot_index, today, problems, where="source"):
    if not isinstance(source, dict):
        problems.append("нет блока %s" % where)
        return
    authority = source.get("authority")
    if authority not in AUTHORITIES:
        problems.append("%s.authority должен быть awm или law, а не %r" % (where, authority))
    if not isinstance(source.get("url"), str) or not source["url"].startswith("http"):
        problems.append("%s.url отсутствует или не похож на ссылку" % where)
    if not isinstance(source.get("verified_by"), str) or not source["verified_by"].strip():
        problems.append("%s.verified_by пуст — предмет никто не сверял" % where)

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

    if authority == "law":
        if not isinstance(source.get("reference"), str) or not source["reference"].strip():
            problems.append("для authority=law нужен %s.reference с нормой закона" % where)
        if source.get("key"):
            problems.append("для authority=law поле %s.key лишнее: закон не лежит в лексиконе" % where)
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


def check_item(raw, stem, containers, snapshot_index, date, today, langs=LANGS):
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
    check_text_map(raw.get("explanation"), "explanation", problems, langs)
    check_source(raw.get("source"), snapshot_index, today, problems)
    extra = raw.get("sources", [])
    if not isinstance(extra, list):
        problems.append("sources должен быть списком дополнительных источников")
    else:
        for i, src in enumerate(extra):
            check_source(src, snapshot_index, today, problems, "sources[%d]" % i)

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
        check_variant(v, where, containers, date, problems, langs)

    if len(variants) > 1 and "examine" not in attrs:
        problems.append("у предмета больше одного варианта, но нет атрибута examine — "
                        "игрок не сможет их различить (R4)")
    if any(v.get("kind") == "composite" for v in variants) and "separable" not in attrs:
        problems.append("есть составной вариант, но нет атрибута separable (R5)")
    return problems


def build(repo, date, today=None, langs=LANGS):
    today = today or datetime.date.today()
    report = {"included": [], "excluded": [], "warnings": [], "fatal": []}

    places, containers, fatal = load_places(repo)
    report["fatal"].extend(fatal)
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
        problems = check_item(raw, stem, containers, index, date, today, langs)
        if problems:
            report["excluded"].append((stem, problems))
            continue
        # тот же предмет на дату перехода: не исключаем, но предупреждаем
        future = check_item(raw, stem, containers, index, iso(FUTURE_PROBE), today, langs)
        for p in future:
            if p not in problems and "не действует" in p:
                report["warnings"].append("%s: после %s %s" % (stem, FUTURE_PROBE, p))
        raw = {k: v for k, v in raw.items() if not k.startswith("_")}
        items.append(raw)
        report["included"].append(stem)

    content = {
        "built": today.isoformat(),
        "source_snapshot": os.path.basename(snap_path),
        "places": places,
        "items": items,
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
    a = ap.parse_args()

    date = iso(a.date) if a.date else datetime.date.today()
    content, report = build(a.repo, date)
    code = print_report(report, date)
    if content is None or a.check:
        return code

    out_dir = os.path.join(a.repo, "dist")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "content.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=2)
    print("записано: %s" % os.path.relpath(out, a.repo))
    return code


if __name__ == "__main__":
    sys.exit(main())
