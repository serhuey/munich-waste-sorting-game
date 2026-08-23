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
"""

import argparse, datetime, hashlib, json, os, re, sys, time, urllib.request
from html.parser import HTMLParser

BASE = "https://www.awm-muenchen.de"
INDEX = BASE + "/abfall-entsorgen/abfalllexikon"
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
UA = "awm-sorting-game/0.1 (educational, non-commercial; contact: sergei.grieg@gmail.com)"
DELAY = 1.0  # секунд между запросами к страницам деталей

# href-фрагмент -> идентификатор адресата в игре
DESTINATIONS = {
    "/muelltonnen/fuer-haushalte": "hausmuell",       # Restmüll/Papier/Bio — уточняется по тексту ссылки
    "/abgabestellen/wertstoffinseln": "wertstoffinsel",
    "/abgabestellen/wertstoffhoefe": "wertstoffhof",
    "/services/sperrmuellabholung": "sperrmuell",
    "/abgabestellen/christbaumentsorgung": "christbaum",
    "/services/problemabfall": "problemabfall",
}
# текст ссылки -> уточнение домашнего бака
HOME_BINS = {
    "restmülltonne": "restmuell",
    "papiertonne": "papier",
    "biotonne": "bio",
}
DETAIL_MARK = "/abfalllexikon/detailansicht-lexikoneintrag/"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "de"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


class Collector(HTMLParser):
    """
    Разметку AWM мы не знаем наперёд, поэтому не привязываемся к классам и тегам.
    Собираем плоский поток событий: текст и ссылки. Записи восстанавливаем потом
    по правилу «текст, за которым идёт кластер ссылок на адресаты».
    """
    def __init__(self):
        super().__init__()
        self.stream = []          # ("text", s) | ("link", href, text)
        self._href = None
        self._buf = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href", "")
            self._buf = []
        elif tag in ("script", "style"):
            self._skip = True

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            self.stream.append(("link", self._href, "".join(self._buf).strip()))
            self._href, self._buf = None, []

    def handle_data(self, data):
        s = data.strip()
        if not s:
            return
        if self._href is not None:
            self._buf.append(data)
        else:
            self.stream.append(("text", s))


def absolute(href):
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return BASE + href
    return BASE + "/" + href


def classify(href, text):
    for frag, dest in DESTINATIONS.items():
        if frag in href:
            if dest == "hausmuell":
                return HOME_BINS.get(text.strip().lower(), "hausmuell")
            return dest
    return None


def parse_index(html):
    c = Collector()
    c.feed(html)
    entries, pending_text, current = [], None, None

    def flush():
        nonlocal current
        if current and current["destinations"]:
            entries.append(current)
        current = None

    for ev in c.stream:
        if ev[0] == "text":
            txt = ev[1]
            # длинные абзацы — это обвязка страницы, не названия предметов
            if len(txt) > 120:
                continue
            if current and current["destinations"]:
                flush()
            pending_text = txt
        else:
            _, href, text = ev
            if DETAIL_MARK in href:
                # у записи есть отдельная страница деталей; имя внутри текста ссылки
                name = re.sub(r"Entsorgungsdetails\s*$", "", text).strip() or pending_text
                flush()
                entries.append({
                    "term": name,
                    "destinations": [],
                    "detail_url": absolute(href),
                    "tip": None,
                })
                pending_text = None
                continue
            dest = classify(href, text)
            if dest is None:
                continue
            if current is None:
                name, tip = pending_text or "", None
                if name and "Tipp:" in name:
                    name, tip = [p.strip() for p in name.split("Tipp:", 1)]
                current = {"term": name, "destinations": [], "detail_url": None, "tip": tip}
            if dest not in current["destinations"]:
                current["destinations"].append(dest)
    flush()

    # чистка: без имени запись бесполезна
    return [e for e in entries if e.get("term")]


def enrich_details(entries, limit=None):
    todo = [e for e in entries if e.get("detail_url") and not e["destinations"]]
    if limit:
        todo = todo[:limit]
    for i, e in enumerate(todo, 1):
        try:
            html = fetch(e["detail_url"])
        except Exception as ex:
            e["error"] = str(ex)
            continue
        c = Collector(); c.feed(html)
        for ev in c.stream:
            if ev[0] != "link":
                continue
            d = classify(ev[1], ev[2])
            if d and d not in e["destinations"]:
                e["destinations"].append(d)
        sys.stderr.write("\r  детали %d/%d  %-40s" % (i, len(todo), e["term"][:40]))
        sys.stderr.flush()
        time.sleep(DELAY)
    sys.stderr.write("\n")


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
        print("  ⚠ подозрительно мало. Загляни в сырой html — возможно, список")
        print("    догружается скриптом или разметка изменилась.")
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
