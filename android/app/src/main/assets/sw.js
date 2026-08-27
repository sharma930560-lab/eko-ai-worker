/**
 * Eko Service Worker — Offline Support (Network-First Strategy)
 */

const CACHE_NAME = 'eko-cache-v3';

self.addEventListener('install', e => {
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // API calls always go straight to network
    if (url.port === '8000' || url.pathname.startsWith('/api/')) {
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
