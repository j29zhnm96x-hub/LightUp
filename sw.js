/*
  Light4Me — Offline-first service worker
  Cache-first for all assets. Bump CACHE_NAME on deploy.
*/

const CACHE_NAME = 'light4me-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles.css',
  './src/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      // Cache-first
      const cached = await caches.match(req);
      if (cached) {
        // Safari fix: cloned redirected response
        if (cached.redirected) {
          const body = await cached.blob();
          return new Response(body, {
            status: cached.status,
            statusText: cached.statusText,
            headers: cached.headers
          });
        }
        return cached;
      }

      try {
        let res = await fetch(req);
        if (res.redirected) {
          const body = await res.blob();
          res = new Response(body, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers
          });
        }
        const cache = await caches.open(CACHE_NAME);
        if (res.ok && res.type !== 'opaque') {
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});
