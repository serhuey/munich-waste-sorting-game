// Turning palette grids into pictures, and text into pixel type. Everything is
// drawn once into a canvas and cached as a data URL; the browser scales it with
// nearest-neighbour (image-rendering: pixelated), so a 16-pixel sprite stays
// crisp at any size.

import { ITEMS, CONTAINERS, ROUTES, DECOR, TREE, SKYLINE } from './sprites.js';

const cache = new Map();

// A sprite is { w, h, px } with one colour (or null) per pixel; the fallback box
// below is still written as rows of letters, which this also reads.
const LETTERS = { k: '#1a1c2c', T: '#f0d2a2', t: '#d09a5c', n: '#9a6038' };
export function draw(sprite, scale = 1) {
  const s = Array.isArray(sprite)
    ? { w: sprite[0].length, h: sprite.length, px: sprite.join('').split('').map(ch => ch === '.' ? null : LETTERS[ch] || '#f0f') }
    : sprite;
  const canvas = document.createElement('canvas');
  canvas.width = s.w * scale; canvas.height = s.h * scale;
  const ctx = canvas.getContext('2d');
  s.px.forEach((c, i) => {
    if (!c) return;
    ctx.fillStyle = c;
    ctx.fillRect((i % s.w) * scale, Math.floor(i / s.w) * scale, scale, scale);
  });
  return canvas;
}

function url(key, rows) {
  if (!cache.has(key)) cache.set(key, draw(rows).toDataURL());
  return cache.get(key);
}

// Hand-drawn files win over drawings in code. The build lists what lies in
// game/art/<kind>/ so the game never asks for a file that is not there; a part
// is written with a double dash in the file name, because a colon is not a
// thing to put in a Mac file name.
const art = new Map();
export function setArt(list) {
  art.clear();
  (list || []).forEach(file => {
    const [kind, name] = file.split('/');
    art.set(kind + '/' + name.replace(/\.png$/, '').replace(/--/g, ':'), 'art/' + file);
  });
}
const drawn = (kind, key) => art.get(kind + '/' + key);
const has = (kind, set, key) => !!(set[key] || drawn(kind, key));
function pick(kind, set, key, prefix) {
  return drawn(kind, key) || (set[key] ? url(prefix + key, set[key]) : url('i:?', UNKNOWN));
}

// An object's picture: a part has its own, a variant has one only where the eye
// is the honest cue, and an object nobody drew falls back to a plain box rather
// than to nothing. A variant or a part can be drawn by hand without any code.
export function itemKey(item, variant, partId) {
  if (partId && has('items', ITEMS, item.id + ':' + partId)) return item.id + ':' + partId;
  if (variant && has('items', ITEMS, item.id + '.' + variant.id)) return item.id + '.' + variant.id;
  return has('items', ITEMS, item.id) ? item.id : null;
}

const UNKNOWN = [
  '................', '................', '...kkkkkkkkkk...', '..kTTTTTTTTTTk..',
  '..kTkkkkkkkkTk..', '..kTTTTTTTTTTk..', '..ktttttttttTk..', '..ktttttttttTk..',
  '..ktttkkktttTk..', '..ktttttttttTk..', '..ktttttttttTk..', '..knnnnnnnnnnk..',
  '...kkkkkkkkkk...', '................', '................', '................',
];

export function itemSprite(item, variant, partId) {
  const key = itemKey(item, variant, partId);
  return key ? pick('items', ITEMS, key, 'i:') : url('i:?', UNKNOWN);
}
export function itemSpriteByKey(key) { return pick('items', ITEMS, key, 'i:'); }
export function containerSprite(id) { return pick('containers', CONTAINERS, id, 'c:'); }
export function routeSprite(id) { return pick('routes', ROUTES, id, 'r:'); }
export function decorSprite(id) { return pick('decor', DECOR, id, 'd:'); }
export function decorSize(id) { const s = DECOR[id] || DECOR.kugel; return { w: s.w, h: s.h }; }
export function treeSprite() { return pick('scenery', { tree: TREE }, 'tree', 's:'); }
export function skylineSprite() { return pick('scenery', { skyline: SKYLINE }, 'skyline', 's:'); }

export function img(src, cls, alt = '') {
  const el = document.createElement('img');
  el.src = src;
  el.alt = alt;
  el.className = cls;
  el.draggable = false;
  return el;
}

// ------------------------------------------------------------------- type
// A 5×7 capital alphabet for headings and buttons. Prose — explanations, item
// names, container labels — stays in the system font, because a newcomer reading
// why the carton is not paper must not also be decoding a typeface.
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  Ä: ['#...#', '.###.', '#...#', '#####', '#...#', '#...#', '#...#'],
  Ö: ['#...#', '.###.', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Ü: ['#...#', '.....', '#...#', '#...#', '#...#', '#...#', '.###.'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '→': ['.....', '...#.', '....#', '#####', '....#', '...#.', '.....'],
  '€': ['..###', '.#...', '####.', '.#...', '####.', '.#...', '..###'],
  '–': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '★': ['..#..', '..#..', '#####', '.###.', '.###.', '##.##', '#...#'],
};

// Text in pixel capitals. The canvas carries the words as its accessible name,
// so a screen reader reads the heading rather than "image".
export function pixelText(text, { scale = 2, color = '#1a1c2c', shadow = null } = {}) {
  const chars = [...String(text).toUpperCase()].map(ch => GLYPHS[ch] || GLYPHS['?']);
  const width = chars.reduce((w, g) => w + g[0].length + 1, -1);
  const off = shadow ? 1 : 0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, (width + off) * scale);
  canvas.height = (7 + off) * scale;
  const ctx = canvas.getContext('2d');
  const paint = (dx, dy, fill) => {
    ctx.fillStyle = fill;
    let x = 0;
    chars.forEach(g => {
      g.forEach((row, y) => [...row].forEach((on, i) => {
        if (on === '#') ctx.fillRect((x + i + dx) * scale, (y + dy) * scale, scale, scale);
      }));
      x += g[0].length + 1;
    });
  };
  if (shadow) paint(1, 1, shadow);
  paint(0, 0, color);
  canvas.className = 'ptext';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', text);
  return canvas;
}

export function setPixelText(el, text, opts) {
  el.textContent = '';
  el.append(pixelText(text, opts));
  el.setAttribute('aria-label', text);
}
