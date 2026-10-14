// A minimal PNG reader and writer for the art pipeline: RGBA, 8 bits, no
// dependencies beyond node's zlib. Enough to export the drawn sprites and to
// read back the size and pixels of a file someone has edited.

import zlib from 'node:zlib';

const TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function hexToRgba(hex) {
  return hex ? [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255] : [0, 0, 0, 0];
}

// sprite: { w, h, px } with a '#rrggbb' or null per pixel.
export function encode(sprite) {
  const { w, h, px } = sprite;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = hexToRgba(px[y * w + x]);
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Width and height from the header — all a check needs, and it reads any PNG.
export function size(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// Pixels of an 8-bit, non-interlaced PNG — truecolour, truecolour with alpha,
// greyscale or indexed — as '#rrggbb' or null for transparent, the same shape
// the sprites use. Pixel editors write all of these, and comparing pixels is the
// only way to tell an edited file from one that is merely re-saved.
export function decode(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let pos = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0, plte = null, trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (kind === 'PLTE') plte = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG: ${depth}-bit${interlace ? ', interlaced' : ''}`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error('unsupported colour type ' + type);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels, out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y ? out[(y - 1) * stride + x] : 0;
      const c = y && x >= channels ? out[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  const hex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  const px = new Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * channels;
    let r, g, b, al = 255;
    if (type === 6) { [r, g, b, al] = out.subarray(o, o + 4); }
    else if (type === 2) { [r, g, b] = out.subarray(o, o + 3); }
    else if (type === 0) { r = g = b = out[o]; }
    else if (type === 4) { r = g = b = out[o]; al = out[o + 1]; }
    else { const k = out[o]; [r, g, b] = plte.subarray(k * 3, k * 3 + 3); al = trns && k < trns.length ? trns[k] : 255; }
    px[i] = al < 128 ? null : hex(r, g, b);
  }
  return { w, h, px };
}
