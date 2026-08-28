/**
 * Eko — API Client
 * Handles all requests to the FastAPI backend.
 * Automatically attaches the user ID header for data isolation.
 * Falls back gracefully when offline (cache → queue → retry).
 *
 * Production: uses window.EKO_API_BASE set by auth.js (HTTPS production URL).
 */

const DEFAULT_API_TIMEOUT_MS = 15000;  // 15 second default timeout for standard CRUD
const AI_API_TIMEOUT_MS = 60000;       // 60 second timeout for AI operations (Gemini / Render cold start)
const API_MAX_RETRIES = 3;
const API_RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (typeof isDemoMode !== 'undefined' && isDemoMode) {
        // Demo mode: use a fixed sandbox user ID so backend endpoints work without real auth
        headers['X-User-Id'] = 'demo_user_123';
    } else if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
        headers['X-User-Id'] = currentUser.id;
    }
    return headers;
}

/**
 * Fetch with timeout support using AbortController.
 */
async function fetchWithTimeout(url, options, timeoutMs = DEFAULT_API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Core API request — with intelligent timeout, retry, and offline support.
 */
async function apiRequest(method, path, body = null, customTimeout = null) {
    if (!navigator.onLine) {
        if (method !== 'GET' && typeof AndroidBridge !== 'undefined') {
            AndroidBridge.queueSync(path, method, JSON.stringify(body));
            return { queued: true, message: 'Saved locally. Will sync when online.' };
        }
        // Try cache for GET requests
        if (method === 'GET') {
            const cached = await offlineCache.get(path);
            if (cached) return cached;
        }
        throw { type: 'OFFLINE', offline: true, message: "You're offline. Your message is saved. Try again when you're connected." };
    }

    // EKO_API_BASE is set by auth.js — production HTTPS URL (no localhost, no emulator)
    const base = window.EKO_API_BASE || 'https://eko-field-worker-api.onrender.com';
    const url = `${base}${path}`;
    const opts = { method, headers: getHeaders() };
    if (body) opts.body = JSON.stringify(body);

    const isAiEndpoint = path.startsWith('/api/ai/');
    const timeoutMs = customTimeout || (isAiEndpoint ? AI_API_TIMEOUT_MS : DEFAULT_API_TIMEOUT_MS);
    const maxAttempts = isAiEndpoint ? 2 : (method === 'GET' ? API_MAX_RETRIES : 1);

    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
            const delay = isAiEndpoint ? 1500 : (API_RETRY_DELAYS[attempt - 1] || 2000);
            await new Promise(r => setTimeout(r, delay));
        }

        try {
            const res = await fetchWithTimeout(url, opts, timeoutMs);

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const errMsg = errData.detail || errData.message || 'Request failed.';

                // Auth error
                if (res.status === 401 || res.status === 403) {
                    throw {
                        type: 'AUTH_ERROR',
                        status: res.status,
                        message: 'Your session has expired. Please sign in again.'
                    };
                }

                // Client validation errors (4xx) - do not retry
                if (res.status >= 400 && res.status < 500) {
                    throw {
                        type: 'CLIENT_ERROR',
                        status: res.status,
                        message: errMsg
                    };
                }

                // Server error (5xx) - allow retry for transient issues
                lastError = {
                    type: 'SERVER_ERROR',
                    status: res.status,
                    message: isAiEndpoint
                        ? 'Eko AI server is temporarily busy. Retrying...'
                        : 'Server error. Please try again.'
                };
                continue;
            }

            const data = await res.json();

            // Cache successful GET responses
            if (method === 'GET') {
                await offlineCache.set(path, data);
            }
            return data;

        } catch (e) {
            if (e.type === 'AUTH_ERROR' || e.type === 'CLIENT_ERROR' || e.offline) {
                throw e; // Do not retry auth or client validation failures
            }

            if (e.name === 'AbortError') {
                lastError = {
                    type: 'TIMEOUT',
                    message: isAiEndpoint
                        ? 'Eko AI is taking longer than usual. Please retry.'
                        : 'Request timed out. Please try again.'
                };
            } else if (!navigator.onLine) {
                throw {
                    type: 'OFFLINE',
                    offline: true,
                    message: "You're offline. Please check your internet connection."
                };
            } else {
                lastError = {
                    type: 'NETWORK_ERROR',
                    message: e.message || 'Connection problem. Please try again.'
                };
            }
        }
    }

    // All retries exhausted
    if (method !== 'GET' && !isAiEndpoint && typeof AndroidBridge !== 'undefined') {
        AndroidBridge.queueSync(path, method, JSON.stringify(body));
        return { queued: true, message: 'Backend unreachable. Saved locally.' };
    }

    throw lastError || { type: 'SERVER_ERROR', message: 'Request failed. Please try again.' };
}


const api = {
    // Customers
    getCustomers: () => apiRequest('GET', '/api/customers'),
    createCustomer: (data) => apiRequest('POST', '/api/customers', data),
    updateCustomer: (id, data) => apiRequest('PATCH', `/api/customers/${id}`, data),
    deleteCustomer: (id) => apiRequest('DELETE', `/api/customers/${id}`),

    // Tasks
    getTasks: () => apiRequest('GET', '/api/tasks'),
    createTask: (data) => apiRequest('POST', '/api/tasks', data),
    updateTask: (id, data) => apiRequest('PATCH', `/api/tasks/${id}`, data),
    deleteTask: (id) => apiRequest('DELETE', `/api/tasks/${id}`),

    // Notes
    getNotes: () => apiRequest('GET', '/api/notes'),
    createNote: (data) => apiRequest('POST', '/api/notes', data),
    deleteNote: (id) => apiRequest('DELETE', `/api/notes/${id}`),

    // Offers
    getOffers: () => apiRequest('GET', '/api/offers'),
    createOffer: (data) => apiRequest('POST', '/api/offers', data),
    deleteOffer: (id) => apiRequest('DELETE', `/api/offers/${id}`),

    // Inventory
    getInventory: () => apiRequest('GET', '/api/inventory'),
    getLowStock: () => apiRequest('GET', '/api/inventory/low-stock'),
    createInventoryItem: (data) => apiRequest('POST', '/api/inventory', data),
    updateInventoryItem: (id, data) => apiRequest('PATCH', `/api/inventory/${id}`, data),
    deleteInventoryItem: (id) => apiRequest('DELETE', `/api/inventory/${id}`),

    // Payments
    getPayments: (status = null) => apiRequest('GET', `/api/payments${status ? '?status=' + encodeURIComponent(status) : ''}`),
    createPayment: (data) => apiRequest('POST', '/api/payments', data),
    updatePayment: (id, data) => apiRequest('PATCH', `/api/payments/${id}`, data),
    deletePayment: (id) => apiRequest('DELETE', `/api/payments/${id}`),

    // AI Superpowers & Multi-turn Conversational Assistant
    askEko: (question, history = [], conversationId = null) => apiRequest('POST', '/api/ai/ask', {
        question,
        history,
        conversation_id: conversationId
    }),
    logActionTaken: (action, source_question = null) => apiRequest('POST', '/api/ai/action-taken', { action, source_question }).catch(() => {}),
    scanBill: (data) => apiRequest('POST', '/api/ai/scan-bill', data),
    voiceParse: (data) => apiRequest('POST', '/api/ai/voice-parse', data),
    generateMessage: (data) => apiRequest('POST', '/api/ai/generate-message', data),
    getCreditScore: (data) => apiRequest('POST', '/api/ai/credit-score', data),
    generateFlyer: (data) => apiRequest('POST', '/api/ai/generate-flyer', data),
};




// ── Demo Data ─────────────────────────────────────────────────────────────────
const DEMO_DATA = {
    customers: [
        { id: 'd1', name: 'Ramesh Kumar', phone: '9876543210', business_type: 'Wholesale', amount_due: 3500, follow_up_date: new Date().toISOString().slice(0, 10), notes: 'Ordered 50kg rice last week' },
        { id: 'd2', name: 'Sunita Devi', phone: '8765432109', business_type: 'Retail', amount_due: 0, follow_up_date: null, notes: 'Regular customer, buys weekly' },
        { id: 'd3', name: 'Mohan Lal', phone: '7654321098', business_type: 'Restaurant', amount_due: 1200, follow_up_date: null, notes: 'Prefers afternoon delivery' },
    ],
    tasks: [
        { id: 't1', title: 'Call supplier for sugar stock', due_date: new Date().toISOString().slice(0, 10), completed: false, priority: 'high' },
        { id: 't2', title: 'Update price board for maida', due_date: null, completed: false, priority: 'medium' },
        { id: 't3', title: 'Collect payment from Ramesh', due_date: new Date().toISOString().slice(0, 10), completed: false, priority: 'high' },
    ],
    notes: [
        { id: 'n1', content: 'Dal ki price 5 rupaye badh gayi aaj. Update karna hai register mein.', created_at: new Date().toISOString() },
        { id: 'n2', content: 'New customer: Priya from next lane. Interested in monthly ration package.', created_at: new Date(Date.now() - 86400000).toISOString() },
    ],
    offers: [
        { id: 'o1', title: 'Weekly Ration Bundle', description: '5kg rice + 1kg dal + 1L oil', discount: '10% off', valid_until: '2026-09-30', active: true },
    ],
};
