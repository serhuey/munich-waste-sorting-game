#!/usr/bin/env python3
"""
Выкладка собранной игры в репозиторий сайта.

    python3 publish.py --dry-run     # показать, что будет скопировано
    python3 publish.py               # скопировать dist/ -> portfolio-site/muell/

Что делает: копирует содержимое dist/ в папку muell/ репозитория сайта,
удаляя из неё файлы, которых в dist/ больше нет.

Чего НЕ делает намеренно: не коммитит и не пушит. Пуш в main репозитория
сайта публикует на живой домен без стейджинга и ревью — это действие автора,
а не скрипта. Скрипт печатает оставшиеся шаги и на этом заканчивается.
"""

import argparse, filecmp, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DIST = os.path.join(REPO, "dist")
SITE = os.environ.get("PORTFOLIO_SITE", os.path.expanduser("~/portfolio-site"))
TARGET_NAME = "muell"


def walk(root):
    for base, _, files in os.walk(root):
        for f in files:
            if f == ".DS_Store":
                continue
            p = os.path.join(base, f)
            yield os.path.relpath(p, root)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="только показать план")
    ap.add_argument("--site", default=SITE, help="путь к репозиторию portfolio-site")
    a = ap.parse_args()

    if not os.path.isdir(DIST):
        sys.exit("нет %s — сначала собери контент: python3 tools/build_data.py" % DIST)
    if not os.path.isdir(os.path.join(a.site, ".git")):
        sys.exit("не похоже на репозиторий сайта: %s\n"
                 "  укажи путь через --site или PORTFOLIO_SITE" % a.site)

    target = os.path.join(a.site, TARGET_NAME)
    src_files = set(walk(DIST))
    dst_files = set(walk(target)) if os.path.isdir(target) else set()

    new     = sorted(f for f in src_files - dst_files)
    gone    = sorted(f for f in dst_files - src_files)
    changed = sorted(f for f in src_files & dst_files
                     if not filecmp.cmp(os.path.join(DIST, f),
                                        os.path.join(target, f), shallow=False))

    for label, files in (("новые", new), ("изменены", changed), ("удаляются", gone)):
        if files:
            print("%s (%d):" % (label, len(files)))
            for f in files[:20]:
                print("   ", f)
            if len(files) > 20:
                print("    … ещё %d" % (len(files) - 20))
    if not (new or changed or gone):
        print("изменений нет")
        return 0
    if a.dry_run:
        print("\n--dry-run: ничего не тронуто")
        return 0

    for f in new + changed:
        dst = os.path.join(target, f)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(DIST, f), dst)
    for f in gone:
        os.remove(os.path.join(target, f))
        d = os.path.dirname(os.path.join(target, f))
        while d != target and not os.listdir(d):
            os.rmdir(d); d = os.path.dirname(d)

    print("\nскопировано в %s" % target)
    print("дальше — руками, в репозитории сайта:")
    print("  1. git add %s/ && git commit" % TARGET_NAME)
    print("  2. git push origin main   # это публикует на живой домен")
    print("  3. подожди 30–120 секунд, проверь https://muell.sergei-grieg.de")
    return 0


if __name__ == "__main__":
    sys.exit(main())
