#!/usr/bin/env python3
"""
Локальная форма для сверки предметов.

    python3 verify_ui.py            # откроет http://127.0.0.1:8765 в браузере
    python3 verify_ui.py --port 9000 --no-open

Зачем: править JSON руками на несколько десятков предметов — это опечатки в
идентификаторах контейнеров, которые ловятся только сборкой. Здесь адресаты
показаны чекбоксами, построенными из data/places.json, поэтому несуществующий
контейнер выбрать нечем.

Что форма НЕ делает: не решает за вас. Кнопка подписи ставит ваше имя и
сегодняшнюю дату — ровно то же утверждение, что и вручную, и ровно так же
неверное, если страницу AWM вы не открывали.

Только стандартная библиотека. Слушает исключительно 127.0.0.1: это инструмент
рабочего стола, а не сервис.
"""

import argparse, datetime, importlib.util, json, os, shutil, sys, tempfile, threading, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DRAFTS = os.path.join(REPO, "data", "drafts")
ITEMS = os.path.join(REPO, "data", "items")

spec = importlib.util.spec_from_file_location("build_data", os.path.join(HERE, "build_data.py"))
bd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bd)


def draft_names():
    if not os.path.isdir(DRAFTS):
        return []
    return sorted(f[:-5] for f in os.listdir(DRAFTS)
                  if f.endswith(".json") and not f.startswith("_"))


def draft_path(item_id):
    return os.path.join(DRAFTS, item_id + ".json")


def load_draft(item_id):
    return bd.load_json(draft_path(item_id))


def save_draft(item_id, data):
    """Пишем через временный файл: обрыв на середине не оставит битый JSON."""
    fd, tmp = tempfile.mkstemp(dir=DRAFTS, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, draft_path(item_id))


def validate(item_id, raw):
    places, containers, fatal = bd.load_places(REPO)
    if fatal:
        return fatal
    path, snapshot = bd.newest_snapshot(REPO)
    index = {e["key"]: e for e in snapshot["entries"]} if snapshot else {}
    today = datetime.date.today()
    # places передаём обязательно: иначе форма не увидит недоступного на тире
    # адресата, а сборка увидит — и человек узнает об этом уже после подписи.
    return bd.check_item(raw, item_id, containers, index, today, today, places=places)


def state():
    places, containers, fatal = bd.load_places(REPO)
    queue = []
    for name in draft_names():
        raw = load_draft(name)
        src = raw.get("source") or {}
        signed = bool(src.get("verified_on") and src.get("verified_by"))
        queue.append({"id": name, "tier": raw.get("tier"), "signed": signed,
                      "term": (raw.get("labels") or {}).get("de") or name,
                      "problems": len(validate(name, raw))})
    return {
        "places": places or [],
        "queue": queue,
        "in_game": len([f for f in os.listdir(ITEMS) if f.endswith(".json")
                        and not f.startswith("_")]) if os.path.isdir(ITEMS) else 0,
        "other": [{"id": e["id"], "title": e["title"], "signed": e["signed"]} for e in other_entries()],
        "today": datetime.date.today().isoformat(),
        "fatal": fatal,
    }


def promote(item_id):
    raw = load_draft(item_id)
    problems = validate(item_id, raw)
    if problems:
        return {"ok": False, "problems": problems}
    os.makedirs(ITEMS, exist_ok=True)
    shutil.move(draft_path(item_id), os.path.join(ITEMS, item_id + ".json"))
    return {"ok": True}


# ----------------------------------------------------------------- «Прочее»
# Подписи вне очереди черновиков: состав мест, предметы в игре с новым
# неподписанным источником, финал, сообщения о 2027 годе. Каждый пункт — файл и
# список «слотов» подписи внутри него; форма показывает, что именно человек
# подтверждает, и записывает имя и дату в те же поля, что проверяет сборка.

PLACES_FILE = os.path.join(REPO, "data", "places.json")
FINALE_FILE = os.path.join(REPO, "data", "finale", "christbaum.json")
NOTICES_FILE = os.path.join(REPO, "data", "notices.json")


def _write_json(path, data):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def _de(m):
    return (m or {}).get("de") or (m or {}).get("en") or ""


def _container_names():
    places = bd.load_json(PLACES_FILE)["places"]
    return {c["id"]: _de(c["labels"]) for p in places for c in p["containers"]}


def _dests(holder, names):
    out = []
    for d in holder.get("destinations") or []:
        d = d if isinstance(d, dict) else {"id": d}
        tail = (" до %s" % d["until"]) if d.get("until") else (" с %s" % d["from"]) if d.get("from") else ""
        out.append(names.get(d["id"], d["id"]) + tail)
    return ", ".join(out)


def _window(w):
    """Окно так, как его читает человек: последний день включительно."""
    last = (bd.iso(w["until"]) - datetime.timedelta(days=1)).isoformat() if w.get("until") else "…"
    return "%s – %s" % (w.get("from", "…"), last)


def other_entries():
    """Всё, что ждёт подписи вне data/drafts/: id, заголовок, файл, слоты."""
    out = []
    # состав мест — одна подпись, поле confirmed_by
    src = bd.load_json(PLACES_FILE).get("_source") or {}
    out.append({"id": "places", "title": "Места и контейнеры", "file": PLACES_FILE,
                "slots": [["_source"]], "signed": bool((src.get("confirmed_by") or "").strip())})
    # предметы в игре, у которых хоть один источник без подписи
    for name in sorted(os.listdir(ITEMS)) if os.path.isdir(ITEMS) else []:
        if not name.endswith(".json") or name.startswith("_"):
            continue
        raw = bd.load_json(os.path.join(ITEMS, name))
        slots = [["source"]] + [["sources", i] for i in range(len(raw.get("sources") or []))]
        unsigned = [sl for sl in slots if not (_at(raw, sl).get("verified_by") or "").strip()]
        if unsigned:
            out.append({"id": "item:" + raw["id"], "title": "В игре: " + _de(raw.get("labels")),
                        "file": os.path.join(ITEMS, name), "slots": slots, "signed": False})
    for path, title in ((FINALE_FILE, "Финал: ёлка"), (NOTICES_FILE, "Сообщение о 2027 годе")):
        if not os.path.exists(path):
            continue
        raw = bd.load_json(path)
        slots = ([["sources", i] for i in range(len(raw.get("sources") or []))]
                 if path == FINALE_FILE else [["_source"]])
        signed = all((_at(raw, sl).get("verified_by") or "").strip() for sl in slots)
        out.append({"id": "finale" if path == FINALE_FILE else "notices", "title": title,
                    "file": path, "slots": slots, "signed": signed})
    return out


def _at(raw, slot):
    node = raw
    for k in slot:
        node = node[k]
    return node


def other_detail(entry_id):
    entry = next((e for e in other_entries() if e["id"] == entry_id), None)
    if entry is None:
        return None
    raw = bd.load_json(entry["file"])
    names = _container_names()
    summary, hints = [], []
    if entry_id == "places":
        hints.append(raw["_source"].get("note") or "")
        for p in raw["places"]:
            cs = ", ".join(_de(c["labels"]) + ((" с " + c["from"]) if c.get("from") else "")
                           + ((" до " + c["until"]) if c.get("until") else "") for c in p["containers"])
            summary.append("Тир %s · %s: %s" % (p["tier"], _de(p["labels"]), cs))
    elif entry_id.startswith("item:"):
        if raw.get("_changed_after_signature"):
            hints.append(raw["_changed_after_signature"])
        for v in raw["variants"]:
            for h in (v.get("parts") or [v]):
                label = _de(h.get("labels")) or _de(raw.get("labels"))
                summary.append("%s → %s" % (label, _dests(h, names)))
        summary.append("Пояснение: " + _de(raw.get("explanation")))
    elif entry_id == "finale":
        summary.append("Сезон " + raw.get("season", ""))
        for r in raw["routes"]:
            when = ("круглый год" if r.get("year_round") else "так нельзя" if r.get("illegal")
                    else "; ".join(_window(w) for w in r.get("windows") or []))
            summary.append("%s — %s. %s" % (_de(r["labels"]), when, _de(r.get("rule"))))
        summary.append("Сцены: " + ", ".join(raw.get("scenes") or []))
    elif entry_id == "notices":
        for n in raw.get("intro") or []:
            summary.append("Вступление %s: %s" % (_window(n), _de(n["text"])))
        for n in raw.get("notices") or []:
            summary.append("Сообщение %s: %s" % (_window(n), _de(n["text"])))
    sources = []
    for sl in entry["slots"]:
        src = _at(raw, sl)
        if entry_id == "places":
            sources.append({"slot": sl, "authority": "page", "reference": "Состав мест и контейнеров",
                            "url": src.get("url"), "verified_by": src.get("confirmed_by", ""),
                            "verified_on": src.get("confirmed_on", "")})
        else:
            sources.append(dict(src, slot=sl))
    return {"id": entry_id, "title": entry["title"], "summary": summary,
            "hints": [h for h in hints if h], "sources": sources}


def other_save(entry_id, body):
    entry = next((e for e in other_entries() if e["id"] == entry_id), None)
    if entry is None:
        return {"ok": False, "problems": ["нет такого пункта"]}
    if entry_id == "places":
        # places.json набран руками — по контейнеру на строку. Перезапись через
        # json.dump переформатировала бы весь файл ради двух полей, поэтому
        # меняем только их, прямо в тексте.
        s = (body.get("sources") or [{}])[0]
        with open(PLACES_FILE, encoding="utf-8") as f:
            text = f.read()
        text = _set_field(text, "confirmed_by", s.get("verified_by", ""))
        text = _set_field(text, "confirmed_on", s.get("verified_on", ""), after="confirmed_by")
        json.loads(text)                      # не записываем то, что не разбирается
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(PLACES_FILE), suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, PLACES_FILE)
        return {"ok": True, "problems": other_problems(entry_id)}
    raw = bd.load_json(entry["file"])
    for s in body.get("sources") or []:
        src = _at(raw, s["slot"])
        src["verified_by"], src["verified_on"] = s.get("verified_by", ""), s.get("verified_on", "")
    _write_json(entry["file"], raw)
    return {"ok": True, "problems": other_problems(entry_id)}


def _set_field(text, key, value, after=None):
    import re
    line = re.compile(r'("%s"\s*:\s*)"[^"]*"' % key)
    if line.search(text):
        return line.sub(lambda m: m.group(1) + json.dumps(value, ensure_ascii=False), text, count=1)
    anchor = re.compile(r'("%s"\s*:\s*"[^"]*")(,?)' % after)
    m = anchor.search(text)
    indent = text[text.rfind("\n", 0, m.start()) + 1:m.start()]
    return text[:m.end(1)] + ',\n%s"%s": %s' % (indent, key, json.dumps(value, ensure_ascii=False)) + m.group(2) + text[m.end():]


def other_problems(entry_id):
    """То же, что скажет сборка: подписано ли, и не сломано ли что-то ещё."""
    if entry_id == "places":
        _, _, fatal = bd.load_places(REPO)
        src = bd.load_json(PLACES_FILE).get("_source") or {}
        return fatal + ([] if (src.get("confirmed_by") or "").strip() else ["не подтверждено"])
    if entry_id.startswith("item:"):
        item_id = entry_id[5:]
        raw = bd.load_json(os.path.join(ITEMS, item_id + ".json"))
        return validate(item_id, raw)
    if entry_id == "finale":
        data, problems = bd.load_finale(REPO)
        raw = bd.load_json(FINALE_FILE)
        return problems + ([] if bd.signed(raw.get("sources")) else ["есть неподписанный источник"])
    if entry_id == "notices":
        _, problems = bd.load_notices(REPO, datetime.date.today())
        raw = bd.load_json(NOTICES_FILE)
        return problems + ([] if bd.signed([raw.get("_source") or {}]) else ["источник не подписан"])
    return []


PAGE = r"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Сверка предметов</title>
<style>
:root{color-scheme:light dark;--line:#8883;--accent:#2f6fb0;--ok:#1f8a4c;--bad:#c0392b}
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  display:grid;grid-template-columns:290px 1fr;height:100vh}
aside{border-right:1px solid var(--line);overflow:auto;padding:12px}
main{overflow:auto;padding:18px 22px 60px;max-width:820px}
h1{font-size:15px;margin:0 0 12px;text-transform:uppercase;letter-spacing:.05em;opacity:.65}
h2{font-size:19px;margin:0 0 2px}
h3{font-size:12px;text-transform:uppercase;letter-spacing:.05em;opacity:.6;margin:22px 0 8px}
.q{padding:7px 9px;border-radius:7px;cursor:pointer;display:flex;gap:8px;align-items:baseline}
.q:hover{background:#8881}
.q.active{background:var(--accent);color:#fff}
.q .t{font-size:11px;opacity:.6}
.q .dot{width:7px;height:7px;border-radius:50%;background:var(--bad);flex:0 0 auto}
.q.ready .dot{background:var(--ok)}
label{display:block;margin:0 0 10px}
label>span{display:block;font-size:12px;opacity:.65;margin-bottom:3px}
small.help{display:block;font-size:11px;opacity:.5;margin-top:2px}
input[type=text],textarea,select{width:100%;padding:7px 9px;border:1px solid var(--line);
  border-radius:6px;font:inherit;background:transparent;color:inherit}
textarea{min-height:56px;resize:vertical}
.row{display:flex;gap:12px}.row>*{flex:1}
.box{border:1px solid var(--line);border-radius:9px;padding:12px;margin-bottom:12px}
.box.quiet{border-style:dashed;opacity:.85}
.hint{background:#8881;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:13px}
.hint b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;opacity:.6}
.dest{display:flex;flex-wrap:wrap;gap:6px}
.dest label{margin:0;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);
  border-radius:20px;padding:4px 11px;cursor:pointer;font-size:13px}
.dest label:has(input:checked){background:var(--accent);color:#fff;border-color:transparent}
.dest label span{display:inline;font-size:13px;opacity:1;margin:0}
.place{font-size:11px;text-transform:uppercase;letter-spacing:.04em;opacity:.55;margin:9px 0 4px}
.inline{display:inline-flex;gap:6px;align-items:center;margin-right:14px}
button{font:inherit;padding:8px 15px;border-radius:7px;border:1px solid var(--line);
  background:transparent;color:inherit;cursor:pointer}
button.primary{background:var(--accent);color:#fff;border-color:transparent}
button.link{border:0;padding:2px 0;color:var(--accent);text-decoration:underline}
.bar{position:sticky;bottom:0;padding:12px 0;display:flex;gap:10px;align-items:center;
  background:Canvas;border-top:1px solid var(--line);margin-top:22px}
.msg{font-size:13px}.msg.bad{color:var(--bad)}.msg.ok{color:var(--ok)}
ul.problems{margin:8px 0 0;padding-left:18px;color:var(--bad);font-size:13px}
a{color:var(--accent)}
.empty{opacity:.6;padding:40px 0}
</style></head><body>
<aside><h1>Очередь <span id="counts"></span></h1><div id="queue"></div>
<h1 style="margin-top:22px">Прочее</h1><div id="other"></div></aside>
<main id="main"><div class="empty">Выберите предмет слева.</div></main>
<script>
let S = null, cur = null, draft = null;

// Код варианта игроку не показывается — он нужен движку, чтобы отличать версии
// предмета внутри файла. Печатать его руками незачем: делаем из названия.
const UMLAUTS = {'ä':'ae','ö':'oe','ü':'ue','ß':'ss','é':'e','è':'e','á':'a','à':'a'};
const slug = text => (text || '').toLowerCase().split('')
  .map(ch => UMLAUTS[ch] || ch).join('')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);

const api = async (p, body) => {
  const r = await fetch(p, body ? {method:'POST', body: JSON.stringify(body)} : {});
  return r.json();
};
const el = (t, a = {}, kids = []) => {
  const n = document.createElement(t);
  for (const [k, v] of Object.entries(a)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'html') n.innerHTML = v;
    else if (v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of [].concat(kids)) n.append(k);
  return n;
};

async function boot() { S = await api('/api/state'); renderQueue(); }

// «Прочее»: подписи вне очереди черновиков. Зелёная точка — всё подписано.
function renderOther() {
  const box = document.getElementById('other');
  box.textContent = '';
  for (const o of S.other || []) {
    box.append(el('div', {
      class: 'q' + (o.signed ? ' ready' : '') + ('other:' + o.id === cur ? ' active' : ''),
      onclick: () => openOther(o.id)
    }, [el('span', {class: 'dot'}), el('span', {}, o.title)]));
  }
}

async function openOther(id) {
  cur = 'other:' + id;
  draft = null;
  const d = await api('/api/other/' + id);
  renderQueue();
  const m = document.getElementById('main');
  m.textContent = '';
  m.append(el('h2', {}, d.title));
  for (const h of d.hints) m.append(el('div', {class: 'hint'}, [el('b', {}, 'важно'), h]));
  m.append(el('h3', {}, 'что вы подтверждаете'));
  m.append(el('ul', {}, d.summary.map(line => el('li', {}, line))));
  m.append(el('h3', {}, 'подпись'));
  d.sources.forEach((src, i) => m.append(sourceBlock(src, d.sources.length > 1 ? 'источник ' + (i + 1) : 'источник', true)));
  const msg = el('div', {class: 'msg', id: 'msg'});
  m.append(el('div', {class: 'bar'}, [
    el('button', {class: 'primary', onclick: async () => {
      const r = await api('/api/other/' + id, {sources: d.sources.map(x => ({slot: x.slot, verified_by: x.verified_by || '', verified_on: x.verified_on || ''}))});
      S = await api('/api/state'); renderQueue();
      showProblems(r.problems);
      flash(r.problems.length ? 'сохранено, но сборка ещё недовольна — смотрите ниже' : 'сохранено и подписано', r.problems.length > 0);
    }}, 'сохранить подписи'), msg]));
  m.append(el('div', {id: 'problems'}));
  showProblems(d.problems);
}

function showProblems(list) {
  const box = document.getElementById('problems');
  box.textContent = '';
  if (list.length) box.append(el('ul', {class: 'problems'}, list.map(p => el('li', {}, p))));
  else box.append(el('div', {class: 'msg ok'}, 'проверку проходит'));
}

function renderQueue() {
  renderOther();
  document.getElementById('counts').textContent = '· в игре ' + S.in_game;
  const q = document.getElementById('queue');
  q.textContent = '';
  for (const d of S.queue) {
    q.append(el('div', {
      class: 'q' + (d.problems === 0 ? ' ready' : '') + (d.id === cur ? ' active' : ''),
      onclick: () => openItem(d.id)
    }, [el('span', {class: 'dot'}), el('span', {}, d.term), el('span', {class: 't'}, 'т' + d.tier)]));
  }
}

async function openItem(id) {
  cur = id;
  draft = await api('/api/draft/' + id);
  renderQueue();
  render();
}

function allContainers() {
  const out = [];
  for (const p of S.places) for (const c of p.containers) out.push({...c, place: p.labels.de});
  return out;
}

function destPicker(holder) {
  const wrap = el('div');
  for (const p of S.places) {
    wrap.append(el('div', {class: 'place'}, p.labels.de));
    const row = el('div', {class: 'dest'});
    for (const c of p.containers) {
      const on = (holder.destinations || []).some(d => (typeof d === 'string' ? d : d.id) === c.id);
      const box = el('input', {type: 'checkbox', ...(on ? {checked: true} : {})});
      box.addEventListener('change', () => {
        let list = (holder.destinations || []).map(d => typeof d === 'string' ? d : d.id);
        list = box.checked ? [...new Set([...list, c.id])] : list.filter(x => x !== c.id);
        holder.destinations = list;
      });
      row.append(el('label', {}, [box, el('span', {}, c.labels.de)]));
    }
    wrap.append(row);
  }
  return wrap;
}

function textField(obj, key, title, opts = {}) {
  const i = el('input', {type: 'text', value: obj[key] || '',
                         ...(opts.placeholder ? {placeholder: opts.placeholder} : {})});
  i.addEventListener('input', () => { obj[key] = i.value; if (opts.onInput) opts.onInput(); });
  if (opts.hint) return el('label', {}, [el('span', {}, title), i, el('small', {class: 'help'}, opts.hint)]);
  return el('label', {}, [el('span', {}, title), i]);
}

// Необязательное пояснение: у варианта — чем он отличается от соседнего,
// у части — почему она едет именно туда. Пустое поле не должно превращаться
// в пустой объект: гейт справедливо потребует от него оба языка.
function optionalReason(holder, title) {
  const box = el('div', {class: 'box quiet'});
  box.append(el('div', {class: 'place'}, title));
  const sync = () => {
    const e = holder.explanation;
    if (e && !(e.de || '').trim() && !(e.en || '').trim()) delete holder.explanation;
  };
  const field = lang => {
    const t = el('textarea', {rows: 2});
    t.value = (holder.explanation || {})[lang] || '';
    t.addEventListener('input', () => {
      holder.explanation = holder.explanation || {de: '', en: ''};
      holder.explanation[lang] = t.value;
      sync();
    });
    return el('label', {}, [el('span', {}, lang === 'de' ? 'по-немецки' : 'по-английски'), t]);
  };
  box.append(el('div', {class: 'row'}, [field('de'), field('en')]));
  return box;
}

// Название варианта заполняет его код, пока код не трогали руками.
function labelWithCode(holder, title, codeTitle, hint) {
  holder.labels = holder.labels || {de: '', en: ''};
  const code = textField(holder, 'id', codeTitle, {hint, placeholder: 'заполнится само'});
  const input = code.querySelector('input');
  const de = textField(holder.labels, 'de', title, {onInput: () => {
    if (!holder._manualId) { holder.id = slug(holder.labels.de); input.value = holder.id; }
  }});
  input.addEventListener('input', () => { holder._manualId = true; });
  return [de, code];
}
function areaField(obj, key, title) {
  const t = el('textarea');
  t.value = obj[key] || '';
  t.addEventListener('input', () => obj[key] = t.value);
  return el('label', {}, [el('span', {}, title), t]);
}

function variantBlock(v, i) {
  const box = el('div', {class: 'box'});
  box.append(el('div', {class: 'row'}, [
    (() => {
      const s = el('select');
      for (const k of ['simple', 'composite']) {
        s.append(el('option', {value: k, ...(v.kind === k ? {selected: true} : {})},
          k === 'simple' ? 'простой' : 'составной (разбирается)'));
      }
      s.addEventListener('change', () => {
        v.kind = s.value;
        if (v.kind === 'composite') {
          delete v.destinations;
          v.parts = v.parts || [newPart(), newPart()];
        } else {
          delete v.parts;
          v.destinations = v.destinations || [];
        }
        render();
      });
      return el('label', {}, [el('span', {}, 'вид'), s]);
    })()
  ]));
  // Название варианта различает версии предмета. Пока версия одна, различать
  // нечего — и спрашивать нечего.
  if (draft.variants.length > 1) {
    box.append(el('div', {class: 'row'}, [
      ...labelWithCode(v, 'как называется вариант, de', 'код варианта',
                       'игроку не показывается'),
      textField(v.labels, 'en', 'то же, en')
    ]));
  } else {
    box.append(el('div', {class: 'place'},
      'вариант один — название ему не нужно; поля появятся, если добавить второй'));
  }
  // Своя причина у варианта имеет смысл только рядом с другим вариантом: у
  // единственного она совпадает с общей причиной предмета.
  if (draft.variants.length > 1) {
    box.append(optionalReason(v, 'почему этот вариант едет именно сюда — необязательно'));
  }
  if (v.kind === 'composite') {
    (v.parts || []).forEach((part, j) => {
      const pb = el('div', {class: 'box'});
      pb.append(el('div', {class: 'row'}, [
        ...labelWithCode(part, 'часть — название, de', 'код части',
                         'игроку не показывается'),
        textField(part.labels, 'en', 'название, en')
      ]));
      pb.append(destPicker(part));
      pb.append(optionalReason(part, 'почему эта часть едет именно сюда — необязательно'));
      pb.append(el('button', {class: 'link', onclick: () => { v.parts.splice(j, 1); render(); }},
        'убрать часть'));
      box.append(pb);
    });
    box.append(el('button', {onclick: () => { v.parts.push(newPart()); render(); }}, '+ часть'));
  } else {
    box.append(destPicker(v));
  }
  if (draft.variants.length > 1) {
    box.append(el('div', {}, el('button', {
      class: 'link', onclick: () => { draft.variants.splice(i, 1); render(); }
    }, 'убрать вариант')));
  }
  return box;
}

const newPart = () => ({id: '', labels: {de: '', en: ''}, destinations: []});
const newVariant = () => ({id: '', kind: 'simple', labels: {de: '', en: ''}, destinations: []});

function sourceBlock(src, title, rerender) {
  const b = el('div', {class: 'box'});
  b.append(el('h3', {}, title));
  if (src.authority === 'awm') {
    b.append(el('div', {class: 'hint'}, [el('b', {}, 'запись лексикона'), src.key || '']));
  } else {
    b.append(el('div', {class: 'hint'}, [
      el('b', {}, src.authority === 'law' ? 'норма' : 'страница'), src.reference || '']));
  }
  b.append(el('div', {}, el('a', {href: src.url, target: '_blank'}, 'открыть источник ↗')));
  const name = el('input', {type: 'text', value: src.verified_by || '',
    placeholder: localStorage.getItem('who') || 'ваше имя'});
  name.addEventListener('input', () => { src.verified_by = name.value; localStorage.setItem('who', name.value); });
  const when = el('input', {type: 'text', value: src.verified_on || '', placeholder: S.today});
  when.addEventListener('input', () => src.verified_on = when.value);
  b.append(el('div', {class: 'row'}, [
    el('label', {}, [el('span', {}, 'сверил'), name]),
    el('label', {}, [el('span', {}, 'дата сверки'), when])
  ]));
  b.append(el('button', {onclick: () => {
    src.verified_by = name.value || localStorage.getItem('who') || '';
    src.verified_on = S.today;
    if (!src.verified_by) { flash('впишите имя — подпись без имени бессмысленна', true); return; }
    if (rerender) { name.value = src.verified_by; when.value = src.verified_on; flash('подпись поставлена — не забудьте сохранить'); }
    else render();
  }}, 'прочитал, подтверждаю'));
  return b;
}

function render() {
  const m = document.getElementById('main');
  m.textContent = '';
  if (!draft) return;
  m.append(el('h2', {}, (draft.labels && draft.labels.de) || draft.id));
  m.append(el('div', {class: 'hint'}, [el('b', {}, 'идентификатор в игре'), draft.id]));

  if (draft._awm_tip) m.append(el('div', {class: 'hint'}, [el('b', {}, 'подсказка AWM'), draft._awm_tip]));
  for (const [k, v] of Object.entries(draft._awm_notes || {})) {
    m.append(el('div', {class: 'hint'}, [el('b', {}, 'AWM про ' + k), v]));
  }
  if (draft._destinations_proposed) {
    m.append(el('div', {class: 'hint'}, [el('b', {}, 'адресаты подставлены машиной'),
      draft._destinations_proposed]));
  }

  m.append(el('h3', {}, 'название'));
  draft.labels = draft.labels || {de: '', en: ''};
  m.append(el('div', {class: 'row'}, [
    textField(draft.labels, 'de', 'de'), textField(draft.labels, 'en', 'en')]));

  m.append(el('h3', {}, 'тир и свойства'));
  const tier = el('select');
  for (let i = 1; i <= 5; i++) {
    tier.append(el('option', {value: i, ...(draft.tier === i ? {selected: true} : {})}, 'тир ' + i));
  }
  tier.addEventListener('change', () => draft.tier = +tier.value);
  m.append(el('label', {}, [el('span', {}, 'тир'), tier]));
  const attrs = el('div');
  for (const [a, title] of [['borderline', 'падает медленно, помечен'],
                            ['examine', 'нужно посмотреть на предмет'],
                            ['separable', 'разбирается на части']]) {
    const c = el('input', {type: 'checkbox', ...((draft.attrs || []).includes(a) ? {checked: true} : {})});
    c.addEventListener('change', () => {
      const set = new Set(draft.attrs || []);
      c.checked ? set.add(a) : set.delete(a);
      draft.attrs = [...set];
    });
    attrs.append(el('label', {class: 'inline'}, [c, el('span', {}, title)]));
  }
  m.append(attrs);

  m.append(el('h3', {}, 'варианты и адресаты'));
  draft.variants = draft.variants || [newVariant()];
  draft.variants.forEach((v, i) => m.append(variantBlock(v, i)));
  m.append(el('button', {onclick: () => { draft.variants.push(newVariant()); render(); }},
    '+ вариант (различается осмотром)'));

  m.append(el('h3', {}, 'пояснение игроку'));
  draft.explanation = draft.explanation || {de: '', en: ''};
  m.append(el('div', {class: 'place'}, 'общее для предмета: чем варианты отличаются и что тут вообще важно'));
  m.append(areaField(draft.explanation, 'de', 'по-немецки'));
  m.append(areaField(draft.explanation, 'en', 'по-английски'));
  m.append(areaField(draft, '_note_ru', 'заметка по-русски — если немецкий текст напишет Claude'));

  m.append(el('h3', {}, 'подпись'));
  m.append(sourceBlock(draft.source || {}, 'основной источник'));
  (draft.sources || []).forEach((s, i) => m.append(sourceBlock(s, 'дополнительный источник ' + (i + 1))));

  const msg = el('div', {class: 'msg', id: 'msg'});
  m.append(el('div', {class: 'bar'}, [
    el('button', {onclick: () => save()}, 'сохранить'),
    el('button', {class: 'primary', onclick: () => save(true)}, 'сохранить и перенести в игру'),
    msg
  ]));
  const box = el('div', {id: 'problems'});
  m.append(box);
  check();
}

function flash(text, bad) {
  const m = document.getElementById('msg');
  if (!m) return;
  m.className = 'msg ' + (bad ? 'bad' : 'ok');
  m.textContent = text;
}

async function check() {
  const r = await api('/api/validate/' + cur, draft);
  const box = document.getElementById('problems');
  box.textContent = '';
  if (r.problems.length) {
    box.append(el('ul', {class: 'problems'}, r.problems.map(p => el('li', {}, p))));
  } else {
    box.append(el('div', {class: 'msg ok'}, 'проверку проходит'));
  }
}

function clean(node) {
  if (Array.isArray(node)) return node.map(clean);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) if (k !== '_manualId') out[k] = clean(v);
    return out;
  }
  return node;
}

async function save(andPromote) {
  await api('/api/draft/' + cur, clean(draft));
  if (!andPromote) { flash('сохранено'); await check(); S = await api('/api/state'); renderQueue(); return; }
  const r = await api('/api/promote/' + cur, {});
  if (r.ok) {
    flash('перенесено в игру');
    cur = null; draft = null;
    S = await api('/api/state');
    renderQueue();
    document.getElementById('main').textContent = '';
    document.getElementById('main').append(el('div', {class: 'empty'}, 'Готово. Выберите следующий.'));
  } else {
    flash('не переношу — смотрите список ниже', true);
    const box = document.getElementById('problems');
    box.textContent = '';
    box.append(el('ul', {class: 'problems'}, r.problems.map(p => el('li', {}, p))));
  }
}

boot();
</script></body></html>
"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        raw = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _json_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or "{}")

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == "/":
            return self._send(200, PAGE, "text/html; charset=utf-8")
        if self.path == "/api/state":
            return self._send(200, json.dumps(state(), ensure_ascii=False))
        if self.path.startswith("/api/other/"):
            d = other_detail(self.path[len("/api/other/"):])
            if d is None:
                return self._send(404, json.dumps({"error": "нет такого пункта"}))
            d["problems"] = other_problems(d["id"])
            return self._send(200, json.dumps(d, ensure_ascii=False))
        if self.path.startswith("/api/draft/"):
            item_id = self.path.rsplit("/", 1)[-1]
            if item_id not in draft_names():
                return self._send(404, json.dumps({"error": "нет такой заготовки"}))
            return self._send(200, json.dumps(load_draft(item_id), ensure_ascii=False))
        return self._send(404, json.dumps({"error": "not found"}))

    def do_POST(self):
        if self.path.startswith("/api/other/"):
            return self._send(200, json.dumps(other_save(self.path[len("/api/other/"):], self._json_body()),
                                              ensure_ascii=False))
        item_id = self.path.rsplit("/", 1)[-1]
        if self.path.startswith("/api/draft/"):
            if item_id not in draft_names():
                return self._send(404, json.dumps({"error": "нет такой заготовки"}))
            save_draft(item_id, self._json_body())
            return self._send(200, json.dumps({"ok": True}))
        if self.path.startswith("/api/validate/"):
            raw = self._json_body()
            return self._send(200, json.dumps({"problems": validate(item_id, raw)},
                                              ensure_ascii=False))
        if self.path.startswith("/api/promote/"):
            if item_id not in draft_names():
                return self._send(404, json.dumps({"error": "нет такой заготовки"}))
            return self._send(200, json.dumps(promote(item_id), ensure_ascii=False))
        return self._send(404, json.dumps({"error": "not found"}))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-open", action="store_true", dest="no_open")
    a = ap.parse_args()

    if not draft_names():
        print("в data/drafts/ пусто — сначала: python3 tools/drafts.py new ...")
    url = "http://127.0.0.1:%d/" % a.port
    server = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    print("форма сверки: %s   (Ctrl+C чтобы закрыть)" % url)
    if not a.no_open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nзакрыто")
    return 0


if __name__ == "__main__":
    sys.exit(main())
