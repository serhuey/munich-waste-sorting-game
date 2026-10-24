// The installed game without a network: an app on the home screen opens where
// there is no signal too. Registered only in the installed app (main.js) — a
// browser tab writes nothing to the device. Network first — online the player always
// gets this build and the day's rules; the copy answers only when the network
// does not. The build writes its version into CACHE, so every release is a new
// worker with a cache of its own, and the old one is dropped when it takes over.

const CACHE = 'muell-__BUILD__';

// Everything one run needs: the page, what it links, the content, every picture
// the content lists. Fetched on install, so offline works from the first visit,
// not only from the second.
async function precache() {
  const cache = await caches.open(CACHE);
  const page = await (await fetch('./', { cache: 'no-store' })).text();
  const linked = [...page.matchAll(/(?:href|src)="((?:js|css|icons)\/[^"]+)"/g)].map(m => m[1]);
  const content = await (await fetch('content.json', { cache: 'no-store' })).json();
  const tag = content.version ? '?v=' + content.version : '';
  const art = Object.keys(content.art || {}).map(f => 'art/' + f + tag);
  // addAll refuses a list with a repeat, and the page names main.js twice.
  await cache.addAll([...new Set(['./', 'content.json', 'manifest.webmanifest', ...linked, ...art])]);
}

self.addEventListener('install', e => e.waitUntil(precache().then(() => self.skipWaiting())));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('muell-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Only the game's own files; what a script on the server answers is not one.
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('.php')) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(async () => {
    // content.json is asked for with no-store; the copy is matched by address.
    const hit = await caches.match(req, { ignoreVary: true });
    if (hit) return hit;
    // The page under any query (?lang=en) is the same page.
    if (req.mode === 'navigate') return caches.match('./');
    return Response.error();
  }));
});
