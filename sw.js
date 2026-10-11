// Jachtlogboek service worker — EERST INTERNET, DAN PAS CACHE.
// Met bereik krijg je altijd de nieuwste versie; zonder bereik start de app uit de bewaarde kopie.
const VERSION = '2026-10-11-i';
const CACHE = 'jlb-' + VERSION;
const APP = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/suncalc/1.9.0/suncalc.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];
const TIMEOUT_MS = 4000; // slecht bereik: na 4 s terugvallen op de bewaarde kopie

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled([
    ...APP.map(u => c.add(new Request(u, { cache: 'reload' }))),
    ...LIBS.map(u => c.add(u))
  ])));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('jlb-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isLib = LIBS.includes(req.url);
  if (!sameOrigin && !isLib) return; // Supabase, weer en kaartbeelden gaan rechtstreeks
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await withTimeout(fetch(req.url, sameOrigin ? { cache: 'no-store' } : {}), TIMEOUT_MS);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req);
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const idx = (await cache.match('./index.html')) || (await cache.match('./'));
        if (idx) return idx;
      }
      throw err;
    }
  })());
});
