/**
 * Eko — API Client
 * Handles all requests to the FastAPI backend.
 * Automatically attaches the user ID header for data isolation.
 * Falls back gracefully when offline.
 */

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

async function apiRequest(method, path, body = null) {
    if (!navigator.onLine) {
        if (method !== 'GET' && typeof AndroidBridge !== 'undefined') {
            AndroidBridge.queueSync(path, method, JSON.stringify(body));
            return { queued: true, message: 'Saved locally. Will sync when online.' };
        }
        throw { offline: true, message: 'You are offline.' };
    }
    // Default to localhost, but allow override.
    // On Android Emulator, use 10.0.2.2 to access host machine.
    let base = window.EKO_API_BASE || 'http://localhost:8000';

    if (base.includes('localhost') && /Android/i.test(navigator.userAgent)) {
        base = base.replace('localhost', '10.0.2.2');
    }

    const opts = { method, headers: getHeaders() };
    if (body) opts.body = JSON.stringify(body);

    try {
        const res = await fetch(`${base}${path}`, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw { status: res.status, message: err.detail || 'Request failed.' };
        }
        return res.json();
    } catch (e) {
        if (method !== 'GET' && typeof AndroidBridge !== 'undefined') {
            AndroidBridge.queueSync(path, method, JSON.stringify(body));
            return { queued: true, message: 'Backend unreachable. Saved locally.' };
        }
        throw e;
    }
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

    // AI Superpowers
    askEko: (question) => apiRequest('POST', '/api/ai/ask', { question }),
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
