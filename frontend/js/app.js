/**
 * Eko AI Operations — App Core
 * Modern Redesign with Lucide Icons & Bottom Nav
 */

const TRANSLATIONS = {
    en: {
        home: 'Dashboard',
        customers: 'Customers',
        activity: 'Transactions',
        askEko: 'Eko AI',
        subtitle: "Fintech operations overview.",
        synced: 'Synced',
        offline: 'Offline'
    },
    // ... translations can be expanded
};

let appLanguage = 'en';
let currentScreen = 'home';
let isAiRequestInProgress = false;

// ── Utility Functions ──────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function today() { return new Date().toISOString().slice(0, 10); }

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
}

function showToast(message, type = 'success') {
    if (typeof AndroidBridge !== 'undefined') {
        AndroidBridge.showToast(message);
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

// ── Icon Helper ──────────────────────────────────────────────────────────────
function renderIcon(name, size = 20, extraClass = '') {
    return `<i data-lucide="${name}" class="${extraClass}" style="width:${size}px; height:${size}px;"></i>`;
}

// ── Screen Router ──────────────────────────────────────────────────────────────
const SCREENS = {
    home:       { title: 'Operations Dashboard', subtitle: "Live service health and summary.", render: renderHomeScreen, load: loadHomeScreen },
    customers:  { title: 'Customer 360', subtitle: 'Longitudinal service history.', render: renderCustomersScreen, load: loadCustomers },
    activity:   { title: 'Transaction Center', subtitle: 'Real-time monitoring.', render: renderActivityScreen, load: loadActivity },
    grievances: { title: 'Grievance Center', subtitle: 'Track SLA & complaints.', render: renderGrievancesScreen, load: loadGrievances },
    'ai-tools': { title: 'AI Operational Suite', subtitle: 'Productivity superpowers.', render: renderAiToolsScreen, load: () => { switchAiToolTab('scanner'); } },
    'ask-eko':  { title: 'Eko AI Assistant', subtitle: 'Grounded operational partner.', render: renderAskEkoScreen, load: loadAskEko },
};

function navigateTo(screen) {
    currentScreen = screen;
    const content = document.getElementById('main-content');
    if (!content) return;

    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.tab === screen);
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

// ── Home Dashboard Renderer ───────────────────────────────────────────────────
function renderHomeScreen() {
    const name = currentUser?.name?.split(' ')[0] || 'Partner';

    return `
    <div class="dashboard-grid container-responsive">
        <div class="welcome-hero">
            <div class="welcome-text">
                <h1 style="color:#FFF; font-size:1.4rem;">${getGreeting()}, ${escapeHtml(name)} 👋</h1>
                <p style="opacity:0.85; font-size:0.9rem;">Eko Operations are running smoothly.</p>
            </div>
            <button class="welcome-action-btn" onclick="navigateTo('ai-tools')">
                ${renderIcon('sparkles', 18)}
                <span>AI Tools</span>
            </button>
        </div>

        <div class="metrics-grid">
            <div class="card stat-card" onclick="navigateTo('activity')">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="metric-icon-wrap" style="background:var(--primary-subtle); color:var(--primary);">${renderIcon('activity', 20)}</div>
                    <span class="badge badge-success" style="font-size:0.6rem;">Live</span>
                </div>
                <div class="text-xs text-muted font-semibold mt-3">Success Rate</div>
                <div class="stat-value" id="stat-success-rate">--</div>
            </div>

            <div class="card stat-card" onclick="navigateTo('activity')">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="metric-icon-wrap" style="background:var(--success-bg); color:var(--success);">${renderIcon('wallet', 20)}</div>
                </div>
                <div class="text-xs text-muted font-semibold mt-3">Settlement Bal.</div>
                <div class="stat-value" id="stat-volume">--</div>
            </div>

            <div class="card stat-card" onclick="navigateTo('grievances')">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="metric-icon-wrap" style="background:var(--danger-bg); color:var(--danger);">${renderIcon('message-square-warning', 20)}</div>
                </div>
                <div class="text-xs text-muted font-semibold mt-3">Open Grievances</div>
                <div class="stat-value" id="stat-complaints">--</div>
            </div>

            <div class="card stat-card" onclick="navigateTo('ask-eko')">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="metric-icon-wrap" style="background:var(--accent-light); color:var(--accent-dark);">${renderIcon('bot', 20)}</div>
                </div>
                <div class="text-xs text-muted font-semibold mt-3">Daily AI Brief</div>
                <div class="text-primary font-bold mt-1" style="font-size:0.85rem;">View Plan ${renderIcon('chevron-right', 12)}</div>
            </div>
        </div>

        <div class="section-header mt-2">
            <h2 class="section-title">Eko Service Hub</h2>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px;">
            <div class="card" style="padding:14px; text-align:center; cursor:pointer;" onclick="showToast('DMT Service')">
                <div style="color:var(--primary); margin-bottom:8px;">${renderIcon('send', 22)}</div>
                <div class="font-bold text-xs">DMT</div>
            </div>
            <div class="card" style="padding:14px; text-align:center; cursor:pointer;" onclick="showToast('AePS Service')">
                <div style="color:var(--accent-dark); margin-bottom:8px;">${renderIcon('fingerprint', 22)}</div>
                <div class="font-bold text-xs">AePS</div>
            </div>
            <div class="card" style="padding:14px; text-align:center; cursor:pointer;" onclick="showToast('BBPS Service')">
                <div style="color:var(--success); margin-bottom:8px;">${renderIcon('receipt', 22)}</div>
                <div class="font-bold text-xs">BBPS</div>
            </div>
            <div class="card" style="padding:14px; text-align:center; cursor:pointer;" onclick="showToast('Recharge Service')">
                <div style="color:var(--warning); margin-bottom:8px;">${renderIcon('smartphone', 22)}</div>
                <div class="font-bold text-xs">Mobile</div>
            </div>
        </div>

        <div id="home-eko-suggestions">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>

        <div class="section-header">
            <h2 class="section-title">Priority Tasks</h2>
            <button class="btn-ghost" style="padding:4px 10px; font-size:0.8rem;" onclick="navigateTo('tasks')">All</button>
        </div>
        <div id="home-tasks-list" class="item-list"></div>
    </div>`;
}

async function loadHomeScreen() {
    try {
        const stats = await apiRequest('GET', '/api/ops/dashboard');
        if (document.getElementById('stat-success-rate')) document.getElementById('stat-success-rate').textContent = stats.success_rate;
        if (document.getElementById('stat-volume')) document.getElementById('stat-volume').textContent = `₹${stats.total_volume.toLocaleString('en-IN')}`;
        if (document.getElementById('stat-complaints')) document.getElementById('stat-complaints').textContent = stats.open_complaints;

        const suggestionsEl = document.getElementById('home-eko-suggestions');
        if (suggestionsEl) {
            try {
                const brief = await api.getDailyBrief();
                suggestionsEl.innerHTML = `
                    <div class="card" style="border-left:4px solid var(--primary); background: linear-gradient(to right, var(--primary-light), #FFF);">
                        <div class="font-bold text-primary mb-2" style="display:flex; align-items:center; gap:8px;">
                            ${renderIcon('sun', 16)} Operational Brief
                        </div>
                        <div class="text-sm line-height-relaxed">${escapeHtml(brief.brief_markdown || 'No summary available.')}</div>
                    </div>
                `;
            } catch (e) { suggestionsEl.innerHTML = ''; }
        }

        // Load tasks (simplified)
        const tasks = await api.getTasks();
        const list = document.getElementById('home-tasks-list');
        if (list) {
            const pending = tasks.filter(t => !t.completed).slice(0, 3);
            if (pending.length === 0) list.innerHTML = `<div class="text-sm text-muted">No pending tasks.</div>`;
            else list.innerHTML = pending.map(t => `
                <div class="card-item" style="padding:12px 16px;">
                    <span class="text-sm font-semibold">${escapeHtml(t.title)}</span>
                    <span class="badge badge-warning" style="font-size:0.6rem;">${t.priority}</span>
                </div>
            `).join('');
        }
        lucide.createIcons();
    } catch (e) { console.error(e); }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('online', () => navigateTo(currentScreen));
    initAuth();
});
