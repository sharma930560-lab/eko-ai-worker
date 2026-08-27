/**
 * Eko — Offline-First Cache & Sync Manager
 *
 * Uses IndexedDB to:
 *   - Cache API responses for offline reads
 *   - Queue mutations when offline
 *   - Auto-sync when internet returns
 *   - Show pending sync count
 *
 * Architecture:
 *   - offlineCache: read/write IndexedDB keyed by API path
 *   - syncQueue: store pending mutations (POST/PATCH/DELETE)
 *   - Auto-sync triggers on 'online' event
 */

const CACHE_DB_NAME = 'eko_offline_v1';
const CACHE_DB_VERSION = 1;
const STORE_CACHE = 'api_cache';
const STORE_QUEUE = 'sync_queue';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── IndexedDB Bootstrap ───────────────────────────────────────────────────────
let _cacheDb = null;

function openCacheDb() {
    if (_cacheDb) return Promise.resolve(_cacheDb);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
        req.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_CACHE)) {
                db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(STORE_QUEUE)) {
                const qs = db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
                qs.createIndex('created_at', 'created_at', { unique: false });
            }
        };
        req.onsuccess = () => {
            _cacheDb = req.result;
            resolve(_cacheDb);
        };
        req.onerror = () => reject(req.error);
    });
}

function idbTransaction(storeName, mode) {
    return openCacheDb().then(db => {
        const tx = db.transaction(storeName, mode);
        return tx.objectStore(storeName);
    });
}

function idbGet(store, key) {
    return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbPut(store, value) {
    return new Promise((resolve, reject) => {
        const req = store.put(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbDelete(store, key) {
    return new Promise((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function idbGetAll(store) {
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ── Offline Cache ─────────────────────────────────────────────────────────────
const offlineCache = {
    async get(path) {
        try {
            const store = await idbTransaction(STORE_CACHE, 'readonly');
            const entry = await idbGet(store, path);
            if (!entry) return null;
            if (Date.now() - entry.ts > CACHE_TTL_MS) {
                // Stale — delete in background, return stale anyway
                idbTransaction(STORE_CACHE, 'readwrite').then(s => idbDelete(s, path)).catch(() => {});
            }
            return entry.data;
        } catch (_) {
            return null;
        }
    },

    async set(path, data) {
        try {
            const store = await idbTransaction(STORE_CACHE, 'readwrite');
            await idbPut(store, { key: path, data, ts: Date.now() });
        } catch (_) { /* ignore write errors */ }
    },

    async invalidate(path) {
        try {
            const store = await idbTransaction(STORE_CACHE, 'readwrite');
            await idbDelete(store, path);
        } catch (_) {}
    },

    async invalidateAll() {
        try {
            const db = await openCacheDb();
            const tx = db.transaction(STORE_CACHE, 'readwrite');
            tx.objectStore(STORE_CACHE).clear();
        } catch (_) {}
    },
};

// ── Sync Queue ────────────────────────────────────────────────────────────────
const syncQueue = {
    async add(method, path, body) {
        try {
            const store = await idbTransaction(STORE_QUEUE, 'readwrite');
            await idbPut(store, {
                method,
                path,
                body: JSON.stringify(body),
                created_at: Date.now(),
                retries: 0,
            });
            updatePendingSyncCount();
        } catch (_) {}
    },

    async getAll() {
        try {
            const store = await idbTransaction(STORE_QUEUE, 'readonly');
            return await idbGetAll(store);
        } catch (_) {
            return [];
        }
    },

    async remove(id) {
        try {
            const store = await idbTransaction(STORE_QUEUE, 'readwrite');
            await idbDelete(store, id);
            updatePendingSyncCount();
        } catch (_) {}
    },

    async count() {
        try {
            const items = await this.getAll();
            return items.length;
        } catch (_) {
            return 0;
        }
    },
};

// ── Pending Sync Count UI ─────────────────────────────────────────────────────
async function updatePendingSyncCount() {
    const count = await syncQueue.count();
    const banner = document.getElementById('status-banner');
    if (banner && !navigator.onLine && count > 0) {
        banner.textContent = `Offline — ${count} change${count !== 1 ? 's' : ''} pending sync`;
    }
}

// ── Auto-Sync on Reconnect ───────────────────────────────────────────────────
let _isSyncing = false;

async function flushSyncQueue() {
    if (_isSyncing) return;
    _isSyncing = true;

    const banner = document.getElementById('status-banner');
    if (banner) {
        banner.textContent = 'Syncing...';
        banner.style.display = 'block';
        banner.style.backgroundColor = '#4F46E5';
    }

    try {
        const items = await syncQueue.getAll();
        let synced = 0;
        let failed = 0;

        for (const item of items) {
            if (!navigator.onLine) break;

            const base = window.EKO_API_BASE || 'http://localhost:8000';
            const headers = { 'Content-Type': 'application/json' };
            if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
                headers['X-User-Id'] = currentUser.id;
            }

            try {
                const res = await fetch(`${base}${item.path}`, {
                    method: item.method,
                    headers,
                    body: item.body || undefined,
                });

                if (res.ok || res.status === 404 || res.status === 409) {
                    // Success or conflict/already-deleted — remove from queue
                    await syncQueue.remove(item.id);
                    synced++;
                    // Invalidate the cache for this entity
                    const entityPath = item.path.split('/').slice(0, 3).join('/');
                    await offlineCache.invalidate(entityPath);
                } else {
                    failed++;
                }
            } catch (_) {
                failed++;
            }
        }

        if (banner) {
            if (synced > 0 && failed === 0) {
                banner.textContent = `Synced ${synced} update${synced !== 1 ? 's' : ''}!`;
                banner.style.backgroundColor = '#16A34A';
                setTimeout(() => {
                    banner.style.display = 'none';
                }, 2500);

                // Refresh data after successful sync
                if (typeof loadDashboardData === 'function') {
                    setTimeout(loadDashboardData, 500);
                }
            } else if (failed > 0) {
                banner.textContent = `Sync: ${synced} done, ${failed} pending retry`;
                banner.style.backgroundColor = '#DC2626';
            } else {
                banner.style.display = 'none';
            }
        }
    } finally {
        _isSyncing = false;
    }
}

// ── Network Event Listeners ───────────────────────────────────────────────────
window.addEventListener('online', () => {
    console.log('Eko: Network reconnected — starting sync');
    flushSyncQueue();

    const banner = document.getElementById('status-banner');
    if (banner) {
        banner.style.display = 'none';
    }
});

window.addEventListener('offline', () => {
    console.log('Eko: Network lost');
    updatePendingSyncCount();

    const banner = document.getElementById('status-banner');
    if (banner) {
        banner.style.display = 'block';
        banner.style.backgroundColor = '#64748B';
    }
});

// ── Load Cached Data on Startup ───────────────────────────────────────────────
/**
 * Returns cached data immediately so dashboard shows without waiting for network.
 * Call this before making API requests on app startup.
 */
async function getCachedOrFetch(path, fetchFn) {
    // First: try cache (instant, works offline)
    const cached = await offlineCache.get(path);
    if (cached) {
        return { data: cached, fromCache: true };
    }
    // Then: fetch from network
    try {
        const data = await fetchFn();
        return { data, fromCache: false };
    } catch (e) {
        if (e.offline) {
            return { data: null, fromCache: false, offline: true };
        }
        throw e;
    }
}
