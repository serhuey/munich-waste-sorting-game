#!/usr/bin/env node
// Hand the sprites you redrew to the game.
//
//     node tools/collect_art.mjs
//
// Compares every PNG in art/originals/ with the drawing in code, pixel by pixel,
// and copies each one that differs into game/art/<kind>/, where it replaces the
// drawing in code. Files that differ only in how the editor encoded them are
// left alone. Then rebuild: python3 tools/build_data.py --fixtures

import fs from 'node:fs';
import path from 'node:path';
import { root, KINDS, keyOf, differs } from './art_common.mjs';

const src = path.join(root, 'art', 'originals');
const dst = path.join(root, 'game', 'art');
const copied = [], problems = [];
let unchanged = 0;
for (const [kind, set] of Object.entries(KINDS)) {
  const dir = path.join(src, kind);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort()) {
    const sprite = set[keyOf(f)];
    if (!sprite) { problems.push(`${kind}/${f}: no such sprite`); continue; }
    const d = differs(path.join(dir, f), sprite);
    if (d.error) { problems.push(`${kind}/${f}: ${d.error}`); continue; }
    if (!d.pixels) { unchanged++; continue; }
    const target = path.join(dst, kind, f);
    const before = fs.existsSync(target) ? fs.readFileSync(target) : null;
    const now = fs.readFileSync(path.join(dir, f));
    if (before && before.equals(now)) { unchanged++; continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, now);
    copied.push(`${kind}/${f} (${d.pixels} px)`);
  }
}
console.log(copied.length ? `copied ${copied.length} into game/art/:\n  ` + copied.join('\n  ') : 'nothing new to copy');
console.log(`${unchanged} unchanged`);
if (problems.length) { console.log('problems:\n  ' + problems.join('\n  ')); process.exitCode = 1; }
