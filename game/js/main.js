// Wiring: content in, one tier at a time out. An item may have to be examined
// before it can be answered and taken apart before it can be sent anywhere; the
// reward curve and the written explanation are U5, and their seams are marked.

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
// ?slow=4 stretches every fall fourfold. Tuning the timing means playing the
// same item at several speeds, and that is easier with a handle than with edits.
const slow = Math.max(0.25, Math.min(20, parseFloat(params.get('slow')) || 1));

const state = { content: null, date: asked ? new Date(asked + 'T12:00:00Z') : new Date(),
                tier: startAt, queue: [], strip: [], activePlace: null,
                right: 0, answered: 0, round: null, flight: null };

const belt = new Belt({
  beltEl: el('belt'), trackEl: el('track'), tabsEl: el('tabs'),
  onPlaceChange: p => { state.activePlace = p; }
});
const fall = new Fall({ fieldEl: el('field'), onLanded: landed });

async function boot() {
  const res = await fetch('content.json', { cache: 'no-store' });
  state.content = await res.json();
  if (state.content.fixture) el('fixture').hidden = false;
  if (slow !== 1) {
    el('clock').hidden = false;
    el('clock').textContent = 'падение замедлено в ' + slow + ' раз';
  }
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
  state.round = null;
  state.strip = rules.stripForTier(state.content.places, state.date, tier);
  belt.setStrip(state.strip);
  belt.locked = false;
  state.queue = rules.shuffle(rules.itemsForTier(state.content.items, tier));
  el('tier').textContent = tier;
  el('total').textContent = state.queue.length;
  el('right').textContent = '0';
  hidePanel();
  next();
}

function next() {
  const round = state.round;
  if (round && round.slots && round.slots.length) return spawnPart(round.slots[0]);
  if (round && round.slots && !round.slots.length) return finishRound();
  if (!state.queue.length) return finishTier();

  const item = state.queue.shift();
  const variant = rules.pickVariant(item);
  state.round = {
    item, variant,
    examined: !rules.needsExamination(item),
    split: false, slots: null, answers: {}
  };
  el('left').textContent = state.queue.length + 1;
  spawnWhole();
}

function hintFor(round) {
  if (!round.examined) return 'тап — рассмотреть';
  if (rules.variantNeedsSplit(round.variant) && !round.split) return 'тап — разобрать';
  return '';
}

function spawnWhole() {
  const { item, variant, examined } = state.round;
  const shown = rules.visibleLabel(item, variant, examined);
  const destinations = rules.answerSlots(variant, state.date).flatMap(s => s.destinations);
  state.flight = { kind: 'whole' };
  fall.spawn({
    item, variant,
    duration: rules.fallDuration(item, destinations, state.strip, state.activePlace) * slow,
    label: shown.name, detail: shown.detail, legible: shown.legible,
    borderline: (item.attrs || []).includes('borderline'),
    hint: hintFor(state.round)
  });
}

function spawnPart(slot) {
  const { item, variant } = state.round;
  state.flight = { kind: 'part', slot };
  fall.spawn({
    item, variant,
    duration: rules.fallDuration(item, slot.destinations, state.strip, state.activePlace) * slow,
    label: (item.labels && item.labels.de) || item.id,
    detail: (slot.labels && slot.labels.de) || slot.id, legible: true,
    borderline: (item.attrs || []).includes('borderline'),
    hint: ''
  });
}

// A tap on the object is examination first, taking it apart second, and only
// then an early drop — the two gestures never compete for the same object state.
function tapItem() {
  const round = state.round;
  if (!round || !fall.current) return fall.drop();
  if (!round.examined) return examine();
  if (rules.variantNeedsSplit(round.variant) && !round.split) return split();
  fall.drop();
}

function examine() {
  const round = state.round;
  fall.pause();
  const detail = (round.variant.labels && round.variant.labels.de) || '—';
  showPanel(
    (round.item.labels && round.item.labels.de) || round.item.id,
    detail,
    'осмотр стоит времени, а не подсказывает ответ',
    () => {
      round.examined = true;
      hidePanel();
      fall.relabel({ detail, legible: true, hint: hintFor(round) });
      fall.resume(rules.TIMING.examineCost);
    },
    'дальше'
  );
}

function split() {
  const round = state.round;
  round.split = true;
  round.slots = rules.answerSlots(round.variant, state.date);
  fall.clear();
  next();
}

function landed({ item, variant, el: itemEl, early }) {
  const round = state.round;
  const chosen = belt.activeContainer();
  const flight = state.flight;

  // A composite object cannot be sent anywhere whole; landing it undivided is
  // the mistake the attribute exists to teach.
  if (flight.kind === 'whole' && rules.variantNeedsSplit(variant) && !round.split) {
    mark(itemEl, false);
    state.answered += 1;
    say('✗ этот предмет нельзя отправить целиком — его надо разобрать', false);
    state.round = null;
    return setTimeout(next, 900);
  }

  const wanted = flight.kind === 'part'
    ? flight.slot.destinations
    : rules.answerSlots(variant, state.date)[0].destinations;
  const ok = !!chosen && wanted.includes(chosen.id);

  if (flight.kind === 'part') {
    round.answers[flight.slot.id] = chosen && chosen.id;
    round.slots = round.slots.slice(1);
  }

  state.answered += 1;
  if (ok) state.right += 1;
  el('right').textContent = state.right;
  mark(itemEl, ok);

  // U5 replaces this with the written explanation, which must also name other
  // correct destinations even when the answer was right (R8).
  const names = wanted.map(id => (state.strip.find(c => c.id === id) || {}).labels)
    .filter(Boolean).map(l => l.de);
  const kind = ok ? '' : ' · ' + (rules.errorKind(state.strip, chosen && chosen.id, wanted) === 'place'
    ? 'не то место' : 'не тот контейнер');
  const part = flight.kind === 'part' ? ((flight.slot.labels && flight.slot.labels.de) + ': ') : '';
  say((ok ? '✓ ' : '✗ ') + part + names.join(' / ') + kind + (early ? ' · рано' : ''), ok);

  if (flight.kind !== 'part') state.round = null;
  setTimeout(next, 700);
}

function finishRound() {
  const round = state.round;
  const score = rules.scoreSlots(rules.answerSlots(round.variant, state.date),
                                 round.answers, state.date);
  say('разобрано: ' + score.right + ' из ' + score.total, score.right === score.total);
  state.round = null;
  setTimeout(next, 700);
}

function mark(itemEl, ok) {
  const aimed = belt.track.querySelector('.bin.aimed');
  if (aimed) {
    aimed.classList.add(ok ? 'hit' : 'miss');
    setTimeout(() => aimed.classList.remove('hit', 'miss'), 450);
  }
  itemEl.classList.add(ok ? 'landed-ok' : 'landed-bad');
  setTimeout(() => itemEl.remove(), 260);
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
  if (!el('panel').hidden) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el('panel-btn').click(); }
    return;
  }
  if (e.key === 'Tab') { e.preventDefault(); belt.stepPlace(e.shiftKey ? -1 : 1); return; }
  if (/^[1-9]$/.test(e.key)) { e.preventDefault(); belt.jumpToPlace(+e.key - 1); return; }
  // No visible cursor: the aim frame is fixed and the belt moves, so a key must
  // agree in direction with the swipe it replaces.
  if (e.key === 'ArrowLeft') { e.preventDefault(); belt.step(1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); belt.step(-1); }
  else if (e.key === 'ArrowUp' || e.key === 'e' || e.key === 'Enter') { e.preventDefault(); tapItem(); }
  else if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); fall.drop(); }
});

el('field').addEventListener('pointerup', ev => {
  if (ev.target.closest('.item')) tapItem();
  else fall.drop();
});

// With any development handle in the URL the moving parts are reachable from the
// console: belt.step(1), state.round, rules.TIMING. Off by default, because a
// player has no use for it and it would only be one more thing to keep working.
if (params.has('date') || params.has('tier') || params.has('slow')) {
  window.__game = { belt, fall, state, rules, startTier, tapItem };
}

boot();
