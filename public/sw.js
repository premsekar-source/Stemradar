const PAGES_CACHE = 'stem-radar-pages-v1';
const STATIC_CACHE = 'stem-radar-static-v1';

const PRECACHE_URLS = [
  './',
  './manifest.webmanifest',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-512x512.png',
  './apple-touch-icon.png',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled(
        PRECACHE_URLS.map((relUrl) =>
          fetch(relUrl).then((res) => {
            if (res && res.ok) {
              const targetCache = relUrl === './' ? PAGES_CACHE : STATIC_CACHE;
              return caches.open(targetCache).then((c) => c.put(relUrl, res));
            }
            return undefined;
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PAGES_CACHE && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Strictly cache only this app's own origin. Never cache Supabase, external fonts, or third-party APIs.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never cache API endpoints if any exist on origin
  if (url.pathname.includes('/api/')) {
    return;
  }

  // Pages: network first, fall back to cached page when offline
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            event.waitUntil(
              caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy))
            );
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedExact = await caches.match(request, { ignoreSearch: true });
          if (cachedExact) return cachedExact;
          const cachedRoot = await caches.match('./');
          if (cachedRoot) return cachedRoot;
          return new Response('Offline', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
    return;
  }

  // Static files: cached first, refreshed in the background (stale-while-revalidate)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const backgroundRefresh = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      if (cachedResponse) {
        event.waitUntil(backgroundRefresh);
        return cachedResponse;
      }

      return backgroundRefresh;
    })
  );
});
