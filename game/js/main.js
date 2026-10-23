// Wiring: content in, screens out. Title, then five tiers one place at a time,
// then the tree, then a result worth forwarding. Every rule is read from the
// content bundle against a date; this file decides only what is on screen.

import { Belt } from './belt.js';
import { Fall } from './fall.js';
import * as rules from './rules.js';
import * as score from './score.js';
import * as explain from './explain.js';
import * as progress from './progress.js';
import * as finale from './finale.js';
import { createI18n, preferredLanguage } from './i18n.js';
import { payload, share } from './share.js';
import { renderCard, rankKey, CARD_FILE, PARADE } from './card.js';
import { itemSprite, itemSpriteByKey, containerSprite, routeSprite, treeSprite, skylineSprite,
         decorSprite, decorSize, setArt, prefetchArt, img, pixelText } from './pixel.js';

const el = id => document.getElementById(id);
const make = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

// Development handles. ?date=2027-01-15 reads the rules against another day —
// it is also how the 2027 switch is shown. ?tier=3 starts further up the ladder,
// ?finale=1 goes straight to the tree, ?slow=4 stretches every fall, ?lang=en
// picks a language. None of them changes a rule.
const params = new URLSearchParams(location.search);
const asked = params.get('date');
const startAt = params.has('tier') ? Math.max(1, Math.min(5, parseInt(params.get('tier'), 10) || 1)) : null;
const slow = Math.max(0.25, Math.min(20, parseFloat(params.get('slow')) || 1));

const state = { content: null, date: asked ? new Date(asked + 'T12:00:00Z') : new Date(),
                tier: 1, queue: [], strip: [], activePlace: null,
                right: 0, answered: 0, points: 0, round: null, flight: null,
                // The run outlives a tier: the header counts this tier, the run
                // carries the ladder. Both die with the tab (KTD3).
                run: progress.createRun(1), finalePoints: 0, reached: 0,
                // Objects met in this run, so the next tier prefers new ones.
                seen: new Set() };
let i18n = null;
const t = (k, v) => i18n.t(k, v);
const pick = m => (i18n ? i18n.pick(m) : (m && m.de) || '');

const belt = new Belt({
  beltEl: el('belt'), trackEl: el('track'), tabsEl: el('tabs'), label: pick,
  onPlaceChange: p => { state.activePlace = p; el('app').dataset.place = p || ''; }
});
// The answer is the container under the frame at the instant the object is let
// go; the belt is locked for the short flight into the bin, so nothing done
// during that flight can change it.
const fall = new Fall({
  fieldEl: el('field'), onLanded: landed,
  onRelease: () => { state.released = belt.activeContainer(); belt.locked = true; }
});

async function boot() {
  const res = await fetch('content.json', { cache: 'no-store' });
  state.content = await res.json();
  setArt(state.content.art, state.content.version);
  const langs = Object.keys(state.content.i18n || {});
  i18n = createI18n(state.content.i18n, preferredLanguage(params.get('lang'), navigator.languages, langs));
  el('sky').src = skylineSprite();
  applyLanguage();
  prefetchArt();
  if (params.has('finale')) return startFinale();
  if (startAt) { state.run = progress.createRun(startAt); return startTier(startAt); }
  showTitle();
}

function applyLanguage() {
  document.documentElement.lang = i18n.lang;
  document.title = t('title');
  el('fixture').hidden = !state.content.fixture;
  el('fixture').textContent = t('fixture_banner');
  const notes = [];
  if (asked) notes.push(t('clock_banner', { date: i18n.date(state.date) }));
  if (slow !== 1) notes.push(t('slow_banner', { n: slow }));
  el('clock').hidden = !notes.length;
  el('clock').textContent = notes.join(' · ');
  el('lbl-tier').textContent = t('hud_tier');
  el('lbl-right').textContent = t('hud_right');
  el('lbl-points').textContent = t('hud_points');
  el('lbl-left').textContent = t('hud_left');
  el('hint-touch').textContent = t('touch_hint');
  el('hint-keys').textContent = t('how_keys');
}

function languageSwitch(after) {
  const row = make('div', 'langs');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', t('language'));
  i18n.langs.forEach(l => {
    const b = make('button', 'pbtn small' + (l === i18n.lang ? ' on' : ''), i18n.name(l));
    b.type = 'button';
    b.setAttribute('aria-pressed', l === i18n.lang);
    b.onclick = () => { i18n.set(l); applyLanguage(); after(); };
    row.append(b);
  });
  return row;
}

// A heading in pixel capitals, broken into lines and scaled down until the
// longest line fits — German compounds decide the layout budget (R22).
// The page can be loaded while its window has no width yet — in a background tab,
// say — and a heading sized against that would stay at one pixel per dot for the
// rest of the session, so the budget never goes below a small phone's.
function pixelHeading(text, { max = 4, width = Math.max(272, Math.min(window.innerWidth, 480) - 48), color = '#1a1c2c', shadow = '#94b0c2' } = {}) {
  const box = make('div', 'pheading');
  box.setAttribute('role', 'heading');
  box.setAttribute('aria-level', '1');
  box.setAttribute('aria-label', text);
  const words = String(text).split(' ');
  for (let scale = max; scale >= 1; scale--) {
    const lines = [];
    let line = '';
    const fits = s => pixelText(s, { scale }).width <= width;
    words.forEach(w => {
      const next = line ? line + ' ' + w : w;
      if (fits(next) || !line) line = next; else { lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    if (lines.every(fits) || scale === 1) {
      lines.forEach(l => { const c = pixelText(l, { scale, color, shadow }); c.setAttribute('aria-hidden', 'true'); box.append(c); });
      return box;
    }
  }
  return box;
}

// Who made it, with the name as a link to the author's site. The sentence comes
// from the language file; only the name is a link, wherever the language puts it.
function creditLine() {
  const p = make('p', 'credit');
  // t() fills every {placeholder}; a marker that cannot occur in text stands in
  // for the name, and the sentence is cut there.
  const [before, after] = t('credit', { name: '\u0000' }).split('\u0000');
  const a = make('a', null, 'Sergei Grieg');
  a.href = 'https://sergei-grieg.de';
  a.target = '_blank';
  a.rel = 'noopener';
  p.append(before || '', a, after || '');
  return p;
}

function currentIntro() {
  const intro = (state.content.notices && state.content.notices.intro) || [];
  const live = intro.find(n => rules.inWindow(n, state.date));
  return live ? pick(live.text) : '';
}

function liveNotices() {
  const list = (state.content.notices && state.content.notices.notices) || [];
  return list.filter(n => rules.inWindow(n, state.date));
}

// ------------------------------------------------------------------ title
function showTitle() {
  const screen = openScreen('title');
  const art = make('div', 'title-art');
  PARADE.forEach(k => {
    art.append(img(itemSpriteByKey(k), 'title-sprite'));
  });
  if (state.content.fixture) screen.append(make('p', 'fixture-note', t('fixture_banner')));
  screen.append(art, pixelHeading(t('title')), make('p', 'lead', t('subtitle')));
  const intro = currentIntro();
  if (intro) screen.append(make('p', 'intro', intro));
  const how = make('div', 'how');
  how.append(make('h2', null, t('how_title')));
  const list = make('ol');
  ['how_1', 'how_2', 'how_3'].forEach(k => list.append(make('li', null, t(k))));
  how.append(list, make('p', 'keys', t('how_keys')));
  const go = make('button', 'pbtn big', t('play'));
  go.type = 'button';
  go.onclick = () => { closeScreen(); startRun(); };
  screen.append(how, languageSwitch(showTitle), go, make('p', 'source', t('source_note')), creditLine());
  go.focus({ preventScroll: true });
  // The change message opens every session inside its window and is never
  // recorded as seen (R19): closing it is the only state, and it dies with the tab.
  const notices = liveNotices();
  if (notices.length) {
    showPanel({ title: t('notice_title'), reasons: notices.map(n => ({ text: pick(n.text) })),
                actionLabel: t('close'), action: () => { hidePanel(); go.focus(); } });
  }
}

function startRun() {
  const first = progress.ladder(state.content, state.date)[0] ?? 1;
  state.run = progress.createRun(first);
  state.seen = new Set();
  state.finalePoints = 0;
  state.reached = 0;
  startTier(first);
}

// ------------------------------------------------------------------- tiers
function startTier(tier) {
  state.tier = tier;
  state.right = 0;
  state.answered = 0;
  state.points = 0;
  state.round = null;
  state.reached = Math.max(state.reached, tier);
  // Every place up to this tier, never only this tier's: what opened earlier
  // stays on the belt, because the ladder teaches where things go and the flat
  // does not stop existing once you have found the island (R6).
  state.strip = rules.stripForTier(state.content.places, state.date, tier);
  belt.setStrip(state.strip);
  belt.locked = true;
  state.queue = rules.roundFor(state.content.items, tier, state.seen);
  state.queue.forEach(i => state.seen.add(i.id));
  el('tier').textContent = tier;
  el('total').textContent = state.queue.length;
  el('left').textContent = state.queue.length;
  el('right').textContent = '0';
  el('points').textContent = '0';
  hidePanel();
  if (!state.queue.length) return emptyTier(tier);
  tierIntro(tier);
}

// Before a tier: what is new. The first tier introduces home; every later one
// introduces exactly one place, with its containers drawn as they will appear.
function tierIntro(tier) {
  const places = rules.unlockedPlaces(state.content.places, state.date, tier);
  const place = places.find(p => p.tier === tier) || places[places.length - 1];
  const shelf = make('div', 'shelf');
  (place ? place.containers : []).forEach(c => {
    const fig = make('figure', 'shelf-bin');
    fig.append(img(containerSprite(c.id), 'shelf-sprite'), make('figcaption', null, pick(c.labels)));
    shelf.append(fig);
  });
  showPanel({
    pixelTitle: t('tier_intro', { n: tier }),
    line: tier === 1 ? t('tier_intro_first') : t('tier_intro_place', { place: pick(place.labels) }),
    extra: shelf,
    note: tier === 1 ? '' : t('tier_intro_more'),
    actionLabel: t('go'),
    // A new place sits at the far end of the belt; the belt travels there, so the
    // first thing the player sees is the containers they have not met yet.
    action: () => {
      hidePanel();
      belt.locked = false;
      if (tier > 1) belt.jumpToPlace(belt.groups.length - 1);
      next();
    }
  });
}

// A tier whose place exists but whose items are not authored yet. Reachable
// only through ?tier= while content is being written; it says so plainly rather
// than opening a round with nothing in it.
function emptyTier(tier) {
  const ahead = progress.nextPlayable(state.content, state.date, tier);
  const back = progress.ladder(state.content, state.date)[0] ?? 1;
  showPanel({
    pixelTitle: t('empty_tier', { n: tier }),
    line: t('empty_tier_line'),
    action: () => startTier(ahead ?? back),
    actionLabel: t('to_tier', { n: ahead ?? back })
  });
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
  if (!round.examined) return t('hint_examine');
  if (rules.variantNeedsSplit(round.variant) && !round.split) return t('hint_split');
  return '';
}

// A variant has its own drawing only where the eye is the honest cue — green
// glass looks green before anyone reads a label — so the drawing is shown from
// the start; objects whose label decides share one picture (see pixel.js).
function spriteFor(item, variant, examined, partId) {
  return itemSprite(item, variant, partId);
}

function spawnWhole() {
  const { item, variant, examined } = state.round;
  const shown = rules.visibleLabel(item, variant, examined, pick);
  const destinations = rules.answerSlots(variant, state.date).flatMap(s => s.destinations);
  state.flight = { kind: 'whole' };
  belt.locked = false;
  fall.spawn({
    item, variant,
    duration: rules.fallDuration(item, destinations, state.strip, state.activePlace) * slow,
    label: shown.name, detail: shown.detail, legible: shown.legible,
    borderline: (item.attrs || []).includes('borderline'),
    hint: hintFor(state.round),
    sprite: spriteFor(item, variant, examined)
  });
}

function spawnPart(slot) {
  const { item, variant } = state.round;
  state.flight = { kind: 'part', slot };
  fall.spawn({
    item, variant,
    duration: rules.fallDuration(item, slot.destinations, state.strip, state.activePlace) * slow,
    label: pick(slot.labels) || slot.id,
    detail: pick(item.labels), legible: true,
    borderline: (item.attrs || []).includes('borderline'),
    hint: '', part: true,
    sprite: itemSprite(item, variant, slot.id),
    from: state.round.from || 0
  });
  // Only the first part continues from where the object broke; the rest fall
  // from the top like anything else.
  state.round.from = 0;
  belt.locked = false;
}

// A tap on the object examines it, then takes it apart, and otherwise does
// nothing at all. Dropping early is a separate gesture — a tap past the object,
// or the space bar — because a key that means "let me look" must never be the
// key that throws the thing away.
function tapItem() {
  if (!fall.current || !el('panel').hidden) return;
  const action = rules.tapAction(state.round);
  if (action === 'examine') return examine();
  if (action === 'split') return split();
  fall.nudge();
}

function examine() {
  const round = state.round;
  fall.pause();
  const detail = pick(round.variant.labels) || '—';
  const pic = make('div', 'examine-pic');
  pic.append(img(itemSprite(round.item, round.variant), 'big-sprite'));
  showPanel({
    title: pick(round.item.labels) || round.item.id,
    line: detail,
    extra: pic,
    note: t('examine_note'),
    action: () => {
      round.examined = true;
      hidePanel();
      fall.relabel({ detail, legible: true, hint: hintFor(round),
                     sprite: itemSprite(round.item, round.variant) });
      fall.resume(rules.TIMING.examineCost);
    },
    // Not "next": nothing new comes after this — the same object goes on falling.
    actionLabel: t('examine_ok')
  });
}

// Taking apart, shown: the object swells and breaks, its parts spread out side
// by side with their names, then the first one falls on from the same height
// and the others rise away to wait their turn. The fall clock is stopped while
// it plays — the object is off the field, nothing is falling.
function split() {
  const round = state.round;
  round.split = true;
  round.slots = rules.answerSlots(round.variant, state.date);
  // Broken high up, the object would come apart above the edge of the field,
  // out of sight. The break is pulled down into view, and the first part goes
  // on falling from exactly where it is shown — never lower than halfway.
  const field = el('field'), travel = field.clientHeight - 60;
  const box = fall.box() || { x: field.clientWidth / 2, y: 0 };
  const lowest = -140 + 0.5 * travel + 70;
  const y = Math.min(Math.max(box.y, 110), lowest);
  round.from = Math.min(0.5, Math.max(0, (y - 70 + 140) / travel));
  fall.clear();
  burst(round, { x: box.x, y }, next);
}

function burst(round, box, done) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) return done();
  const field = el('field');
  const layer = make('div', 'burst');
  layer.style.left = box.x + 'px';
  layer.style.top = box.y + 'px';
  const whole = img(itemSprite(round.item, round.variant), 'burst-whole');
  layer.append(whole);
  const gap = Math.min(116, (field.clientWidth - 120) / 2);
  const shards = round.slots.map((slot, i) => {
    const shard = make('div', 'shard');
    shard.append(img(itemSprite(round.item, round.variant, slot.id), 'shard-sprite'),
                 make('div', 'shard-label', pick(slot.labels) || slot.id));
    layer.append(shard);
    // The first part keeps the object's place — it is the one that falls on —
    // and the others step out to either side of it.
    const side = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
    return { shard, dx: side * gap };
  });
  field.append(layer);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    whole.classList.add('crack');
    shards.forEach(({ shard, dx }) => { shard.style.transform = `translate(calc(-50% + ${dx}px), -50%) scale(1)`; shard.style.opacity = 1; });
  }));
  setTimeout(() => {
    shards.forEach(({ shard, dx }, i) => {
      if (i === 0) { shard.remove(); return; }
      shard.style.transform = `translate(calc(-50% + ${dx}px), ${-box.y - 120}px) scale(.6)`;
      shard.style.opacity = 0;
    });
    done();
    setTimeout(() => layer.remove(), 400);
  }, 720);
}

function landed({ item, variant, el: itemEl, early, remaining }) {
  const round = state.round;
  const chosen = state.released;
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
    return showExplanation(item, variant, explain.explainUndivided(item, variant, i18n.lang), points);
  }

  const slot = flight.kind === 'part'
    ? flight.slot
    : rules.answerSlots(variant, state.date)[0];
  const ok = !!chosen && slot.destinations.includes(chosen.id);
  const points = score.scoreAnswer({ ok, early, remaining });
  const line = explain.explainSlot({
    strip: state.strip, slot, chosen: chosen && chosen.id, lang: i18n.lang,
    fallbackName: pick(item.labels) || item.id,
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
    // Parts share one explanation at the end of the item. Until then a tick or
    // a cross pops over the belt, where the eye already is, and is gone again:
    // a line of text that stayed behind outlived the moment it described.
    pop(ok ? '✓' : '✗', ok);
    return setTimeout(next, 550);
  }

  addPoints(points);
  state.round = null;
  showExplanation(item, variant, explain.explainAnswer({
    item, variant, slots: [slot], strip: state.strip, lines: [line], points, lang: i18n.lang
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
  showExplanation(round.item, round.variant, explain.explainAnswer({
    item: round.item, variant: round.variant,
    slots: rules.answerSlots(round.variant, state.date),
    strip: state.strip, lines: round.lines, points, lang: i18n.lang
  }), points);
}

function addPoints(points) {
  state.points += points;
  el('points').textContent = state.points;
  pop((points >= 0 ? '+' : '') + points, points >= 0);
}

function pop(text, ok) {
  const node = make('div', 'pop ' + (ok ? 'ok' : 'bad'), text);
  node.setAttribute('aria-hidden', 'true');
  el('field').append(node);
  setTimeout(() => node.remove(), 900);
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

// The rung between tiers: what this tier came to, what the run comes to, and
// which place opens next. The decision itself is not made here — progress.js
// answers it from the data, so the same three outcomes hold whatever the ladder
// is reordered to.
function finishTier() {
  belt.locked = true;
  el('left').textContent = '0';
  const share = score.sharePercent(state.right, state.answered);
  state.run = progress.recordTier(state.run, {
    tier: state.tier, right: state.right, answered: state.answered, points: state.points
  });
  const out = progress.outcome({
    content: state.content, date: state.date, tier: state.tier,
    right: state.right, answered: state.answered
  });
  const total = progress.runTotals(state.run);

  const lines = [];
  if (state.run.tiers.length > 1) {
    lines.push({ text: t('run_total', total), ok: total.points >= 0, quiet: true });
  }
  (out.opened || []).forEach(p => {
    lines.push({ text: t('opens', { place: pick(p.labels), count: p.containers.length }), ok: true });
  });
  (out.skipped || []).forEach(n => lines.push({ text: t('skipped', { n }), ok: false, quiet: true }));

  const hasFinale = !!state.content.finale;
  const titles = { advance: 'tier_cleared', retry: 'tier_failed', finale: 'tier_cleared' };
  const notes = {
    advance: t('next_tier', { n: out.tier }),
    retry: t('need_share', { share: Math.round(score.CLEAR_SHARE * 100) }),
    finale: ''
  };
  const labels = { advance: t('continue'), retry: t('retry'), finale: hasFinale ? t('to_finale') : t('finale_done') };

  showPanel({
    pixelTitle: t(titles[out.kind], { n: state.tier }),
    titleOk: out.kind !== 'retry',
    line: t('tier_line', { right: state.right, answered: state.answered, share, points: state.points }),
    lines,
    note: notes[out.kind],
    action: () => {
      if (out.kind === 'finale') return hasFinale ? startFinale() : showEnd();
      startTier(out.tier);
    },
    actionLabel: labels[out.kind]
  });
}

// Every answer gets an explanation before the game moves on (R8). Dismissing it
// quickly is allowed and changes nothing: the score was settled at the landing.
function showExplanation(item, variant, result, points) {
  const lines = [];
  if (result.undivided) {
    lines.push({ text: t('undivided', { parts: result.parts.join(' + ') }), ok: false });
  } else {
    result.lines.forEach(l => {
      if (l.ok) {
        lines.push({ text: t('ok_line', { part: l.part, container: l.chosen }), ok: true });
        if (l.also.length) lines.push({ text: t('also_correct', { list: l.also.join(', ') }), ok: true, quiet: true });
      } else {
        const chosen = l.chosen || t('nothing');
        lines.push({ text: l.kind === 'place'
          ? t('wrong_place', { part: l.part, chosen: l.chosenPlace || chosen, wanted: l.wantedPlace })
          : t('wrong_container', { part: l.part, chosen }), ok: false });
        lines.push({ text: t('should_be', { list: l.wanted.join(' / ') }), ok: false, quiet: true });
      }
    });
  }
  const pic = make('div', 'answer-pic');
  pic.append(img(itemSprite(item, variant), 'mid-sprite'));
  showPanel({
    title: pick(item.labels) || item.id,
    badge: (points >= 0 ? '+' : '') + points,
    titleOk: points >= 0,
    extra: pic,
    lines,
    reasons: result.reasons,
    unverified: item.unverified,
    action: () => { hidePanel(); next(); },
    actionLabel: t('next')
  });
}

// ------------------------------------------------------------------ finale
// A tear-off calendar sheet: the month and year on a red band, the day number
// large, the weekday under it. The date decides which routes are open, so it is
// the first thing the player has to see change between the two days.
function calendarSheet(date) {
  const part = opts => i18n.date(date, { ...opts, timeZone: 'UTC' });
  const sheet = make('div', 'calendar');
  sheet.setAttribute('role', 'img');
  sheet.setAttribute('aria-label', t('finale_day', { date: i18n.date(date) }));
  const band = make('div', 'cal-band');
  const title = make('span', 'cal-title');
  title.append(make('span', 'cal-month', part({ month: 'long' })), make('span', 'cal-year', part({ year: 'numeric' })));
  band.append(make('span', 'cal-ring'), title, make('span', 'cal-ring'));
  const day = make('div', 'cal-day');
  day.append(pixelText(part({ day: 'numeric' }), { scale: 9, color: '#1a1c2c' }));
  day.firstChild.setAttribute('aria-hidden', 'true');
  sheet.append(band, day, make('div', 'cal-weekday', part({ weekday: 'long' })));
  return sheet;
}

// The tree: strip it, then choose a route on a given day. Two days are played —
// one inside the collection window and one after it — because the window is
// the thing a newcomer does not know exists.
function startFinale() {
  fall.clear();
  belt.locked = true;
  hidePanel();
  const data = state.content.finale;
  if (!data) return showEnd();
  const days = finale.sceneDates(data);
  const removed = new Set();
  let scene = 0;

  // fresh: the day has just changed. Only then is the old sheet torn off; the
  // screen is also rebuilt after every decoration, and the calendar must not
  // tear again each time.
  const render = fresh => {
    const screen = openScreen('finale');
    const day = days[scene];
    screen.append(pixelHeading(t('finale_title'), { max: 3 }));
    const cal = calendarSheet(day);
    if (fresh && scene > 0) {
      // The sheet of the previous day lies on top and tears away, so what
      // changed is shown rather than left to be noticed.
      const old = calendarSheet(days[scene - 1]);
      old.classList.add('torn');
      cal.append(old);
      const gone = Math.round((day - days[scene - 1]) / 86400000);
      cal.append(make('div', 'cal-later', t('finale_later', { n: gone })));
    }
    screen.append(cal);

    const stage = make('div', 'tree-stage');
    stage.append(img(treeSprite(), 'tree-sprite', ''));
    const positions = { stern: [50, 1], kugel: [36, 44], kugel_gold: [64, 62], lametta: [52, 28],
                        lichter: [44, 70], kerze: [70, 40], netz: [50, 52] };
    (data.decorations || []).forEach(d => {
      if (removed.has(d.id)) return;
      const b = make('button', 'decor decor-' + d.id);
      b.type = 'button';
      b.setAttribute('aria-label', pick(d.labels));
      const [x, y] = positions[d.id] || [50, 50];
      b.style.left = x + '%';
      b.style.top = y + '%';
      const pic = img(decorSprite(d.id), 'decor-sprite');
      const size = decorSize(d.id);
      pic.width = size.w * 3;
      pic.height = size.h * 3;
      b.append(pic);
      b.onclick = () => {
        removed.add(d.id);
        b.classList.add('gone');
        setTimeout(render, 180);
      };
      stage.append(b);
    });
    screen.append(stage);

    const done = finale.stripped(data, removed);
    const left = (data.decorations || []).filter(d => !removed.has(d.id)).length;
    screen.append(make('p', 'status', done ? t('finale_stripped') : (removed.size ? t('finale_left', { n: left }) : t('finale_strip'))));

    const routes = make('div', 'routes');
    data.routes.forEach(r => {
      const b = make('button', 'route');
      b.type = 'button';
      b.disabled = !done;
      b.append(img(routeSprite(r.id), 'route-sprite'), make('span', null, pick(r.labels)));
      b.onclick = () => choose(r.id);
      routes.append(b);
    });
    screen.append(routes, make('p', 'edition', t('finale_edition', { season: data.season })));
    const first = screen.querySelector('.decor, .route:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  };

  const choose = routeId => {
    const day = days[scene];
    const verdict = finale.judge(data, routeId, day);
    state.finalePoints += verdict.points;
    const fmt = d => i18n.date(d, { day: 'numeric', month: 'long', timeZone: 'UTC' });
    const lines = [];
    if (verdict.kind === 'closed') {
      lines.push({ text: t('finale_open_when', { windows: finale.windowText(verdict.route, fmt) }), ok: false });
    }
    if (verdict.kind === 'ok' && verdict.also.length) {
      lines.push({ text: t('finale_also', { list: verdict.also.map(r => pick(r.labels)).join(', ') }), ok: true, quiet: true });
    }
    if (verdict.kind !== 'ok') {
      lines.push({ text: t('should_be', { list: verdict.open.map(r => pick(r.labels)).join(' / ') }), ok: false, quiet: true });
    }
    const reasons = [{ text: pick(verdict.route.rule) }];
    if (scene === 0) reasons.push({ text: pick(data.strip_reason) });
    const last = scene === days.length - 1;
    const pic = make('div', 'answer-pic');
    pic.append(img(routeSprite(routeId), 'mid-sprite'));
    showPanel({
      title: pick(verdict.route.labels),
      badge: (verdict.points >= 0 ? '+' : '') + verdict.points,
      titleOk: verdict.kind === 'ok',
      line: t({ ok: 'finale_ok', closed: 'finale_closed', illegal: 'finale_illegal' }[verdict.kind]),
      extra: pic,
      lines, reasons,
      unverified: data.unverified,
      actionLabel: last ? t('finale_done') : t('finale_next_day'),
      action: () => { hidePanel(); if (last) return showEnd(); scene += 1; render(true); }
    });
  };

  render();
}

// --------------------------------------------------------------------- end
function showEnd() {
  fall.clear();
  belt.locked = true;
  hidePanel();
  const total = progress.runTotals(state.run);
  const points = total.points + state.finalePoints;
  const screen = openScreen('end');
  const art = make('div', 'title-art');
  art.append(img(treeSprite(), 'end-tree'));
  screen.append(art, pixelHeading(t('end_title'), { max: 5 }));
  const big = make('div', 'score');
  big.append(pixelText(t('points_short', { points }), { scale: 4, color: '#2f9e57', shadow: '#a7f070' }));
  big.setAttribute('aria-label', t('points_short', { points }));
  screen.append(big, make('p', 'lead', t('end_line', { points, right: total.right, answered: total.answered })));
  if (state.reached) screen.append(make('p', 'intro', t('end_reached', { n: state.reached })));

  // The picture is drawn as the screen opens, not on the tap: by the time a
  // file is ready after a tap, Safari no longer lets the page share it.
  const words = payload({ text: t('share_text', { points }), href: location.href });
  let file = null;
  const card = renderCard({
    title: t('title'), rank: t(rankKey(total.right, total.answered)), points: t('points_short', { points }),
    line: t('card_line', { right: total.right, answered: total.answered }),
    question: t('card_question'), note: t('card_note'), address: new URL(words.url).host
  }).then(blob => { file = new File([blob], CARD_FILE, { type: 'image/png' }); return blob; }, () => null);

  const shareBtn = make('button', 'pbtn big', t('share'));
  shareBtn.type = 'button';
  const buttons = make('div', 'end-buttons');
  shareBtn.onclick = async () => {
    const result = await share({ ...words, files: file && [file] });
    if (result === 'copied') shareBtn.textContent = t('shared');
    // No share sheet that takes a file — a desktop, mostly: the words went
    // out, the picture is offered to save by hand.
    if (result === 'copied' || result === 'shared' || result === 'failed') offerCard(buttons, card, words.text);
  };
  const again = make('button', 'pbtn quiet', t('again'));
  again.type = 'button';
  again.onclick = () => { closeScreen(); startRun(); };
  buttons.append(shareBtn, again);
  screen.append(buttons, languageSwitch(showEnd), make('p', 'source', t('source_note')), creditLine());
  shareBtn.focus({ preventScroll: true });
}

// The card shown under the buttons, with a link that saves it. The address is
// a blob: in this tab's memory — nothing is uploaded to make it.
let cardUrl = null;
async function offerCard(after, card, alt) {
  const blob = await card;
  if (!blob || after.nextElementSibling?.classList.contains('card-offer')) return;
  if (cardUrl) URL.revokeObjectURL(cardUrl);
  cardUrl = URL.createObjectURL(blob);
  const box = make('figure', 'card-offer');
  box.append(img(cardUrl, 'card-preview', alt));
  const save = make('a', 'pbtn small', t('save_image'));
  save.href = cardUrl;
  save.download = CARD_FILE;
  box.append(save);
  after.after(box);
}

// ------------------------------------------------------------- overlays
function openScreen(kind) {
  const screen = el('screen');
  screen.textContent = '';
  screen.className = 'screen screen-' + kind;
  screen.hidden = false;
  screen.scrollTop = 0;
  const inner = make('div', 'screen-inner');
  screen.append(inner);
  return inner;
}
function closeScreen() { el('screen').hidden = true; el('screen').textContent = ''; }

function showPanel({ title, pixelTitle, badge, titleOk, line, lines, reasons, note, extra, unverified, action, actionLabel }) {
  const head = el('panel-title');
  head.textContent = '';
  head.className = titleOk === undefined ? '' : (titleOk ? 'ok' : 'bad');
  if (pixelTitle) head.append(pixelHeading(pixelTitle, { max: 3, width: Math.min(window.innerWidth, 380) - 80 }));
  else head.textContent = title || '';
  const badgeEl = el('panel-badge');
  badgeEl.textContent = '';
  badgeEl.hidden = !badge;
  if (badge) {
    badgeEl.className = 'badge ' + (titleOk ? 'ok' : 'bad');
    badgeEl.append(pixelText(badge, { scale: 3, color: '#f4f4f4' }));
    badgeEl.setAttribute('aria-label', badge);
  }
  el('panel-extra').textContent = '';
  if (extra) el('panel-extra').append(extra);
  el('panel-line').textContent = line || '';
  const box = el('panel-lines');
  box.textContent = '';
  (lines || []).forEach(l => box.append(make('div', 'panel-row ' + (l.ok ? 'ok' : 'bad') + (l.quiet ? ' quiet' : ''), l.text)));
  const notes = el('panel-note');
  notes.textContent = '';
  if (note) notes.append(make('p', 'note', note));
  (reasons || []).forEach(r => {
    const p = make('p', 'reason');
    if (r.scope) p.append(make('b', null, r.scope + ': '));
    p.append(document.createTextNode(r.text));
    notes.append(p);
  });
  el('panel-flag').hidden = !unverified;
  el('panel-flag').textContent = t('unverified');
  const btn = el('panel-btn');
  btn.textContent = actionLabel;
  // One press, one action. A double click or a double tap on "Weiter" used to
  // run it twice — the second time on the next object, skipping it unanswered.
  let done = false;
  btn.onclick = () => { if (done) return; done = true; action(); };
  el('panel').hidden = false;
  btn.focus();
}
// When a dialog closes, the rest of that gesture must not reach the field: the
// second tap of a double tap, or a held key repeating, would otherwise drop the
// object that has only just appeared. Input on the field waits a moment.
let quietUntil = 0;
function hidePanel() {
  if (!el('panel').hidden) quietUntil = performance.now() + 350;
  el('panel').hidden = true;
}
const quiet = () => performance.now() < quietUntil;

document.addEventListener('keydown', e => {
  if (!el('panel').hidden) {
    // A held key repeats; only a fresh press may close a dialog.
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); el('panel-btn').click(); }
    else if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
    return;
  }
  if (!el('screen').hidden) return;
  // The same key that closed the dialog, still held, must not drop or examine
  // the next object; moving the belt with a held arrow is fine.
  if ((e.repeat || quiet()) && ['Enter', ' ', 'ArrowUp', 'ArrowDown', 'e'].includes(e.key)) { e.preventDefault(); return; }
  if (e.key === 'Tab') { e.preventDefault(); belt.stepPlace(e.shiftKey ? -1 : 1); return; }
  if (/^[1-9]$/.test(e.key)) { e.preventDefault(); belt.jumpToPlace(+e.key - 1); return; }
  // No visible cursor: the aim frame is fixed and the belt moves, so a key must
  // agree in direction with the swipe it replaces.
  if (e.key === 'ArrowLeft') { e.preventDefault(); belt.step(1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); belt.step(-1); }
  else if (e.key === 'ArrowUp' || e.key === 'e' || e.key === 'Enter') { e.preventDefault(); tapItem(); }
  else if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); fall.drop(); }
});

// On the field: a tap on the object looks at it or takes it apart; a swipe
// down, from anywhere including the object, drops it early. On a touch screen
// a tap on empty space does nothing — a stray touch while aiming must not throw
// the object away. With a mouse, a click beside the object still drops it.
let press = null;
el('field').addEventListener('pointerdown', ev => {
  press = { x: ev.clientX, y: ev.clientY, t: performance.now(), onItem: !!ev.target.closest('.item'),
            touch: ev.pointerType !== 'mouse' };
  // Captured so a swipe that ends over the belt still ends here.
  try { el('field').setPointerCapture(ev.pointerId); } catch (e) { /* no active pointer */ }
});
el('field').addEventListener('pointercancel', () => { press = null; });
el('field').addEventListener('pointerup', ev => {
  const p = press;
  press = null;
  if (!p || !el('panel').hidden || quiet()) return;
  const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
  if (dy > 40 && dy > Math.abs(dx) * 1.2 && performance.now() - p.t < 700) return fall.drop();
  if (Math.hypot(dx, dy) > 12) return;                 // some other gesture: ignore
  if (p.onItem) tapItem();
  else if (!p.touch) fall.drop();
});

// With any development handle in the URL the moving parts are reachable from the
// console: belt.step(1), state.round, rules.TIMING. Off by default, because a
// player has no use for it and it would only be one more thing to keep working.
if (['date', 'tier', 'slow', 'finale', 'lang'].some(k => params.has(k))) {
  window.__game = { belt, fall, state, rules, progress, finale, startTier, startFinale, showEnd, tapItem,
                    get i18n() { return i18n; } };
}

boot();
