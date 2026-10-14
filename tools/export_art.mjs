#!/usr/bin/env node
// Export every drawn sprite as a 1× PNG, plus the palette, as a starting point
// for redrawing by hand.
//
//     node tools/export_art.mjs
//
// Writes art/originals/<kind>/<name>.png and art/palette.gpl. Nothing here is
// used by the game: open a file in Pixelorama, redraw it, and save it under the
// same name into game/art/<kind>/ — from then on the game shows your file
// instead of the drawing in game/js/sprites.js. Keep the size: objects are
// 32×32, containers 48×48; a test refuses anything else.

import fs from 'node:fs';
import path from 'node:path';
import { encode } from './png.mjs';
import { ITEMS, CONTAINERS, ROUTES, DECOR, TREE, SKYLINE } from '../game/js/sprites.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'art', 'originals');
export const KINDS = { items: ITEMS, containers: CONTAINERS, routes: ROUTES, decor: DECOR,
                       scenery: { tree: TREE, skyline: SKYLINE } };
// A part's key carries a colon, which Finder shows as a slash; in a file name
// it is written as a double dash.
export const fileName = key => key.replace(/:/g, '--') + '.png';

const colours = new Map();
let written = 0;
for (const [kind, set] of Object.entries(KINDS)) {
  fs.mkdirSync(path.join(out, kind), { recursive: true });
  for (const [key, sprite] of Object.entries(set)) {
    fs.writeFileSync(path.join(out, kind, fileName(key)), encode(sprite));
    sprite.px.forEach(c => c && colours.set(c, (colours.get(c) || 0) + 1));
    written++;
  }
}

// The palette in GIMP's format, which Pixelorama imports. Colours run dark to
// light within families of hue, so ramps sit next to each other.
const hsl = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
};
const sorted = [...colours.keys()].sort((a, b) => {
  const A = hsl(a), B = hsl(b);
  const fa = A.s < 0.12 ? -1 : Math.floor(A.h / 30), fb = B.s < 0.12 ? -1 : Math.floor(B.h / 30);
  return fa - fb || A.l - B.l;
});
const lines = ['GIMP Palette', 'Name: Muenchner Muelltrennung', 'Columns: 16', '#'];
sorted.forEach(hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${hex}`);
});
fs.writeFileSync(path.join(root, 'art', 'palette.gpl'), lines.join('\n') + '\n');
console.log(`${written} sprites → art/originals/, ${sorted.length} colours → art/palette.gpl`);
