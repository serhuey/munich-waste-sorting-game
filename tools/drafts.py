#!/usr/bin/env python3
"""
Очередь на сверку: заготовки предметов и перенос готовых в игру.

    python3 drafts.py new zeitung-zeitschrift-illustrierte --tier 1
    python3 drafts.py list
    python3 drafts.py promote zeitung

Заготовка лежит в data/drafts/ и в сборку не попадает. В ней уже заполнено то,
что машина знает из снимка: ключ лексикона, ссылка, немецкое название, подсказка
AWM и адресаты, которые снимок видит сегодня. Не заполнено то, что знать может
только человек: куда предмет идёт в игре и что об этом сказать игроку.

Честная граница: этот скрипт не заменяет чтение источника. Гейт проверяет
утверждение о сверке (verified_by и verified_on), а не сам факт чтения —
поставить дату, не открыв страницу, технически возможно. Смысл в том, что
подпись под утверждением ставит человек.
"""

import argparse, datetime, importlib.util, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DRAFTS = os.path.join(REPO, "data", "drafts")
ITEMS = os.path.join(REPO, "data", "items")

spec = importlib.util.spec_from_file_location("build_data", os.path.join(HERE, "build_data.py"))
bd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bd)

TODO = [
    "открыть source.url и прочитать запись целиком",
    "вписать destinations в каждом варианте — это адресаты игры, а не AWM",
    "написать explanation: почему так, на de и en",
    "заполнить labels.en",
    "поставить source.verified_by и source.verified_on",
    "перенести: python3 tools/drafts.py promote <id>",
]


def snapshot_index():
    path, data = bd.newest_snapshot(REPO)
    if data is None:
        sys.exit("нет снимка лексикона в data/verified/")
    return path, {e["key"]: e for e in data["entries"]}


def cmd_new(a):
    path, index = snapshot_index()
    entry = index.get(a.key)
    if entry is None:
        near = [k for k in index if a.key.split("-")[0] in k][:8]
        sys.exit("ключа %s нет в %s%s" % (a.key, os.path.basename(path),
                                          ("\n  похожие: " + ", ".join(near)) if near else ""))
    item_id = a.id or entry["key"].split("-")[0]
    os.makedirs(DRAFTS, exist_ok=True)
    dest = os.path.join(DRAFTS, item_id + ".json")
    if os.path.exists(dest) and not a.force:
        sys.exit("уже есть %s — --force, если правда нужно перезаписать" % dest)

    draft = {
        "_todo": TODO,
        "_awm_term": entry["term"],
        "_awm_tip": entry.get("tip"),
        "_awm_notes": entry.get("notes") or {},
        "id": item_id,
        "tier": a.tier,
        "attrs": a.attrs.split(",") if a.attrs else [],
        "labels": {"de": entry["term"], "en": ""},
        "source": {
            "authority": "awm",
            "key": entry["key"],
            "url": entry.get("detail_url") or bd.load_json(path)["source"],
            "destinations_at_verification": entry["destinations"],
            "verified_by": "",
            "verified_on": "",
        },
        "variants": [
            {"id": "standard", "kind": "simple",
             "labels": {"de": "", "en": ""}, "destinations": []}
        ],
        "explanation": {"de": "", "en": ""},
    }
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(draft, f, ensure_ascii=False, indent=2)
    print("заготовка: data/drafts/%s.json   (%s)" % (item_id, entry["term"]))
    return 0


def missing_bits(raw):
    out = []
    src = raw.get("source") or {}
    if not src.get("verified_on"):
        out.append("не сверен")
    if not src.get("verified_by"):
        out.append("нет подписи")
    for i, v in enumerate(raw.get("variants") or []):
        if v.get("kind") == "composite":
            for j, part in enumerate(v.get("parts") or []):
                if not part.get("destinations"):
                    out.append("вариант %d, часть %d без адресата" % (i, j))
        elif not v.get("destinations"):
            out.append("вариант %d без адресата" % i)
    if not (raw.get("explanation") or {}).get("de"):
        out.append("нет пояснения")
    return out


def cmd_list(a):
    if not os.path.isdir(DRAFTS):
        print("заготовок нет")
        return 0
    names = sorted(f for f in os.listdir(DRAFTS) if f.endswith(".json"))
    if not names:
        print("заготовок нет")
        return 0
    ready = 0
    print("%-22s %-6s %s" % ("предмет", "тир", "чего не хватает"))
    for name in names:
        raw = bd.load_json(os.path.join(DRAFTS, name))
        gaps = missing_bits(raw)
        if not gaps:
            ready += 1
        print("%-22s %-6s %s" % (name[:-5], raw.get("tier", "?"),
                                 ", ".join(gaps) if gaps else "готов к переносу"))
    print("\nвсего %d, готовы %d" % (len(names), ready))
    return 0


def cmd_promote(a):
    src = os.path.join(DRAFTS, a.id + ".json")
    if not os.path.exists(src):
        sys.exit("нет %s" % src)
    raw = bd.load_json(src)
    places, containers, fatal = bd.load_places(REPO)
    if fatal:
        sys.exit("\n".join(fatal))
    _, index = snapshot_index()
    today = datetime.date.today()
    problems = bd.check_item(raw, a.id, containers, index, today, today)
    if problems:
        print("не переношу, предмет не проходит проверку:")
        for p in problems:
            print("  ", p)
        return 1
    os.makedirs(ITEMS, exist_ok=True)
    shutil.move(src, os.path.join(ITEMS, a.id + ".json"))
    print("перенесено: data/items/%s.json" % a.id)
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    n = sub.add_parser("new", help="создать заготовку из записи лексикона")
    n.add_argument("key", help="ключ записи в снимке")
    n.add_argument("--tier", type=int, required=True)
    n.add_argument("--id", default=None, help="идентификатор предмета в игре")
    n.add_argument("--attrs", default="", help="borderline,examine,separable")
    n.add_argument("--force", action="store_true")
    n.set_defaults(func=cmd_new)

    l = sub.add_parser("list", help="показать очередь")
    l.set_defaults(func=cmd_list)

    p = sub.add_parser("promote", help="перенести готовую заготовку в data/items/")
    p.add_argument("id")
    p.set_defaults(func=cmd_promote)

    a = ap.parse_args()
    sys.exit(a.func(a) or 0)


if __name__ == "__main__":
    main()
