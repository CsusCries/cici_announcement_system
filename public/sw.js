/*
 * Service worker: lets the site install as an app and open without a connection.
 * Network first: when online you always get the latest files; the saved copy is
 * only used when the network fails. Supabase requests (other domains) are never cached.
 */
const CACHE = 'cici-v1';
const APP_FILES = [
  'index.html', 'admin.html', 'login.html', 'offline.html',
  'config.js', 'js/data.js', 'js/pwa.js', 'css/mobile.css',
  'vendor/supabase/supabase.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('offline.html');
        return Response.error();
      })
  );
});
