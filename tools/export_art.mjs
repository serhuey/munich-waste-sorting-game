#!/usr/bin/env node
// Export every drawn sprite as a 1× PNG, plus the palette, to draw over.
//
//     node tools/export_art.mjs           # never overwrites a file you have edited
//     node tools/export_art.mjs --force   # start again from the drawings in code
//
// Writes art/originals/<kind>/<name>.png and art/palette.gpl. Draw over any of
// the files in place, then run `node tools/collect_art.mjs`: it finds what you
// changed and hands it to the game. Keep the size — objects 32×32, containers
// 48×48 — and export at 100 %.

import fs from 'node:fs';
import path from 'node:path';
import { encode } from './png.mjs';
import { root, KINDS, fileName, differs } from './art_common.mjs';

const force = process.argv.includes('--force');
const out = path.join(root, 'art', 'originals');
const colours = new Map();
let written = 0;
const kept = [];
for (const [kind, set] of Object.entries(KINDS)) {
  fs.mkdirSync(path.join(out, kind), { recursive: true });
  for (const [key, sprite] of Object.entries(set)) {
    sprite.px.forEach(c => c && colours.set(c, (colours.get(c) || 0) + 1));
    const file = path.join(out, kind, fileName(key));
    // A file whose pixels differ from the code is someone's drawing; an export
    // that replaced it would erase their work without a word.
    if (!force && fs.existsSync(file)) {
      const d = differs(file, sprite);
      if (d.error || d.pixels) { kept.push(`${kind}/${fileName(key)}`); continue; }
    }
    fs.writeFileSync(file, encode(sprite));
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
if (kept.length) console.log(`kept ${kept.length} edited file(s), use --force to overwrite: ${kept.join(', ')}`);
