#!/usr/bin/env python3
"""
Локальный сервер для dist/ без кэша.

    python3 tools/serve.py            # http://127.0.0.1:8799
    python3 tools/serve.py --port 9000 --lan

Обычный `python3 -m http.server` не запрещает браузеру кэшировать файлы, и после
пересборки браузер может взять новый main.js и старый fall.js — игра ломается
так, будто ошибка в коде. Здесь каждый ответ помечен no-store.

--lan слушает все интерфейсы, чтобы открыть игру с телефона в той же сети.
"""

import argparse, functools, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8799)
    ap.add_argument("--lan", action="store_true", help="слушать все интерфейсы, не только 127.0.0.1")
    a = ap.parse_args()
    host = "0.0.0.0" if a.lan else "127.0.0.1"
    handler = functools.partial(NoCache, directory=os.path.join(REPO, "dist"))
    print("http://%s:%d/" % ("127.0.0.1" if not a.lan else "<IP этого Mac>", a.port))
    ThreadingHTTPServer((host, a.port), handler).serve_forever()


if __name__ == "__main__":
    main()
