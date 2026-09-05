/**
 * Eko Partner Operations — App Core
 * Connected Platform: One Source of Truth
 */

let appLanguage = 'en';
let currentScreen = 'home';
let _lastSyncTime = null;
let _notificationCache = [];

// ── Utility Functions ──────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function today() { return new Date().toISOString().slice(0, 10); }

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
        ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return formatDate(dateStr);
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
}

function showToast(message, type = 'success') {
    if (typeof AndroidBridge !== 'undefined') {
        try { AndroidBridge.showToast(message); } catch(e) {}
        return;
    }
    let toast = document.getElementById('global-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'global-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function initializeIcons() {
    if (window.lucide) lucide.createIcons();
}

function renderIcon(name, size = 20, extraClass = '') {
    return `<i data-lucide="${name}" class="${extraClass}" style="width:${size}px; height:${size}px;"></i>`;
}

function serviceName(raw) {
    const s = (raw || '').toLowerCase();
    if (s.startsWith('dmt')) return 'Send Money';
    if (s.startsWith('aeps-cash')) return 'Cash Withdrawal';
    if (s.startsWith('aeps-balance')) return 'Balance Check';
    if (s.startsWith('aeps-mini')) return 'Mini Statement';
    if (s.startsWith('aeps')) return 'Aadhaar Banking';
    if (s.startsWith('bbps-electricity')) return 'Electricity Bill';
    if (s.startsWith('bbps-water')) return 'Water Bill';
    if (s.startsWith('bbps-gas')) return 'Gas Bill';
    if (s.startsWith('bbps')) return 'Bill Payment';
    if (s.startsWith('recharge')) return 'Mobile Recharge';
    return raw || 'Service';
}

// ── Sync Indicator ─────────────────────────────────────────────────────────────
function updateSyncIndicator(state) {
    const badge = document.getElementById('global-sync-badge');
    const text = document.getElementById('sync-text');
    if (!badge || !text) return;
    if (state === 'syncing') {
        badge.className = 'sync-indicator syncing';
        text.textContent = 'Syncing…';
    } else if (state === 'online') {
        _lastSyncTime = new Date();
        badge.className = 'sync-indicator online';
        text.textContent = 'Synced';
    } else if (state === 'offline') {
        badge.className = 'sync-indicator offline';
        text.textContent = 'Offline';
    } else if (state === 'stale' && _lastSyncTime) {
        badge.className = 'sync-indicator offline';
        text.textContent = `Cached ${formatTimeAgo(_lastSyncTime)}`;
    }
}

// ── Notification Bell ─────────────────────────────────────────────────────────
async function loadNotifications() {
    try {
        _notificationCache = await api.getNotifications();
        updateNotifBadge(_notificationCache.length);
    } catch (e) { /* silent */ }
}

function updateNotifBadge(count) {
    const badge = document.getElementById('notif-badge-count');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function openNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    renderNotificationPanel();
}

function renderNotificationPanel() {
    const body = document.getElementById('notification-panel-body');
    if (!body) return;
    if (!_notificationCache || _notificationCache.length === 0) {
        body.innerHTML = `<div class="text-sm text-muted text-center p-4">No new notifications.</div>`;
        return;
    }
    body.innerHTML = _notificationCache.map(n => `
        <div class="notif-item ${n.priority === 'high' ? 'notif-urgent' : ''}" onclick="handleNotifClick('${n.id}', '${n.deep_link || ''}')">
            <div class="notif-title">${escapeHtml(n.title)}</div>
            <div class="notif-msg">${escapeHtml(n.message)}</div>
            <div class="notif-time">${formatTimeAgo(n.created_at)}</div>
        </div>
    `).join('');
}

async function handleNotifClick(id, deepLink) {
    try { await api.markNotificationRead(id); } catch(e) {}
    _notificationCache = _notificationCache.filter(n => n.id !== id);
    updateNotifBadge(_notificationCache.length);
    document.getElementById('notification-panel')?.classList.add('hidden');
    if (deepLink) {
        const parts = deepLink.split('/').filter(Boolean);
        const entityType = parts[0];
        const entityId = parts[1];
        if (entityType === 'transactions') {
            navigateTo('activity');
            if (entityId) setTimeout(() => { if (typeof showActivityDetail === 'function') showActivityDetail(entityId); }, 350);
        } else if (entityType === 'complaints') {
            navigateTo('grievances');
            if (entityId) setTimeout(() => { if (typeof showComplaintDetail === 'function') showComplaintDetail(entityId); }, 350);
        } else if (entityType === 'partners') {
            navigateTo('partners');
            if (entityId) setTimeout(() => { if (typeof openPartnerProfile === 'function') openPartnerProfile(entityId); }, 350);
        }
    }
}

// ── Global Search ─────────────────────────────────────────────────────────────
let _searchDebounceTimer = null;

function openGlobalSearchModal() {
    const modal = document.getElementById('global-search-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const input = document.getElementById('global-search-input');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 50);
    }
    const results = document.getElementById('global-search-results');
    if (results) {
        results.innerHTML = '<p class="text-sm text-muted text-center py-4">Type 2 or more characters to search across all operational records.</p>';
    }
}

function handleGlobalSearchInput(query) {
    if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
    const q = (query || '').trim();
    const resultsEl = document.getElementById('global-search-results');
    if (!resultsEl) return;

    if (q.length < 2) {
        resultsEl.innerHTML = '<p class="text-sm text-muted text-center py-4">Type 2 or more characters to search across all operational records.</p>';
        return;
    }

    resultsEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Searching operational records...</p></div>';

    _searchDebounceTimer = setTimeout(async () => {
        try {
            const res = await api.search(q);
            renderGlobalSearchResults(res, q);
        } catch (err) {
            resultsEl.innerHTML = `<p class="text-sm text-danger text-center py-4">Search failed: ${escapeHtml(err.message || 'Error')}</p>`;
        }
    }, 250);
}

function renderGlobalSearchResults(res, query) {
    const resultsEl = document.getElementById('global-search-results');
    if (!resultsEl) return;

    const partners = res.partners || [];
    const transactions = res.transactions || [];
    const complaints = res.complaints || [];

    const total = partners.length + transactions.length + complaints.length;
    if (total === 0) {
        resultsEl.innerHTML = `<p class="text-sm text-muted text-center py-4">No matching records found for "${escapeHtml(query)}".</p>`;
        return;
    }

    let html = '';

    if (partners.length > 0) {
        html += `<div class="text-xs font-bold text-muted uppercase tracking-wider mb-2 mt-2">Partners (${partners.length})</div>`;
        html += partners.map(p => `
            <div class="card mb-2" style="padding:10px 14px; cursor:pointer;" onclick="closeModal('global-search-modal'); if (typeof openPartnerProfile === 'function') openPartnerProfile('${p.id}');">
                <div class="font-semibold text-sm">${escapeHtml(p.name)}</div>
                <div class="text-xs text-muted">${p.phone || 'No phone'} · ${p.category || 'retailer'} · KYC: ${p.kyc_status}</div>
            </div>
        `).join('');
    }

    if (transactions.length > 0) {
        html += `<div class="text-xs font-bold text-muted uppercase tracking-wider mb-2 mt-3">Transactions (${transactions.length})</div>`;
        html += transactions.map(t => `
            <div class="card mb-2" style="padding:10px 14px; cursor:pointer;" onclick="closeModal('global-search-modal'); if (typeof showActivityDetail === 'function') { showActivityDetail('${t.id}'); } else { navigateTo('activity'); }">
                <div style="display:flex; justify-content:space-between;">
                    <span class="font-semibold text-sm">${escapeHtml(serviceName(t.service_name))}</span>
                    <span class="font-bold text-sm">₹${(t.amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div class="text-xs text-muted mt-1">${t.customer_name || 'Anonymous'} · Status: <span class="badge ${t.status === 'success' ? 'badge-success' : t.status === 'failed' ? 'badge-danger' : 'badge-warning'}">${t.status}</span></div>
            </div>
        `).join('');
    }

    if (complaints.length > 0) {
        html += `<div class="text-xs font-bold text-muted uppercase tracking-wider mb-2 mt-3">Complaints (${complaints.length})</div>`;
        html += complaints.map(c => `
            <div class="card mb-2" style="padding:10px 14px; cursor:pointer;" onclick="closeModal('global-search-modal'); if (typeof showComplaintDetail === 'function') { showComplaintDetail('${c.id}'); } else { navigateTo('grievances'); }">
                <div class="font-semibold text-sm">${escapeHtml(c.subject)}</div>
                <div class="text-xs text-muted mt-1">Priority: ${c.priority} · Status: <span class="badge ${c.status === 'open' ? 'badge-danger' : 'badge-neutral'}">${c.status}</span></div>
            </div>
        `).join('');
    }

    resultsEl.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

// ── Screen Router ──────────────────────────────────────────────────────────────
const SCREENS = {
    home:       { title: 'Operations Dashboard', subtitle: 'Live service health and summary.', render: renderHomeScreen, load: loadHomeScreen },
    partners:   { title: 'Partner Network', subtitle: 'Manage retailers & agents.', render: renderPartnersScreen, load: loadPartners },
    customers:  { title: 'Partner Network', subtitle: 'Manage retailers & agents.', render: renderPartnersScreen, load: loadPartners },
    activity:   { title: 'Transaction Center', subtitle: 'Real-time monitoring.', render: renderActivityScreen, load: loadActivity },
    grievances: { title: 'Complaints', subtitle: 'Track SLA & resolutions.', render: renderGrievancesScreen, load: loadGrievances },
    'ai-tools': { title: 'AI Operational Suite', subtitle: 'Productivity superpowers.', render: renderAiToolsScreen, load: () => { switchAiToolTab('scanner'); } },
    'ask-eko':  { title: 'Ask Eko AI', subtitle: 'Grounded operational partner.', render: renderAskEkoScreen, load: loadAskEko },
};

function navigateTo(screen) {
    if (!currentUser) { showLoginScreen(); return; }
    currentScreen = screen;
    const content = document.getElementById('main-content');
    if (!content) return;

    document.querySelectorAll('.nav-item').forEach(n => {
        const tab = n.dataset.tab;
        n.classList.toggle('active', tab === screen || (tab === 'partners' && screen === 'customers'));
    });

    const def = SCREENS[screen];
    if (!def) return;

    const titleEl = document.getElementById('page-header-title');
    const subEl = document.getElementById('page-header-subtitle');
    if (titleEl) titleEl.textContent = def.title;
    if (subEl) subEl.textContent = def.subtitle;

    content.innerHTML = def.render();
    def.load();
    if (window.lucide) lucide.createIcons();
}

// ── Service Flow Launcher ─────────────────────────────────────────────────────
function openServiceFlow(service) {
    const el = document.getElementById('service-flow-modal');
    const body = document.getElementById('service-flow-body');
    const title = document.getElementById('service-flow-title');
    if (!el || !body) return;

    const sandboxBanner = `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; margin-bottom:14px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.22); border-radius:8px; font-size:0.75rem; color:var(--text-secondary);">
            ${renderIcon('flask-conical', 16, 'text-primary')}
            <div><strong>Sandbox Environment:</strong> Simulated financial operation for testing and demo. No real banking accounts debited.</div>
        </div>
    `;

    const flows = {
        dmt: {
            label: 'Send Money (DMT) · Sandbox Flow',
            html: `
            ${sandboxBanner}
            <form id="dmt-form" onsubmit="submitDMT(event)">
                <div class="form-group"><label>Customer / Sender Name</label>
                    <input class="form-input" name="customer_name" placeholder="Sender's name" required></div>
                <div class="form-group"><label>Receiver Name</label>
                    <input class="form-input" name="receiver_name" placeholder="Full name (or 'FAIL' to test bank failure)" required></div>
                <div class="form-group"><label>Account Number</label>
                    <input class="form-input" name="receiver_account" placeholder="Bank account number" required></div>
                <div class="form-group"><label>IFSC Code</label>
                    <input class="form-input" name="receiver_ifsc" placeholder="e.g. SBIN0001234" required></div>
                <div class="form-group"><label>Amount (₹)</label>
                    <input class="form-input" name="amount" type="number" min="100" max="25000" placeholder="Min ₹100 (99999 to test failure)" required></div>
                <button class="btn-primary" type="submit" style="width:100%; margin-top:8px;">${renderIcon('send',16)} Simulate Money Transfer</button>
            </form>`
        },
        aeps: {
            label: 'Aadhaar Banking (AePS) · Sandbox Flow',
            html: `
            ${sandboxBanner}
            <form id="aeps-form" onsubmit="submitAePS(event)">
                <div class="form-group"><label>Customer Name</label>
                    <input class="form-input" name="customer_name" placeholder="Customer's name" required></div>
                <div class="form-group"><label>Aadhaar Last 4 Digits</label>
                    <input class="form-input" name="aadhaar_last4" maxlength="4" placeholder="XXXX ('0000' to test failure)" required></div>
                <div class="form-group"><label>Operation Type</label>
                    <select class="form-input" name="service_type" onchange="toggleAePSAmount(this.value)">
                        <option value="withdrawal">Cash Withdrawal</option>
                        <option value="balance">Balance Check</option>
                        <option value="mini_statement">Mini Statement</option>
                    </select></div>
                <div class="form-group" id="aeps-amount-row"><label>Amount (₹)</label>
                    <input class="form-input" name="amount" type="number" min="100" max="10000" placeholder="Amount" required></div>
                <button class="btn-primary" type="submit" style="width:100%; margin-top:8px;">${renderIcon('fingerprint',16)} Simulate AePS Operation</button>
            </form>`
        },
        bbps: {
            label: 'Pay Bills (BBPS) · Sandbox Flow',
            html: `
            ${sandboxBanner}
            <form id="bbps-form" onsubmit="submitBBPS(event)">
                <div class="form-group"><label>Customer Name</label>
                    <input class="form-input" name="customer_name" placeholder="Customer's name" required></div>
                <div class="form-group"><label>Bill Category</label>
                    <select class="form-input" name="category">
                        <option value="electricity">Electricity</option>
                        <option value="water">Water</option>
                        <option value="gas">Gas</option>
                        <option value="broadband">Broadband</option>
                        <option value="insurance">Insurance</option>
                        <option value="education">Education</option>
                    </select></div>
                <div class="form-group"><label>Provider / Biller</label>
                    <input class="form-input" name="provider" placeholder="e.g. BSES Rajdhani" required></div>
                <div class="form-group"><label>Consumer Number</label>
                    <input class="form-input" name="consumer_number" placeholder="Account/CA ('000000' to test failure)" required></div>
                <div class="form-group"><label>Amount (₹)</label>
                    <input class="form-input" name="amount" type="number" min="1" placeholder="Bill amount" required></div>
                <button class="btn-primary" type="submit" style="width:100%; margin-top:8px;">${renderIcon('receipt',16)} Simulate Bill Payment</button>
            </form>`
        },
        recharge: {
            label: 'Mobile Recharge · Sandbox Flow',
            html: `
            ${sandboxBanner}
            <form id="recharge-form" onsubmit="submitRecharge(event)">
                <div class="form-group"><label>Customer Name</label>
                    <input class="form-input" name="customer_name" placeholder="Customer's name" required></div>
                <div class="form-group"><label>Mobile Number</label>
                    <input class="form-input" name="mobile_number" type="tel" maxlength="10" placeholder="10-digit number" required></div>
                <div class="form-group"><label>Telecom Operator</label>
                    <select class="form-input" name="operator">
                        <option value="Jio">Jio</option>
                        <option value="Airtel">Airtel</option>
                        <option value="Vi">Vi (Vodafone Idea)</option>
                        <option value="BSNL">BSNL</option>
                    </select></div>
                <div class="form-group"><label>Plan Amount (₹)</label>
                    <input class="form-input" name="plan_amount" type="number" min="10" placeholder="e.g. 299" required></div>
                <button class="btn-primary" type="submit" style="width:100%; margin-top:8px;">${renderIcon('smartphone',16)} Simulate Recharge</button>
            </form>`
        }
    };

    const flow = flows[service];
    if (!flow) return;
    if (title) title.textContent = flow.label;
    body.innerHTML = flow.html;
    el.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function toggleAePSAmount(val) {
    const row = document.getElementById('aeps-amount-row');
    if (row) row.style.display = (val === 'balance' || val === 'mini_statement') ? 'none' : '';
}

async function submitDMT(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Processing…';
    try {
        const res = await api.initDMT({
            customer_name: f.get('customer_name'),
            receiver_name: f.get('receiver_name'),
            receiver_account: f.get('receiver_account'),
            receiver_ifsc: f.get('receiver_ifsc'),
            amount: parseFloat(f.get('amount'))
        });
        showServiceResult(res, 'Send Money');
    } catch(err) {
        showToast('Transaction failed: ' + (err.message || 'Unknown error'), 'error');
        btn.disabled = false; btn.textContent = 'Send Money';
    }
}

async function submitAePS(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Processing…';
    try {
        const res = await api.initAePS({
            customer_name: f.get('customer_name'),
            aadhaar_last4: f.get('aadhaar_last4'),
            service_type: f.get('service_type'),
            amount: parseFloat(f.get('amount') || 0)
        });
        showServiceResult(res, 'AePS');
    } catch(err) {
        showToast('AePS failed: ' + (err.message || 'Unknown error'), 'error');
        btn.disabled = false; btn.textContent = 'Process';
    }
}

async function submitBBPS(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Processing…';
    try {
        const res = await api.initBBPS({
            customer_name: f.get('customer_name'),
            category: f.get('category'),
            provider: f.get('provider'),
            consumer_number: f.get('consumer_number'),
            amount: parseFloat(f.get('amount'))
        });
        showServiceResult(res, 'Bill Payment');
    } catch(err) {
        showToast('Bill payment failed: ' + (err.message || 'Unknown error'), 'error');
        btn.disabled = false; btn.textContent = 'Pay Bill';
    }
}

async function submitRecharge(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Processing…';
    try {
        const res = await api.initRecharge({
            customer_name: f.get('customer_name'),
            mobile_number: f.get('mobile_number'),
            operator: f.get('operator'),
            plan_amount: parseFloat(f.get('plan_amount'))
        });
        showServiceResult(res, 'Recharge');
    } catch(err) {
        showToast('Recharge failed: ' + (err.message || 'Unknown error'), 'error');
        btn.disabled = false; btn.textContent = 'Recharge';
    }
}

function showServiceResult(res, label) {
    const body = document.getElementById('service-flow-body');
    if (!body) return;
    const isSuccess = res.status === 'success';
    body.innerHTML = `
        <div style="text-align:center; padding:20px 0;">
            <div style="width:60px; height:60px; border-radius:50%; margin:0 auto 14px;
                background:${isSuccess ? 'var(--success-bg)' : 'var(--danger-bg)'};
                display:flex; align-items:center; justify-content:center;">
                ${renderIcon(isSuccess ? 'check-circle' : 'x-circle', 28, isSuccess ? 'text-success' : 'text-danger')}
            </div>
            <div style="font-size:1.35rem; font-weight:800; color:${isSuccess ? 'var(--success)' : 'var(--danger)'};">
                ${isSuccess ? 'Sandbox Simulation: Completed' : 'Simulation: Payout Failed'}
            </div>
            <div class="text-sm text-muted mt-2">${label} · ₹${(res.amount || 0).toLocaleString('en-IN')}</div>
            <div style="margin:8px auto; display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:999px; background:rgba(59,130,246,0.1); color:#1d4ed8; font-size:11px; font-weight:600;">
                ${renderIcon('flask-conical', 12)} Sandbox Flow · Demo Simulation
            </div>
            ${res.reference_id ? `<div class="text-xs text-muted mt-1" style="font-family:monospace">Ref: ${res.reference_id}</div>` : ''}
            ${!isSuccess && res.failure_reason ? `
                <div style="margin-top:14px; padding:12px; background:var(--danger-bg); border-radius:var(--radius-md); text-align:left;">
                    <div class="text-xs font-bold text-danger mb-1">Failure Root Cause</div>
                    <div class="text-xs text-danger">${escapeHtml(res.failure_reason)}</div>
                    <div class="text-xs text-muted mt-2">Simulation test: To test resolution, create an operational complaint below.</div>
                </div>
                <button class="btn-secondary mt-3" onclick="closeModal('service-flow-modal'); navigateTo('grievances');">
                    ${renderIcon('message-square-warning', 14)} File Operational Complaint
                </button>
            ` : ''}
            ${isSuccess && res.commission ? `<div class="text-xs text-success mt-2">Partner Commission Credited: ₹${res.commission.toFixed(2)}</div>` : ''}
        </div>
        <button class="btn-ghost" style="width:100%;" onclick="closeModal('service-flow-modal'); navigateTo('activity');">
            ${renderIcon('arrow-left-right', 14)} View in Transaction Center
        </button>
    `;
    if (window.lucide) lucide.createIcons();
    // Refresh home counts in background
    if (currentScreen === 'home') loadHomeScreen();
}

// ── Home Dashboard Renderer ───────────────────────────────────────────────────
function renderHomeScreen() {
    const name = currentUser?.name?.split(' ')[0] || 'Partner';
    return `
    <div class="dashboard-grid container-responsive">
        <div class="welcome-hero">
            <div class="welcome-text">
                <h1 style="color:#FFFFFF; font-size:1.4rem; margin-bottom:4px;">${getGreeting()}, ${escapeHtml(name)} 👋</h1>
                <p style="color:rgba(255,255,255,0.9); font-size:0.9rem;">Eko Partner Operations — powered up.</p>
            </div>
            <div style="background:rgba(255,255,255,0.18); padding:12px; border-radius:12px; flex-shrink:0; cursor:pointer;" onclick="navigateTo('ask-eko')">
                ${renderIcon('sparkles', 24)}
            </div>
        </div>

        <div class="metrics-grid">
            <div class="card stat-card" onclick="navigateTo('activity')" style="cursor:pointer;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="metric-icon-wrap" style="background:var(--primary-subtle); color:var(--primary);">${renderIcon('activity', 20)}</div>
                    <span class="badge badge-success" style="font-size:0.6rem;">Today</span>
                </div>
                <div class="text-xs text-muted font-semibold mt-3">Transactions</div>
                <div class="stat-value" id="stat-today-txn">--</div>
            </div>

            <div class="card stat-card" onclick="navigateTo('activity')" style="cursor:pointer;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="metric-icon-wrap" style="background:var(--success-bg); color:var(--success);">${renderIcon('wallet', 20)}</div>
                </div>
                <div class="text-xs text-muted font-semibold mt-3">Success Rate</div>
                <div class="stat-value" id="stat-success-rate">--</div>
            </div>

            <div class="card stat-card" onclick="navigateTo('activity')" style="cursor:pointer;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="metric-icon-wrap" style="background:var(--danger-bg); color:var(--danger);">${renderIcon('alert-triangle', 20)}</div>
                </div>
                <div class="text-xs text-muted font-semibold mt-3">Failed Today</div>
                <div class="stat-value" id="stat-failed">--</div>
            </div>

            <div class="card stat-card" onclick="navigateTo('grievances')" style="cursor:pointer;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="metric-icon-wrap" style="background:var(--danger-bg); color:var(--danger);">${renderIcon('message-square-warning', 20)}</div>
                </div>
                <div class="text-xs text-muted font-semibold mt-3">Open Complaints</div>
                <div class="stat-value" id="stat-complaints">--</div>
            </div>
        </div>

        <div id="home-needs-attention"></div>

        <div class="section-header">
            <h2 class="section-title">Eko Service Hub</h2>
        </div>
        <div class="grid-cols-4" style="gap:12px;">
            <div class="card" style="padding:14px; text-align:center; cursor:pointer;" onclick="openServiceFlow('dmt')">
                <div style="color:var(--primary); margin-bottom:8px;">${renderIcon('send', 22)}</div>
                <div class="font-bold text-xs">Send Money</div>
            </div>
            <div class="card" style="padding:14px; text-align:center; cursor:pointer;" onclick="openServiceFlow('aeps')">
                <div style="color:var(--accent-dark); margin-bottom:8px;">${renderIcon('fingerprint', 22)}</div>
                <div class="font-bold text-xs">AePS</div>
            </div>
            <div class="card" style="padding:14px; text-align:center; cursor:pointer;" onclick="openServiceFlow('bbps')">
                <div style="color:var(--success); margin-bottom:8px;">${renderIcon('receipt', 22)}</div>
                <div class="font-bold text-xs">Pay Bills</div>
            </div>
            <div class="card" style="padding:14px; text-align:center; cursor:pointer;" onclick="openServiceFlow('recharge')">
                <div style="color:var(--warning); margin-bottom:8px;">${renderIcon('smartphone', 22)}</div>
                <div class="font-bold text-xs">Recharge</div>
            </div>
        </div>

        <div id="home-eko-brief">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>

        <div class="section-header">
            <h2 class="section-title">Priority Tasks</h2>
            <button class="btn-ghost" style="padding:4px 10px; font-size:0.8rem;" onclick="navigateTo('ask-eko')">AI Help</button>
        </div>
        <div id="home-tasks-list" class="item-list"></div>
    </div>`;
}

async function loadHomeScreen() {
    updateSyncIndicator('syncing');
    try {
        const stats = await api.getDashboard();
        if (document.getElementById('stat-today-txn'))
            document.getElementById('stat-today-txn').textContent = stats.today_transactions || 0;
        if (document.getElementById('stat-success-rate'))
            document.getElementById('stat-success-rate').textContent = stats.success_rate || '0%';
        if (document.getElementById('stat-failed'))
            document.getElementById('stat-failed').textContent = stats.failed_alerts || 0;
        if (document.getElementById('stat-complaints'))
            document.getElementById('stat-complaints').textContent = stats.open_complaints || 0;

        // Needs Attention
        const attnEl = document.getElementById('home-needs-attention');
        const items = [];
        if (stats.sla_at_risk > 0) items.push(`${renderIcon('clock',14)} ${stats.sla_at_risk} complaint${stats.sla_at_risk>1?'s':''} approaching SLA deadline`);
        if (stats.failed_alerts > 0) items.push(`${renderIcon('alert-triangle',14)} ${stats.failed_alerts} failed transaction${stats.failed_alerts>1?'s':''} need attention`);
        if (stats.pending_operations > 0) items.push(`${renderIcon('loader',14)} ${stats.pending_operations} transaction${stats.pending_operations>1?'s':''} still processing`);
        if (attnEl && items.length > 0) {
            attnEl.innerHTML = `
                <div class="card" style="border-left:4px solid var(--danger); background:var(--danger-bg); margin-bottom:4px;">
                    <div class="font-bold" style="display:flex; align-items:center; gap:8px; color:var(--danger); font-size:0.85rem; margin-bottom:8px;">
                        ${renderIcon('bell-ring',14)} Needs Attention
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${items.map(i => `<div class="text-sm" style="display:flex; align-items:center; gap:6px; color:var(--danger-dark)">${i}</div>`).join('')}
                    </div>
                </div>`;
        } else if (attnEl) {
            attnEl.innerHTML = '';
        }

        updateSyncIndicator('online');
    } catch (e) {
        updateSyncIndicator('stale');
    }

    // Daily brief
    const briefEl = document.getElementById('home-eko-brief');
    if (briefEl) {
        try {
            const brief = await api.getDailyBrief();
            const items = brief.summary_items || [];
            briefEl.innerHTML = `
                <div class="card" style="border-left:4px solid var(--primary); background:linear-gradient(to right, var(--primary-light, #FFF7ED), #FFF);">
                    <div class="font-bold text-primary mb-2" style="display:flex; align-items:center; gap:8px;">
                        ${renderIcon('sun', 16)} Today's Operational Brief
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        ${items.length > 0
                            ? items.map(i => `<div class="text-sm line-height-relaxed">${escapeHtml(i)}</div>`).join('')
                            : `<div class="text-sm text-muted">${escapeHtml(brief.brief_markdown || 'All operations running smoothly.')}</div>`
                        }
                    </div>
                    ${brief.next_step ? `
                        <div style="margin-top:10px; padding:8px 10px; background:rgba(249,115,22,0.08); border-radius:8px; font-size:0.8rem; color:var(--primary); font-weight:500;">
                            ${renderIcon('arrow-right',12)} ${escapeHtml(brief.next_step)}
                        </div>` : ''}
                </div>`;
        } catch (e) {
            briefEl.innerHTML = '';
        }
    }

    // Tasks
    try {
        const tasks = await api.getTasks();
        const list = document.getElementById('home-tasks-list');
        if (list) {
            const pending = tasks.filter(t => !t.completed).slice(0, 3);
            if (pending.length === 0) {
                list.innerHTML = `<div class="text-sm text-muted text-center p-4">No pending tasks. Great work!</div>`;
            } else {
                list.innerHTML = pending.map(t => `
                    <div class="card-item" style="padding:12px 16px; margin-bottom:8px;">
                        <span class="text-sm font-semibold">${escapeHtml(t.title)}</span>
                        <span class="badge ${t.priority === 'high' ? 'badge-danger' : 'badge-warning'}" style="font-size:0.6rem;">${t.priority}</span>
                    </div>
                `).join('');
            }
        }
    } catch (e) { /* silent */ }

    // Load notifications in background
    loadNotifications();
    if (window.lucide) lucide.createIcons();
}

function formatAiResponse(text) {
    if (!text) return '';
    return escapeHtml(text)
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function openAppGuide() {
    const modal = document.getElementById('app-guide-modal');
    const body = document.getElementById('guide-modal-content');
    if (!modal || !body) return;
    body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="card" style="padding:16px;">
                <div class="font-bold text-primary mb-1">${renderIcon('layout-dashboard',14)} Dashboard</div>
                <div class="text-sm text-muted">Today's transactions, success rate, alerts, and operational brief.</div>
            </div>
            <div class="card" style="padding:16px;">
                <div class="font-bold text-primary mb-1">${renderIcon('users',14)} Partners</div>
                <div class="text-sm text-muted">Manage your retailers and agents. View their transaction history, complaints, and payments.</div>
            </div>
            <div class="card" style="padding:16px;">
                <div class="font-bold text-primary mb-1">${renderIcon('arrow-left-right',14)} Transactions</div>
                <div class="text-sm text-muted">Filter by status, search by name or ID, and raise complaints from failed transactions.</div>
            </div>
            <div class="card" style="padding:16px;">
                <div class="font-bold text-primary mb-1">${renderIcon('message-square-warning',14)} Complaints</div>
                <div class="text-sm text-muted">Track open complaints with SLA countdowns. Resolve or escalate directly from this view.</div>
            </div>
            <div class="card" style="padding:16px;">
                <div class="font-bold text-primary mb-1">${renderIcon('send',14)} Service Hub</div>
                <div class="text-sm text-muted">Send Money (DMT), Aadhaar Banking (AePS), Pay Bills (BBPS), and Mobile Recharge. All transactions are recorded automatically.</div>
            </div>
        </div>`;
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('online', () => { updateSyncIndicator('syncing'); navigateTo(currentScreen); });
    window.addEventListener('offline', () => updateSyncIndicator('offline'));
    initAuth();
});
