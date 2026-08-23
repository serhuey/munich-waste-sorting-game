#!/usr/bin/env python3
"""
Подстановка личных данных в юридические страницы.

    python3 render_legal.py                 # legal/ + values.local.json -> dist/
    python3 render_legal.py --check         # только проверить, что всё заполнится

Зачем отдельный шаг. Impressum по §5 DDG обязан быть публичным на сайте, но
репозиторий игры публичный, а история коммитов вечная: адрес, указанный
сегодня, останется в ней и после переезда. Поэтому в репозитории лежат
шаблоны с {{ПЛЕЙСХОЛДЕРАМИ}}, значения — в legal/values.local.json, который
в .gitignore, а собранные страницы попадают только в dist/.

Незаполненный плейсхолдер — ошибка сборки, а не пустое место на странице.
"""

import argparse, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC = os.path.join(REPO, "legal")
OUT = os.path.join(REPO, "dist")
VALUES = os.path.join(SRC, "values.local.json")
PLACEHOLDER = re.compile(r"\{\{([A-Z_]+)\}\}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="не писать файлы, только проверить")
    a = ap.parse_args()

    if not os.path.exists(VALUES):
        sys.exit("нет %s\n  скопируй legal/values.example.json и впиши свои данные" % VALUES)
    with open(VALUES, encoding="utf-8") as f:
        values = {k: v for k, v in json.load(f).items() if not k.startswith("_")}

    pages = sorted(f for f in os.listdir(SRC) if f.endswith(".html"))
    if not pages:
        sys.exit("в %s нет html-страниц" % SRC)

    problems, rendered = [], {}
    for name in pages:
        with open(os.path.join(SRC, name), encoding="utf-8") as f:
            text = f.read()
        needed = set(PLACEHOLDER.findall(text))
        missing = sorted(k for k in needed if not values.get(k))
        for k in missing:
            problems.append("%s: не задано значение %s" % (name, k))
        text = PLACEHOLDER.sub(lambda m: values.get(m.group(1), m.group(0)), text)
        left = sorted(set(PLACEHOLDER.findall(text)))
        for k in left:
            problems.append("%s: плейсхолдер {{%s}} остался в результате" % (name, k))
        rendered[name] = text

    if problems:
        print("не собрано:")
        for p in problems:
            print("  ", p)
        return 1

    if a.check:
        print("проверка пройдена: %s — все значения на месте" % ", ".join(pages))
        return 0

    os.makedirs(OUT, exist_ok=True)
    for name, text in rendered.items():
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            f.write(text)
        print("собрано: dist/%s" % name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
