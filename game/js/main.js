// Wiring: content in, one tier at a time out. An item may have to be examined
// before it can be answered and taken apart before it can be sent anywhere; the
// reward curve and the written explanation are U5, and their seams are marked.

import { Belt } from './belt.js';
import { Fall } from './fall.js';
import * as rules from './rules.js';
import * as score from './score.js';
import * as explain from './explain.js';

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

const lang = (navigator.language || 'de').slice(0, 2) === 'en' ? 'en' : 'de';
const state = { content: null, date: asked ? new Date(asked + 'T12:00:00Z') : new Date(),
                tier: startAt, queue: [], strip: [], activePlace: null,
                right: 0, answered: 0, points: 0, round: null, flight: null };

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
  state.points = 0;
  state.round = null;
  state.strip = rules.stripForTier(state.content.places, state.date, tier);
  belt.setStrip(state.strip);
  belt.locked = false;
  state.queue = rules.shuffle(rules.itemsForTier(state.content.items, tier));
  el('tier').textContent = tier;
  el('total').textContent = state.queue.length;
  el('right').textContent = '0';
  el('points').textContent = '0';
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
    split: false, slots: null, answers: {}, lines: [], partPoints: 0
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

// A tap on the object examines it, then takes it apart, and otherwise does
// nothing at all. Dropping early is a separate gesture — a tap past the object,
// or the space bar — because a key that means "let me look" must never be the
// key that throws the thing away.
function tapItem() {
  if (!fall.current) return;
  const action = rules.tapAction(state.round);
  if (action === 'examine') return examine();
  if (action === 'split') return split();
  fall.nudge();
}

function examine() {
  const round = state.round;
  fall.pause();
  const detail = (round.variant.labels && round.variant.labels.de) || '—';
  showPanel({
    title: (round.item.labels && round.item.labels.de) || round.item.id,
    line: detail,
    note: 'осмотр стоит времени, а не подсказывает ответ',
    action: () => {
      round.examined = true;
      hidePanel();
      fall.relabel({ detail, legible: true, hint: hintFor(round) });
      fall.resume(rules.TIMING.examineCost);
    },
    actionLabel: 'дальше'
  });
}

function split() {
  const round = state.round;
  round.split = true;
  round.slots = rules.answerSlots(round.variant, state.date);
  fall.clear();
  next();
}

function landed({ item, variant, el: itemEl, early, remaining }) {
  const round = state.round;
  const chosen = belt.activeContainer();
  const flight = state.flight;

  // A composite object cannot be sent anywhere whole; landing it undivided is
  // the mistake the attribute exists to teach, and the explanation talks about
  // the object rather than about containers.
  if (flight.kind === 'whole' && rules.variantNeedsSplit(variant) && !round.split) {
    const points = score.scoreAnswer({ ok: false, early, remaining });
    state.answered += 1;
    addPoints(points);
    mark(itemEl, false);
    state.round = null;
    return showExplanation(explain.explainUndivided(item, variant, lang), points);
  }

  const slot = flight.kind === 'part'
    ? flight.slot
    : rules.answerSlots(variant, state.date)[0];
  const ok = !!chosen && slot.destinations.includes(chosen.id);
  const points = score.scoreAnswer({ ok, early, remaining });
  const line = explain.explainSlot({
    strip: state.strip, slot, chosen: chosen && chosen.id,
    errorKind: rules.errorKind(state.strip, chosen && chosen.id, slot.destinations)
  });

  state.answered += 1;
  if (ok) state.right += 1;
  el('right').textContent = state.right;
  mark(itemEl, ok);

  if (flight.kind === 'part') {
    round.answers[slot.id] = chosen && chosen.id;
    round.lines.push(line);
    round.partPoints += points;
    round.slots = round.slots.slice(1);
    // Parts share one explanation at the end of the item; a short line keeps the
    // player informed that the part registered while the next one is falling.
    say((ok ? '✓ ' : '✗ ') + line.part + ' → ' + (line.chosen || '—'), ok);
    return setTimeout(next, 550);
  }

  addPoints(points);
  state.round = null;
  showExplanation(explain.explainAnswer({
    item, strip: state.strip, lines: [line], points, lang
  }), points);
}

// Parts are scored one by one, then floored: taking an item apart must never
// score below sending the same item whole, or the game would be teaching
// players not to bother (R9).
function finishRound() {
  const round = state.round;
  const points = score.splitFloor(round.partPoints, score.POINTS.wrong);
  addPoints(points);
  state.round = null;
  showExplanation(explain.explainAnswer({
    item: round.item, strip: state.strip, lines: round.lines, points, lang
  }), points);
}

function addPoints(points) {
  state.points += points;
  el('points').textContent = state.points;
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
  const cleared = score.tierCleared(state.right, state.answered);
  const share = score.sharePercent(state.right, state.answered);
  const more = rules.itemsForTier(state.content.items, state.tier + 1).length > 0;
  const nextTier = cleared && more;
  showPanel({
    title: cleared ? 'Тир ' + state.tier + ' пройден' : 'Тир ' + state.tier + ' не пройден',
    line: state.right + ' из ' + state.answered + ' — ' + share + '% · ' +
          state.points + ' очков',
    note: cleared
      ? (more ? 'Дальше: тир ' + (state.tier + 1) : 'Предметов дальше нет')
      : 'Нужно ' + Math.round(score.CLEAR_SHARE * 100) + '%. Ошибки не блокируют — можно пройти ещё раз',
    action: () => startTier(nextTier ? state.tier + 1 : state.tier),
    actionLabel: nextTier ? 'продолжить' : (cleared ? 'сначала' : 'ещё раз')
  });
}

function say(text, ok) {
  const box = el('say');
  box.textContent = text;
  box.className = 'say ' + (ok ? 'ok' : 'bad');
}

// Every answer gets an explanation before the game moves on (R8). Dismissing it
// quickly is allowed and changes nothing: the score was settled at the landing.
function showExplanation(result, points) {
  const lines = [];
  if (result.undivided) {
    lines.push({ text: 'целиком отправить нельзя — надо было разобрать: ' +
                       result.parts.join(' + '), ok: false });
  } else {
    result.lines.forEach(l => {
      if (l.ok) {
        lines.push({ text: l.part + ' → ' + l.chosen, ok: true });
        if (l.also.length) {
          lines.push({ text: 'верно было также: ' + l.also.join(', '), ok: true, quiet: true });
        }
      } else if (l.kind === 'place') {
        lines.push({ text: l.part + ': не то место — ' + (l.chosenPlace || '—') +
                           ' вместо ' + l.wantedPlace, ok: false });
        lines.push({ text: 'нужно: ' + l.wanted.join(' / '), ok: false, quiet: true });
      } else {
        lines.push({ text: l.part + ': не тот контейнер — ' + (l.chosen || '—'), ok: false });
        lines.push({ text: 'нужно: ' + l.wanted.join(' / '), ok: false, quiet: true });
      }
    });
  }
  showPanel({
    title: (points >= 0 ? '+' : '') + points,
    titleOk: points >= 0,
    line: '',
    lines,
    note: result.reason,
    action: () => { hidePanel(); next(); },
    actionLabel: 'дальше'
  });
}

function showPanel({ title, titleOk, line, lines, note, action, actionLabel }) {
  const head = el('panel-title');
  head.textContent = title;
  head.className = titleOk === undefined ? '' : (titleOk ? 'ok' : 'bad');
  el('panel-line').textContent = line || '';
  const box = el('panel-lines');
  box.textContent = '';
  (lines || []).forEach(l => {
    const row = document.createElement('div');
    row.className = 'panel-row ' + (l.ok ? 'ok' : 'bad') + (l.quiet ? ' quiet' : '');
    row.textContent = l.text;
    box.append(row);
  });
  el('panel-note').textContent = note || '';
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
