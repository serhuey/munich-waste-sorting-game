// The result as a picture, for the share sheet (U11). Drawn here in the browser
// from the game's own sprites and pixel type, so nothing leaves the device and
// no font or service is fetched: the picture goes wherever the player sends it
// and nowhere else. It names no player and no AWM mark — an unofficial game
// must not look like a certificate from the city.

import { pixelText, itemSpriteByKey, skylineSprite } from './pixel.js';

export const CARD = { w: 1080, h: 1350 };   // 4:5, what feeds and chats show uncropped
export const CARD_FILE = 'muelltrennung-ergebnis.png';
// The objects the title screen opens with. The card shows the same row, so a
// picture in a chat looks like the game it came from.
export const PARADE = ['bananenschalen', 'glasflasche.gruen', 'aludose', 'getraenkekarton', 'batterien'];

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

// Prose wrapped to a width, centred on x. Set downward from y, it returns the y
// below the last line; with bottom, y is where the last line ends and the text
// grows upward, returning the y above the first line — a line that wraps then
// pushes away from the frame instead of into it.
function prose(ctx, text, x, y, width, size, color, weight = 400, bottom = false) {
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
  const lh = size * 1.3;
  const top = bottom ? y - lines.length * lh : y;
  lines.forEach((l, i) => ctx.fillText(l, x, top + i * lh));
  return bottom ? top : top + lines.length * lh;
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
  const [sky, ...items] = await Promise.all([skylineSprite(), ...PARADE.map(itemSpriteByKey)].map(load));

  // The game's sky: three bands, the city along the bottom.
  [[0, 0.4], [0.4, 0.72], [0.72, 1]].forEach(([a, b], i) => {
    ctx.fillStyle = C.sky[i];
    ctx.fillRect(0, Math.round(a * h), w, Math.ceil((b - a) * h));
  });
  const ss = 4;
  const skyTop = h - 96 - sky.height * ss;
  ctx.drawImage(sky, Math.round((w - sky.width * ss) / 2), skyTop, sky.width * ss, sky.height * ss);

  const mid = w / 2;
  heading(ctx, texts.title, mid, 48, w - 120, 6, { color: C.paper, shadow: C.navy });

  // The sheet: paper, an ink frame, the hard shadow the game's buttons have.
  // Its shadow ends above the city's highest pixel, so the cathedral stands whole.
  const px = 90, py = 130, pw = w - 2 * px, ph = skyTop - 24 - py;
  ctx.fillStyle = C.ink; ctx.fillRect(px + 12, py + 12, pw, ph);
  ctx.fillRect(px - 6, py - 6, pw + 12, ph + 12);
  ctx.fillStyle = C.cream; ctx.fillRect(px, py, pw, ph);

  // Downward from the top: the objects, the rank, the points, the count.
  const is = 3, gap = 40;
  const rowW = items.reduce((s, i) => s + i.width * is, 0) + gap * (items.length - 1);
  const rowH = Math.max(...items.map(i => i.height)) * is;
  let x = Math.round(mid - rowW / 2);
  items.forEach(i => {
    ctx.drawImage(i, x, py + 40 + rowH - i.height * is, i.width * is, i.height * is);
    x += i.width * is + gap;
  });
  let y = py + 40 + rowH + 34;
  y = heading(ctx, texts.rank, mid, y, pw - 80, 6, { color: C.navy, shadow: C.sun }) + 30;
  y = heading(ctx, texts.points, mid, y, pw - 80, 12, { color: C.ok, shadow: C.okShadow }) + 26;
  prose(ctx, texts.line, mid, y, pw - 100, 40, C.ink, 700);
  // Upward from the frame: the note, the question above it.
  y = prose(ctx, texts.note, mid, py + ph - 32, pw - 80, 26, C.grey, 400, true) - 28;
  prose(ctx, texts.question, mid, y, pw - 120, 38, C.ink, 400, true);

  // Where to play, as type in the picture: several apps drop the text and the
  // link when a file comes with them, and the address must survive that.
  ctx.fillStyle = C.ink; ctx.fillRect(0, h - 96, w, 96);
  heading(ctx, texts.address, mid, h - 96 + 27, w - 80, 6, { color: C.paper });

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}
