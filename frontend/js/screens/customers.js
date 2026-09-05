/**
 * Eko Partner Operations — Customer 360 & Timeline
 * Redesigned for professional mobile-first data management.
 */

let customerSearchTerm = '';

function renderCustomersScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Customer 360</h1>
                <p class="text-sm text-muted">Manage longitudinal profiles and service health.</p>
            </div>
            <button class="icon-btn primary" onclick="openAddCustomerModal()" aria-label="Add Profile">
                ${renderIcon('user-plus', 20)}
            </button>
        </div>

        <div class="search-bar mb-6">
            <i data-lucide="search" class="search-bar-icon"></i>
            <input type="text" id="customer-search-input" class="form-input" placeholder="Search by name, phone or ID..." oninput="handleCustomerSearch(this.value)">
        </div>

        <div id="customers-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>

    <!-- Add Customer Modal -->
    <div id="add-customer-modal" class="modal-overlay hidden">
        <div class="modal-card">
            <div class="modal-header">
                <h2>Register New Profile</h2>
                <button class="modal-close" onclick="closeModal('add-customer-modal')" aria-label="Close">${renderIcon('x', 16)}</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Full Legal Name *</label>
                    <input id="c-name" type="text" placeholder="e.g. Rahul Kumar" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Contact Number</label>
                    <input id="c-phone" type="tel" placeholder="e.g. 9876543210" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Partner Category</label>
                    <select id="c-type" class="form-input">
                        <option value="Individual">Individual Customer</option>
                        <option value="Merchant">Retail Merchant</option>
                        <option value="Enterprise">Enterprise Business</option>
                    </select>
                </div>
                <div id="customer-form-error" class="form-error hidden"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="closeModal('add-customer-modal')">Discard</button>
                <button class="btn-primary" onclick="saveCustomer()">Create Account</button>
            </div>
        </div>
    </div>`;
}

async function loadCustomers() {
    const list = document.getElementById('customers-list');
    if (!list) return;
    try {
        const customers = await api.getCustomers();
        window._allCustomers = customers;
        renderFilteredCustomers();
    } catch (e) {
        list.innerHTML = `
            <div class="error-state">
                <div class="error-state-title">Data Unavailable</div>
                <div class="error-state-desc">Could not load customer profiles. Please verify network access.</div>
            </div>`;
    }
}

function handleCustomerSearch(val) {
    customerSearchTerm = val.toLowerCase().trim();
    renderFilteredCustomers();
}

function renderFilteredCustomers() {
    const list = document.getElementById('customers-list');
    if (!list || !window._allCustomers) return;

    let filtered = window._allCustomers.filter(c =>
        !customerSearchTerm ||
        c.name.toLowerCase().includes(customerSearchTerm) ||
        (c.phone && c.phone.includes(customerSearchTerm))
    );

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${renderIcon('users', 24)}</div>
                <h3>No profiles found</h3>
                <p>Register your first partner or customer using the button above.</p>
            </div>`;
        return;
    }

    list.innerHTML = filtered.map(c => `
        <div class="card-item" onclick="openCustomerDetail('${c.id}')" style="cursor:pointer; padding:16px;">
            <div style="display:flex; align-items:center; gap:14px; min-width:0;">
                <div class="user-avatar" style="background:var(--primary-light); color:var(--primary);">${c.name.charAt(0).toUpperCase()}</div>
                <div class="min-w-0">
                    <div class="font-bold text-main" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.name)}</div>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                        <span class="badge ${c.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}" style="font-size:0.6rem;">${c.kyc_status}</span>
                        ${c.phone ? `<span class="text-xs text-muted">· ${escapeHtml(c.phone)}</span>` : ''}
                    </div>
                </div>
            </div>
            ${renderIcon('chevron-right', 18, 'text-light')}
        </div>
    `).join('');
    lucide.createIcons();
}

async function openCustomerDetail(id) {
    const customer = window._allCustomers.find(c => c.id === id);
    if (!customer) return;

    const modal = document.getElementById('customer-detail-modal');
    const body = document.getElementById('cd-modal-body');
    const title = document.getElementById('cd-modal-title');
    if (!modal || !body || !title) return;

    title.textContent = 'Operational Customer 360';

    body.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid var(--border);">
            <div class="user-avatar" style="width:56px; height:56px; font-size:1.5rem; background:var(--primary-dark); color:#FFF;">${customer.name.charAt(0).toUpperCase()}</div>
            <div style="flex:1;">
                <h3 style="font-size:1.2rem; font-weight:800;">${escapeHtml(customer.name)}</h3>
                <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                    <span class="badge ${customer.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}">${customer.kyc_status}</span>
                    <span class="text-xs text-muted">${customer.business_type || 'Category N/A'}</span>
                </div>
            </div>
            <button class="icon-btn" onclick="recalculateCredit('${customer.id}')" title="Refresh Assessment">${renderIcon('rotate-cw', 18)}</button>
        </div>

        <div class="filter-chips mb-5" style="background:var(--bg); padding:4px; border-radius:var(--radius-md); display:flex;">
            <button class="chip active" id="tab-timeline" onclick="switchCustomerDetailTab('timeline', '${customer.id}')" style="flex:1; border:none; justify-content:center;">Timeline</button>
            <button class="chip" id="tab-credit" onclick="switchCustomerDetailTab('credit', '${customer.id}')" style="flex:1; border:none; justify-content:center;">Credit Intel</button>
            <button class="chip" id="tab-info" onclick="switchCustomerDetailTab('info', '${customer.id}')" style="flex:1; border:none; justify-content:center;">Details</button>
        </div>

        <div id="customer-detail-content" style="min-height:320px;">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>

        <div style="display:flex; gap:12px; margin-top:28px; padding-top:16px; border-top:1px solid var(--border);">
            <button class="btn-primary" style="flex:1;" onclick="closeModal('customer-detail-modal'); navigateTo('ask-eko'); sendToEko('${customer.id}')">
                ${renderIcon('sparkles', 18)}
                <span>Ask Eko AI Assistant</span>
            </button>
        </div>
    `;

    modal.classList.remove('hidden');
    switchCustomerDetailTab('timeline', customer.id);
    lucide.createIcons();
}

async function switchCustomerDetailTab(tab, cid) {
    const container = document.getElementById('customer-detail-content');
    if (!container) return;

    document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'timeline') {
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
        try {
            const timeline = await api.getCustomerTimeline(cid);
            if (!timeline || timeline.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding:40px 20px;">
                        <div class="empty-state-icon">${renderIcon('history', 24)}</div>
                        <h3>No events recorded</h3>
                        <p>Timeline events appear after service activity or KYC updates.</p>
                    </div>`;
            } else {
                container.innerHTML = `
                    <div class="timeline-list">
                        ${timeline.map(e => `
                            <div class="timeline-item">
                                <div class="timeline-dot"></div>
                                <div class="timeline-content">
                                    <div class="timeline-title">${escapeHtml(e.title)}</div>
                                    <div class="timeline-meta">${escapeHtml(e.description || '')}</div>
                                    <div style="font-size:0.7rem; color:var(--text-light); margin-top:6px; font-weight:600;">${formatDateTime(e.created_at)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } catch (e) { container.innerHTML = '<p class="text-danger p-4 text-center">Failed to load timeline context.</p>'; }
    } else if (tab === 'credit') {
        container.innerHTML = `
            <div class="card" style="border-style:dashed; text-align:center; padding:32px 24px; background:var(--bg);">
                <div class="text-xs font-bold text-muted mb-2">OPERATIONAL TRUST SCORE</div>
                <div class="credit-score-value" id="credit-val-display" style="font-size:3.5rem; color:var(--primary);">--</div>
                <p class="text-xs text-muted mt-3">Calculated via deterministic transaction-velocity engine.</p>
            </div>

            <div class="ai-rec-block" style="margin-top:20px; border-left:4px solid var(--primary);">
                <div class="font-bold text-sm mb-1">${renderIcon('zap', 14)} Growth Simulation</div>
                <div class="text-xs text-muted mb-4">Project impact of hypothetical future success.</div>
                <button class="btn-primary" style="width:100%; font-size:0.8rem; min-height:38px;" onclick="runSimulation('${cid}')">Run AI Scenario Simulation</button>
            </div>
        `;
    } else if (tab === 'info') {
        const c = window._allCustomers.find(x => x.id === cid);
        container.innerHTML = `
            <div class="grid-cols-2 mb-6">
                <div class="card stat-card" style="padding:14px; border-color:var(--border);">
                    <div class="text-xs font-bold text-muted">SETTLEMENT BAL.</div>
                    <div class="font-bold text-lg">₹${(c.amount_due || 0).toLocaleString('en-IN')}</div>
                </div>
                <div class="card stat-card" style="padding:14px; border-color:var(--border);">
                    <div class="text-xs font-bold text-muted">ID VERIFIED</div>
                    <div class="font-bold text-lg">${c.kyc_status === 'verified' ? 'YES' : 'PENDING'}</div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Internal Operational Notes</label>
                <div class="card" style="font-size:0.85rem; background:var(--bg); border:none; line-height:1.6;">${escapeHtml(c.notes || 'No notes available for this partner profile.')}</div>
            </div>
        `;
    }
    lucide.createIcons();
}

async function recalculateCredit(cid) {
    showToast('Refreshing Operational Assessment...', 'info');
    try {
        const res = await api.recalculateScore(cid);
        showToast(`Trust Score Updated: ${res.score.toFixed(1)} pts`, 'success');
        const valEl = document.getElementById('credit-val-display');
        if (valEl) valEl.textContent = res.score.toFixed(1);
    } catch (e) { showToast('Assessment failed.', 'error'); }
}

async function runSimulation(cid) {
    showToast('Calculating projected impact...', 'info');
    try {
        const res = await api.simulateScore({
            customer_id: cid,
            hypothetical_success_txns: 5,
            hypothetical_volume: 25000
        });
        showToast(`Projected move: ${res.delta > 0 ? '+' : ''}${res.delta} pts`, 'success');
    } catch (e) { showToast('Simulation failed.', 'error'); }
}

async function saveCustomer() {
    const name = document.getElementById('c-name').value.trim();
    if (!name) { showToast('Full name is required', 'error'); return; }
    try {
        await api.createCustomer({
            name,
            phone: document.getElementById('c-phone').value,
            business_type: document.getElementById('c-type').value
        });
        closeModal('add-customer-modal');
        loadCustomers();
        showToast('New profile created & synced successfully.');
    } catch (e) { showToast('Profile save failed.', 'error'); }
}

function openAddCustomerModal() {
    document.getElementById('add-customer-modal').classList.remove('hidden');
}
