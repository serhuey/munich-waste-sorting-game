// Pictures and pixel type. Every picture is a PNG in game/art/<kind>/ — drawn
// by hand, edited in place, the only source the game reads. The browser scales
// it with nearest-neighbour (image-rendering: pixelated), so a 32-pixel sprite
// stays crisp at any size.

// A sprite given as rows of letters, painted into a canvas. Only the fallback
// box below still lives as letters, and the sprite sheet uses this to show it.
const LETTERS = { k: '#1a1c2c', T: '#f0d2a2', t: '#d09a5c', n: '#9a6038' };
export function draw(rows, scale = 1) {
  const w = rows[0].length, h = rows.length;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  rows.join('').split('').forEach((ch, i) => {
    if (ch === '.') return;
    ctx.fillStyle = LETTERS[ch] || '#f0f';
    ctx.fillRect((i % w) * scale, Math.floor(i / w) * scale, scale, scale);
  });
  return canvas;
}

// What a missing file shows: a plain box rather than nothing. The terminal tests
// refuse a release where any object in data would come to this.
const UNKNOWN = [
  '................', '................', '...kkkkkkkkkk...', '..kTTTTTTTTTTk..',
  '..kTkkkkkkkkTk..', '..kTTTTTTTTTTk..', '..ktttttttttTk..', '..ktttttttttTk..',
  '..ktttkkktttTk..', '..ktttttttttTk..', '..ktttttttttTk..', '..knnnnnnnnnnk..',
  '...kkkkkkkkkk...', '................', '................', '................',
];
let unknown = null;
const fallback = () => unknown || (unknown = draw(UNKNOWN).toDataURL());

// The build lists what lies in game/art/<kind>/, with each file's size, so the
// game never asks for a file that is not there and can lay a picture out before
// it arrives. A part is written with a double dash in the file name, because a
// colon is not a thing to put in a Mac file name.
const art = new Map();
const sizes = new Map();
export function setArt(list, version) {
  art.clear(); sizes.clear();
  // The build's version on every address, so a redrawn picture is fetched anew
  // rather than served from yesterday's cache.
  const tag = version ? '?v=' + version : '';
  Object.entries(list || {}).forEach(([file, size]) => {
    const [kind, name] = file.split('/');
    const key = kind + '/' + name.replace(/\.png$/, '').replace(/--/g, ':');
    art.set(key, 'art/' + file + tag);
    sizes.set(key, { w: size[0], h: size[1] });
  });
}
const pick = (kind, key) => art.get(kind + '/' + key) || fallback();
const has = key => art.has('items/' + key);

// An object's picture: a part has its own, a variant has one only where the eye
// is the honest cue — green glass looks green before anyone reads a label — and
// otherwise the object's own picture stands for all its versions.
export function itemKey(item, variant, partId) {
  if (partId && has(item.id + ':' + partId)) return item.id + ':' + partId;
  if (variant && has(item.id + '.' + variant.id)) return item.id + '.' + variant.id;
  return has(item.id) ? item.id : null;
}
export function itemSprite(item, variant, partId) {
  const key = itemKey(item, variant, partId);
  return key ? pick('items', key) : fallback();
}
// Every file, fetched in the background once the game is up. They are small
// (about 100 KB together) but many, and fetched on first sight each one arrived
// after its card had started falling.
export function prefetchArt() {
  const urls = [...art.values()];
  const go = () => urls.forEach(u => { const i = new Image(); i.decoding = 'async'; i.src = u; });
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 1500 });
  else setTimeout(go, 300);
}
export function itemSpriteByKey(key) { return pick('items', key); }
export function containerSprite(id) { return pick('containers', id); }
export function routeSprite(id) { return pick('routes', id); }
export function decorSprite(id) { return pick('decor', id); }
export function decorSize(id) { return sizes.get('decor/' + id) || { w: 16, h: 16 }; }
export function treeSprite() { return pick('scenery', 'tree'); }
export function skylineSprite() { return pick('scenery', 'skyline'); }

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
