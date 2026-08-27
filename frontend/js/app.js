/**
 * Eko Micro-Entrepreneur Worker — App Core
 * Navigation, Top Header sync, metrics calculation, and screen router.
 */

// ── Translations ──────────────────────────────────────────────────────────────
const TRANSLATIONS = {
    en: {
        home: 'Home',
        customers: 'Customers',
        tasks: 'Tasks',
        notes: 'Notes',
        askEko: 'Ask Eko AI',
        greeting_morning: 'Good Morning',
        greeting_afternoon: 'Good Afternoon',
        greeting_evening: 'Good Evening',
        subtitle: "Here's your business at a glance.",
        customersCount: 'Active Customers',
        pendingTasksCount: 'Pending Tasks',
        followupsDue: 'Follow-ups Due',
        aiSuggestions: 'AI Recommendations',
        quickActions: 'Quick Actions',
        addCustomer: 'New Customer',
        addTask: 'Add Task',
        addNote: 'Add Note',
        upcomingTasks: 'Upcoming & Priority Tasks',
        reviewSuggestions: 'Review Suggestions',
        synced: 'Synced',
        offline: 'Offline — saved on device',
        noPendingTasks: 'All caught up! No pending tasks right now.',
    },
    hi: {
        home: 'होम',
        customers: 'ग्राहक (Khata)',
        tasks: 'कार्य (Tasks)',
        notes: 'डायरी (Notes)',
        askEko: 'Eko AI सहायक',
        greeting_morning: 'शुभ प्रभात',
        greeting_afternoon: 'नमस्ते',
        greeting_evening: 'शुभ संध्या',
        subtitle: 'यहाँ आपके व्यवसाय की पूरी जानकारी है।',
        customersCount: 'सक्रिय ग्राहक',
        pendingTasksCount: 'बाकी काम',
        followupsDue: 'आज के फॉलो-अप',
        aiSuggestions: 'AI सुझाव',
        quickActions: 'त्वरित क्रियाएँ',
        addCustomer: 'नया ग्राहक',
        addTask: 'काम जोड़ें',
        addNote: 'नोट जोड़ें',
        upcomingTasks: 'प्राथमिकता वाले काम',
        reviewSuggestions: 'सुझाव देखें',
        synced: 'सिंक हो गया',
        offline: 'ऑफलाइन — डिवाइस में सुरक्षित',
        noPendingTasks: 'सब पूरा हो गया! कोई पेंडिंग काम नहीं है।',
    },
    hinglish: {
        home: 'Home',
        customers: 'Customers',
        tasks: 'Kaam & Tasks',
        notes: 'Business Notes',
        askEko: 'Ask Eko AI',
        greeting_morning: 'Good Morning',
        greeting_afternoon: 'Namaste',
        greeting_evening: 'Good Evening',
        subtitle: 'Aaj ka business update aur summary.',
        customersCount: 'Active Customers',
        pendingTasksCount: 'Baaki Kaam',
        followupsDue: 'Follow-ups Today',
        aiSuggestions: 'AI Suggestions',
        quickActions: 'Quick Actions',
        addCustomer: 'Naya Customer',
        addTask: 'Kaam Add Karein',
        addNote: 'Note Likhein',
        upcomingTasks: 'Zaruri & Upcoming Kaam',
        reviewSuggestions: 'Suggestions Dekhein',
        synced: 'Synced',
        offline: 'Offline — Device pe save hai',
        noPendingTasks: 'Shabaash! Koi pending kaam nahi hai abhi.',
    },
};

let appLanguage = 'en';
let currentScreen = 'home';

// ── Utility Functions ──────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return (
        d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
        ' · ' +
        d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    );
}

function isOverdue(dateStr) {
    return dateStr && dateStr < today();
}

function getGreeting() {
    const h = new Date().getHours();
    const t = TRANSLATIONS[appLanguage] || TRANSLATIONS.en;
    if (h < 12) return t.greeting_morning;
    if (h < 17) return t.greeting_afternoon;
    return t.greeting_evening;
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('global-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'global-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

// ── Screen Router ──────────────────────────────────────────────────────────────
const SCREENS = {
    home:       { title: 'Home', subtitle: "Here's your business at a glance.", render: renderHomeScreen, load: loadHomeScreen },
    customers:  { title: 'Customers', subtitle: 'Manage accounts, credit balances & follow-ups.', render: renderCustomersScreen, load: loadCustomers },
    tasks:      { title: 'Tasks', subtitle: 'Prioritize daily operations & supplier orders.', render: renderTasksScreen, load: loadTasks },
    notes:      { title: 'Business Notes', subtitle: 'Your daily commercial journal & stock logs.', render: renderNotesScreen, load: loadNotes },
    'ai-tools': { title: 'AI Superpowers Suite', subtitle: '5 True Multimodal & Generative AI tools for retail operations.', render: renderAiToolsScreen, load: () => {} },
    'ask-eko':  { title: 'Ask Eko AI', subtitle: 'Contextual, grounded business assistant.', render: renderAskEkoScreen, load: loadAskEko },
};

function navigateTo(screen) {
    currentScreen = screen;
    const content = document.getElementById('main-content');
    if (!content) return;

    // Update active state in desktop sidebar and mobile bottom nav
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.tab === screen);
    });

    const def = SCREENS[screen];
    if (!def) return;

    // Update Top Header
    const t = TRANSLATIONS[appLanguage] || TRANSLATIONS.en;
    let headerTitle = def.title;
    if (screen === 'home') headerTitle = t.home;
    if (screen === 'customers') headerTitle = t.customers;
    if (screen === 'tasks') headerTitle = t.tasks;
    if (screen === 'notes') headerTitle = t.notes;
    if (screen === 'ai-tools') headerTitle = 'AI Superpowers';
    if (screen === 'ask-eko') headerTitle = t.askEko;

    const titleEl = document.getElementById('page-header-title');
    const subEl = document.getElementById('page-header-subtitle');
    if (titleEl) titleEl.textContent = headerTitle;
    if (subEl) subEl.textContent = def.subtitle;

    // Render View
    content.innerHTML = def.render();
    def.load();
}

// ── Home Dashboard ─────────────────────────────────────────────────────────────
function renderHomeScreen() {
    const t = TRANSLATIONS[appLanguage] || TRANSLATIONS.en;
    const name = currentUser?.name?.split(' ')[0] || 'Partner';

    return `
    <div class="dashboard-grid">
        <!-- Hero Banner -->
        <div class="welcome-hero">
            <div class="welcome-text">
                <h1>${getGreeting()}, ${escapeHtml(name)} 👋</h1>
                <p>${t.subtitle}</p>
            </div>
            <button class="welcome-action-btn" onclick="navigateTo('ai-tools')">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                <span>Launch AI Tools</span>
            </button>
        </div>

        <!-- 4 Summary Metric Cards -->
        <div class="metrics-grid">
            <div class="metric-card" onclick="navigateTo('customers')">
                <div class="metric-header">
                    <div class="metric-icon-wrap metric-icon-blue">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </div>
                    <span class="metric-tag metric-tag-blue" id="stat-customers-tag">Total</span>
                </div>
                <div class="metric-value" id="stat-customers">—</div>
                <div class="metric-label">${t.customersCount}</div>
            </div>

            <div class="metric-card" onclick="navigateTo('tasks')">
                <div class="metric-header">
                    <div class="metric-icon-wrap metric-icon-purple">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    </div>
                    <span class="metric-tag metric-tag-purple" id="stat-tasks-tag">Pending</span>
                </div>
                <div class="metric-value" id="stat-tasks">—</div>
                <div class="metric-label">${t.pendingTasksCount}</div>
            </div>

            <div class="metric-card" onclick="navigateTo('customers')">
                <div class="metric-header">
                    <div class="metric-icon-wrap metric-icon-green">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <span class="metric-tag metric-tag-green" id="stat-followups-tag">Action</span>
                </div>
                <div class="metric-value" id="stat-followups">—</div>
                <div class="metric-label">${t.followupsDue}</div>
            </div>

            <div class="metric-card" onclick="navigateTo('ai-tools')">
                <div class="metric-header">
                    <div class="metric-icon-wrap metric-icon-cyan">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </div>
                    <span class="metric-tag" style="background:#ECFEFF; color:#0891B2;">5 Tools</span>
                </div>
                <div class="metric-value" id="stat-suggestions">5 AI Tools</div>
                <div class="metric-label">AI Superpowers</div>
            </div>
        </div>

        <!-- AI Superpowers Spotlight Card (Recruiter Highlight) -->
        <div style="background:linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%); border:1px solid rgba(79, 70, 229, 0.2); border-radius:var(--radius-lg); padding:20px; box-shadow:var(--shadow-xs);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="ai-header-badge">Real AI Core</span>
                    <h3 style="font-size:1.05rem; font-weight:800; color:var(--text-main); margin:0;">Eko AI Superpowers Hub</h3>
                </div>
                <button class="btn-ghost" style="padding:4px 10px; font-size:0.8rem;" onclick="navigateTo('ai-tools')">Open All 5 Tools →</button>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
                <button class="btn-secondary" style="padding:10px; font-size:0.82rem; display:flex; flex-direction:column; align-items:center; gap:6px; background:var(--surface);" onclick="navigateTo('ai-tools'); switchAiToolTab('scanner');">
                    <span style="font-size:1.3rem;">📷</span>
                    <span style="font-weight:700;">Bill Scanner</span>
                </button>
                <button class="btn-secondary" style="padding:10px; font-size:0.82rem; display:flex; flex-direction:column; align-items:center; gap:6px; background:var(--surface);" onclick="navigateTo('ai-tools'); switchAiToolTab('voice');">
                    <span style="font-size:1.3rem;">🎙️</span>
                    <span style="font-weight:700;">Voice Khata</span>
                </button>
                <button class="btn-secondary" style="padding:10px; font-size:0.82rem; display:flex; flex-direction:column; align-items:center; gap:6px; background:var(--surface);" onclick="navigateTo('ai-tools'); switchAiToolTab('whatsapp');">
                    <span style="font-size:1.3rem;">💬</span>
                    <span style="font-weight:700;">WhatsApp Studio</span>
                </button>
                <button class="btn-secondary" style="padding:10px; font-size:0.82rem; display:flex; flex-direction:column; align-items:center; gap:6px; background:var(--surface);" onclick="navigateTo('ai-tools'); switchAiToolTab('credit');">
                    <span style="font-size:1.3rem;">🛡️</span>
                    <span style="font-weight:700;">Credit Scorer</span>
                </button>
                <button class="btn-secondary" style="padding:10px; font-size:0.82rem; display:flex; flex-direction:column; align-items:center; gap:6px; background:var(--surface);" onclick="navigateTo('ai-tools'); switchAiToolTab('flyer');">
                    <span style="font-size:1.3rem;">🎨</span>
                    <span style="font-weight:700;">Flyer Creator</span>
                </button>
            </div>
        </div>

        <!-- Eko Insights Proactive Advice Card -->
        <div class="insights-card">
            <div class="insights-left">
                <div class="insights-badge-icon">
                    <svg class="icon" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
                </div>
                <div>
                    <div class="insights-title" id="insights-headline">Eko Proactive Insights</div>
                    <div class="insights-desc" id="insights-body">Analyzing your customer balances and daily schedule to suggest optimal actions...</div>
                </div>
            </div>
            <button class="insights-btn" onclick="navigateTo('ask-eko')">
                <span>${t.reviewSuggestions}</span>
                <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        </div>

        <!-- Quick Actions -->
        <div class="section-header">
            <h2 class="section-title">${t.quickActions}</h2>
        </div>
        <div class="quick-actions-grid">
            <div class="action-card" onclick="navigateTo('customers'); setTimeout(openAddCustomerModal, 120);">
                <div class="action-icon-wrap">
                    <svg class="icon" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                </div>
                <div class="action-info">
                    <span class="action-name">${t.addCustomer}</span>
                    <span class="action-hint">Khata & Credit</span>
                </div>
            </div>

            <div class="action-card" onclick="navigateTo('tasks'); setTimeout(openAddTaskModal, 120);">
                <div class="action-icon-wrap">
                    <svg class="icon" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                </div>
                <div class="action-info">
                    <span class="action-name">${t.addTask}</span>
                    <span class="action-hint">Daily Checklist</span>
                </div>
            </div>

            <div class="action-card" onclick="navigateTo('notes')">
                <div class="action-icon-wrap">
                    <svg class="icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </div>
                <div class="action-info">
                    <span class="action-name">${t.addNote}</span>
                    <span class="action-hint">Business Log</span>
                </div>
            </div>

            <div class="action-card action-card-ai" onclick="navigateTo('ask-eko')">
                <div class="action-icon-wrap">
                    <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>
                </div>
                <div class="action-info">
                    <span class="action-name" style="color:var(--primary); font-weight:700;">${t.askEko}</span>
                    <span class="action-hint">AI Suggestions</span>
                </div>
            </div>
        </div>

        <!-- Upcoming Tasks -->
        <div class="section-header">
            <h2 class="section-title">${t.upcomingTasks}</h2>
            <button class="btn-ghost" style="padding:4px 10px; font-size:0.8rem;" onclick="navigateTo('tasks')">View All →</button>
        </div>
        <div id="home-tasks-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>`;
}

async function loadHomeScreen() {
    try {
        const tasks = isDemoMode ? DEMO_DATA.tasks : await api.getTasks();
        const customers = isDemoMode ? DEMO_DATA.customers : await api.getCustomers();

        const pending = tasks.filter(t => !t.completed);
        const followups = customers.filter(c => (c.follow_up_date && c.follow_up_date <= today()) || c.amount_due > 0);

        // Update metric values
        const cEl = document.getElementById('stat-customers');
        const tEl = document.getElementById('stat-tasks');
        const fEl = document.getElementById('stat-followups');
        if (cEl) cEl.textContent = customers.length;
        if (tEl) tEl.textContent = pending.length;
        if (fEl) fEl.textContent = followups.length;

        // Update Proactive Insights text
        const insightHead = document.getElementById('insights-headline');
        const insightBody = document.getElementById('insights-body');
        if (insightHead && insightBody) {
            if (followups.length > 0) {
                insightHead.textContent = `Eko noticed ${followups.length} follow-ups are due today.`;
                insightBody.textContent = `Prioritize contacting ${followups[0].name}${followups[0].amount_due ? ` (₹${followups[0].amount_due} due)` : ''} to accelerate your payment recovery.`;
            } else {
                insightHead.textContent = `All customer follow-ups are up to date! 🎉`;
                insightBody.textContent = `You have ${pending.length} pending business tasks scheduled for completion.`;
            }
        }

        // Render upcoming task items
        const listEl = document.getElementById('home-tasks-list');
        if (!listEl) return;

        const upcoming = pending.slice(0, 4);
        if (upcoming.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state" style="padding:24px;">
                    <div class="empty-state-icon">
                        <svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <h3>${(TRANSLATIONS[appLanguage] || TRANSLATIONS.en).noPendingTasks}</h3>
                </div>`;
            return;
        }

        listEl.innerHTML = upcoming.map(task => `
            <div class="card-item" onclick="navigateTo('tasks')">
                <div class="task-item">
                    <div class="custom-checkbox ${task.completed ? 'checked' : ''}" onclick="event.stopPropagation(); toggleTaskHome('${task.id}', ${!task.completed})">
                        ${task.completed ? '<svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    <div class="task-details">
                        <div class="task-title ${task.completed ? 'done' : ''}">${escapeHtml(task.title)}</div>
                        <div class="task-meta">
                            ${task.due_date ? `<span class="${isOverdue(task.due_date) ? 'overdue' : ''}">📅 ${formatDate(task.due_date)}</span>` : ''}
                            <span class="badge-priority ${task.priority}">${task.priority}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (e) {
        const listEl = document.getElementById('home-tasks-list');
        if (listEl) {
            listEl.innerHTML = `
                <div class="empty-state" style="padding:24px;">
                    <p style="color:var(--text-muted);">Could not load live tasks. Verify backend connection.</p>
                </div>`;
        }
    }
}

async function toggleTaskHome(id, completed) {
    try {
        if (isDemoMode) {
            const t = DEMO_DATA.tasks.find(x => x.id === id);
            if (t) t.completed = completed;
        } else {
            await api.updateTask(id, { completed });
        }
        await loadHomeScreen();
    } catch (e) {
        showToast('Could not update task', 'error');
    }
}

// ── App Guide Walkthrough (5-Step Modern Onboarding) ──────────────────────────
const GUIDE_STEPS = [
    {
        icon: '<svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
        title: 'Welcome to Eko Worker',
        title_hi: 'Eko Worker में आपका स्वागत है',
        title_hinglish: 'Eko Worker mein Aapka Swagat Hai',
        desc: 'Your simple, device-constrained AI business assistant designed for everyday entrepreneurs and field teams.',
        desc_hi: 'आपके रोज़मर्रा के व्यवसाय के लिए एक सरल और तेज़ AI सहायक जो बिना किसी परेशानी के काम करता है।',
        desc_hinglish: 'Aapke daily business aur dukaan ke operations ke liye AI assistant. Fast, private aur simple.',
        tip: 'Works on low-end phones and runs offline whenever connectivity drops.'
    },
    {
        icon: '<svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
        title: '1. Manage Customers & Khata',
        title_hi: '1. ग्राहक खाता और उधारी',
        title_hinglish: '1. Customer Khata & Follow-ups',
        desc: 'Keep customer balances organized. Set follow-up reminder dates so you always recover outstanding payments on time.',
        desc_hi: 'ग्राहकों का हिसाब-किताब रखें, उधारी ट्रैक करें और फॉलो-अप की तारीख तय करें।',
        desc_hinglish: 'Customers ka balance record karein aur payment follow-up date set karein.',
        tip: 'Customer names and numbers stay 100% private in your local database.'
    },
    {
        icon: '<svg class="icon icon-lg" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
        title: '2. Track Daily Tasks & Priorities',
        title_hi: '2. रोज़ के काम और प्राथमिकता',
        title_hinglish: '2. Daily Tasks & To-Dos',
        desc: 'Organize supplier calls, inventory dispatches, and pending deliveries with High, Medium, and Low priorities.',
        desc_hi: 'स्टॉक ऑर्डर, सप्लायर कॉल और दुकान के जरूरी कामों की लिस्ट बनाएं।',
        desc_hinglish: 'Supplier stock orders aur delivery checklist maintain karein.',
        tip: 'Check off items with one tap as you finish your morning routines.'
    },
    {
        icon: '<svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
        title: '3. Business Journal (Notes)',
        title_hi: '3. व्यापार डायरी (नोट्स)',
        title_hinglish: '3. Business Diary & Notes',
        desc: 'Quickly record daily cashflow updates, wholesale rate changes, and specific customer preferences.',
        desc_hi: 'भाव में बदलाव, दैनिक बिक्री और ग्राहकों की मांग तुरंत नोट करें।',
        desc_hinglish: 'Daily rates, special customer orders aur daily sales note karein.',
        tip: 'All notes are saved with automatic timestamps.'
    },
    {
        icon: '<svg class="icon icon-lg" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>',
        title: '4. Ask Eko — Your AI Worker',
        title_hi: '4. Ask Eko — आपका AI सहायक',
        title_hinglish: '4. Ask Eko — Aapka AI Worker',
        desc: 'Ask business questions in Hindi, Hinglish, or English. Generate polite WhatsApp payment reminders, promotions, and daily plan summaries.',
        desc_hi: 'हिंदी, हिंग्लिश या इंग्लिश में पूछें। व्हाट्सएप पेमेंट मैसेज और बिजनेस टिप्स तुरंत पाएं।',
        desc_hinglish: 'Hindi ya Hinglish mein WhatsApp reminders likhwayein aur daily advice lein.',
        tip: 'Try one-tap chips like "Follow-ups today?" for instant business guidance.'
    }
];

let currentGuideIndex = 0;

function openAppGuide() {
    currentGuideIndex = 0;
    renderGuideStep(0);
    const modal = document.getElementById('app-guide-modal');
    if (modal) modal.classList.remove('hidden');
}

function renderGuideStep(index) {
    currentGuideIndex = index;
    const step = GUIDE_STEPS[index];
    const total = GUIDE_STEPS.length;
    const isLast = index === total - 1;

    let title = step.title;
    let desc = step.desc;
    if (appLanguage === 'hi') { title = step.title_hi; desc = step.desc_hi; }
    if (appLanguage === 'hinglish') { title = step.title_hinglish; desc = step.desc_hinglish; }

    const contentEl = document.getElementById('guide-modal-content');
    const footerEl = document.getElementById('guide-modal-footer');
    if (!contentEl || !footerEl) return;

    contentEl.innerHTML = `
        <div class="guide-step-body">
            <div class="guide-icon-badge">${step.icon}</div>
            <h3 class="guide-title">${title}</h3>
            <p class="guide-desc">${desc}</p>
            <div class="guide-tip-box">
                <span class="guide-tip-title">💡 Pro Tip</span>
                <span class="guide-tip-text">${step.tip}</span>
            </div>
            <div class="guide-dots">
                ${GUIDE_STEPS.map((_, i) => `<span class="guide-dot ${i === index ? 'active' : ''}"></span>`).join('')}
            </div>
        </div>
    `;

    footerEl.innerHTML = `
        ${index > 0 ? `<button class="btn-ghost" onclick="renderGuideStep(${index - 1})">← Previous</button>` : '<div></div>'}
        <button class="btn-primary" onclick="${isLast ? "closeModal('app-guide-modal'); showToast('Guide complete! You are ready to go.');" : `renderGuideStep(${index + 1})`}">
            ${isLast ? 'Got it! Start using Eko 🚀' : 'Next Step →'}
        </button>
    `;
}

// ── Language & Online Status ──────────────────────────────────────────────────
function switchLanguage(lang) {
    appLanguage = lang;
    ['lang-select-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = lang;
    });
    navigateTo(currentScreen);
}

function updateOnlineStatus() {
    const banner = document.getElementById('offline-banner');
    const statusWrap = document.getElementById('header-sync-status');
    const statusText = document.getElementById('sync-status-text');

    const t = TRANSLATIONS[appLanguage] || TRANSLATIONS.en;

    if (navigator.onLine) {
        if (banner) banner.classList.add('hidden');
        if (statusWrap) {
            statusWrap.className = 'sync-status online';
            if (statusText) statusText.textContent = t.synced;
        }
    } else {
        if (banner) banner.classList.remove('hidden');
        if (statusWrap) {
            statusWrap.className = 'sync-status offline';
            if (statusText) statusText.textContent = t.offline;
        }
    }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // Boot auth
    initAuth();
});
