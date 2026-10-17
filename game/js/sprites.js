// Pixel art for every object on the belt and every container under it. Objects
// are 32×32, containers 48×48. Each picture is painted from a few shapes by a
// tiny rasteriser — fill, a one-pixel ink outline, light from the top left, and
// a cylinder ramp for bottles and cans — so a hundred sprites stay one coherent
// style and the whole game's art is this one file. No request leaves the page.
//
// A sprite never gives away what the object's label decides: a deposit can and
// a deposit-free can share one picture, because telling them apart is what
// examining is for (R4). Variants get their own picture only where the eye is
// the honest cue — the colour of glass, a torn shirt.

export const INK = '#1a1c2c';

// Colour ramps: outline, dark, mid, light, highlight.
const R = {
  ink: { d: '#14161f', m: '#2b2f3a', l: '#454b5c' },
  white: { d: '#c3ccd6', m: '#e7ecf1', l: '#f8fafc', h: '#ffffff' },
  paper: { d: '#cfc6b4', m: '#eee7d8', l: '#fbf7ee', h: '#ffffff' },
  pulp: { d: '#9b9384', m: '#c4bcae', l: '#ddd6ca' },
  card: { d: '#94622f', m: '#c58e55', l: '#ddae78' },
  kraft: { d: '#a6733b', m: '#cf9c5e', l: '#e6bd83' },
  bread: { d: '#93521f', m: '#c4843f', l: '#e0ac66', h: '#f3d39a' },
  banana: { d: '#b8870f', m: '#f0c419', l: '#f9e27a' },
  egg: { d: '#c9a57b', m: '#e8cfac', l: '#f7e8d2' },
  coffee: { d: '#2e1a0e', m: '#4a2c17', l: '#6b4426' },
  steel: { d: '#69768a', m: '#a3afbd', l: '#d0d8e2', h: '#ffffff' },
  alu: { d: '#8592a3', m: '#bcc6d1', l: '#e3e9ef', h: '#ffffff' },
  red: { d: '#8f2737', m: '#c9364a', l: '#ec6a6a', h: '#ffb0a8' },
  blue: { d: '#243a8f', m: '#3b5dc9', l: '#6f8fe8', h: '#c2d2ff' },
  sky: { d: '#3b7bb0', m: '#5aa9e6', l: '#9fd3f7', h: '#e2f4ff' },
  screen: { d: '#1d2f6b', m: '#2c4a9e', l: '#4f78cc', h: '#9fc2ff' },
  clear: { d: '#7fb0c4', m: '#bde0ec', l: '#e3f4fa', h: '#ffffff' },
  milk: { d: '#c9c4d6', m: '#ebe8f2', l: '#f8f6fc', h: '#ffffff' },
  gglass: { d: '#1c6436', m: '#2e9a55', l: '#6dcf8a', h: '#c8f2d4' },
  bglass: { d: '#6b3a12', m: '#a35a1e', l: '#d0873e', h: '#f0c08a' },
  blglass: { d: '#1d2f80', m: '#3654c4', l: '#6f8ff0', h: '#cdd8ff' },
  yellow: { d: '#c08f06', m: '#f2bf0f', l: '#ffde5e', h: '#fff2b0' },
  green: { d: '#21703a', m: '#38b764', l: '#7fe08f', h: '#c9f5d2' },
  pink: { d: '#a8406a', m: '#e86a92', l: '#f7a8c2', h: '#ffe0ea' },
  orange: { d: '#b4532a', m: '#ef7d57', l: '#f9ad8a' },
  grey: { d: '#333c57', m: '#4b5671', l: '#6b7792' },
  wood: { d: '#663b1c', m: '#955c33', l: '#bd7f4c' },
  brown: { d: '#4a2c16', m: '#7a4a26', l: '#a06a3c' },
  purple: { d: '#3d1a3d', m: '#6a2f6a', l: '#9a5a9a', h: '#d6a8d6' },
  beige: { d: '#ad9c7c', m: '#d4c4a0', l: '#e8dcbf', h: '#f6efe0' },
  pet: { d: '#79a9c4', m: '#b4dbec', l: '#dff1f8', h: '#ffffff' },
  duvet: { d: '#c79a3a', m: '#f0cd70', l: '#fbe6a8' },
  mattress: { d: '#9fb2c8', m: '#d3dfec', l: '#eef4fa' },
  leaf: { d: '#1d5c33', m: '#2e8a4c', l: '#4fb36a', h: '#8fdc9f' },
};

class Painter {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (this.in(x, y)) this.px[y * this.w + x] = c; }
  get(x, y) { return this.in(x, y) ? this.px[y * this.w + x] : null; }

  // Fill a shape given as a test on pixel centres. The shape's own rim is inked,
  // its inside lit from the top left — or, for cylinders, shaded across each row.
  paint(test, ramp, o = {}) {
    const { w, h } = this;
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (test(x + 0.5, y + 0.5)) m[y * w + x] = 1;
    const at = (x, y) => this.in(x, y) && m[y * w + x] === 1;
    const ink = o.outline === false ? null : (o.ink || INK);
    const shade = o.shade || 'auto';
    for (let y = 0; y < h; y++) {
      let lx = -1, rx = -1;
      for (let x = 0; x < w; x++) if (at(x, y)) { if (lx < 0) lx = x; rx = x; }
      for (let x = 0; x < w; x++) {
        if (!at(x, y)) continue;
        const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
        if (edge && ink) { this.set(x, y, ink); continue; }
        let c = ramp.m;
        if (shade === 'cyl') {
          const t = (x - lx) / Math.max(1, rx - lx);
          c = t < 0.16 ? ramp.l : t < 0.3 && ramp.h ? ramp.h : t > 0.74 ? ramp.d : ramp.m;
        } else if (shade === 'auto') {
          const k = ink ? 2 : 1;
          if (!at(x - k, y) || !at(x, y - k)) c = ramp.l;
          if (!at(x + k, y) || !at(x, y + k)) c = ramp.d;
        } else if (shade === 'light') c = ramp.l;
        else if (shade === 'dark') c = ramp.d;
        if (o.tex && o.tex(x, y)) c = o.texColor || ramp.d;
        this.set(x, y, c);
      }
    }
    return this;
  }
  rect(x, y, w, h, ramp, o) { return this.paint((a, b) => a >= x && a < x + w && b >= y && b < y + h, ramp, o); }
  round(x, y, w, h, r, ramp, o) {
    return this.paint((a, b) => {
      if (a < x || a >= x + w || b < y || b >= y + h) return false;
      const cx = Math.min(Math.max(a, x + r), x + w - r), cy = Math.min(Math.max(b, y + r), y + h - r);
      return (a - cx) ** 2 + (b - cy) ** 2 <= r * r;
    }, ramp, o);
  }
  ell(cx, cy, rx, ry, ramp, o) { return this.paint((a, b) => ((a - cx) / rx) ** 2 + ((b - cy) / ry) ** 2 <= 1, ramp, o); }
  ring(cx, cy, r1, r2, ramp, o) {
    return this.paint((a, b) => { const d = (a - cx) ** 2 + (b - cy) ** 2; return d <= r1 * r1 && d >= r2 * r2; }, ramp, o);
  }
  poly(pts, ramp, o) {
    return this.paint((a, b) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > b) !== (yj > b) && a < (xj - xi) * (b - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }, ramp, o);
  }
  line(x0, y0, x1, y1, c, wd = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      for (let k = 0; k < wd; k++) this.set(Math.floor(x) + (Math.abs(x1 - x0) < Math.abs(y1 - y0) ? k : 0),
                                         Math.floor(y) + (Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? k : 0), c);
    }
    return this;
  }
  path(pts, c, wd = 1) { for (let i = 1; i < pts.length; i++) this.line(...pts[i - 1], ...pts[i], c, wd); return this; }
  hl(x, y, n, c) { for (let i = 0; i < n; i++) this.set(x + i, y, c); return this; }
  vl(x, y, n, c) { for (let i = 0; i < n; i++) this.set(x, y + i, c); return this; }
  dot(x, y, c) { this.set(x, y, c); return this; }
  clear(test) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (test(x, y)) this.px[y * this.w + x] = null; return this; }
  out() { return { w: this.w, h: this.h, px: this.px }; }
}

const draw = (w, h, fn) => { const p = new Painter(w, h); fn(p); return p.out(); };
const item = fn => draw(32, 32, fn);

// Textures that carry a colour for anyone who cannot see it (R12, AE11):
// green-versus-brown glass is exactly the pair a colour-blind player loses.
const TEX = {
  diag: (x, y) => (x + y) % 4 === 0,
  dots: (x, y) => x % 3 === 0 && y % 3 === 0,
  bars: x => x % 3 === 0,
  checks: (x, y) => (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0,
};

// ------------------------------------------------------------------- shapes
function bottle(p, ramp, tex) {
  p.poly([[14, 2], [18, 2], [18, 9], [23, 14], [23, 30], [9, 30], [9, 14], [14, 9]], ramp,
    { shade: 'cyl', tex: tex && TEX[tex], texColor: ramp.d });
  p.rect(13, 2, 6, 3, R.alu);
  p.rect(11, 18, 10, 7, R.paper, { shade: 'flat' });
  p.hl(13, 21, 6, R.paper.d);
}
function battery(p, x, band, mark) {
  p.rect(x + 2, 3, 4, 3, R.steel);
  p.round(x, 5, 8, 24, 2, R.ink, { shade: 'cyl' });
  p.rect(x, 8, 8, 12, band, { shade: 'cyl' });
  if (mark === 'plus') { p.hl(x + 2, 13, 4, '#ffffff'); p.vl(x + 3, 11, 5, '#ffffff'); p.vl(x + 4, 11, 5, '#ffffff'); }
  if (mark === 'bolt') p.path([[x + 5, 9], [x + 2, 14], [x + 5, 14], [x + 2, 19]], '#ffffff');
  p.rect(x, 26, 8, 3, R.steel, { shade: 'flat' });
}
function screwBase(p, y) {
  p.rect(12, y, 8, 6, R.alu, { shade: 'cyl' });
  for (let i = 1; i < 6; i += 2) p.hl(13, y + i, 6, R.alu.d);
  p.round(14, y + 5, 4, 3, 1, R.ink);
}
function hazard(p, cx, cy, s = 5) {
  p.poly([[cx, cy - s], [cx + s, cy], [cx, cy + s], [cx - s, cy]], R.white, { ink: '#c9364a', shade: 'flat' });
  p.vl(cx, cy - 2, 3, INK).dot(cx, cy + 2, INK);
}
function remote(p, open) {
  p.round(10, 2, 12, 28, 3, R.ink);
  p.ell(16, 6, 2, 2, R.red);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) p.rect(12 + c * 3, 11 + r * 3, 2, 2, R.grey, { outline: false, shade: 'light' });
  if (open) p.rect(12, 23, 8, 5, R.grey, { shade: 'dark' });
  else p.hl(12, 24, 8, R.ink.l);
}
function drill(p, withPack) {
  p.rect(0, 11, 4, 2, R.steel, { outline: false });
  p.rect(3, 9, 6, 6, R.ink);
  p.round(8, 6, 19, 10, 4, R.yellow);
  p.rect(22, 8, 3, 2, R.ink, { outline: false });
  p.poly([[14, 15], [22, 15], [21, 24], [15, 24]], R.yellow);
  p.rect(13, 16, 2, 3, R.ink);
  if (withPack) {
    p.round(10, 23, 16, 7, 1, R.ink);
    p.rect(20, 25, 2, 2, R.green, { outline: false, shade: 'light' });
  }
}

// ------------------------------------------------------------------- objects
const S = {
  // tier 1 ------------------------------------------------------------------
  backpapier: item(p => {
    p.round(2, 9, 28, 12, 2, R.white);
    p.rect(3, 12, 26, 3, R.red, { outline: false, shade: 'flat' });
    p.hl(6, 17, 10, R.white.d);
    p.poly([[15, 19], [30, 19], [28, 29], [12, 29]], R.paper);
    p.hl(16, 23, 10, R.paper.d).hl(15, 26, 10, R.paper.d);
  }),
  bananenschalen: item(p => {
    p.poly([[13, 9], [19, 9], [12, 28], [4, 25]], R.banana);
    p.poly([[13, 9], [19, 9], [27, 28], [18, 29]], R.banana);
    p.poly([[14, 9], [19, 9], [30, 17], [28, 24]], R.banana);
    p.rect(13, 9, 6, 4, R.paper, { outline: false, shade: 'flat' });
    p.rect(14, 3, 4, 7, R.brown);
    [[10, 20], [11, 23], [21, 23], [24, 18], [26, 21]].forEach(([x, y]) => p.dot(x, y, R.brown.m));
  }),
  brot: item(p => {
    p.round(2, 10, 28, 15, 7, R.bread);
    [[8, 12], [14, 12], [20, 12]].forEach(([x, y]) => p.line(x, y, x + 4, y + 6, R.bread.d).line(x + 1, y, x + 5, y + 6, R.bread.h));
    [[7, 20], [13, 21], [22, 20], [25, 17]].forEach(([x, y]) => p.dot(x, y, R.bread.h));
  }),
  coffeebecher: item(p => {
    p.poly([[9, 9], [23, 9], [21, 30], [11, 30]], R.white, { shade: 'cyl' });
    p.poly([[9.4, 14], [22.6, 14], [21.8, 23], [10.2, 23]], R.card, { shade: 'cyl' });
    p.ell(16, 18.5, 2.5, 2.5, R.brown, { outline: false });
    p.round(7, 5, 18, 5, 2, R.alu);
    p.hl(12, 6, 4, INK);
  }),
  eierkarton: item(p => {
    p.rect(2, 16, 28, 6, R.pulp);
    for (let i = 0; i < 4; i++) p.ell(6.5 + i * 6.3, 23, 3.4, 4.5, R.pulp);
    p.round(2, 7, 28, 11, 3, R.pulp);
    for (let i = 1; i < 4; i++) p.vl(2 + i * 7, 9, 7, R.pulp.d);
    p.rect(11, 10, 10, 4, R.white, { shade: 'flat' });
  }),
  eierschalen: item(p => {
    p.ell(11, 20, 7, 8, R.egg);
    p.ell(23, 22, 6, 6, R.egg);
    const cut1 = x => 15 + [0, -2, -1, 1][x % 4], cut2 = x => 19 + [1, -1, 0, -2][x % 4];
    p.clear((x, y) => (x <= 18 && y < cut1(x)) || (x >= 17 && x <= 29 && y < cut2(x) && y > 14));
    for (let x = 4; x <= 18; x++) if (p.get(x, cut1(x) + 1)) p.dot(x, cut1(x), INK);
    for (let x = 17; x <= 29; x++) if (p.get(x, cut2(x) + 1)) p.dot(x, cut2(x), INK);
    for (let x = 6; x <= 16; x++) if (p.get(x, cut1(x) + 2) && p.get(x, cut1(x) + 2) !== INK) p.dot(x, cut1(x) + 1, R.egg.d);
  }),
  kaffeefilter: item(p => {
    p.poly([[4, 8], [28, 8], [19, 29], [13, 29]], R.paper);
    for (let x = 14; x < 19; x += 2) p.vl(x, 26, 3, R.paper.d);
    p.ell(16, 9, 11, 3.5, R.coffee);
    [[12, 8], [18, 9], [21, 8]].forEach(([x, y]) => p.dot(x, y, R.coffee.l));
  }),
  papiertaschentuch: item(p => {
    p.poly([[5, 14], [9, 7], [16, 10], [22, 5], [28, 11], [26, 18], [29, 24], [20, 28], [12, 27], [4, 22]], R.white);
    p.path([[10, 12], [14, 17], [12, 23]], R.white.d).path([[20, 9], [19, 15], [24, 21]], R.white.d).path([[15, 20], [20, 23]], R.white.d);
  }),
  papiertuete: item(p => {
    p.path([[11, 10], [11, 5], [14, 3], [14, 10]], INK).path([[18, 10], [18, 3], [21, 5], [21, 10]], INK);
    p.rect(6, 9, 20, 21, R.kraft);
    p.rect(22, 10, 3, 19, R.kraft, { outline: false, shade: 'dark' });
    for (let x = 7; x < 25; x += 2) p.dot(x, 10, R.kraft.d);
    p.round(10, 16, 9, 7, 2, R.kraft, { shade: 'light', ink: R.kraft.d });
  }),
  thermosflasche: item(p => {
    p.round(10, 8, 12, 22, 3, R.steel, { shade: 'cyl' });
    p.rect(10, 18, 12, 3, R.ink, { shade: 'cyl' });
    p.round(9, 2, 14, 7, 2, R.ink, { shade: 'cyl' });
  }),
  windeln: item(p => {
    p.poly([[3, 8], [29, 8], [27, 14], [20, 22], [16, 25], [12, 22], [5, 14]], R.white);
    p.rect(3, 8, 6, 5, R.sky);
    p.rect(23, 8, 6, 5, R.sky);
    [[12, 13], [16, 16], [20, 13], [14, 19], [18, 19]].forEach(([x, y]) => p.dot(x, y, R.pink.m));
  }),
  zahnbuerste: item(p => {
    p.poly([[5, 26], [8, 29], [25, 10], [22, 7]], R.sky);
    p.line(8, 26, 22, 10, R.sky.h);
    p.poly([[20, 3], [29, 9], [26, 13], [17, 7]], R.white);
    for (let i = 0; i < 4; i++) p.dot(21 + i * 2, 6 + i, R.sky.m);
  }),
  zeitung: item(p => {
    p.rect(4, 5, 23, 23, R.paper);
    p.rect(26, 7, 3, 21, R.paper, { shade: 'dark' });
    p.rect(7, 8, 17, 3, R.ink, { outline: false, shade: 'flat' });
    p.rect(7, 13, 8, 7, R.grey, { outline: false });
    for (let y = 13; y < 25; y += 2) p.hl(17, y, 7, R.paper.d);
    for (let y = 22; y < 26; y += 2) p.hl(7, y, 8, R.paper.d);
  }),
  zigarettenschachtel: item(p => {
    p.rect(8, 5, 16, 24, R.white);
    p.rect(8, 5, 16, 10, R.red);
    p.hl(9, 9, 14, R.red.d);
    p.ell(16, 12, 2, 2, R.white, { outline: false });
    p.rect(10, 19, 12, 7, R.grey, { outline: false });
    p.hl(11, 21, 10, R.white.d);
  }),

  // tier 2 ------------------------------------------------------------------
  batterien: item(p => { battery(p, 6, R.yellow, 'plus'); battery(p, 18, R.yellow, 'plus'); }),
  akkus: item(p => { battery(p, 6, R.green, 'bolt'); battery(p, 18, R.green, 'bolt'); }),
  ladekabel: item(p => {
    p.rect(13, 0, 2, 4, R.steel, { outline: false });
    p.rect(17, 0, 2, 4, R.steel, { outline: false });
    p.round(10, 3, 12, 10, 2, R.white);
    p.path([[16, 13], [16, 17], [9, 20], [9, 25], [18, 28], [25, 24], [23, 18], [27, 15]], INK, 2);
    p.round(24, 9, 6, 7, 1, R.alu);
  }),
  handy: item(p => {
    p.round(8, 2, 16, 28, 3, R.ink);
    p.rect(10, 5, 12, 20, R.screen, { outline: false });
    p.line(12, 22, 20, 8, R.screen.h);
    p.hl(14, 27, 4, R.grey.l);
  }),
  elektrozahnbuerste: item(p => {
    p.round(8, 27, 16, 4, 1, R.grey);
    p.rect(14, 5, 4, 9, R.white);
    p.round(13, 1, 6, 6, 2, R.white);
    for (let y = 2; y < 6; y++) p.hl(14, y, 1, R.blue.m);
    p.round(11, 12, 10, 17, 4, R.white, { shade: 'cyl' });
    p.rect(13, 16, 6, 7, R.blue, { outline: false });
    p.ell(16, 25, 1.6, 1.6, R.blue, { outline: false });
  }),
  led_lampe: item(p => {
    p.poly([[10, 17], [22, 17], [19, 23], [13, 23]], R.white);
    p.ell(16, 11, 10, 9, R.white);
    p.rect(12, 9, 8, 3, R.yellow, { outline: false, shade: 'flat' });
    for (let x = 12; x < 20; x += 2) p.dot(x, 10, R.yellow.h);
    screwBase(p, 23);
  }),
  gluehlampe: item(p => {
    p.poly([[10, 17], [22, 17], [19, 23], [13, 23]], R.clear);
    p.ell(16, 11, 10, 9, R.clear);
    p.vl(13, 12, 9, R.grey.m).vl(19, 12, 9, R.grey.m);
    p.path([[13, 12], [14, 9], [15, 12], [16, 9], [17, 12], [18, 9], [19, 12]], R.orange.m);
    p.dot(10, 7, '#ffffff').dot(9, 9, '#ffffff');
    screwBase(p, 23);
  }),
  pfandflasche_einweg: item(p => {
    p.round(10, 8, 12, 22, 4, R.pet, { shade: 'cyl' });
    p.rect(13, 4, 6, 5, R.pet, { shade: 'cyl' });
    p.rect(12, 1, 8, 4, R.blue);
    p.rect(10, 15, 12, 7, R.red, { shade: 'cyl' });
    p.ring(16, 18.5, 2.5, 1.2, R.white, { outline: false, shade: 'flat' });
    p.hl(11, 25, 10, R.pet.d).hl(11, 27, 10, R.pet.d);
  }),
  pfandflasche_mehrweg: item(p => bottle(p, R.bglass, 'dots')),
  fernbedienung: item(p => remote(p, false)),

  // tier 3 ------------------------------------------------------------------
  aludose: item(p => {
    p.round(9, 5, 14, 24, 2, R.red, { shade: 'cyl' });
    p.round(9, 3, 14, 4, 1, R.alu, { shade: 'cyl' });
    p.rect(9, 27, 14, 3, R.alu, { shade: 'cyl' });
    p.path([[11, 22], [15, 14], [20, 11]], '#ffffff', 2);
  }),
  glasflasche: item(p => bottle(p, R.clear)),
  opalglas: item(p => {
    p.round(6, 11, 20, 18, 4, R.milk, { shade: 'cyl' });
    p.round(7, 6, 18, 6, 2, R.alu, { shade: 'cyl' });
    p.ell(16, 20, 4, 3, R.pink, { outline: false, shade: 'flat' });
    p.hl(13, 25, 6, R.milk.d);
  }),
  kristallglas: item(p => {
    p.poly([[7, 3], [25, 3], [24, 11], [19, 16], [13, 16], [8, 11]], R.clear);
    for (let x = 10; x < 24; x += 4) p.line(x, 5, x - 2, 12, R.clear.h);
    p.line(12, 6, 15, 13, R.clear.d);
    p.rect(15, 16, 2, 9, R.clear, { outline: false, shade: 'cyl' });
    p.vl(14, 16, 9, INK).vl(17, 16, 9, INK);
    p.ell(16, 27, 8, 2.5, R.clear);
  }),
  spiegel: item(p => {
    p.round(5, 2, 22, 28, 3, R.wood);
    p.rect(8, 5, 16, 22, R.sky);
    p.line(10, 14, 16, 7, R.sky.h, 2).line(13, 22, 21, 12, R.sky.h);
  }),
  joghurtbecher: item(p => {
    p.poly([[8, 9], [24, 9], [22, 29], [10, 29]], R.white, { shade: 'cyl' });
    p.poly([[8.7, 14], [23.3, 14], [22.8, 20], [9.2, 20]], R.pink, { shade: 'cyl' });
    p.hl(11, 24, 10, R.blue.m).hl(11, 25, 10, R.blue.m);
    p.round(5, 6, 22, 4, 1, R.alu);
    p.rect(26, 7, 3, 3, R.alu);
  }),
  getraenkekarton: item(p => {
    p.rect(15, 1, 3, 5, R.white);
    p.poly([[8, 12], [16, 5], [24, 12]], R.white);
    p.rect(8, 11, 16, 19, R.yellow);
    p.ell(14, 19, 4, 4, R.orange);
    p.ell(18, 15, 2.5, 1.5, R.leaf, { outline: false });
    p.rect(9, 26, 14, 3, R.white, { outline: false, shade: 'flat' });
  }),
  konservendose: item(p => {
    p.rect(7, 6, 18, 23, R.alu, { shade: 'cyl' });
    p.rect(7, 10, 18, 15, R.orange, { shade: 'cyl' });
    p.ell(14, 17, 3.5, 3, R.green);
    p.ell(19, 18, 3, 2.5, R.red);
    p.hl(8, 7, 16, R.alu.d).hl(8, 27, 16, R.alu.d);
  }),
  deospray: item(p => {
    p.round(10, 8, 12, 22, 2, R.blue, { shade: 'cyl' });
    p.rect(10, 8, 12, 3, R.alu, { shade: 'cyl' });
    p.round(11, 2, 10, 7, 3, R.white, { shade: 'cyl' });
    p.rect(19, 4, 3, 2, R.ink, { outline: false });
    p.rect(12, 16, 8, 8, R.white, { outline: false, shade: 'flat' });
    p.ell(16, 20, 2, 2, R.sky, { outline: false });
  }),
  kronkorken: item(p => {
    p.paint((a, b) => {
      const d = Math.hypot(a - 16, b - 16), ang = Math.atan2(b - 16, a - 16);
      return d <= 12 + (Math.cos(ang * 21) > 0.3 ? 1 : 0);
    }, R.red);
    p.ring(16, 16, 9, 8, R.red, { outline: false, shade: 'dark' });
    p.poly([[16, 10], [18, 15], [23, 15], [19, 18], [20, 23], [16, 20], [12, 23], [13, 18], [9, 15], [14, 15]], R.yellow, { outline: false });
  }),
  shampooflasche: item(p => {
    p.round(8, 8, 16, 22, 5, R.pink, { shade: 'cyl' });
    p.round(12, 2, 8, 7, 1, R.white, { shade: 'cyl' });
    p.round(11, 15, 10, 9, 1, R.white, { shade: 'flat' });
    p.hl(13, 18, 6, R.pink.m).hl(13, 20, 6, R.pink.l);
  }),
  plastiktuete: item(p => {
    p.ring(11, 8, 5, 3, R.white);
    p.ring(21, 8, 5, 3, R.white);
    p.round(4, 10, 24, 20, 3, R.white);
    p.path([[8, 14], [10, 20], [8, 27]], R.white.d).path([[22, 13], [24, 22]], R.white.d);
    p.rect(12, 17, 8, 6, R.red, { shade: 'flat' });
  }),
  styropor: item(p => {
    p.poly([[4, 12], [11, 5], [29, 5], [22, 12]], R.white, { shade: 'light' });
    p.poly([[22, 12], [29, 5], [29, 21], [22, 28]], R.white, { shade: 'dark' });
    p.rect(4, 12, 19, 16, R.white);
    [[7, 16], [12, 19], [17, 15], [9, 23], [15, 25], [19, 21], [25, 12], [26, 18], [15, 8], [21, 7]]
      .forEach(([x, y]) => p.dot(x, y, R.white.d));
  }),
  kaffeekapsel: item(p => {
    p.poly([[7, 12], [25, 12], [21, 27], [11, 27]], R.purple, { shade: 'cyl' });
    p.round(4, 9, 24, 4, 1, R.purple, { shade: 'light' });
    p.hl(9, 18, 14, R.purple.d);
  }),
  tshirt: item(p => {
    p.poly([[9, 5], [13, 4], [16, 7], [19, 4], [23, 5], [30, 11], [27, 16], [24, 14], [24, 29], [8, 29], [8, 14], [5, 16], [2, 11]], R.blue);
    p.ell(16, 5, 3, 2, R.blue, { shade: 'dark' });
    p.rect(11, 15, 4, 4, R.white, { outline: false, shade: 'flat' });
  }),
  'tshirt.kaputt': item(p => {
    const dirty = { d: '#5c5a52', m: '#868377', l: '#a8a598' };
    p.poly([[9, 5], [13, 4], [16, 7], [19, 4], [23, 5], [30, 11], [27, 16], [24, 14], [24, 29], [8, 29], [8, 14], [5, 16], [2, 11]], dirty);
    p.ell(13, 20, 4, 3, R.brown, { outline: false });
    p.ell(21, 11, 2.5, 2, R.brown, { outline: false });
    p.clear((x, y) => (x - 19) ** 2 + (y - 23) ** 2 < 5 || (x > 23 && y > 25 && x - y > -3));
    p.ring(19, 23, 2.8, 2.1, R.ink, { outline: false, shade: 'flat' });
    p.path([[11, 9], [14, 12], [12, 14]], INK);
  }),
  bettwaesche: item(p => {
    p.round(3, 7, 26, 10, 2, R.sky);
    for (let x = 6; x < 27; x += 4) p.dot(x, 11, R.white.l).dot(x + 2, 13, R.white.l);
    p.round(4, 16, 24, 11, 2, R.white);
    for (let y = 19; y < 26; y += 3) p.hl(6, y, 20, R.sky.l);
  }),
  gummistiefel: item(p => {
    p.poly([[9, 20], [20, 20], [27, 23], [29, 28], [9, 28]], R.green);
    p.rect(9, 3, 12, 20, R.green, { shade: 'cyl' });
    p.rect(8, 2, 14, 3, R.green, { shade: 'light' });
    p.rect(8, 27, 22, 3, R.ink);
  }),
  teelicht: item(p => {
    p.round(5, 17, 22, 9, 2, R.alu, { shade: 'cyl' });
    p.ell(16, 18, 9, 2, R.white, { outline: false, shade: 'flat' });
    p.vl(16, 13, 4, INK);
    p.ell(16, 9, 3, 5, R.yellow);
    p.ell(16, 10, 1.4, 2.4, R.orange, { outline: false, shade: 'flat' });
  }),

  // tier 4 ------------------------------------------------------------------
  toaster: item(p => {
    p.round(9, 4, 6, 8, 1, R.bread);
    p.round(17, 5, 6, 7, 1, R.bread);
    p.round(3, 10, 26, 17, 5, R.steel);
    p.rect(9, 10, 6, 2, R.ink, { outline: false });
    p.rect(17, 10, 6, 2, R.ink, { outline: false });
    p.rect(28, 15, 3, 3, R.ink);
    p.rect(5, 27, 4, 2, R.ink).rect(23, 27, 4, 2, R.ink);
  }),
  wasserkocher: item(p => {
    p.ring(24, 17, 7, 4, R.ink);
    p.poly([[9, 8], [23, 8], [25, 27], [7, 27]], R.steel, { shade: 'cyl' });
    p.poly([[3, 9], [10, 9], [10, 14]], R.steel);
    p.rect(19, 13, 2, 9, R.sky, { outline: false, shade: 'flat' });
    p.round(10, 4, 12, 5, 2, R.ink);
    p.round(6, 27, 20, 4, 1, R.ink);
  }),
  laptop: item(p => {
    p.round(5, 3, 22, 16, 1, R.grey);
    p.rect(7, 5, 18, 12, R.screen, { outline: false });
    p.line(9, 15, 15, 6, R.screen.h);
    p.poly([[3, 19], [29, 19], [31, 26], [1, 26]], R.steel);
    for (let y = 20; y < 24; y += 2) for (let x = 5; x < 27; x += 2) p.dot(x + (y % 4 ? 1 : 0), y, R.steel.d);
    p.rect(13, 24, 6, 1, R.steel.d, { outline: false });
  }),
  fernseher: item(p => {
    p.rect(14, 23, 4, 4, R.ink);
    p.round(8, 26, 16, 4, 1, R.ink);
    p.round(1, 4, 30, 20, 1, R.ink);
    p.rect(3, 6, 26, 16, R.screen, { outline: false });
    p.line(6, 19, 15, 8, R.screen.h).line(10, 20, 18, 11, R.screen.l);
  }),
  kuehlschrank: item(p => {
    p.round(8, 1, 16, 29, 2, R.white);
    p.hl(9, 11, 14, INK);
    p.vl(21, 4, 5, R.grey.m).vl(21, 14, 8, R.grey.m);
    p.rect(9, 30, 3, 2, R.ink, { outline: false }).rect(20, 30, 3, 2, R.ink, { outline: false });
  }),
  matratze: item(p => {
    p.poly([[2, 13], [8, 8], [30, 8], [24, 13]], R.mattress, { shade: 'light' });
    p.rect(2, 13, 23, 11, R.mattress);
    p.poly([[24, 13], [30, 8], [30, 19], [24, 24]], R.mattress, { shade: 'dark' });
    for (let x = 6; x < 24; x += 5) for (let y = 16; y < 23; y += 4) p.dot(x, y, R.mattress.d);
    p.hl(3, 21, 21, R.sky.m);
  }),
  sofa: item(p => {
    p.round(4, 7, 24, 12, 3, R.red);
    p.vl(16, 8, 10, R.red.d);
    p.round(4, 16, 24, 8, 2, R.red, { shade: 'light' });
    p.round(1, 12, 7, 14, 3, R.red);
    p.round(24, 12, 7, 14, 3, R.red);
    p.rect(4, 26, 3, 4, R.wood).rect(25, 26, 3, 4, R.wood);
  }),
  stuhl: item(p => {
    p.rect(10, 20, 2, 9, R.wood, { shade: 'dark' }).rect(20, 20, 2, 9, R.wood, { shade: 'dark' });
    p.rect(9, 2, 3, 17, R.wood).rect(20, 2, 3, 17, R.wood);
    p.rect(11, 4, 10, 3, R.wood).rect(11, 9, 10, 3, R.wood);
    p.poly([[6, 17], [26, 17], [28, 21], [4, 21]], R.wood, { shade: 'light' });
    p.rect(5, 21, 3, 9, R.wood).rect(24, 21, 3, 9, R.wood);
  }),
  bettdecke: item(p => {
    p.round(2, 7, 28, 19, 6, R.duvet);
    for (let x = 9; x < 26; x += 7) p.vl(x, 9, 15, R.duvet.d);
    for (let y = 13; y < 24; y += 6) p.hl(4, y, 24, R.duvet.d);
  }),
  bohrmaschine: item(p => drill(p, true)),

  // tier 5 ------------------------------------------------------------------
  farbeimer: item(p => {
    p.path([[6, 11], [8, 5], [16, 2], [24, 5], [26, 11]], INK);
    p.poly([[6, 11], [26, 11], [24, 29], [8, 29]], R.white, { shade: 'cyl' });
    p.round(5, 9, 22, 4, 1, R.alu, { shade: 'cyl' });
    p.rect(9, 16, 14, 8, R.grey, { shade: 'flat' });
    p.path([[12, 21], [15, 18], [20, 18]], R.white.l, 2);
  }),
  nagellack: item(p => {
    p.round(8, 14, 16, 15, 4, R.pink, { shade: 'cyl' });
    p.round(12, 2, 8, 13, 1, R.ink, { shade: 'cyl' });
    p.line(11, 17, 11, 25, R.pink.h);
  }),
  rohrreiniger: item(p => {
    p.round(8, 8, 16, 22, 3, R.yellow, { shade: 'cyl' });
    p.round(11, 2, 10, 7, 1, R.red, { shade: 'cyl' });
    hazard(p, 16, 19, 6);
  }),
  pflanzenschutz: item(p => {
    p.round(8, 9, 16, 21, 3, R.green, { shade: 'cyl' });
    p.round(12, 3, 8, 7, 1, R.ink, { shade: 'cyl' });
    p.round(10, 14, 12, 12, 1, R.white, { shade: 'flat' });
    hazard(p, 16, 20, 5);
  }),
  medikamente: item(p => {
    p.rect(3, 3, 19, 13, R.white);
    p.rect(11, 5, 3, 9, R.red, { outline: false, shade: 'flat' });
    p.rect(8, 8, 9, 3, R.red, { outline: false, shade: 'flat' });
    p.round(10, 13, 20, 16, 2, R.alu);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) p.ell(15 + c * 6, 18 + r * 6, 2.2, 2.2, c % 2 ? R.pink : R.white);
  }),
  thermometer: item(p => {
    p.poly([[6, 23], [9, 26], [28, 7], [25, 4]], R.clear);
    p.line(10, 22, 22, 10, R.alu.m, 2);
    for (let i = 0; i < 5; i++) p.dot(13 + i * 3, 23 - i * 3 - 4, INK);
    p.ell(7, 26, 4, 4, R.alu);
  }),
  energiesparlampe: item(p => {
    [9, 14, 19].forEach(x => p.round(x, 1, 5, 17, 2, R.white));
    p.round(7, 16, 18, 7, 2, R.white, { shade: 'cyl' });
    screwBase(p, 23);
  }),
  lametta: item(p => {
    for (let i = 0; i < 9; i++) {
      const x = 7 + i * 2, len = 14 + (i * 7) % 9;
      for (let y = 8; y < 8 + len; y++) p.dot(x + ((y + i) % 4 === 0 ? 1 : 0), y, i % 2 ? R.alu.l : R.alu.d);
    }
    p.round(5, 3, 22, 6, 1, R.red);
    p.hl(8, 5, 16, R.red.l);
  }),
  verduenner: item(p => {
    p.round(7, 6, 18, 24, 1, R.alu, { shade: 'cyl' });
    p.round(18, 1, 5, 6, 1, R.red);
    p.rect(9, 12, 14, 13, R.orange, { shade: 'flat' });
    hazard(p, 16, 18, 5);
  }),
};

// Glass by colour. Green, brown and blue are also striped, dotted and barred,
// so the colour survives greyscale.
S['glasflasche.weiss'] = item(p => bottle(p, R.clear));
S['glasflasche.gruen'] = item(p => bottle(p, R.gglass, 'diag'));
S['glasflasche.braun'] = item(p => bottle(p, R.bglass, 'dots'));
S['glasflasche.blau'] = item(p => bottle(p, R.blglass, 'bars'));

// Parts are drawn as what they are once separated.
S['fernbedienung:batterien'] = S.batterien;
S['fernbedienung:geraet'] = item(p => remote(p, true));
S['bohrmaschine:akku'] = item(p => {
  p.round(4, 10, 24, 13, 2, R.ink);
  p.rect(9, 7, 14, 4, R.ink);
  p.rect(20, 14, 4, 3, R.green, { outline: false, shade: 'light' });
  p.hl(7, 19, 18, R.ink.l);
});
S['bohrmaschine:geraet'] = item(p => drill(p, false));
S['joghurtbecher:becher'] = item(p => {
  p.poly([[8, 9], [24, 9], [22, 29], [10, 29]], R.white, { shade: 'cyl' });
  p.poly([[8.7, 14], [23.3, 14], [22.8, 20], [9.2, 20]], R.pink, { shade: 'cyl' });
  p.hl(11, 24, 10, R.blue.m).hl(11, 25, 10, R.blue.m);
  p.ell(16, 9, 8, 2, R.ink, { outline: false });
});
S['joghurtbecher:deckel'] = item(p => {
  p.ell(15, 17, 13, 7, R.alu);
  p.ell(15, 17, 6, 3, R.pink, { outline: false, shade: 'flat' });
  p.poly([[25, 13], [31, 9], [31, 13], [27, 16]], R.alu);
});

// ---------------------------------------------------------- second batch
function receipt(p, ramp, lines) {
  p.poly([[8, 2], [24, 2], [24, 27], [22, 29], [20, 27], [18, 29], [16, 27], [14, 29], [12, 27], [10, 29], [8, 27]], ramp);
  for (let y = 6; y < 24; y += 3) p.hl(11, y, y % 2 ? 10 : 7, lines);
  p.hl(11, 24, 10, INK);
}
function sprayCan(p, body, cap) {
  p.round(10, 9, 12, 21, 2, body, { shade: 'cyl' });
  p.rect(10, 9, 12, 3, R.alu, { shade: 'cyl' });
  p.round(11, 3, 10, 7, 3, cap, { shade: 'cyl' });
}
Object.assign(S, {
  kassenbon: item(p => receipt(p, R.paper, R.paper.d)),
  'kassenbon.blau': item(p => receipt(p, R.sky, R.sky.d)),
  'kassenbon.weiss': item(p => receipt(p, R.white, R.white.d)),
  pizzakarton: item(p => {
    p.poly([[2, 14], [10, 6], [30, 6], [22, 14]], R.card, { shade: 'light' });
    p.rect(2, 14, 21, 9, R.card);
    p.poly([[22, 14], [30, 6], [30, 15], [22, 23]], R.card, { shade: 'dark' });
    p.ell(16, 10, 6, 2.2, R.red, { outline: false, shade: 'flat' });
    p.dot(13, 10, R.yellow.m).dot(18, 9, R.yellow.m);
  }),
  'pizzakarton:karton': item(p => {
    p.poly([[2, 14], [10, 6], [30, 6], [22, 14]], R.card, { shade: 'light' });
    p.rect(2, 14, 21, 9, R.card);
    p.poly([[22, 14], [30, 6], [30, 15], [22, 23]], R.card, { shade: 'dark' });
    [[12, 9], [18, 8], [16, 11]].forEach(([x, y]) => p.dot(x, y, R.card.d));
  }),
  'pizzakarton:reste': item(p => {
    p.poly([[6, 24], [26, 24], [16, 8]], R.bread);
    p.poly([[9, 22], [23, 22], [16, 11]], R.red, { outline: false });
    [[13, 19], [18, 18], [16, 15]].forEach(([x, y]) => p.ell(x, y, 1.6, 1.6, R.yellow, { outline: false }));
  }),
  biotuete: item(p => {
    p.poly([[7, 6], [25, 6], [27, 28], [5, 28]], R.green, { shade: 'auto' });
    p.path([[7, 6], [10, 3], [13, 6]], INK).path([[19, 6], [22, 3], [25, 6]], INK);
    p.ell(16, 17, 5, 4, R.white, { shade: 'flat' });
    p.path([[13, 18], [16, 14], [19, 18]], R.green.d);
  }),
  katzenstreu: item(p => {
    p.rect(6, 6, 20, 23, R.sky);
    p.rect(9, 10, 14, 10, R.white, { shade: 'flat' });
    p.poly([[12, 15], [14, 12], [15, 15]], INK).poly([[17, 15], [18, 12], [20, 15]], INK);
    p.ell(16, 17, 4, 3, R.grey, { outline: false });
    for (let x = 8; x < 25; x += 3) p.dot(x, 25, R.sky.d);
  }),
  kaffeesatz: item(p => {
    p.ell(16, 22, 12, 6, R.coffee);
    for (let i = 0; i < 14; i++) p.dot(7 + (i * 7) % 19, 19 + (i * 5) % 6, R.coffee.l);
    p.round(9, 4, 14, 12, 3, R.white, { shade: 'cyl' });
    p.ell(16, 6, 6, 1.6, R.coffee, { outline: false });
  }),
  fleisch: item(p => {
    p.poly([[4, 18], [10, 10], [22, 9], [28, 15], [24, 25], [10, 26]], R.red);
    p.path([[10, 14], [16, 18], [22, 14]], R.pink.l);
    p.round(18, 18, 12, 4, 2, R.white);
    p.ell(29, 20, 2.2, 2.6, R.white).ell(19, 20, 2.2, 2.6, R.white);
  }),
  einwegbesteck: item(p => {
    p.round(7, 2, 5, 10, 2, R.white);
    p.rect(8, 11, 3, 18, R.white);
    p.rect(20, 2, 2, 8, R.white).rect(23, 2, 2, 8, R.white);
    p.round(19, 8, 7, 5, 1, R.white);
    p.rect(21, 12, 3, 17, R.white);
  }),
  fotos: item(p => {
    p.rect(9, 3, 20, 18, R.white);
    p.rect(3, 9, 20, 20, R.white);
    p.rect(5, 11, 16, 12, R.sky, { outline: false });
    p.poly([[5, 23], [10, 16], [14, 20], [17, 17], [21, 23]], R.leaf, { outline: false });
    p.ell(17, 14, 2, 2, R.yellow, { outline: false });
  }),
  umzugskarton: item(p => {
    p.poly([[3, 11], [9, 5], [29, 5], [23, 11]], R.card, { shade: 'light' });
    p.rect(3, 11, 21, 18, R.card);
    p.poly([[23, 11], [29, 5], [29, 23], [23, 29]], R.card, { shade: 'dark' });
    p.rect(3, 11, 21, 3, R.kraft, { outline: false, shade: 'flat' });
    p.rect(8, 18, 9, 3, INK, { outline: false });
  }),
  briefumschlag: item(p => {
    p.rect(2, 7, 28, 19, R.white);
    p.path([[3, 8], [16, 18], [29, 8]], R.white.d);
    p.rect(5, 17, 13, 6, R.clear, { shade: 'flat' });
    p.hl(7, 19, 8, R.grey.l).hl(7, 21, 6, R.grey.l);
  }),
  servietten: item(p => {
    p.poly([[4, 12], [16, 6], [28, 12], [16, 18]], R.pink, { shade: 'light' });
    p.poly([[4, 12], [16, 18], [16, 27], [4, 21]], R.pink);
    p.poly([[16, 18], [28, 12], [28, 21], [16, 27]], R.pink, { shade: 'dark' });
    p.ell(12, 14, 2, 1.2, R.brown, { outline: false });
  }),
  blumen: item(p => {
    [[10, 4, R.pink], [17, 3, R.yellow], [22, 7, R.red]].forEach(([x, y, r]) => p.ell(x, y + 3, 3.5, 3.5, r));
    p.path([[10, 10], [14, 22]], R.leaf.d).path([[17, 9], [16, 22]], R.leaf.d).path([[22, 13], [18, 22]], R.leaf.d);
    p.poly([[7, 16], [12, 19], [9, 21]], R.leaf, { outline: false });
    p.round(11, 21, 10, 9, 2, R.wood);
  }),
  zigarettenkippen: item(p => {
    for (const [x, y] of [[4, 18], [14, 22], [19, 12]]) {
      p.rect(x, y, 6, 4, R.orange);
      p.rect(x + 6, y, 4, 4, R.white);
      p.rect(x + 10, y, 1, 4, R.grey, { outline: false });
    }
  }),
  luftpolsterumschlag: item(p => {
    p.rect(2, 6, 28, 21, R.yellow);
    p.rect(2, 6, 28, 5, R.yellow, { shade: 'light' });
    for (let y = 14; y < 25; y += 3) for (let x = 5; x < 28; x += 3) p.dot(x, y, R.yellow.d);
    p.rect(6, 15, 11, 5, R.white, { shade: 'flat' });
  }),
  tapeten: item(p => {
    p.rect(5, 4, 15, 25, R.paper);
    for (let y = 7; y < 27; y += 5) for (let x = 7; x < 19; x += 5) p.ell(x + 1, y + 1, 1.4, 1.4, R.leaf, { outline: false });
    p.ell(22, 26, 6, 4, R.paper, { shade: 'cyl' });
    p.ring(22, 26, 3, 1.5, R.paper, { shade: 'dark', outline: false });
  }),
  elektrorasierer: item(p => {
    p.round(10, 3, 12, 8, 2, R.alu);
    for (let x = 12; x < 21; x += 2) p.vl(x, 5, 4, R.alu.d);
    p.round(9, 10, 14, 20, 4, R.ink, { shade: 'cyl' });
    p.ell(16, 18, 2.5, 2.5, R.blue);
  }),
  taschenrechner: item(p => {
    p.round(7, 2, 18, 28, 2, R.grey);
    p.rect(9, 4, 14, 6, R.green, { outline: false, shade: 'flat' });
    p.hl(15, 7, 6, R.green.d);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) p.rect(9 + c * 4, 12 + r * 4, 3, 3, c === 3 ? R.orange : R.white, { outline: false, shade: 'flat' });
  }),
  usb_stick: item(p => {
    p.rect(12, 2, 8, 8, R.alu);
    p.rect(14, 4, 1, 2, INK).rect(17, 4, 1, 2, INK);
    p.round(10, 9, 12, 20, 3, R.blue, { shade: 'cyl' });
    p.ell(16, 24, 2, 2, R.white, { outline: false });
  }),
  e_zigarette: item(p => {
    p.poly([[5, 26], [9, 30], [27, 12], [23, 8]], R.grey);
    p.poly([[22, 9], [26, 13], [30, 9], [26, 5]], R.ink);
    p.line(9, 25, 22, 12, R.grey.l);
    p.ell(13, 23, 1.5, 1.5, R.sky, { outline: false });
  }),
  einweckglas: item(p => {
    p.round(7, 9, 18, 20, 4, R.clear, { shade: 'cyl' });
    p.round(8, 4, 16, 6, 1, R.yellow, { shade: 'cyl' });
    p.round(10, 15, 12, 7, 1, R.paper, { shade: 'flat' });
    p.ell(16, 25, 5, 2, R.red, { outline: false });
  }),
  alufolie: item(p => {
    p.round(2, 9, 28, 9, 2, R.blue);
    p.rect(3, 12, 26, 2, R.white, { outline: false, shade: 'flat' });
    p.poly([[6, 17], [28, 17], [26, 30], [8, 27]], R.alu);
    p.path([[10, 20], [15, 25], [22, 21]], R.alu.d);
  }),
  glasscherben: item(p => {
    p.poly([[5, 26], [9, 15], [14, 24]], R.clear);
    p.poly([[13, 27], [18, 12], [23, 18], [21, 28]], R.clear);
    p.poly([[22, 26], [27, 17], [29, 27]], R.clear);
    p.line(17, 15, 19, 24, R.clear.h);
  }),
  babyflasche: item(p => {
    p.ell(16, 4, 3, 3, R.yellow);
    p.round(11, 6, 10, 4, 1, R.sky);
    p.round(9, 10, 14, 20, 4, R.clear, { shade: 'cyl' });
    for (let y = 14; y < 27; y += 4) p.hl(19, y, 2, R.blue.m);
    p.rect(10, 22, 12, 7, R.white, { outline: false, shade: 'flat' });
  }),
  geschirr: item(p => {
    p.ell(16, 18, 14, 9, R.white);
    p.ell(16, 18, 9, 5.5, R.white, { outline: false, shade: 'dark' });
    p.ring(16, 18, 12, 11, R.blue, { outline: false, shade: 'flat' });
    p.path([[16, 9], [14, 15], [18, 20], [15, 27]], INK);
  }),
  teekanne: item(p => {
    p.ring(25, 17, 6, 3.5, R.white);
    p.poly([[2, 11], [8, 15], [8, 19]], R.white);
    p.ell(15, 19, 10, 10, R.white);
    p.round(10, 6, 10, 4, 1, R.white);
    p.ell(15, 5, 2, 1.5, R.white);
    p.ring(15, 19, 10, 9, R.blue, { outline: false, shade: 'flat' });
    p.ell(15, 19, 3, 3, R.blue, { outline: false });
  }),
  schuhe: item(p => {
    p.poly([[3, 14], [11, 10], [17, 16], [29, 19], [29, 25], [3, 25]], R.red);
    p.rect(3, 24, 27, 4, R.white);
    p.path([[10, 13], [13, 16]], R.white.l).path([[12, 12], [15, 15]], R.white.l);
    p.hl(20, 21, 6, R.red.l);
  }),
  spielzeug: item(p => {
    p.round(4, 9, 24, 12, 2, R.red);
    for (const x of [8, 14, 20]) p.round(x, 5, 4, 4, 1, R.red, { shade: 'light' });
    p.round(8, 20, 16, 9, 2, R.yellow);
    for (const x of [11, 17]) p.round(x, 17, 4, 3, 1, R.yellow, { shade: 'light' });
  }),
  cds: item(p => {
    p.ring(16, 16, 13, 2.5, R.alu);
    p.paint((a, b) => { const d = Math.hypot(a - 16, b - 16); return d < 12 && d > 3 && (a - 16) * 0.6 + (b - 16) < -2 && (a - 16) * 0.6 + (b - 16) > -7; }, R.sky, { outline: false, shade: 'light' });
    p.paint((a, b) => { const d = Math.hypot(a - 16, b - 16); return d < 12 && d > 3 && (a - 16) + (b - 16) * 0.4 > 3 && (a - 16) + (b - 16) * 0.4 < 7; }, R.pink, { outline: false, shade: 'light' });
  }),
  staubsauger: item(p => {
    p.path([[20, 12], [24, 4], [27, 4]], INK, 2);
    p.round(4, 13, 20, 14, 6, R.red);
    p.ell(9, 27, 3, 3, R.ink).ell(20, 27, 3, 3, R.ink);
    p.round(23, 2, 6, 4, 1, R.grey);
    p.rect(10, 16, 8, 4, R.grey, { outline: false });
  }),
  mikrowelle: item(p => {
    p.round(1, 6, 30, 21, 2, R.white);
    p.rect(4, 9, 17, 15, R.ink);
    p.rect(5, 10, 15, 13, R.grey, { outline: false });
    p.line(7, 20, 14, 12, R.grey.l);
    for (let y = 10; y < 23; y += 4) p.ell(26, y + 1, 1.5, 1.5, R.grey, { outline: false });
  }),
  buegeleisen: item(p => {
    p.poly([[3, 23], [10, 13], [29, 13], [29, 23]], R.sky);
    p.path([[12, 13], [14, 6], [26, 6], [27, 13]], INK, 2);
    p.rect(3, 22, 27, 4, R.alu);
    p.ell(20, 18, 2, 2, R.red, { outline: false });
  }),
  regal: item(p => {
    p.rect(5, 2, 3, 28, R.wood).rect(24, 2, 3, 28, R.wood);
    for (const y of [3, 12, 21]) p.rect(5, y, 22, 3, R.wood, { shade: 'light' });
    p.rect(9, 6, 3, 6, R.red).rect(12, 7, 3, 5, R.blue).rect(15, 6, 2, 6, R.green);
    p.round(18, 16, 6, 5, 1, R.yellow);
  }),
  kinderwagen: item(p => {
    p.path([[4, 6], [8, 12]], INK, 2);
    p.paint((a, b) => a > 7 && a < 27 && b > 9 && b < 23 && (b > 15 || Math.hypot(a - 22, b - 15) < 6 || a > 21), R.blue);
    p.round(7, 15, 20, 8, 3, R.blue);
    p.ell(10, 27, 3.5, 3.5, R.ink).ell(24, 27, 3.5, 3.5, R.ink);
    p.dot(10, 27, R.grey.l).dot(24, 27, R.grey.l);
  }),
  lattenrost: item(p => {
    p.poly([[2, 13], [8, 7], [30, 7], [24, 13]], R.wood, { shade: 'light' });
    for (let x = 6; x < 28; x += 4) p.line(x, 12, x + 5, 8, R.wood.d);
    p.rect(2, 13, 23, 4, R.wood);
    p.poly([[24, 13], [30, 7], [30, 11], [24, 17]], R.wood, { shade: 'dark' });
    p.rect(3, 17, 2, 6, R.wood).rect(22, 17, 2, 6, R.wood);
  }),
  skier: item(p => {
    p.poly([[4, 27], [6, 29], [26, 6], [24, 3]], R.red);
    p.poly([[10, 29], [12, 31], [30, 10], [28, 7]], R.blue);
    p.rect(13, 16, 4, 3, R.ink).rect(18, 19, 4, 3, R.ink);
  }),
  backofenreiniger: item(p => sprayCan(p, R.orange, R.ink)),
  desinfektionsmittel: item(p => {
    p.round(9, 10, 14, 20, 3, R.white, { shade: 'cyl' });
    p.rect(13, 6, 6, 5, R.white);
    p.poly([[13, 2], [23, 2], [23, 5], [13, 6]], R.blue);
    p.rect(14, 16, 4, 10, R.blue, { outline: false, shade: 'flat' });
    p.rect(11, 19, 10, 4, R.blue, { outline: false, shade: 'flat' });
  }),
  holzschutzmittel: item(p => {
    p.round(7, 7, 18, 23, 1, R.brown, { shade: 'cyl' });
    p.round(12, 3, 8, 5, 1, R.ink);
    p.rect(9, 12, 14, 13, R.paper, { shade: 'flat' });
    hazard(p, 16, 18, 5);
  }),
  insektenspray: item(p => {
    sprayCan(p, R.yellow, R.red);
    hazard(p, 16, 21, 5);
  }),
  benzin: item(p => {
    p.round(4, 8, 24, 22, 2, R.red);
    p.path([[8, 8], [8, 4], [18, 4], [18, 8]], INK, 2);
    p.round(22, 3, 5, 6, 1, R.ink);
    p.line(8, 14, 22, 25, R.red.d).line(22, 14, 8, 25, R.red.d);
  }),
  mueckenschutz: item(p => {
    sprayCan(p, R.green, R.white);
    p.ell(16, 20, 3, 2, R.ink, { outline: false });
    p.path([[13, 18], [11, 16]], INK).path([[19, 18], [21, 16]], INK);
  }),
});

// ------------------------------------------------- rolls: box, tube, sheet
// Cling film, foil and baking paper come on a cardboard tube in a cardboard
// box, and the box and tube go one way, the sheet another.
function rollBox(p, band, sheet) {
  p.round(2, 10, 26, 11, 2, R.white);
  p.rect(3, 13, 24, 4, band, { outline: false, shade: 'flat' });
  p.ring(27, 15.5, 5, 2.2, R.card);
  p.ell(27, 15.5, 2.2, 2.2, R.ink, { outline: false });
  if (sheet) p.poly([[8, 20], [24, 20], [22, 29], [6, 28]], sheet);
}
function tubeAndBox(p, band) {
  p.round(2, 6, 22, 10, 2, R.white);
  p.rect(3, 9, 20, 3, band, { outline: false, shade: 'flat' });
  p.poly([[4, 15], [22, 15], [20, 18], [6, 18]], R.white, { shade: 'dark' });
  p.round(6, 21, 22, 7, 3, R.card, { shade: 'cyl' });
  p.ring(26, 24.5, 3.5, 1.6, R.card, { shade: 'dark' });
}
function crumpled(p, ramp, glint) {
  p.poly([[5, 14], [10, 8], [17, 11], [23, 6], [28, 12], [26, 19], [28, 25], [19, 28], [11, 27], [4, 22]], ramp);
  p.path([[10, 13], [14, 18], [12, 23]], ramp.d).path([[20, 10], [19, 16], [24, 21]], ramp.d);
  if (glint) p.path([[15, 20], [20, 23]], ramp.h || ramp.l);
}
Object.assign(S, {
  frischhaltefolie: item(p => rollBox(p, R.sky, R.clear)),
  'frischhaltefolie:verpackung': item(p => tubeAndBox(p, R.sky)),
  'frischhaltefolie:folie': item(p => crumpled(p, R.clear, true)),
  'alufolie:verpackung': item(p => tubeAndBox(p, R.blue)),
  'alufolie:folie': item(p => crumpled(p, R.alu, true)),
  'backpapier:verpackung': item(p => tubeAndBox(p, R.red)),
  'backpapier:papier': item(p => crumpled(p, R.paper, false)),
  gefrierbeutel: item(p => {
    p.round(3, 9, 26, 18, 2, R.sky);
    p.rect(4, 12, 24, 3, R.white, { outline: false, shade: 'flat' });
    p.round(8, 17, 16, 7, 1, R.white, { shade: 'flat' });
    p.ell(12, 20.5, 2, 2, R.blue, { outline: false });
    p.hl(16, 20, 6, R.grey.l);
  }),
  'gefrierbeutel:verpackung': item(p => {
    p.round(3, 9, 26, 18, 2, R.sky);
    p.rect(4, 12, 24, 3, R.white, { outline: false, shade: 'flat' });
    p.poly([[6, 9], [26, 9], [22, 4], [10, 4]], R.sky, { shade: 'light' });
  }),
  'gefrierbeutel:beutel': item(p => {
    p.round(4, 5, 16, 22, 1, R.clear);
    p.rect(5, 8, 14, 2, R.blue, { outline: false, shade: 'flat' });
    p.round(13, 9, 16, 20, 1, R.clear);
    p.rect(14, 12, 14, 2, R.blue, { outline: false, shade: 'flat' });
    p.path([[16, 18], [24, 24]], R.clear.h);
  }),
});

export const ITEMS = S;

// ---------------------------------------------------------------- containers
// Bins are coloured all over, the way they stand in the courtyard. The island's
// containers follow the real ones: a beige, rounded shell with a round hole and
// a white sticker, alike in everything but one coloured band — so the kind can
// be told at a glance without reading.

const box48 = fn => draw(48, 48, fn);

function plate(p, x, y, icon) {
  p.round(x, y, 16, 13, 1, R.white, { shade: 'flat' });
  ICON[icon](p, x + 2, y + 2);
}
const ICON = {
  rest: (p, x, y) => { p.round(x + 3, y + 1, 6, 8, 1, R.ink); p.hl(x + 2, y + 1, 8, INK); p.hl(x + 4, y, 4, INK); },
  papier: (p, x, y) => { p.rect(x + 1, y + 1, 10, 8, R.paper); p.hl(x + 3, y + 3, 6, INK).hl(x + 3, y + 5, 6, R.grey.l).hl(x + 3, y + 7, 4, R.grey.l); },
  bio: (p, x, y) => { p.ell(x + 6, y + 4, 5, 3.5, R.leaf); p.line(x + 2, y + 8, x + 9, y + 2, R.leaf.d); },
  gelb: (p, x, y) => { p.round(x + 3, y + 3, 6, 6, 1, R.yellow); p.rect(x + 4, y, 4, 3, R.yellow); },
  glass: (p, x, y) => { p.poly([[x + 5, y], [x + 7, y], [x + 7, y + 3], [x + 9, y + 5], [x + 9, y + 9], [x + 3, y + 9], [x + 3, y + 5], [x + 5, y + 3]], R.clear); },
  can: (p, x, y) => { p.rect(x + 3, y + 1, 6, 8, R.alu, { shade: 'cyl' }); p.hl(x + 3, y + 3, 6, INK); },
  plastic: (p, x, y) => { p.round(x + 3, y + 2, 6, 7, 2, R.pet, { shade: 'cyl' }); p.rect(x + 4, y, 4, 2, R.blue); },
  shirt: (p, x, y) => { p.poly([[x + 2, y + 1], [x + 10, y + 1], [x + 11, y + 4], [x + 9, y + 4], [x + 9, y + 9], [x + 3, y + 9], [x + 3, y + 4], [x + 1, y + 4]], R.blue); },
  batt: (p, x, y) => { p.rect(x + 4, y, 4, 2, R.steel); p.rect(x + 3, y + 1, 6, 8, R.yellow); p.hl(x + 4, y + 7, 4, INK); },
  plug: (p, x, y) => { p.vl(x + 4, y, 3, INK).vl(x + 7, y, 3, INK); p.round(x + 2, y + 2, 8, 5, 1, R.grey); p.vl(x + 6, y + 7, 3, INK); },
  tv: (p, x, y) => { p.rect(x + 1, y + 1, 10, 7, R.screen); p.hl(x + 4, y + 8, 4, INK); },
  chair: (p, x, y) => { p.vl(x + 3, y, 9, INK); p.hl(x + 3, y + 5, 7, INK); p.vl(x + 9, y + 5, 4, INK); },
  flask: (p, x, y) => { p.poly([[x + 4, y], [x + 7, y], [x + 7, y + 3], [x + 10, y + 9], [x + 1, y + 9], [x + 4, y + 3]], R.green); },
};

function wheelie(ramp, icon) {
  return box48(p => {
    p.rect(13, 3, 22, 3, R.ink);
    p.poly([[8, 12], [40, 12], [38, 42], [10, 42]], ramp, { shade: 'cyl' });
    for (const x of [14, 34]) p.vl(x, 15, 25, ramp.d);
    p.round(5, 6, 38, 8, 2, ramp);
    p.hl(7, 12, 34, ramp.d);
    plate(p, 16, 20, icon);
    p.ell(13, 43, 4, 4, R.ink);
    p.ell(35, 43, 4, 4, R.ink);
    p.dot(13, 43, R.grey.l).dot(35, 43, R.grey.l);
  });
}

function island(band, tex, icon) {
  return box48(p => {
    p.ring(17, 6, 2.5, 1, R.steel).ring(31, 6, 2.5, 1, R.steel);
    p.poly([[6, 34], [42, 34], [43, 41], [41, 45], [7, 45], [5, 41]], R.beige, { shade: 'cyl' });
    p.round(5, 7, 38, 28, 9, R.beige, { shade: 'cyl' });
    p.ell(24, 14, 4.5, 4.5, R.ink, { outline: false });
    p.round(14, 20, 20, 10, 1, R.white, { shade: 'flat' });
    ICON[icon](p, 18, 20);
    p.hl(26, 23, 6, R.grey.l).hl(26, 25, 6, R.grey.l).hl(26, 27, 4, R.grey.l);
    // The one element that differs: the band round the waist, in the colour of
    // what goes in — and, for glass, in a texture too.
    p.round(3, 31, 42, 8, 1, band, { tex: tex && TEX[tex], texColor: band.d });
  });
}

function crate(ramp, icon) {
  return box48(p => {
    p.rect(2, 30, 44, 4, R.wood, { shade: 'light' });
    p.rect(4, 34, 3, 12, R.wood).rect(41, 34, 3, 12, R.wood);
    p.round(10, 10, 28, 21, 1, ramp);
    p.rect(17, 9, 14, 3, R.ink);
    plate(p, 16, 16, icon);
  });
}

function skip(ramp, icon, cargo) {
  return box48(p => {
    cargo(p);
    p.poly([[2, 18], [46, 18], [41, 42], [7, 42]], ramp);
    p.hl(4, 21, 40, ramp.l);
    for (const x of [12, 24, 36]) p.vl(x, 22, 18, ramp.d);
    plate(p, 16, 25, icon);
    p.round(8, 41, 8, 5, 2, R.ink).round(32, 41, 8, 5, 2, R.ink);
  });
}

const C = {
  restmuell: wheelie(R.ink, 'rest'),
  papier: wheelie(R.blue, 'papier'),
  bio: wheelie(R.brown, 'bio'),
  gelbe_tonne: wheelie(R.yellow, 'gelb'),
  glas_weiss: island(R.white, null, 'glass'),
  glas_gruen: island(R.gglass, 'diag', 'glass'),
  glas_braun: island(R.bglass, 'dots', 'glass'),
  kunststoff: island(R.yellow, null, 'plastic'),
  metall: island(R.steel, 'checks', 'can'),
  altkleider: box48(p => {
    p.round(7, 4, 34, 41, 2, R.red);
    p.rect(13, 10, 22, 6, R.ink);
    p.rect(14, 11, 20, 2, R.grey, { outline: false });
    plate(p, 16, 22, 'shirt');
    p.rect(7, 42, 34, 3, R.ink);
  }),
  batteriebox: crate(R.green, 'batt'),
  elektro_ruecknahme: crate(R.blue, 'plug'),
  elektroschrott: skip(R.blue, 'tv', p => {
    p.rect(8, 8, 14, 11, R.ink);
    p.rect(9, 9, 12, 8, R.screen, { outline: false });
    p.round(25, 9, 12, 10, 2, R.steel);
    p.path([[36, 6], [40, 3], [43, 8], [39, 12]], INK, 2);
  }),
  batterien: box48(p => {
    p.round(10, 6, 28, 38, 3, R.green, { shade: 'cyl' });
    p.round(9, 4, 30, 5, 1, R.green, { shade: 'dark' });
    for (const y of [17, 31]) p.hl(11, y, 26, R.green.d);
    plate(p, 16, 18, 'batt');
  }),
  sperrmuell: skip(R.orange, 'chair', p => {
    p.round(7, 5, 18, 10, 2, R.red);
    p.round(5, 11, 22, 7, 2, R.red, { shade: 'light' });
    p.rect(30, 2, 3, 16, R.wood).rect(38, 2, 3, 16, R.wood).rect(30, 9, 11, 3, R.wood);
  }),
  pfandautomat: box48(p => {
    p.round(7, 1, 34, 45, 1, R.steel);
    p.rect(11, 5, 26, 9, R.ink);
    p.rect(12, 6, 24, 7, R.green, { outline: false, shade: 'flat' });
    p.hl(14, 9, 14, R.green.h);
    p.round(13, 18, 22, 16, 2, R.grey);
    p.ell(24, 26, 6, 6, R.ink);
    p.ell(24, 26, 3, 3, R.ink, { outline: false, shade: 'dark' });
    p.rect(13, 38, 22, 3, R.ink);
  }),
  giftmobil: box48(p => {
    p.round(1, 10, 31, 27, 1, R.white);
    p.round(31, 18, 16, 19, 2, R.red);
    p.rect(35, 21, 9, 7, R.sky);
    hazard(p, 16, 22, 7);
    p.rect(1, 35, 46, 3, R.ink);
    p.ell(10, 39, 5, 5, R.ink).ell(38, 39, 5, 5, R.ink);
    p.dot(10, 39, R.grey.l).dot(38, 39, R.grey.l);
  }),
  problemstoffannahme: box48(p => {
    p.round(3, 4, 11, 22, 2, R.red, { shade: 'cyl' });
    p.hl(4, 11, 9, R.red.d).hl(4, 19, 9, R.red.d);
    p.round(34, 2, 11, 24, 2, R.green, { shade: 'cyl' });
    p.hl(35, 10, 9, R.green.d).hl(35, 18, 9, R.green.d);
    p.round(17, 10, 14, 16, 1, R.yellow);
    hazard(p, 24, 18, 5);
    p.rect(0, 26, 48, 21, R.wood);
    p.hl(1, 28, 46, R.wood.l);
    plate(p, 16, 31, 'flask');
  }),
};

export const CONTAINERS = C;

// ------------------------------------------------------------------ scenery
// The finale's tree, what has to come off it, and the four places it can go.
export const TREE = draw(64, 88, p => {
  p.round(26, 70, 12, 14, 1, R.wood);
  [[2, 22, 13], [14, 22, 19], [28, 24, 25], [43, 27, 31]].forEach(([top, height, base]) => {
    p.paint((a, b) => {
      if (b < top || b >= top + height) return false;
      const t = (b - top) / height;
      const half = 2 + (base - 2) * t + (Math.floor(a / 3) % 2 && t > 0.85 ? -1.5 : 0);
      return Math.abs(a - 32) <= half;
    }, R.leaf);
  });
  for (let y = 6; y < 70; y += 9) p.dot(32 - Math.floor(y / 3), y, R.leaf.h);
});

export const DECOR = {
  kugel: draw(12, 13, p => { p.rect(5, 0, 2, 2, R.alu); p.ell(6, 7, 5.5, 5.5, R.red); p.dot(4, 5, R.red.h).dot(4, 6, R.red.h); }),
  kugel_gold: draw(12, 13, p => { p.rect(5, 0, 2, 2, R.alu); p.ell(6, 7, 5.5, 5.5, R.yellow); p.dot(4, 5, R.yellow.h).dot(4, 6, R.yellow.h); }),
  lametta: draw(14, 12, p => {
    for (let i = 0; i < 7; i++) for (let y = 0; y < 8 + (i * 5) % 5; y++) p.dot(1 + i * 2 + (y % 3 === 0 ? 1 : 0), y, i % 2 ? R.alu.l : R.alu.d);
  }),
  lichter: draw(16, 8, p => {
    p.path([[0, 1], [5, 4], [10, 4], [15, 1]], INK);
    [[2, 3], [7, 5], [12, 4]].forEach(([x, y]) => p.ell(x + 0.5, y + 1.5, 1.8, 1.8, R.yellow));
  }),
  kerze: draw(8, 12, p => { p.ell(4, 2, 1.5, 2, R.yellow, { outline: false }); p.rect(2, 4, 4, 5, R.white); p.rect(1, 9, 6, 3, R.alu); }),
  netz: draw(40, 22, p => {
    for (let y = 0; y < 22; y++) for (let x = 0; x < 40; x++) if ((x + y) % 5 === 0 || (x - y + 40) % 5 === 0) p.dot(x, y, R.white.d);
  }),
  stern: draw(15, 15, p => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7.4;
      pts.push([7.5 + r * Math.cos(a), 7.8 + r * Math.sin(a)]);
    }
    p.poly(pts, R.yellow);
  }),
};

export const ROUTES = {
  wertstoffhof: box48(p => {
    p.rect(2, 16, 44, 28, R.steel);
    for (let x = 6; x < 44; x += 5) p.vl(x, 18, 24, R.steel.d);
    p.rect(16, 28, 16, 16, R.grey);
    p.round(8, 4, 32, 11, 1, R.green);
    p.rect(12, 8, 24, 3, R.white, { outline: false, shade: 'flat' });
  }),
  sammelstelle: box48(p => {
    p.rect(0, 43, 48, 5, R.grey, { shade: 'flat' });
    p.rect(22, 12, 4, 32, R.grey);
    p.rect(6, 2, 36, 17, R.white);
    for (const x of [14, 32]) p.poly([[x, 4], [x + 5, 15], [x - 5, 15]], R.leaf);
    for (const x of [8, 38]) { p.poly([[x, 24], [x + 6, 40], [x - 6, 40]], R.leaf); p.rect(x - 1, 40, 2, 3, R.wood, { outline: false }); }
  }),
  schule: box48(p => {
    p.rect(4, 18, 40, 26, R.duvet);
    p.poly([[2, 19], [24, 4], [46, 19]], R.red);
    p.rect(19, 30, 10, 14, R.wood);
    p.rect(8, 23, 7, 7, R.sky).rect(33, 23, 7, 7, R.sky);
    p.ell(24, 14, 3.5, 3.5, R.white);
    p.vl(24, 12, 3, INK).hl(24, 14, 2, INK);
  }),
  strasse: box48(p => {
    p.rect(0, 30, 48, 18, R.grey, { shade: 'flat', outline: false });
    for (let x = 2; x < 48; x += 10) p.hl(x, 38, 6, R.white.m);
    p.rect(9, 32, 2, 3, R.wood, { outline: false });
    p.poly([[10, 6], [17, 32], [3, 32]], R.leaf);
    p.vl(37, 22, 10, INK).vl(38, 22, 10, INK);
    p.ell(37.5, 13, 9, 9, R.red);
    p.ell(37.5, 13, 6, 6, R.white, { outline: false, shade: 'flat' });
    p.line(33, 9, 42, 17, R.red.m, 2);
  }),
};

// The city behind the falling items, in three planes. The Alps stand furthest
// back and palest — no ink outline, the way distance takes contrast away. Then
// the landmarks, crowding and overlapping as they do from a hill: the Olympic
// tower and BMW's cylinders on the left, the Frauenkirche's two onion domes in
// the middle where a phone's narrow crop lands, the Neues Rathaus pushed in
// front of its feet, the yellow Theatinerkirche behind the roofs on the right
// and the Allianz Arena far out. In front of everything, a row of gabled
// houses and a few trees, with the inked outline only the near plane gets.
export const SKYLINE = draw(320, 96, p => {
  const H = 96;
  const far = { d: '#a9bccf', m: '#c3d2e1', l: '#d7e2ed' };
  const farer = { d: '#bccbdb', m: '#d2dde8', l: '#e2eaf2' };
  const snow = { d: '#dfe7ef', m: '#f2f6fa', l: '#ffffff' };
  const mist = c => ({ ink: c });

  // --- the Alps: two ranges, the further one paler
  const ridge = (pts, ramp, ink) => p.poly([...pts, [320, H], [0, H]], ramp, { ink, shade: 'flat' });
  ridge([[0, 46], [18, 34], [30, 40], [52, 18], [66, 30], [80, 24], [104, 40], [128, 28], [146, 14], [164, 30],
         [184, 22], [206, 38], [228, 20], [244, 12], [262, 28], [282, 22], [300, 34], [320, 26]], farer, '#b4c4d6');
  // snow on the high peaks of the far range
  for (const [x, y] of [[52, 18], [146, 14], [244, 12], [228, 20]]) {
    p.poly([[x, y], [x + 7, y + 8], [x + 3, y + 6], [x, y + 9], [x - 3, y + 6], [x - 7, y + 8]], snow, { ink: '#c9d6e3', shade: 'flat' });
  }
  ridge([[0, 58], [24, 44], [40, 52], [62, 36], [78, 46], [98, 40], [118, 52], [138, 42], [160, 54], [182, 40],
         [204, 50], [226, 36], [250, 48], [272, 42], [296, 54], [320, 46]], far, '#a3b6ca');
  for (const [x, y] of [[62, 36], [226, 36], [182, 40]]) {
    p.poly([[x, y], [x + 6, y + 6], [x + 2, y + 5], [x, y + 7], [x - 2, y + 5], [x - 6, y + 6]], snow, { ink: '#c0cfdd', shade: 'flat' });
  }

  // --- far plane: Olympic tower and roof, BMW, Allianz Arena, Theatiner
  const pale = { d: '#8e9db0', m: '#b2bfcd', l: '#d2dbe5', h: '#eef2f6' };
  // Olympiaturm
  p.vl(51, 0, 4, '#c9364a').vl(51, 4, 4, '#f4f4f4').vl(51, 8, 3, '#c9364a');
  p.rect(49, 10, 5, 76, pale, { shade: 'cyl', ink: '#7d8ca0' });
  p.round(43, 18, 17, 4, 1, pale, mist('#7d8ca0'));
  p.round(44, 22, 15, 6, 1, { d: '#5d6a80', m: '#6f7d93', l: '#8796ab' }, mist('#5d6a80'));
  p.hl(45, 24, 13, '#bfe3ef');
  p.round(45, 28, 13, 3, 1, pale, mist('#7d8ca0'));
  // the Olympic tent roof
  p.paint((a, b) => b > 66 && b < 80 && a > 14 && a < 92 && b > 66 + Math.abs(Math.sin((a - 14) / 12)) * 8,
          { d: '#a8bccb', m: '#c8d8e3', l: '#e4eef4' }, { ink: '#8ea3b5', tex: TEX.checks, texColor: '#b6c8d6' });
  // BMW: four cylinders, the blue-and-white roundel on top
  for (const [x, top] of [[82, 34], [96, 30], [89, 40], [103, 42]]) {
    p.round(x, top, 13, H - top, 6, pale, { shade: 'cyl', ink: '#7d8ca0' });
    for (let y = top + 7; y < 80; y += 7) p.hl(x + 2, y, 9, pale.d);
  }
  // the roundel, quartered blue and white
  p.paint((a, b) => Math.hypot(a - 103, b - 27) <= 4.6, R.white, { ink: INK, shade: 'flat' });
  p.paint((a, b) => Math.hypot(a - 103, b - 27) <= 3.4 && (a < 103) === (b < 27), R.blue, { outline: false, shade: 'flat' });
  // Allianz Arena, low on the far right
  p.ell(300, 66, 19, 8, { d: '#d9c6cc', m: '#ece1e4', l: '#f7f1f3' },
        { ink: '#a88f97', tex: (x, y) => (x + 2 * y) % 5 === 0, texColor: '#d2aab4' });
  p.hl(283, 67, 34, '#e8a0ad');
  // Theatinerkirche: ochre, two towers with scrolls, the big dome
  const ochre = { d: '#c08a2c', m: '#e3b04f', l: '#f2cf7f' };
  const copper = { d: '#3f8a63', m: '#5fae84', l: '#8fd1aa', h: '#c4ecd4' };
  p.rect(232, 50, 46, 46, ochre);
  p.ell(255, 46, 11, 11, copper);
  p.rect(252, 30, 6, 8, ochre);
  p.ell(255, 28, 4, 4, copper);
  p.vl(255, 20, 5, INK);
  for (const x of [226, 270]) {
    p.rect(x, 34, 12, 62, ochre);
    p.round(x + 2, 26, 8, 9, 3, ochre);
    p.ell(x + 6, 23, 4, 5, copper);
    p.vl(x + 6, 15, 4, INK);
    for (let y = 42; y < 90; y += 10) p.round(x + 4, y, 4, 6, 2, { d: '#6d4a1a', m: '#6d4a1a', l: '#6d4a1a' }, { outline: false });
  }
  p.round(249, 66, 12, 30, 6, R.wood);
  p.poly([[240, 60], [255, 52], [270, 60]], ochre);

  // --- the heroes: Frauenkirche, with the Neues Rathaus in front of its feet
  const brick = { d: '#7a3e1c', m: '#a95a2c', l: '#c9773f', h: '#e39a5f' };
  // nave roof between the towers, steep and tiled
  p.poly([[150, 52], [196, 52], [196, 96], [150, 96]], brick);
  p.poly([[146, 54], [173, 20], [200, 54]], { d: '#6b2f20', m: '#8f4030', l: '#b05a44' });
  for (let y = 30; y < 54; y += 4) p.hl(173 - (y - 20) * 0.75 + 2, y, (y - 20) * 1.5 - 3, '#6b2f20');
  for (const x of [142, 186]) {
    p.rect(x, 26, 20, 70, brick, { shade: 'cyl' });
    for (let y = 36; y < 96; y += 12) p.hl(x + 1, y, 18, brick.d);
    p.round(x + 6, 40, 3, 10, 1, { d: INK, m: '#2b2f3a', l: '#2b2f3a' }, { outline: false });
    p.round(x + 11, 40, 3, 10, 1, { d: INK, m: '#2b2f3a', l: '#2b2f3a' }, { outline: false });
    p.ell(x + 10, 60, 4, 4, R.paper);
    p.vl(x + 10, 57, 3, INK).hl(x + 10, 60, 2, INK);
    p.rect(x + 2, 22, 16, 5, brick, { shade: 'light' });
    // the onion dome: a neck, a swell, a point and a lantern
    p.paint((a, b) => {
      const cx = x + 10, t = (b - 2) / 20;
      if (t < 0 || t > 1) return false;
      const w = t < 0.3 ? 1 + t / 0.3 * 2 : 3 + Math.sin((t - 0.3) / 0.7 * Math.PI * 0.95) * 6;
      return Math.abs(a - cx + 0.5) <= Math.max(1, w);
    }, copper);
    p.rect(x + 9, 0, 2, 3, R.alu, { outline: false });
  }
  // Neues Rathaus: Gothic front, pinnacles, the clock tower with its spire
  const stone = { d: '#3e3a44', m: '#5d5866', l: '#7d778a' };
  p.rect(98, 54, 58, 42, stone);
  for (let x = 100; x < 154; x += 6) {
    p.poly([[x, 55], [x + 3, 46], [x + 6, 55]], stone);
    p.vl(x + 3, 43, 3, INK);
  }
  for (let x = 102; x < 152; x += 6) for (let y = 62; y < 92; y += 10) {
    if (x > 118 && x < 132) continue;
    p.round(x, y, 3, 6, 1, { d: '#bfe3ef', m: '#9fd3f7', l: '#bfe3ef' }, { outline: false });
  }
  p.rect(118, 24, 14, 72, stone, { shade: 'cyl' });
  p.poly([[116, 25], [125, 2], [134, 25]], copper);
  p.vl(125, 0, 3, INK);
  p.ell(125, 33, 4, 4, R.paper);
  p.vl(125, 30, 3, INK).hl(125, 33, 2, INK);
  p.rect(116, 44, 18, 7, stone, { shade: 'light' });
  for (let x = 118; x < 133; x += 3) p.dot(x, 47, '#e3b04f');
  p.round(121, 76, 8, 20, 4, R.wood);

  // --- the near plane: a row of houses and trees, overlapping
  const fronts = [
    [0, 22, 30, '#f2cf7f'], [18, 18, 24, '#f4f4f4'], [34, 24, 34, '#e8a0ad'], [56, 20, 26, '#cfe3c8'],
    [74, 26, 30, '#f4f4f4'], [96, 18, 22, '#f2cf7f'], [192, 22, 26, '#f4f4f4'], [212, 18, 30, '#cfe3c8'],
    [228, 26, 24, '#f2cf7f'], [252, 20, 28, '#e8a0ad'], [270, 24, 20, '#f4f4f4'], [292, 28, 22, '#f2cf7f'],
  ];
  fronts.forEach(([x, w, h, c], i) => {
    const ramp = { d: c, m: c, l: c };
    p.rect(x, H - h, w, h, ramp, { shade: 'flat' });
    const roof = i % 3 === 0
      ? [[x - 1, H - h + 1], [x + w / 2, H - h - 9], [x + w + 1, H - h + 1]]
      : [[x - 1, H - h + 1], [x + 3, H - h - 5], [x + w - 3, H - h - 5], [x + w + 1, H - h + 1]];
    p.poly(roof, { d: '#8f4030', m: '#b05a44', l: '#c97760' });
    if (i % 2) p.rect(x + w - 6, H - h - 9, 3, 6, { d: '#8f4030', m: '#8f4030', l: '#8f4030' });
    for (let wx = x + 3; wx < x + w - 3; wx += 6) for (let wy = H - h + 5; wy < H - 4; wy += 8) {
      p.rect(wx, wy, 3, 4, { d: '#5aa9e6', m: '#9fd3f7', l: '#bfe3ef' }, { ink: '#3e4a66' });
    }
  });
  for (const [x, y, r] of [[160, 86, 9], [174, 88, 7], [8, 88, 6], [312, 86, 8], [218, 90, 6]]) {
    p.ell(x, y, r, r * 0.9, R.leaf);
    p.dot(x - 2, y - 3, R.leaf.h).dot(x + 1, y - 4, R.leaf.l);
  }
});
