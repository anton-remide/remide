/* Service Worker — RemiDe PWA
 * Strategy:
 *   • App shell (HTML, CSS, JS, images) → cache-first with network fallback
 *   • Supabase API / external requests   → network-only (never cache)
 *   • Offline fallback                   → serve cached index.html for navigation
 *
 * Cache is versioned so updates bust stale assets.
 */

const CACHE_NAME = 'remide-v1';

// Minimal shell — Vite hashed assets are cached on fetch
const SHELL_URLS = [
  './',
  './favicon-32.png',
  './favicon-192.png',
  './apple-touch-icon.png',
  './logo.svg',
  './logo-full.svg',
];

/* ── Install ─────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

/* ── Activate ────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Claim all open tabs
  self.clients.claim();
});

/* ── Fetch ───────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin API calls, analytics, chrome-extension, etc.
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/rest/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('umami')
  ) {
    return;
  }

  // Navigation requests (SPA) → network-first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh HTML
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('./') || caches.match('./index.html'))
    );
    return;
  }

  // Static assets → cache-first (Vite hashed filenames = safe to cache long-term)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
