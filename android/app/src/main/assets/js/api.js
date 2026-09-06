/**
 * Eko AI Operations — API Client
 */

const DEFAULT_API_TIMEOUT_MS = 20000;
const AI_API_TIMEOUT_MS = 45000;

function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const savedUser = localStorage.getItem('eko_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            if (user.id) headers['X-User-Id'] = user.id;
        } catch (e) {}
    }
    return headers;
}

async function apiRequest(method, path, body = null) {
    let base = window.EKO_API_BASE || 'https://eko-field-worker-api.onrender.com';
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
        throw e;
    }
}

const api = {
    // Dashboard
    getDashboard: () => apiRequest('GET', '/api/ops/dashboard'),

    // Customers / Partners
    getCustomers: () => apiRequest('GET', '/api/customers'),
    createCustomer: (data) => apiRequest('POST', '/api/customers', data),
    getCustomerTimeline: (cid) => apiRequest('GET', `/api/customers/${cid}/timeline`),
    getPartners: () => apiRequest('GET', '/api/partners'),
    getPartnerDetail: (pid) => apiRequest('GET', `/api/partners/${pid}`),

    // Transactions / Service Activity
    getActivity: () => apiRequest('GET', '/api/activity'),
    getActivityDetail: (aid) => apiRequest('GET', `/api/activity/${aid}`),
    getTransaction: (aid) => apiRequest('GET', `/api/activity/${aid}`),
    createActivity: (data) => apiRequest('POST', '/api/activity', data),

    // Service Flows (Sandbox)
    initDMT: (data) => apiRequest('POST', '/api/services/dmt', data),
    initAePS: (data) => apiRequest('POST', '/api/services/aeps', data),
    initBBPS: (data) => apiRequest('POST', '/api/services/bbps', data),
    initRecharge: (data) => apiRequest('POST', '/api/services/recharge', data),

    // Complaints
    getComplaints: () => apiRequest('GET', '/api/complaints'),
    getComplaintDetail: (id) => apiRequest('GET', `/api/complaints/${id}`),
    createComplaint: (data) => apiRequest('POST', '/api/complaints', data),
    updateComplaint: (id, data) => apiRequest('PATCH', `/api/complaints/${id}`, data),
    addComplaintNote: (id, data) => apiRequest('POST', `/api/complaints/${id}/notes`, data),

    // WhatsApp Outreach & Studio
    getWhatsAppOutreach: (status = null) => apiRequest('GET', `/api/whatsapp/outreach${status ? `?status=${status}` : ''}`),
    createWhatsAppOutreach: (data) => apiRequest('POST', '/api/whatsapp/outreach', data),
    updateWhatsAppOutreach: (id, data) => apiRequest('PATCH', `/api/whatsapp/outreach/${id}`, data),
    generateWhatsAppMessage: (data) => apiRequest('POST', '/api/whatsapp/generate', data),

    // Banner & Poster Studio
    getPosters: () => apiRequest('GET', '/api/posters'),
    getPosterDetail: (pid) => apiRequest('GET', `/api/posters/${pid}`),
    createPoster: (data) => apiRequest('POST', '/api/posters', data),
    updatePoster: (pid, data) => apiRequest('PUT', `/api/posters/${pid}`, data),
    generatePosterCopy: (data) => apiRequest('POST', '/api/posters/generate-copy', data),

    // Notifications
    getNotifications: () => apiRequest('GET', '/api/notifications'),
    markNotificationRead: (id) => apiRequest('POST', `/api/notifications/mark-read/${id}`),

    // Search
    search: (q) => apiRequest('GET', `/api/search?q=${encodeURIComponent(q)}`),

    // Credit Intelligence
    recalculateScore: (cid) => apiRequest('POST', `/api/credit-score/recalculate/${cid}`),
    getCreditHistory: (cid) => apiRequest('GET', `/api/credit-score/history?customer_id=${cid}`),
    simulateScore: (data) => apiRequest('POST', '/api/credit-score/simulate', data),
    analyzeCreditScore: (data) => apiRequest('POST', '/api/credit-score/analyze', data),

    // AI
    askEko: (question, history = [], customer_id = null, transaction_id = null, complaint_id = null, page_context = null) => {
        if (typeof question === 'object' && question !== null) {
            return apiRequest('POST', '/api/ai/ask', question);
        }
        return apiRequest('POST', '/api/ai/ask', { question, history, customer_id, transaction_id, complaint_id, page_context });
    },
    askAi: (question, history = [], customer_id = null, transaction_id = null, complaint_id = null, page_context = null) => {
        if (typeof question === 'object' && question !== null) {
            return apiRequest('POST', '/api/ai/ask', question);
        }
        return apiRequest('POST', '/api/ai/ask', { question, history, customer_id, transaction_id, complaint_id, page_context });
    },
    getDailyBrief: () => apiRequest('GET', '/api/ai/brief'),

    // Tasks & Notes
    getTasks: () => apiRequest('GET', '/api/tasks'),
    createTask: (data) => apiRequest('POST', '/api/tasks', data),
    updateTask: (id, data) => apiRequest('PATCH', `/api/tasks/${id}`, data),
    getNotes: () => apiRequest('GET', '/api/notes'),
    createNote: (data) => apiRequest('POST', '/api/notes', data),
    deleteNote: (id) => apiRequest('DELETE', `/api/notes/${id}`),

    // AI Tools
    scanBill: (data) => apiRequest('POST', '/api/ai/scan-bill', data),
    voiceParse: (data) => apiRequest('POST', '/api/ai/voice-parse', data),
    generateMessage: (data) => apiRequest('POST', '/api/ai/generate-message', data),
};
