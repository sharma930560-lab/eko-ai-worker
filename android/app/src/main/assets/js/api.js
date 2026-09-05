/**
 * Eko AI Operations — API Client
 * Enhanced for Fintech Ops 2.0
 */

const DEFAULT_API_TIMEOUT_MS = 20000;
const AI_API_TIMEOUT_MS = 45000;

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
    let base = window.EKO_API_BASE || 'https://eko-field-worker-api.onrender.com';

    // Allow explicit developer override via localStorage if configured
    try {
        const devOverride = localStorage.getItem('eko_api_base_override');
        if (devOverride) base = devOverride;
    } catch (e) {}

    const url = `${base}${path}`;
    const timeoutMs = path.includes('/api/ai/') ? AI_API_TIMEOUT_MS : DEFAULT_API_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const opts = { 
        method, 
        headers: getHeaders(),
        signal: controller.signal
    };
    if (body) opts.body = JSON.stringify(body);

    try {
        const res = await fetch(url, opts);
        clearTimeout(timer);
        if (!res.ok) {
            if (res.status === 401 && !path.includes('/api/auth/')) {
                console.warn(`API Error 401 on ${path}: Clearing invalid session and returning to login.`);
                if (typeof clearSession === 'function') clearSession();
                if (typeof showLoginScreen === 'function') showLoginScreen();
            }
            const err = await res.json().catch(() => ({}));
            throw { status: res.status, message: err.detail || err.message || 'Request failed' };
        }
        return await res.json();
    } catch (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') {
            throw { status: 408, message: `Request timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.` };
        }
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
