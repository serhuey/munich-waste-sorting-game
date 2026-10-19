#!/usr/bin/env node
// A first picture for whatever has none yet, and the palette to draw with.
//
//     node tools/sketch_art.mjs
//
// The game reads only game/art/<kind>/<name>.png — those files are the art, and
// you edit them in place. This tool never touches a file that exists. It writes
// one only where tools/sketches.mjs has a drawing and game/art has no file — a
// new object's first draft, painted in code, to redraw by hand or keep — and
// names every object in data that has neither. Then it rebuilds
// art/palette.gpl from the colours in game/art, for Pixelorama.
//
// Objects are 32×32, containers and routes 48×48; decorations, the tree and the
// skyline keep the size they have.

import fs from 'node:fs';
import path from 'node:path';
import { encode, decode } from './png.mjs';
import { ITEMS, CONTAINERS, ROUTES, DECOR, TREE, SKYLINE } from './sketches.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artDir = path.join(root, 'game', 'art');
const KINDS = { items: ITEMS, containers: CONTAINERS, routes: ROUTES, decor: DECOR,
                scenery: { tree: TREE, skyline: SKYLINE } };
// A part's key carries a colon, which Finder shows as a slash; in a file name
// it is written as a double dash.
const fileOf = (kind, key) => path.join(artDir, kind, key.replace(/:/g, '--') + '.png');

const written = [];
for (const [kind, set] of Object.entries(KINDS)) {
  for (const [key, sprite] of Object.entries(set)) {
    const file = fileOf(kind, key);
    if (fs.existsSync(file)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encode(sprite));
    written.push(`${kind}/${path.basename(file)}`);
  }
}

// What data needs and nothing provides: no file and no sketch to make one from.
const json = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const missing = [];
for (const dir of ['data/items', 'data/drafts']) {
  for (const f of fs.readdirSync(path.join(root, dir))) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    const { id } = json(dir + '/' + f);
    if (!fs.existsSync(fileOf('items', id))) missing.push(`items/${id}.png`);
  }
}

// The palette in GIMP's format, which Pixelorama imports: every colour in use,
// dark to light within families of hue, so ramps sit next to each other.
const colours = new Set();
for (const kind of fs.readdirSync(artDir)) {
  const dir = path.join(artDir, kind);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.png'))) {
    decode(fs.readFileSync(path.join(dir, f))).px.forEach(c => c && colours.add(c.toLowerCase()));
  }
}
const hsl = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
};
const sorted = [...colours].sort((a, b) => {
  const A = hsl(a), B = hsl(b);
  const fa = A.s < 0.12 ? -1 : Math.floor(A.h / 30), fb = B.s < 0.12 ? -1 : Math.floor(B.h / 30);
  return fa - fb || A.l - B.l;
});
const lines = ['GIMP Palette', 'Name: Muenchner Muelltrennung', 'Columns: 16', '#'];
sorted.forEach(hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${hex}`);
});
fs.mkdirSync(path.join(root, 'art'), { recursive: true });
fs.writeFileSync(path.join(root, 'art', 'palette.gpl'), lines.join('\n') + '\n');

console.log(written.length ? `sketched ${written.length} into game/art/:\n  ` + written.join('\n  ') : 'nothing to sketch');
console.log(`${sorted.length} colours → art/palette.gpl`);
if (missing.length) {
  console.log('no picture and no sketch — draw these:\n  ' + missing.join('\n  '));
  process.exitCode = 1;
}
