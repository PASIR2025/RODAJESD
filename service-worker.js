/*
  SimuPLC Lab PWA Service Worker
  Versión corregida:
  - NO devuelve index.html viejo si hay internet.
  - Network First para HTML y navegación.
  - Cache First solo para assets estáticos.
  - Limpia cachés antiguas automáticamente.
*/

const CACHE_NAME = 'simuplc-lab-pwa-v3-premium-cache-fix';
const STATIC_CACHE = [
  './manifest.json',
  './ladder_mobile_compact.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-fbd.svg',
  './icons/icon-ladder.svg',
  './icons/icon-clean-sim.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE).catch(() => Promise.resolve());
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
          return Promise.resolve();
        })
      );
    }).then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('./index.html');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);

  // No interferir con Apps Script ni APIs externas.
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // Navegación / HTML: siempre intentar red primero.
  if (
    request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets estáticos: cache first.
  event.respondWith(cacheFirst(request));
});
