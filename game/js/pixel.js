// Turning palette grids into pictures, and text into pixel type. Everything is
// drawn once into a canvas and cached as a data URL; the browser scales it with
// nearest-neighbour (image-rendering: pixelated), so a 16-pixel sprite stays
// crisp at any size.

import { PALETTE, ITEMS, CONTAINERS, ROUTES, TREE, SKYLINE } from './sprites.js';

const cache = new Map();

export function draw(rows, scale = 1) {
  const h = rows.length, w = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    ctx.fillStyle = PALETTE[ch] || '#f0f';
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  return canvas;
}

function url(key, rows) {
  if (!cache.has(key)) cache.set(key, draw(rows).toDataURL());
  return cache.get(key);
}

// An object's picture: a part has its own, a variant has one only where the eye
// is the honest cue, and an object nobody drew falls back to a plain box rather
// than to nothing.
export function itemKey(item, variant, partId) {
  if (partId && ITEMS[item.id + ':' + partId]) return item.id + ':' + partId;
  if (variant && ITEMS[item.id + '.' + variant.id]) return item.id + '.' + variant.id;
  return ITEMS[item.id] ? item.id : null;
}

const UNKNOWN = [
  '................', '................', '...kkkkkkkkkk...', '..kTTTTTTTTTTk..',
  '..kTkkkkkkkkTk..', '..kTTTTTTTTTTk..', '..ktttttttttTk..', '..ktttttttttTk..',
  '..ktttkkktttTk..', '..ktttttttttTk..', '..ktttttttttTk..', '..knnnnnnnnnnk..',
  '...kkkkkkkkkk...', '................', '................', '................',
];

export function itemSprite(item, variant, partId) {
  const key = itemKey(item, variant, partId);
  return key ? url('i:' + key, ITEMS[key]) : url('i:?', UNKNOWN);
}

export function containerSprite(id) {
  return CONTAINERS[id] ? url('c:' + id, CONTAINERS[id]) : url('i:?', UNKNOWN);
}

export function routeSprite(id) { return url('r:' + id, ROUTES[id]); }
export function treeSprite() { return url('tree', TREE); }
export function skylineSprite() { return url('sky', SKYLINE); }

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
