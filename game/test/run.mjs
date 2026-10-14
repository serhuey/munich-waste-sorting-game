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
console.log(r.total + ' tests, ' + r.failed + ' failed');
r.bad.forEach(b => console.log('✗ ' + b.name + '\n   ' + b.why));
process.exit(r.failed ? 1 : 0);
