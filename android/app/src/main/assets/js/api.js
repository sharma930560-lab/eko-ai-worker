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
            // Normalize FastAPI validation errors (422): detail is an array of {loc, msg, type}
            let errMsg = err.message || 'Request failed';
            if (err.detail) {
                if (typeof err.detail === 'string') {
                    errMsg = err.detail;
                } else if (Array.isArray(err.detail)) {
                    // Extract field + message from each validation error
                    errMsg = err.detail.map(e => {
                        const field = Array.isArray(e.loc) ? e.loc.filter(l => l !== 'body').join('.') : '';
                        return field ? `${field}: ${e.msg}` : (e.msg || 'Validation error');
                    }).join('; ');
                } else if (typeof err.detail === 'object') {
                    errMsg = JSON.stringify(err.detail);
                }
            }
            throw { status: res.status, message: errMsg };
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
    getCustomers: (search = null) => apiRequest('GET', `/api/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    createCustomer: (data) => apiRequest('POST', '/api/customers', data),
    getCustomerTimeline: (cid) => apiRequest('GET', `/api/customers/${cid}/timeline`),
    getPartners: (category = null, search = null) => {
        const q = new URLSearchParams();
        if (category && category !== 'All') q.append('category', category);
        if (search) q.append('search', search);
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiRequest('GET', `/api/partners${qs}`);
    },
    getPartnerDetail: (pid) => apiRequest('GET', `/api/partners/${pid}`),

    // Transactions / Service Activity
    getActivity: (filters = {}) => {
        const q = new URLSearchParams();
        if (filters.status && filters.status !== 'all') q.append('status', filters.status);
        if (filters.service) q.append('service', filters.service);
        if (filters.partner_id) q.append('partner_id', filters.partner_id);
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiRequest('GET', `/api/activity${qs}`);
    },
    getActivityDetail: (aid) => apiRequest('GET', `/api/activity/${aid}`),
    getTransaction: (aid) => apiRequest('GET', `/api/activity/${aid}`),
    createActivity: (data) => apiRequest('POST', '/api/activity', data),

    // Earnings & Commission Engine
    getCommissions: (params = {}) => {
        const q = new URLSearchParams();
        if (params.status && params.status !== 'all') q.append('status', params.status);
        if (params.service && params.service !== 'all') q.append('service', params.service);
        if (params.date_range && params.date_range !== 'all') q.append('date_range', params.date_range);
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiRequest('GET', `/api/commissions${qs}`);
    },
    getCommissionDetail: (cid) => apiRequest('GET', `/api/commissions/${cid}`),
    getEarningsSummary: () => apiRequest('GET', '/api/earnings/summary'),
    getSettlements: () => apiRequest('GET', '/api/settlements'),

    // Data Upload / CSV & XLSX Import
    validateUpload: (data) => apiRequest('POST', '/api/upload/validate', data),
    importUpload: (data) => apiRequest('POST', '/api/upload/import', data),

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
    triageComplaint: (data) => apiRequest('POST', '/api/complaints/triage', data),

    // WhatsApp Outreach & Studio
    getWhatsAppOutreach: (status = null) => apiRequest('GET', `/api/whatsapp/outreach${status && status !== 'all' ? `?status=${status}` : ''}`),
    createWhatsAppOutreach: (data) => apiRequest('POST', '/api/whatsapp/outreach', data),
    updateWhatsAppOutreach: (id, data) => apiRequest('PATCH', `/api/whatsapp/outreach/${id}`, data),
    generateWhatsAppMessage: (data) => apiRequest('POST', '/api/whatsapp/generate', data),

    // Banner & Poster Studio
    getPosters: () => apiRequest('GET', '/api/posters'),
    getPosterDetail: (pid) => apiRequest('GET', `/api/posters/${pid}`),
    createPoster: (data) => apiRequest('POST', '/api/posters', data),
    updatePoster: (pid, data) => apiRequest('PUT', `/api/posters/${pid}`, data),
    deletePoster: (id) => apiRequest('DELETE', `/api/posters/${id}`),
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

function formatErrorMessage(err, fallback = 'Unable to complete request. Please try again.') {
    if (!err) return fallback;
    if (typeof err === 'string') {
        return (err === '[object Object]') ? fallback : err;
    }
    if (err.message) {
        if (typeof err.message === 'string') {
            return (err.message === '[object Object]') ? fallback : err.message;
        }
        if (typeof err.message === 'object') {
            try { return JSON.stringify(err.message); } catch (_) { return fallback; }
        }
    }
    if (err.detail) {
        if (typeof err.detail === 'string') return err.detail;
        if (Array.isArray(err.detail)) {
            return err.detail.map(d => (d && d.msg) ? (d.loc ? `${d.loc.slice(-1)}: ${d.msg}` : d.msg) : JSON.stringify(d)).join('; ');
        }
        if (typeof err.detail === 'object') {
            try { return JSON.stringify(err.detail); } catch (_) { return fallback; }
        }
    }
    if (err.statusText && typeof err.statusText === 'string') return err.statusText;
    try {
        const str = String(err);
        return (str === '[object Object]') ? fallback : str;
    } catch (_) {
        return fallback;
    }
}
window.formatErrorMessage = formatErrorMessage;

