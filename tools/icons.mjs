#!/usr/bin/env node
// The icons of the page and of the installed app, drawn from the game's own
// paper bin so the tab and the home screen look like the game.
//
//     node tools/icons.mjs
//
// Writes game/icons/. The bin is scaled by whole numbers only, so every pixel of
// the sprite stays a square block — a smoothed pixel sprite reads as a smudge.
// The maskable icon keeps the bin inside the central circle every launcher
// leaves uncut (radius 0.4 of the side).

import fs from 'node:fs';
import path from 'node:path';
import { encode, decode } from './png.mjs';

const REPO = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const SPRITE = path.join(REPO, 'game', 'art', 'containers', 'papier.png');
const OUT = path.join(REPO, 'game', 'icons');
const SKY = '#86bde4';   // the top band of the game's sky

const art = decode(fs.readFileSync(SPRITE));
// The bin without its transparent margin.
let x0 = art.w, y0 = art.h, x1 = -1, y1 = -1;
for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) {
  if (!art.px[y * art.w + x]) continue;
  x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
}
const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
const at = (x, y) => art.px[(y0 + y) * art.w + x0 + x];

// side × side, the bin at a whole scale, centred, on bg (null: transparent).
function icon(side, scale, bg) {
  const px = new Array(side * side).fill(bg);
  const ox = Math.floor((side - bw * scale) / 2), oy = Math.floor((side - bh * scale) / 2);
  for (let y = 0; y < bh * scale; y++) for (let x = 0; x < bw * scale; x++) {
    const c = at(Math.floor(x / scale), Math.floor(y / scale));
    if (c) px[(oy + y) * side + ox + x] = c;
  }
  return { w: side, h: side, px };
}

// The tab icon as vector squares: sharp at 16 px and at 64 alike.
function svg() {
  const side = Math.max(bw, bh), ox = (side - bw) / 2, oy = (side - bh) / 2;
  const rects = [];
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw;) {
      const c = at(x, y);
      let run = 1;
      while (x + run < bw && at(x + run, y) === c) run++;
      if (c) rects.push(`<rect x="${x + ox}" y="${y + oy}" width="${run}" height="1" fill="${c}"/>`);
      x += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges">${rects.join('')}</svg>\n`;
}

fs.mkdirSync(OUT, { recursive: true });
const files = {
  'icon.svg': svg(),
  'favicon-48.png': encode(icon(48, 1, null)),
  'apple-touch-icon.png': encode(icon(180, 3, SKY)),
  'icon-192.png': encode(icon(192, 3, SKY)),
  'icon-512.png': encode(icon(512, 8, SKY)),
  'icon-maskable-512.png': encode(icon(512, 6, SKY)),
};
for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), data);
console.log('written: ' + Object.keys(files).map(n => 'game/icons/' + n).join(', '));
