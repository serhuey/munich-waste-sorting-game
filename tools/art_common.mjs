// What the art tools share: where each kind of sprite lives, how a sprite key
// maps to a file name, and whether a PNG differs from the drawing in code.

import fs from 'node:fs';
import path from 'node:path';
import { decode } from './png.mjs';
import { ITEMS, CONTAINERS, ROUTES, DECOR, TREE, SKYLINE } from '../game/js/sprites.js';

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const KINDS = { items: ITEMS, containers: CONTAINERS, routes: ROUTES, decor: DECOR,
                       scenery: { tree: TREE, skyline: SKYLINE } };
// A part's key carries a colon, which Finder shows as a slash; in a file name
// it is written as a double dash.
export const fileName = key => key.replace(/:/g, '--') + '.png';
export const keyOf = file => file.slice(0, -4).replace(/--/g, ':');

// Pixels, not bytes: an editor re-encodes a file it saves, so bytes differ even
// where nothing was drawn.
export function differs(file, sprite) {
  let img;
  try { img = decode(fs.readFileSync(file)); } catch (e) { return { error: e.message }; }
  if (img.w !== sprite.w || img.h !== sprite.h) return { error: `${img.w}×${img.h}, must be ${sprite.w}×${sprite.h}` };
  let n = 0;
  for (let i = 0; i < img.px.length; i++) if ((img.px[i] || '').toLowerCase() !== (sprite.px[i] || '').toLowerCase()) n++;
  return { pixels: n };
}
