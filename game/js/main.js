// Wiring: content in, one tier at a time out. Scoring beyond right-and-wrong,
// examination, taking items apart and the written explanation are their own
// units; the seams they attach to are marked.

import { Belt } from './belt.js';
import { Fall } from './fall.js';
import * as rules from './rules.js';

const el = id => document.getElementById(id);

// Two development handles, and one of them is how the 2027 switch gets shown to
// people: ?date=2027-01-15 moves the clock the rules are read against, ?tier=3
// starts further up the ladder. Neither changes any rule — both only choose
// which day and which tier the same data is read for.
const params = new URLSearchParams(location.search);
const asked = params.get('date');
const startAt = Math.max(1, Math.min(5, parseInt(params.get('tier'), 10) || 1));

const state = { content: null, date: asked ? new Date(asked + 'T12:00:00Z') : new Date(),
                tier: startAt, queue: [], strip: [], activePlace: null, right: 0, answered: 0 };

const belt = new Belt({
  beltEl: el('belt'), trackEl: el('track'), tabsEl: el('tabs'),
  onPlaceChange: p => { state.activePlace = p; }
});
const fall = new Fall({ fieldEl: el('field'), onLanded: landed });

async function boot() {
  const res = await fetch('content.json', { cache: 'no-store' });
  state.content = await res.json();
  if (state.content.fixture) el('fixture').hidden = false;
  if (asked) {
    el('clock').hidden = false;
    el('clock').textContent = 'правила читаются на ' + asked;
  }
  startTier(startAt);
}

function startTier(tier) {
  state.tier = tier;
  state.right = 0;
  state.answered = 0;
  state.strip = rules.stripForTier(state.content.places, state.date, tier);
  belt.setStrip(state.strip);
  belt.locked = false;
  const pool = rules.itemsForTier(state.content.items, tier)
    .map(item => ({ item, variant: playableVariant(item) }))
    .filter(pair => pair.variant);
  state.queue = rules.shuffle(pool);
  el('tier').textContent = tier;
  el('total').textContent = state.queue.length;
  hidePanel();
  next();
}

// Composite variants need the tap that takes an item apart, which is U4. Until
// it exists the engine plays only what it can answer, rather than pretending.
function playableVariant(item) {
  const simple = (item.variants || []).filter(v => v.kind === 'simple');
  if (!simple.length) return null;
  return simple[Math.floor(Math.random() * simple.length)];
}

function next() {
  if (!state.queue.length) return finishTier();
  const { item, variant } = state.queue.shift();
  el('left').textContent = state.queue.length + 1;
  fall.spawn({
    item, variant,
    duration: rules.fallDuration(item, variant, state.strip, state.activePlace, state.date),
    label: (item.labels && item.labels.de) || item.id,
    borderline: (item.attrs || []).includes('borderline')
  });
}

function landed({ item, variant, el: itemEl, early }) {
  const chosen = belt.activeContainer();
  const correct = rules.answerSlots(variant, state.date)[0].destinations;
  const ok = chosen && correct.includes(chosen.id);
  state.answered += 1;
  if (ok) state.right += 1;
  el('right').textContent = state.right;

  const aimed = belt.track.querySelector('.bin.aimed');
  if (aimed) {
    aimed.classList.add(ok ? 'hit' : 'miss');
    setTimeout(() => aimed.classList.remove('hit', 'miss'), 450);
  }
  itemEl.classList.add(ok ? 'landed-ok' : 'landed-bad');
  setTimeout(() => itemEl.remove(), 260);

  // U5 replaces this line with the written explanation, which must also name
  // other correct destinations even when the answer was right (R8).
  const names = correct.map(id => (state.strip.find(c => c.id === id) || {}).labels)
    .filter(Boolean).map(l => l.de);
  const kind = ok ? '' : ' · ' + (rules.errorKind(state.strip, chosen && chosen.id, correct) === 'place'
    ? 'не то место' : 'не тот контейнер');
  say((ok ? '✓ ' : '✗ ') + names.join(' / ') + kind + (early ? ' · рано' : ''), ok);
  setTimeout(next, 700);
}

function finishTier() {
  belt.locked = true;
  const more = rules.itemsForTier(state.content.items, state.tier + 1).length > 0;
  const share = state.answered ? Math.round((state.right / state.answered) * 100) : 0;
  showPanel(
    'Тир ' + state.tier + ' пройден',
    state.right + ' из ' + state.answered + ' — ' + share + '%',
    more ? 'Дальше: тир ' + (state.tier + 1) : 'Предметов дальше нет',
    more ? () => startTier(state.tier + 1) : () => startTier(1),
    more ? 'продолжить' : 'сначала'
  );
}

function say(text, ok) {
  const box = el('say');
  box.textContent = text;
  box.className = 'say ' + (ok ? 'ok' : 'bad');
}

function showPanel(title, line, note, action, actionLabel) {
  el('panel-title').textContent = title;
  el('panel-line').textContent = line;
  el('panel-note').textContent = note;
  const btn = el('panel-btn');
  btn.textContent = actionLabel;
  btn.onclick = action;
  el('panel').hidden = false;
  btn.focus();
}
function hidePanel() { el('panel').hidden = true; }

document.addEventListener('keydown', e => {
  if (!el('panel').hidden) return;
  if (e.key === 'Tab') { e.preventDefault(); belt.stepPlace(e.shiftKey ? -1 : 1); return; }
  if (/^[1-9]$/.test(e.key)) { e.preventDefault(); belt.jumpToPlace(+e.key - 1); return; }
  // No visible cursor: the aim frame is fixed and the belt moves, so a key must
  // agree in direction with the swipe it replaces.
  if (e.key === 'ArrowLeft') { e.preventDefault(); belt.step(1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); belt.step(-1); }
  else if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); fall.drop(); }
});
el('field').addEventListener('pointerup', () => fall.drop());

boot();
