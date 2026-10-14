// The engine tests from a terminal: `node game/test/run.mjs`. The test page is
// still the reference — this only gives it the few browser globals it touches.
const el = () => ({ innerHTML: '', textContent: '' });
globalThis.document = { getElementById: el, title: '', cookie: '' };
globalThis.localStorage = { length: 0 };
globalThis.sessionStorage = { length: 0 };
globalThis.window = globalThis;
await import('./tests.js');
const r = globalThis.__results;

// Art coverage needs the repository's files, which the test page cannot read:
// every container and every object in data must have a drawing, so none of
// them falls back to the blank box in a release.
const fs = await import('node:fs');
const path = await import('node:path');
const { ITEMS, CONTAINERS, DECOR, ROUTES } = await import('../js/sprites.js');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const json = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const missing = [];
json('data/places.json').places.forEach(p => p.containers.forEach(c => { if (!CONTAINERS[c.id]) missing.push('container ' + c.id); }));
for (const dir of ['data/items', 'data/drafts']) {
  for (const f of fs.readdirSync(path.join(root, dir))) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    const item = json(dir + '/' + f);
    if (!ITEMS[item.id]) missing.push('item ' + item.id);
  }
}
const tree = json('data/finale/christbaum.json');
tree.decorations.forEach(d => { if (!DECOR[d.id]) missing.push('decoration ' + d.id); });
tree.routes.forEach(x => { if (!ROUTES[x.id]) missing.push('route ' + x.id); });
r.total += 1;
if (missing.length) { r.failed += 1; r.bad.push({ name: 'every object in data has a drawing', why: missing.join(', ') }); }

// Hand-drawn files in game/art/<kind>/ replace drawings in code. A file the game
// would never ask for — a typo in the name — or one of the wrong size would fail
// silently in the browser, so it fails here instead.
const { size } = await import('../../tools/png.mjs');
const { DECOR: D, TREE, SKYLINE } = await import('../js/sprites.js');
const KINDS = { items: ITEMS, containers: CONTAINERS, routes: ROUTES, decor: D, scenery: { tree: TREE, skyline: SKYLINE } };
const ids = new Map();
for (const dir of ['data/items', 'data/drafts']) for (const f of fs.readdirSync(path.join(root, dir))) {
  if (f.endsWith('.json') && !f.startsWith('_')) { const it = json(dir + '/' + f); ids.set(it.id, it); }
}
const artProblems = [];
const artDir = path.join(root, 'game/art');
if (fs.existsSync(artDir)) for (const kind of fs.readdirSync(artDir)) {
  const dir = path.join(artDir, kind);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (!KINDS[kind]) { artProblems.push(kind + '/: unknown folder, expected ' + Object.keys(KINDS).join(', ')); continue; }
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith('.')) continue;
    if (!f.endsWith('.png')) { artProblems.push(kind + '/' + f + ': not a PNG'); continue; }
    const key = f.slice(0, -4).replace(/--/g, ':');
    let want = KINDS[kind][key];
    if (!want && kind === 'items') {
      // a variant or a part may be drawn by hand without any code
      const m = key.match(/^([a-z0-9_]+)([.:])([a-z0-9_]+)$/);
      const it = m && ids.get(m[1]);
      const ok = it && (m[2] === '.' ? it.variants.some(v => v.id === m[3])
                                     : it.variants.some(v => (v.parts || []).some(p => p.id === m[3])));
      if (ok) want = { w: 32, h: 32 };
    }
    if (!want) { artProblems.push(kind + '/' + f + ': no such ' + kind.replace(/s$/, '') + ' — check the name'); continue; }
    const got = size(fs.readFileSync(path.join(dir, f)));
    if (!got) artProblems.push(kind + '/' + f + ': not a readable PNG');
    else if (got.w !== want.w || got.h !== want.h) artProblems.push(kind + '/' + f + `: ${got.w}×${got.h}, must be ${want.w}×${want.h}`);
  }
}
r.total += 1;
if (artProblems.length) { r.failed += 1; r.bad.push({ name: 'hand-drawn files match a sprite and its size', why: artProblems.join('; ') }); }
console.log(r.total + ' tests, ' + r.failed + ' failed');
r.bad.forEach(b => console.log('✗ ' + b.name + '\n   ' + b.why));
process.exit(r.failed ? 1 : 0);
