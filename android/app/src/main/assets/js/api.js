/**
 * Eko AI Operations — API Client
 * Enhanced for Fintech Ops 2.0
 */

const DEFAULT_API_TIMEOUT_MS = 15000;
const AI_API_TIMEOUT_MS = 60000;

function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const savedUser = localStorage.getItem('eko_user');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        if (user.id) headers['X-User-Id'] = user.id;
    }
    return headers;
}

async function apiRequest(method, path, body = null) {
    const base = window.EKO_API_BASE || 'https://eko-field-worker-api.onrender.com';
    const url = `${base}${path}`;
    const opts = { method, headers: getHeaders() };
    if (body) opts.body = JSON.stringify(body);

    try {
        const res = await fetch(url, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw { status: res.status, message: err.message || 'Request failed' };
        }
        return await res.json();
    } catch (e) {
        console.error(`API Error [${method} ${path}]:`, e);
        throw e;
    }
}

const api = {
    // Customers & Timeline
    getCustomers: () => apiRequest('GET', '/api/customers'),
    createCustomer: (data) => apiRequest('POST', '/api/customers', data),
    getCustomerTimeline: (cid) => apiRequest('GET', `/api/customers/${cid}/timeline`),

    // Transactions / Service Activity
    getActivity: () => apiRequest('GET', '/api/activity'),
    createActivity: (data) => apiRequest('POST', '/api/activity', data),

    // Complaints / Grievances
    createComplaint: (data) => apiRequest('POST', '/api/complaints', data),
    getComplaints: () => apiRequest('GET', '/api/complaints'), // Stub if needed

    // Credit Intelligence
    recalculateScore: (cid) => apiRequest('POST', `/api/credit-score/recalculate/${cid}`),
    getCreditHistory: (cid) => apiRequest('GET', `/api/credit-score/history?customer_id=${cid}`),
    simulateScore: (data) => apiRequest('POST', '/api/credit-score/simulate', data),

    // AI
    askEko: (question, history = [], customer_id = null) => apiRequest('POST', '/api/ai/ask', {
        question, history, customer_id
    }),
    getDailyBrief: () => apiRequest('GET', '/api/ai/brief'),

    // Legacy mapping or extended
    getTasks: () => apiRequest('GET', '/api/tasks'),
    createTask: (data) => apiRequest('POST', '/api/tasks', data),
    getNotes: () => apiRequest('GET', '/api/notes'),
    createNote: (data) => apiRequest('POST', '/api/notes', data),
    scanBill: (data) => apiRequest('POST', '/api/ai/scan-bill', data),
    voiceParse: (data) => apiRequest('POST', '/api/ai/voice-parse', data),
    generateMessage: (data) => apiRequest('POST', '/api/ai/generate-message', data),
};
