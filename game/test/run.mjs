// The engine tests from a terminal: `node game/test/run.mjs`. The test page is
// still the reference — this only gives it the few browser globals it touches.
const el = () => ({ innerHTML: '', textContent: '' });
globalThis.document = { getElementById: el, title: '', cookie: '' };
globalThis.localStorage = { length: 0 };
globalThis.sessionStorage = { length: 0 };
globalThis.window = globalThis;
await import('./tests.js');
const r = globalThis.__results;

// Art needs the repository's files, which the test page cannot read. Every
// picture is a PNG in game/art/<kind>/, and every object, container, route and
// decoration in data must have one, so none falls back to the blank box in a
// release.
const fs = await import('node:fs');
const path = await import('node:path');
const { size } = await import('../../tools/png.mjs');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const json = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const artDir = path.join(root, 'game/art');
const files = {};
if (fs.existsSync(artDir)) for (const kind of fs.readdirSync(artDir)) {
  const dir = path.join(artDir, kind);
  if (fs.statSync(dir).isDirectory()) files[kind] = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
}
const hasFile = (kind, key) => (files[kind] || []).includes(key.replace(/:/g, '--') + '.png');

const ids = new Map();
for (const dir of ['data/items', 'data/drafts']) for (const f of fs.readdirSync(path.join(root, dir))) {
  if (f.endsWith('.json') && !f.startsWith('_')) { const it = json(dir + '/' + f); ids.set(it.id, it); }
}
const places = json('data/places.json').places;
const tree = json('data/finale/christbaum.json');
const missing = [];
places.forEach(p => p.containers.forEach(c => { if (!hasFile('containers', c.id)) missing.push('containers/' + c.id); }));
ids.forEach((_, id) => { if (!hasFile('items', id)) missing.push('items/' + id); });
tree.decorations.forEach(d => { if (!hasFile('decor', d.id)) missing.push('decor/' + d.id); });
tree.routes.forEach(x => { if (!hasFile('routes', x.id)) missing.push('routes/' + x.id); });
['tree', 'skyline'].forEach(k => { if (!hasFile('scenery', k)) missing.push('scenery/' + k); });
r.total += 1;
if (missing.length) { r.failed += 1; r.bad.push({ name: 'every object in data has a picture', why: missing.map(m => m + '.png').join(', ') }); }

// A file the game would never ask for — a typo in the name — or one of the
// wrong size would fail silently in the browser, so it fails here instead.
// Objects 32×32, containers and routes 48×48; decorations, the tree and the
// skyline are as large as they are drawn.
const SIZE = { items: [32, 32], containers: [48, 48], routes: [48, 48] };
const known = {
  items: key => {
    const m = key.match(/^([a-z0-9_]+)(?:([.:])([a-z0-9_]+))?$/);
    const it = m && ids.get(m[1]);
    if (!it) return false;
    if (!m[2]) return true;
    return m[2] === '.' ? it.variants.some(v => v.id === m[3])
                        : it.variants.some(v => (v.parts || []).some(p => p.id === m[3]));
  },
  containers: key => places.some(p => p.containers.some(c => c.id === key)),
  routes: key => tree.routes.some(x => x.id === key),
  decor: key => tree.decorations.some(d => d.id === key),
  scenery: key => key === 'tree' || key === 'skyline',
};
const artProblems = [];
for (const [kind, list] of Object.entries(files)) {
  if (!known[kind]) { artProblems.push(kind + '/: unknown folder, expected ' + Object.keys(known).join(', ')); continue; }
  for (const f of list) {
    if (!f.endsWith('.png')) { artProblems.push(kind + '/' + f + ': not a PNG'); continue; }
    const key = f.slice(0, -4).replace(/--/g, ':');
    if (!known[kind](key)) { artProblems.push(kind + '/' + f + ': nothing in data is called that — check the name'); continue; }
    const got = size(fs.readFileSync(path.join(artDir, kind, f)));
    const want = SIZE[kind];
    if (!got) artProblems.push(kind + '/' + f + ': not a readable PNG');
    else if (want && (got.w !== want[0] || got.h !== want[1])) artProblems.push(kind + '/' + f + `: ${got.w}×${got.h}, must be ${want[0]}×${want[1]}`);
  }
}
r.total += 1;
if (artProblems.length) { r.failed += 1; r.bad.push({ name: 'every picture matches something in data, at its size', why: artProblems.join('; ') }); }
console.log(r.total + ' tests, ' + r.failed + ' failed');
r.bad.forEach(b => console.log('✗ ' + b.name + '\n   ' + b.why));
process.exit(r.failed ? 1 : 0);
