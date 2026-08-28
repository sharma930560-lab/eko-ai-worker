/**
 * Eko Service Worker — Offline Support (Network-First Strategy for Static Assets)
 */

const CACHE_NAME = 'eko-cache-v4';

self.addEventListener('install', e => {
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // Only handle GET requests
    if (e.request.method !== 'GET') {
        return;
    }

    const url = new URL(e.request.url);

    // Bypass SW entirely for all API requests and cross-origin requests
    if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin || url.port === '8000') {
        return;
    }

    // Static assets: Network first, cache fallback
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res && res.status === 200 && e.request.method === 'GET') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});

