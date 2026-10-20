// The result as a picture, for the share sheet (U11). Drawn here in the browser
// from the game's own sprites and pixel type, so nothing leaves the device and
// no font or service is fetched: the picture goes wherever the player sends it
// and nowhere else. It names no player and no AWM mark — an unofficial game
// must not look like a certificate from the city.

import { pixelText, treeSprite, skylineSprite } from './pixel.js';

export const CARD = { w: 1080, h: 1350 };   // 4:5, what feeds and chats show uncropped
export const CARD_FILE = 'muelltrennung-ergebnis.png';

// A title for the share of right answers, never for the points: points reward
// speed, and a card should say how well someone knows where things go.
export function rankKey(right, answered) {
  const share = answered ? right / answered : 0;
  if (share >= 0.9) return 'card_rank_top';
  if (share >= 0.7) return 'card_rank_mid';
  return 'card_rank_low';
}

const PROSE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const C = { ink: '#1a1c2c', paper: '#f4f4f4', cream: '#fff7e6', grey: '#566c86',
            ok: '#2f9e57', okShadow: '#a7f070', navy: '#29366f', sun: '#ffcd75',
            sky: ['#86bde4', '#a3d0ee', '#bfe3f7'] };

const load = src => new Promise((resolve, reject) => {
  const i = new Image();
  i.onload = () => resolve(i);
  i.onerror = reject;
  i.src = src;
});

// Prose wrapped to a width, centred on x; returns the y below the last line.
function prose(ctx, text, x, y, width, size, color, weight = 400) {
  ctx.font = `${weight} ${size}px ${PROSE}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const next = line ? line + ' ' + word : word;
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * 1.3));
  return y + lines.length * size * 1.3;
}

// Pixel type at the largest whole scale that fits the width, centred on x.
function heading(ctx, text, x, y, maxWidth, maxScale, opts) {
  let scale = maxScale;
  let c = pixelText(text, { ...opts, scale });
  while (scale > 1 && c.width > maxWidth) c = pixelText(text, { ...opts, scale: --scale });
  ctx.drawImage(c, Math.round(x - c.width / 2), y);
  return y + c.height;
}

// texts: { title, rank, points, line, question, note, address }, all in the
// player's language already. Resolves to a PNG Blob.
export async function renderCard(texts) {
  const { w, h } = CARD;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const [tree, sky] = await Promise.all([load(treeSprite()), load(skylineSprite())]);

  // The game's sky: three bands, the city along the bottom.
  [[0, 0.4], [0.4, 0.72], [0.72, 1]].forEach(([a, b], i) => {
    ctx.fillStyle = C.sky[i];
    ctx.fillRect(0, Math.round(a * h), w, Math.ceil((b - a) * h));
  });
  const ss = 4;
  ctx.drawImage(sky, Math.round((w - sky.width * ss) / 2), h - 96 - sky.height * ss, sky.width * ss, sky.height * ss);

  const mid = w / 2;
  heading(ctx, texts.title, mid, 56, w - 120, 6, { color: C.paper, shadow: C.navy });

  // The sheet: paper, an ink frame, the hard shadow the game's buttons have.
  const px = 90, py = 150, pw = w - 2 * px, ph = 900;
  ctx.fillStyle = C.ink; ctx.fillRect(px + 12, py + 12, pw, ph);
  ctx.fillRect(px - 6, py - 6, pw + 12, ph + 12);
  ctx.fillStyle = C.cream; ctx.fillRect(px, py, pw, ph);

  const ts = 4;
  ctx.drawImage(tree, Math.round(mid - tree.width * ts / 2), py + 40, tree.width * ts, tree.height * ts);
  let y = py + 40 + tree.height * ts + 30;
  y = heading(ctx, texts.rank, mid, y, pw - 80, 6, { color: C.navy, shadow: C.sun }) + 34;
  y = heading(ctx, texts.points, mid, y, pw - 80, 12, { color: C.ok, shadow: C.okShadow }) + 30;
  y = prose(ctx, texts.line, mid, y, pw - 100, 40, C.ink, 700) + 22;
  prose(ctx, texts.question, mid, y, pw - 120, 38, C.ink);
  prose(ctx, texts.note, mid, py + ph - 56, pw - 80, 26, C.grey);

  // Where to play, as type in the picture: several apps drop the text and the
  // link when a file comes with them, and the address must survive that.
  ctx.fillStyle = C.ink; ctx.fillRect(0, h - 96, w, 96);
  heading(ctx, texts.address, mid, h - 96 + 27, w - 80, 6, { color: C.paper });

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}
