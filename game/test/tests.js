// Pure-logic tests for the engine. No DOM, no timing: everything here is a
// function of data and a date, which is exactly why the 2027 switch can be
// proved by moving a clock instead of waiting for a year.

import * as rules from '../js/rules.js';
import { nearestIndex } from '../js/belt.js';
import * as score from '../js/score.js';
import * as explain from '../js/explain.js';

const results = [];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, why: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'ожидалось true'); }
function same(got, want, msg) {
  if (!eq(got, want)) throw new Error((msg || '') + ' получено ' + JSON.stringify(got) +
    ', ожидалось ' + JSON.stringify(want));
}

const d = s => new Date(s + 'T12:00:00Z');
const PLACES = [
  { id: 'home', tier: 1, labels: { de: 'Zuhause', en: 'Home' }, containers: [
    { id: 'restmuell', labels: { de: 'Restmüll', en: 'Residual' } },
    { id: 'papier', labels: { de: 'Papier', en: 'Paper' } },
    { id: 'gelbe_tonne', from: '2027-01-01', labels: { de: 'Gelbe Tonne', en: 'Yellow bin' } }
  ] },
  { id: 'insel', tier: 3, labels: { de: 'Insel', en: 'Island' }, containers: [
    { id: 'glas_weiss', labels: { de: 'Weißglas', en: 'Clear glass' } },
    { id: 'kunststoff', until: '2027-01-01', labels: { de: 'Kunststoff', en: 'Plastic' } },
    { id: 'metall', until: '2027-01-01', labels: { de: 'Metalle', en: 'Metals' } }
  ] }
];

test('until is exclusive, from is inclusive', () => {
  assert(rules.inWindow({ until: '2027-01-01' }, d('2026-12-31')), 'канун ещё внутри');
  assert(!rules.inWindow({ until: '2027-01-01' }, d('2027-01-01')), 'в сам день уже нет');
  assert(rules.inWindow({ from: '2027-01-01' }, d('2027-01-01')), 'в сам день уже да');
  assert(!rules.inWindow({ from: '2027-01-01' }, d('2026-12-31')), 'накануне ещё нет');
  assert(rules.inWindow({}, d('2026-08-27')), 'без окна — всегда');
});

test('the yellow bin is absent in 2026 and present in 2027', () => {
  const before = rules.stripOn(PLACES, d('2026-08-27')).map(c => c.id);
  const after = rules.stripOn(PLACES, d('2027-01-15')).map(c => c.id);
  assert(!before.includes('gelbe_tonne'), 'в 2026 жёлтого бака быть не должно');
  assert(after.includes('gelbe_tonne'), 'в 2027 он должен появиться');
});

test('both packaging containers leave the island, glass stays', () => {
  const after = rules.stripOn(PLACES, d('2027-01-15')).map(c => c.id);
  assert(!after.includes('kunststoff'), 'пластик уезжает');
  assert(!after.includes('metall'), 'металл уезжает');
  assert(after.includes('glas_weiss'), 'стекло остаётся');
});

test('a place with no containers left disappears from the strip', () => {
  const onlyPackaging = [{ id: 'x', tier: 1, labels: { de: 'X', en: 'X' },
    containers: [{ id: 'k', until: '2027-01-01', labels: { de: 'K', en: 'K' } }] }];
  same(rules.stripOn(onlyPackaging, d('2027-01-15')).length, 0);
});

test('the strip carries place order and index', () => {
  const strip = rules.stripOn(PLACES, d('2026-08-27'));
  same(strip.map(c => c.placeId), ['home', 'home', 'insel', 'insel', 'insel']);
  same(strip.map(c => c.placeIndex), [0, 0, 1, 1, 1]);
});

test('a tier only shows places already unlocked', () => {
  same(rules.stripForTier(PLACES, d('2026-08-27'), 1).map(c => c.id), ['restmuell', 'papier']);
  same(rules.stripForTier(PLACES, d('2026-08-27'), 3).map(c => c.id).length, 5);
});

test('destinations accept both the short and the dated form', () => {
  const holder = { destinations: ['papier', { id: 'kunststoff', until: '2027-01-01' },
                                  { id: 'gelbe_tonne', from: '2027-01-01' }] };
  same(rules.destinationsOn(holder, d('2026-08-27')), ['papier', 'kunststoff']);
  same(rules.destinationsOn(holder, d('2027-01-15')), ['papier', 'gelbe_tonne']);
});

test('a composite variant answers in parts', () => {
  const variant = { kind: 'composite', parts: [
    { id: 'karton', labels: {}, destinations: ['papier'] },
    { id: 'reste', labels: {}, destinations: ['bio'] }
  ] };
  const slots = rules.answerSlots(variant, d('2026-08-27'));
  same(slots.length, 2);
  same(slots.map(s => s.destinations), [['papier'], ['bio']]);
});

test('a borderline item falls slower than a plain one', () => {
  const strip = rules.stripForTier(PLACES, d('2026-08-27'), 1);
  const plain = rules.fallDuration({ tier: 1, attrs: [] }, ['papier'], strip, 'home');
  const slow = rules.fallDuration({ tier: 1, attrs: ['borderline'] }, ['papier'], strip, 'home');
  assert(slow > plain, 'помеченный предмет обязан падать дольше: ' + slow + ' vs ' + plain);
});

test('an item whose place is not the active one falls slower', () => {
  const strip = rules.stripForTier(PLACES, d('2026-08-27'), 3);
  const here = rules.fallDuration({ tier: 3, attrs: [] }, ['glas_weiss'], strip, 'insel');
  const away = rules.fallDuration({ tier: 3, attrs: [] }, ['glas_weiss'], strip, 'home');
  assert(away > here, 'смена места стоит времени: ' + away + ' vs ' + here);
});

test('a part falls by its own destination, not the whole item\'s', () => {
  const strip = rules.stripForTier(PLACES, d('2026-08-27'), 3);
  const homePart = rules.fallDuration({ tier: 3, attrs: [] }, ['papier'], strip, 'home');
  const awayPart = rules.fallDuration({ tier: 3, attrs: [] }, ['glas_weiss'], strip, 'home');
  assert(awayPart > homePart, 'часть, лежащая в другом месте, падает дольше');
});

test('examination changes what can be read, not what is true', () => {
  const item = { id: 'dose', attrs: ['examine'], labels: { de: 'Aludose', en: 'Can' } };
  const variant = { id: 'pfand', kind: 'simple', labels: { de: 'mit Pfand', en: 'deposit' },
                    destinations: ['papier'] };
  const before = rules.visibleLabel(item, variant, false);
  const after = rules.visibleLabel(item, variant, true);
  assert(!before.legible, 'до осмотра надпись нечитаема');
  assert(after.legible, 'после осмотра читаема');
  same(before.detail, after.detail, 'текст один и тот же — меняется только читаемость');
  same(after.name, 'Aludose');
});

test('an item without the examine attribute is legible from the start', () => {
  const shown = rules.visibleLabel({ id: 'x', attrs: [], labels: { de: 'X' } },
                                   { labels: { de: 'y' } }, false);
  assert(shown.legible);
});

test('a composite variant must be taken apart, a simple one must not', () => {
  assert(rules.variantNeedsSplit({ kind: 'composite', parts: [] }));
  assert(!rules.variantNeedsSplit({ kind: 'simple', destinations: ['papier'] }));
});

test('a tap never throws the object away', () => {
  const simple = { kind: 'simple', destinations: ['papier'] };
  const composite = { kind: 'composite', parts: [] };
  same(rules.tapAction(null), 'none');
  same(rules.tapAction({ examined: true, split: false, variant: simple }), 'none',
       'у обычного предмета тапу отвечать нечем');
  same(rules.tapAction({ examined: false, split: false, variant: simple }), 'examine');
  same(rules.tapAction({ examined: true, split: false, variant: composite }), 'split');
  same(rules.tapAction({ examined: true, split: true, variant: composite }), 'none',
       'разобранный предмет больше не разбирается');
});

test('parts are scored by slot, so the order they are sorted in does not matter', () => {
  const slots = [
    { id: 'karton', destinations: ['papier'] },
    { id: 'reste', destinations: ['bio'] }
  ];
  const inOrder = rules.scoreSlots(slots, { karton: 'papier', reste: 'bio' }, d('2026-08-27'));
  const reversed = rules.scoreSlots(slots, { reste: 'bio', karton: 'papier' }, d('2026-08-27'));
  same(inOrder.right, 2);
  same(reversed.right, inOrder.right, 'порядок разбора не влияет на счёт');
});

test('a correct part still counts when another part is wrong', () => {
  const slots = [
    { id: 'huelle', destinations: ['papier'] },
    { id: 'becher', destinations: ['kunststoff'] }
  ];
  const score = rules.scoreSlots(slots, { huelle: 'papier', becher: 'restmuell' }, d('2026-08-27'));
  same(score.right, 1);
  same(score.detail.map(x => x.ok), [true, false]);
});

test('a wrong container in the right place is not a place error', () => {
  const strip = rules.stripOn(PLACES, d('2026-08-27'));
  same(rules.errorKind(strip, 'restmuell', ['papier']), 'container');
  same(rules.errorKind(strip, 'restmuell', ['glas_weiss']), 'place');
});

test('the aim frame picks the nearest container, not the one before it', () => {
  const centres = [50, 150, 250];
  same(nearestIndex(centres, 40), 0);
  same(nearestIndex(centres, 99), 0);
  same(nearestIndex(centres, 101), 1);
  same(nearestIndex(centres, 9999), 2);
});

test('shuffle keeps every item exactly once', () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  same(rules.shuffle(list).sort((a, b) => a - b), list);
  same(list, [1, 2, 3, 4, 5, 6, 7, 8], 'исходный список не должен меняться');
});

test('dropping early is worth more, and being wrong early costs more', () => {
  const rightNow = score.scoreAnswer({ ok: true, early: true, remaining: 1 });
  const rightLate = score.scoreAnswer({ ok: true, early: false, remaining: 0 });
  const wrongNow = score.scoreAnswer({ ok: false, early: true, remaining: 1 });
  const wrongLate = score.scoreAnswer({ ok: false, early: false, remaining: 0 });
  same([rightNow, rightLate, wrongNow, wrongLate], [150, 100, -75, -50]);
  assert(rightNow > rightLate, 'ранний верный ответ дороже');
  assert(wrongNow < wrongLate, 'ранняя ошибка дороже обходится');
});

test('the early bonus shrinks as the object falls', () => {
  const top = score.scoreAnswer({ ok: true, early: true, remaining: 1 });
  const middle = score.scoreAnswer({ ok: true, early: true, remaining: 0.5 });
  const bottom = score.scoreAnswer({ ok: true, early: true, remaining: 0 });
  assert(top > middle && middle > bottom, [top, middle, bottom].join(' > '));
  same(bottom, 100, 'у самой ленты ранний сброс уже ничего не добавляет');
});

test('taking an item apart never scores below sending it whole', () => {
  const bothWrong = score.scoreAnswer({ ok: false, early: false, remaining: 0 }) * 2;
  same(bothWrong, -100, 'без пола две ошибки стоили бы вдвое');
  same(score.splitFloor(bothWrong, score.POINTS.wrong), -50, 'пол по R9');
  same(score.splitFloor(200, score.POINTS.wrong), 200, 'хороший разбор пол не трогает');
});

test('a tier clears on a share, not on a clean run', () => {
  assert(score.tierCleared(7, 10), '70% проходит');
  assert(!score.tierCleared(69, 100), '69% не проходит');
  assert(score.tierCleared(10, 10), 'чистый проход тоже проходит');
  assert(!score.tierCleared(0, 0), 'без ответов нечего засчитывать');
});

test('a correct answer still names the other correct destinations', () => {
  const strip = rules.stripOn(PLACES, d('2026-08-27'));
  const line = explain.explainSlot({
    strip,
    slot: { id: 'whole', labels: { de: 'Ladegerät' }, destinations: ['restmuell', 'papier'] },
    chosen: 'restmuell', errorKind: 'container'
  });
  assert(line.ok, 'ответ верный');
  same(line.also, ['Papier'], 'второй верный адресат назван даже при верном ответе');
});

test('a place error is explained as a place, not as a container', () => {
  const strip = rules.stripOn(PLACES, d('2026-08-27'));
  const line = explain.explainSlot({
    strip, slot: { id: 'whole', labels: { de: 'Flasche' }, destinations: ['glas_weiss'] },
    chosen: 'restmuell', errorKind: 'place'
  });
  assert(!line.ok);
  same(line.kind, 'place');
  same([line.chosenPlace, line.wantedPlace], ['Zuhause', 'Insel']);
});

test('three reasons answer three different questions, in order', () => {
  const item = { id: 'karton', explanation: { de: 'zwei Antworten, nicht eine' } };
  const variant = { id: 'fettig', kind: 'composite', labels: { de: 'mit Resten' },
                    explanation: { de: 'mit Resten ist er nicht mehr sauber' } };
  const slots = [{ id: 'reste', labels: { de: 'Reste' },
                   explanation: { de: 'Essensreste gehören in die Biotonne' } }];
  const got = explain.reasons({ item, variant, slots, lang: 'de' });
  same(got.map(r => r.text), [
    'Essensreste gehören in die Biotonne',
    'mit Resten ist er nicht mehr sauber',
    'zwei Antworten, nicht eine'
  ], 'сначала часть, потом вариант, потом предмет');
});

test('a simple variant explains itself once, not twice', () => {
  const item = { id: 'dose', explanation: { de: 'das DPG-Logo entscheidet' } };
  const variant = { id: 'frei', kind: 'simple', labels: { de: 'Pfandfrei' },
                    explanation: { de: 'ohne Pfandzeichen: Metall' } };
  // Слот простого варианта — сам вариант, и пояснение у них одно и то же.
  const slots = [{ id: 'frei', labels: { de: 'Pfandfrei' },
                   explanation: variant.explanation }];
  const got = explain.reasons({ item, variant, slots, lang: 'de' });
  same(got.map(r => r.text), ['ohne Pfandzeichen: Metall', 'das DPG-Logo entscheidet']);
  same(got[0].scope, null, 'у единственного слота заголовок не нужен — он уже в строке ответа');
});

test('an item with one reason still explains itself', () => {
  const item = { id: 'x', explanation: { de: 'nur eins' } };
  const got = explain.reasons({ item, variant: { id: 'v' }, slots: [{ id: 'v' }], lang: 'de' });
  same(got.map(r => r.text), ['nur eins']);
  same(got[0].scope, null, 'общее пояснение идёт без заголовка');
});

test('the same sentence is never shown twice', () => {
  const text = { de: 'одно и то же' };
  const got = explain.reasons({ item: { explanation: text },
                                variant: { explanation: text }, slots: [], lang: 'de' });
  same(got.length, 1);
});

test('a missing translation falls back rather than showing nothing', () => {
  same(explain.reasonText({ explanation: { en: 'only english' } }, 'de'), 'only english');
  same(explain.reasonText({}, 'de'), '');
});

const box = document.getElementById('out');
const bad = results.filter(r => !r.ok);
box.innerHTML = results.map(r =>
  '<div class="' + (r.ok ? 'ok' : 'bad') + '">' + (r.ok ? '✓' : '✗') + ' ' + r.name +
  (r.ok ? '' : '<br><small>' + r.why + '</small>') + '</div>').join('');
document.getElementById('sum').textContent =
  results.length + ' тестов, провалено ' + bad.length;
document.title = (bad.length ? '✗ ' : '✓ ') + document.title;
window.__results = { total: results.length, failed: bad.length, bad };
