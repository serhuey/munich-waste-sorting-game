#!/usr/bin/env python3
"""
Снимок мюнхенского Abfalllexikon и диф между снимками.

Только стандартная библиотека — ставить ничего не нужно.

    python3 awm_lexikon.py fetch                 # скачать и разобрать в снимок
    python3 awm_lexikon.py fetch --details       # + пройти страницы деталей (медленно, вежливо)
    python3 awm_lexikon.py diff old.json new.json
    python3 awm_lexikon.py diff --latest         # два последних снимка в data/

Снимки: data/lexikon-YYYY-MM-DD.json
Сырой HTML первого запуска: data/raw-YYYY-MM-DD.html — посмотреть глазами,
если разбор выглядит странно.

ВАЖНО. Это вспомогательный инструмент, а не источник истины для игры.
Снимок нужен, чтобы (1) ловить изменения, (2) проверять, что ни один предмет
в игре не расходится с AWM, (3) искать контринтуитивные записи под уровни.
Наполнять игру всеми записями не нужно и вредно.

О разборе. Мы привязываемся к классам разметки AWM (eintrag_card на индексе,
wegwerfen_card на страницах деталей), а не собираем ссылки со страницы подряд.
Так было в первой версии, и это давало ложные данные: в шапке сайта есть ссылки
на Wertstoffhof, Wertstoffinsel, Mülltonnen и Sperrmüll, поэтому каждая запись
получала один и тот же набор адресатов. Тихо неправильный снимок хуже, чем
никакого: он выглядит как проверка, а проверкой не является. Если AWM сменит
вёрстку, разбор упадёт до нуля записей и заорёт — это осознанный размен.
"""

import argparse, datetime, hashlib, json, os, re, sys, time, urllib.error, urllib.request
from html.parser import HTMLParser

BASE = "https://www.awm-muenchen.de"
INDEX = BASE + "/abfall-entsorgen/abfalllexikon"
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
UA = "awm-sorting-game/0.1 (educational, non-commercial; contact: sergei.grieg@gmail.com)"
DELAY = 1.0  # секунд между запросами к страницам деталей

DETAIL_MARK = "/abfalllexikon/detailansicht-lexikoneintrag/"

# Подпись адресата у AWM -> идентификатор в игре.
# Ключ — нормализованный текст ссылки (индекс) или заголовка карточки (детали).
DESTINATIONS = {
    "restmülltonne": "restmuell",
    "restmüll": "restmuell",
    "biotonne": "bio",
    "bioabfall": "bio",
    "papiertonne": "papier",
    "papiertonnen": "papier",
    "wertstoffhof": "wertstoffhof",
    "wertstoffhöfe": "wertstoffhof",
    "wertstoffinsel": "wertstoffinsel",
    "wertstoffinseln": "wertstoffinsel",
    "wertstoffmobil": "wertstoffmobil",
    "altkleidercontainer": "altkleider",
    "sperrmüll": "sperrmuell",
    "sperrmüllabholung": "sperrmuell",
    "containerdienst": "containerdienst",
    "halle 2": "halle2",
    "problemabfall": "problemabfall",
    "problemabfälle": "problemabfall",
    "problemstoffe": "problemabfall",
    "giftmobil": "problemabfall",
    "christbaum": "christbaum",
    "christbaumentsorgung": "christbaum",
    "entsorgungspark freimann": "entsorgungspark",
    # AWM предлагает повторное использование раньше выбрасывания — это маршрут, а не бак.
    "weiternutzen": "weiternutzen",
    # 1 января 2027: появится здесь сама, и попадёт в диф как новый адресат.
    "gelbe tonne": "gelbe_tonne",
}

# Не-адресаты: ссылки этого вида встречаются рядом с записями, но местом не являются.
IGNORED_LABELS = {"mehr infos", "weitere informationen", "hier", "zum formular"}

unknown_labels = {}   # подпись -> сколько раз встретилась; печатается в конце прогона


def norm(s):
    """Нормализация подписи: без переносов, без хвостовых скобок, в нижнем регистре."""
    s = re.sub(r"\s+", " ", (s or "")).strip().lower()
    s = re.sub(r"\s*\(.*?\)\s*$", "", s)       # "Halle 2 (gut erhaltenes)" -> "halle 2"
    return s.strip(" .,;:")


def classify(label):
    """Подпись -> идентификатор адресата. Неизвестное не выбрасываем, а считаем."""
    k = norm(label)
    if not k or k in IGNORED_LABELS:
        return None
    if k in DESTINATIONS:
        return DESTINATIONS[k]
    unknown_labels[k] = unknown_labels.get(k, 0) + 1
    return "?" + re.sub(r"[^a-zà-ÿ0-9]+", "-", k).strip("-")


def absolute(href):
    if href.startswith("http"):
        return href
    return BASE + ("" if href.startswith("/") else "/") + href


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "de"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8", "replace")
    except urllib.error.URLError as ex:
        if "CERTIFICATE_VERIFY_FAILED" in str(ex):
            raise SystemExit(
                "TLS: у этого Python нет корневых сертификатов.\n"
                "  Питон с python.org: выполнить один раз\n"
                "    /Applications/Python\\ 3.x/Install\\ Certificates.command\n"
                "  Либо запустить скрипт другим интерпретатором, например\n"
                "    /opt/homebrew/bin/python3 awm_lexikon.py fetch"
            )
        raise


def has_class(attrs, *names):
    cls = (dict(attrs).get("class") or "").split()
    return any(n in cls for n in names)


class Blocks(HTMLParser):
    """
    Разбор блоков по классу с учётом вложенности.

    Наследник объявляет START_CLASSES: класс -> имя блока. Пока блок открыт,
    все события уходят в self.cur; закрывается блок на своём же уровне вложенности.
    """
    START_CLASSES = {}
    BLOCK_TAG = "div"

    def __init__(self):
        super().__init__()
        self.depth = 0
        self.cur = None
        self.open_at = None
        self.blocks = []

    def handle_starttag(self, tag, attrs):
        if tag == self.BLOCK_TAG:
            self.depth += 1
            if self.cur is None:
                for cls, name in self.START_CLASSES.items():
                    if has_class(attrs, cls):
                        self.cur = {"kind": name, "events": []}
                        self.open_at = self.depth
                        return
        if self.cur is not None:
            self.cur["events"].append(("start", tag, dict(attrs)))

    def handle_startendtag(self, tag, attrs):
        if self.cur is not None:
            self.cur["events"].append(("start", tag, dict(attrs)))

    def handle_endtag(self, tag):
        if self.cur is not None:
            self.cur["events"].append(("end", tag, None))
        if tag == self.BLOCK_TAG:
            if self.cur is not None and self.depth == self.open_at:
                self.blocks.append(self.cur)
                self.cur, self.open_at = None, None
            self.depth -= 1

    def handle_data(self, data):
        if self.cur is not None and data.strip():
            self.cur["events"].append(("text", data, None))


def block_text(events, start=0, stop=None):
    return re.sub(r"\s+", " ", "".join(
        e[1] for e in events[start:stop] if e[0] == "text")).strip()


class IndexBlocks(Blocks):
    """Индекс лексикона: одна запись — один div.eintrag_card."""
    START_CLASSES = {"eintrag_card": "entry"}


def parse_index(html):
    p = IndexBlocks()
    p.feed(html)
    entries = []
    for b in p.blocks:
        ev = b["events"]
        term, tip, detail_url, labels = None, None, None, []
        cap = None             # что сейчас пишем: term | tip
        in_dest = 0            # глубина внутри entsorgung_wrapper
        depth = 0
        link_href, link_buf, link_open = None, [], False
        for kind, a, attrs in ev:
            if kind == "start" and a == "div":
                depth += 1
                if has_class(list(attrs.items()), "entsorgung_wrapper"):
                    in_dest = depth
            elif kind == "end" and a == "div":
                if in_dest == depth:
                    in_dest = 0
                depth -= 1
            elif kind == "start" and a == "span":
                cls = attrs.get("class", "")
                if "autocomplete_src" in cls:
                    cap, term = "term", ""      # текст этого span — название записи
                elif "infovalue" in cls:
                    cap, tip = "tip", ""        # подсказка AWM рядом с записью
            elif kind == "end" and a == "span":
                cap = None
            elif kind == "start" and a == "a":
                link_href, link_buf, link_open = attrs.get("href", ""), [], True
            elif kind == "end" and a == "a" and link_open:
                text = re.sub(r"\s+", " ", "".join(link_buf)).strip()
                if DETAIL_MARK in link_href:
                    detail_url = absolute(link_href)
                elif in_dest and text:
                    labels.append(text)
                link_href, link_buf, link_open = None, [], False
            elif kind == "text":
                if link_open:
                    link_buf.append(a)
                elif cap == "term":
                    term = (term or "") + a
                elif cap == "tip":
                    tip = (tip or "") + a

        term = re.sub(r"\s+", " ", term).strip() if term else None
        tip = re.sub(r"\s+", " ", tip).strip() or None if tip else None
        if not term:
            # у записи с деталями название лежит внутри ссылки
            t = block_text(ev)
            term = re.sub(r"Entsorgungsdetails\s*$", "", t).strip() or None
        if not term:
            continue
        dests = []
        for lab in labels:
            d = classify(lab)
            if d and d not in dests:
                dests.append(d)
        entries.append({
            "term": term,
            "destinations": dests,
            "labels": labels,
            "tip": tip,
            "notes": {},
            "detail_url": detail_url,
        })
    return entries


class DetailBlocks(Blocks):
    """Страница деталей: каждый адресат — своя карточка div.wegwerfen_card."""
    START_CLASSES = {"wegwerfen_card": "card"}


def parse_detail(html):
    """-> [(подпись адресата, пояснение AWM)]"""
    p = DetailBlocks()
    p.feed(html)
    out = []
    for b in p.blocks:
        ev = b["events"]
        title, note, mode, dep = None, [], None, 0
        for kind, a, attrs in ev:
            if kind == "start" and a == "h3" and (attrs.get("class") or "").find("titel") >= 0:
                mode, title = "title", ""
            elif kind == "start" and a == "div":
                dep += 1
                if (attrs.get("class") or "").find("description") >= 0:
                    mode, note = "note", []
            elif kind == "end" and a == "div":
                if mode == "note" and dep:
                    mode = None
                dep -= 1
            elif kind == "end" and a == "h3" and mode == "title":
                mode = None
            elif kind == "text":
                if mode == "title":
                    title = (title or "") + a
                elif mode == "note":
                    note.append(a)
        title = re.sub(r"\s+", " ", title or "").strip()
        if title:
            out.append((title, re.sub(r"\s+|\xa0", " ", "".join(note)).strip()))
    return out


def enrich_details(entries, limit=None):
    todo = [e for e in entries if e.get("detail_url") and not e["destinations"]]
    if limit:
        todo = todo[:limit]
    empty = []
    for i, e in enumerate(todo, 1):
        try:
            html = fetch(e["detail_url"])
        except SystemExit:
            raise
        except Exception as ex:
            e["error"] = str(ex)
            continue
        cards = parse_detail(html)
        if not cards:
            empty.append(e["term"])
        for label, note in cards:
            e["labels"].append(label)
            d = classify(label)
            if d and d not in e["destinations"]:
                e["destinations"].append(d)
            if d and note:
                e["notes"][d] = note
        sys.stderr.write("\r  детали %d/%d  %-40s" % (i, len(todo), e["term"][:40]))
        sys.stderr.flush()
        time.sleep(DELAY)
    sys.stderr.write("\n")
    if empty:
        print("  ⚠ страниц деталей без карточек адресатов: %d (%s)"
              % (len(empty), ", ".join(empty[:5])))


def snapshot(entries, source_url):
    for e in entries:
        e["key"] = re.sub(r"[^a-z0-9]+", "-", e["term"].lower()).strip("-")
        e["fingerprint"] = hashlib.sha1(
            (e["key"] + "|" + ",".join(sorted(e["destinations"]))).encode()
        ).hexdigest()[:12]
    return {
        "source": source_url,
        "fetched": datetime.date.today().isoformat(),
        "count": len(entries),
        "note": "Снимок для сверки и дифа. Не источник контента игры — контент отбирается вручную.",
        "entries": sorted(entries, key=lambda e: e["key"]),
    }


def cmd_fetch(args):
    os.makedirs(DATA, exist_ok=True)
    today = datetime.date.today().isoformat()
    html = fetch(INDEX)
    raw = os.path.join(DATA, "raw-%s.html" % today)
    with open(raw, "w", encoding="utf-8") as f:
        f.write(html)
    entries = parse_index(html)
    print("разобрано записей: %d  (сырой html: %s)" % (len(entries), raw))
    if len(entries) < 100:
        print("  ⚠ подозрительно мало. Разбор привязан к классу eintrag_card —")
        print("    скорее всего AWM сменил вёрстку. Загляни в сырой html.")
    if args.details:
        enrich_details(entries, args.limit)
    out = os.path.join(DATA, "lexikon-%s.json" % today)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(snapshot(entries, INDEX), f, ensure_ascii=False, indent=2)
    print("снимок: %s" % out)
    no_dest = [e["term"] for e in entries if not e["destinations"]]
    if no_dest:
        print("без адресатов (нужны --details): %d, например %s"
              % (len(no_dest), ", ".join(no_dest[:5])))
    if unknown_labels:
        print("незнакомые подписи адресатов (%d) — проверить и внести в DESTINATIONS:"
              % len(unknown_labels))
        for lab, n in sorted(unknown_labels.items(), key=lambda kv: -kv[1])[:15]:
            print("  %4d× %s" % (n, lab))


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def cmd_diff(args):
    if args.latest:
        files = sorted(f for f in os.listdir(DATA) if f.startswith("lexikon-"))
        if len(files) < 2:
            sys.exit("нужно минимум два снимка в %s" % DATA)
        a, b = (os.path.join(DATA, files[-2]), os.path.join(DATA, files[-1]))
    else:
        a, b = args.old, args.new
    old, new = load(a), load(b)
    o = {e["key"]: e for e in old["entries"]}
    n = {e["key"]: e for e in new["entries"]}

    added   = [n[k] for k in n if k not in o]
    removed = [o[k] for k in o if k not in n]
    changed = [(o[k], n[k]) for k in n if k in o and o[k]["fingerprint"] != n[k]["fingerprint"]]

    print("%s  →  %s" % (os.path.basename(a), os.path.basename(b)))
    print("записей: %d → %d" % (old["count"], new["count"]))
    print()
    if changed:
        print("ИЗМЕНИЛИСЬ (%d) — требуют ручной пересверки:" % len(changed))
        for x, y in changed:
            print("  %s" % y["term"])
            print("     было: %s" % ", ".join(x["destinations"]))
            print("     стало: %s" % ", ".join(y["destinations"]))
        print()
    if added:
        print("ДОБАВЛЕНЫ (%d): %s" % (len(added), ", ".join(e["term"] for e in added[:20])))
        print()
    if removed:
        print("ИСЧЕЗЛИ (%d): %s" % (len(removed), ", ".join(e["term"] for e in removed[:20])))
        print()
    if not (changed or added or removed):
        print("изменений нет")
    return 1 if changed else 0


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fetch", help="скачать индекс и сохранить снимок")
    f.add_argument("--details", action="store_true",
                   help="дополнительно пройти страницы деталей (по одной в секунду)")
    f.add_argument("--limit", type=int, default=None,
                   help="ограничить число страниц деталей (для пробы)")
    f.set_defaults(func=cmd_fetch)

    d = sub.add_parser("diff", help="сравнить два снимка")
    d.add_argument("old", nargs="?"); d.add_argument("new", nargs="?")
    d.add_argument("--latest", action="store_true", help="два последних снимка в data/")
    d.set_defaults(func=cmd_diff)

    a = p.parse_args()
    sys.exit(a.func(a) or 0)


if __name__ == "__main__":
    main()
