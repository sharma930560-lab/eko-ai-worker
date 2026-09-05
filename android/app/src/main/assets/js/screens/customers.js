/**
 * Eko AI Operations — Customer 360 & Timeline
 */

let customerSearchTerm = '';

function renderCustomersScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Customer 360</h1>
                <p class="text-sm text-muted">Manage longitudinal profiles and service history.</p>
            </div>
            <button class="btn-primary" onclick="openAddCustomerModal()">
                ${renderIcon('user-plus', 18)}
                <span>Add Profile</span>
            </button>
        </div>

        <div class="filter-search-bar">
            <div class="search-input-wrap">
                <i data-lucide="search" class="search-icon"></i>
                <input type="text" id="customer-search-input" class="search-input" placeholder="Search by name, phone or ID..." oninput="handleCustomerSearch(this.value)">
            </div>
        </div>

        <div id="customers-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>

    <!-- Add Customer Modal -->
    <div id="add-customer-modal" class="modal-overlay hidden">
        <div class="modal-card">
            <div class="modal-header">
                <h2>New Customer Profile</h2>
                <button class="modal-close" onclick="closeModal('add-customer-modal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Full Name *</label>
                    <input id="c-name" type="text" placeholder="e.g. Rahul Kumar" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Mobile Number</label>
                    <input id="c-phone" type="tel" placeholder="e.g. 9876543210" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select id="c-type" class="form-input">
                        <option value="Individual">Individual User</option>
                        <option value="Merchant">Retail Merchant</option>
                        <option value="Enterprise">Enterprise Partner</option>
                    </select>
                </div>
                <div id="customer-form-error" class="form-error hidden"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="closeModal('add-customer-modal')">Cancel</button>
                <button class="btn-primary" onclick="saveCustomer()">Save Account</button>
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
        list.innerHTML = `<div class="empty-state"><p>Could not load customers. Verify connection.</p></div>`;
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
        list.innerHTML = `<div class="empty-state"><h3>No profiles found</h3></div>`;
        return;
    }

    list.innerHTML = filtered.map(c => `
        <div class="card-item customer-card" onclick="openCustomerDetail('${c.id}')">
            <div style="display:flex; align-items:center; gap:14px; min-width:0;">
                <div class="customer-avatar">${c.name.charAt(0).toUpperCase()}</div>
                <div class="customer-info-block">
                    <div class="customer-name">${escapeHtml(c.name)}</div>
                    <div class="customer-sub">
                        <span class="badge ${c.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}" style="font-size:0.6rem;">${c.kyc_status}</span>
                        ${c.phone ? `<span>· ${escapeHtml(c.phone)}</span>` : ''}
                    </div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                ${renderIcon('chevron-right', 18, 'text-light')}
            </div>
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

    title.textContent = 'Customer 360';

    body.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border);">
            <div class="customer-avatar" style="width:52px; height:52px; font-size:1.4rem;">${customer.name.charAt(0).toUpperCase()}</div>
            <div style="flex:1;">
                <h3 style="font-size:1.1rem; font-weight:700;">${escapeHtml(customer.name)}</h3>
                <div style="color:var(--text-muted); font-size:0.86rem;">KYC Status: <span class="badge ${customer.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}">${customer.kyc_status}</span></div>
            </div>
            <button class="btn-ghost" onclick="recalculateCredit('${customer.id}')" title="Refresh Assessment">${renderIcon('rotate-cw', 16)}</button>
        </div>

        <div style="display:flex; background:var(--bg); padding:4px; border-radius:var(--radius-md); gap:4px; margin-bottom:20px;">
            <button class="segment-tab active" id="tab-timeline" onclick="switchCustomerDetailTab('timeline', '${customer.id}')" style="flex:1;">Timeline</button>
            <button class="segment-tab" id="tab-credit" onclick="switchCustomerDetailTab('credit', '${customer.id}')" style="flex:1;">Credit</button>
            <button class="segment-tab" id="tab-info" onclick="switchCustomerDetailTab('info', '${customer.id}')" style="flex:1;">Information</button>
        </div>

        <div id="customer-detail-content" style="min-height:300px;">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>

        <div style="display:flex; gap:12px; margin-top:24px; padding-top:16px; border-top:1px solid var(--border);">
            <button class="btn-primary" style="flex:1;" onclick="navigateTo('ask-eko'); sendToEko('${customer.id}')">
                ${renderIcon('bot', 18)}
                <span>Ask AI Assistant</span>
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

    document.querySelectorAll('.segment-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'timeline') {
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
        try {
            const timeline = await api.getCustomerTimeline(cid);
            if (!timeline || timeline.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>No operational events found.</p></div>';
            } else {
                container.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:16px; padding-left:8px; border-left:2px solid var(--border);">
                        ${timeline.map(e => `
                            <div style="position:relative; padding-left:20px;">
                                <div style="position:absolute; left:-25px; top:4px; width:10px; height:10px; border-radius:50%; background:var(--primary); border:2px solid #FFF;"></div>
                                <div style="font-weight:700; font-size:0.85rem;">${escapeHtml(e.title)}</div>
                                <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(e.description || '')}</div>
                                <div style="font-size:0.7rem; color:var(--text-light); margin-top:4px;">${formatDateTime(e.created_at)}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } catch (e) { container.innerHTML = '<p>Error.</p>'; }
    } else if (tab === 'credit') {
        container.innerHTML = `
            <div class="card" style="border-style:dashed; text-align:center; padding:32px 20px;">
                <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Internal Trust Score</div>
                <div style="font-size:3rem; font-weight:800; color:var(--primary); margin:8px 0;">--</div>
                <p class="text-sm text-muted">Recalculate above to see the latest dynamic assessment.</p>
            </div>

            <div style="margin-top:20px; background:var(--primary-light); padding:16px; border-radius:var(--radius-md);">
                <h4 style="font-size:0.85rem; margin-bottom:8px;">${renderIcon('zap', 14)} What-if Simulation</h4>
                <p class="text-xs text-muted mb-3">Project impact of hypothetical successful transactions.</p>
                <button class="btn-primary" style="width:100%; font-size:0.8rem; padding:8px;" onclick="runSimulation('${cid}')">Run Growth Simulation</button>
            </div>
        `;
    } else if (tab === 'info') {
        const c = window._allCustomers.find(x => x.id === cid);
        container.innerHTML = `
            <div class="grid-cols-2">
                <div class="card stat-card" style="padding:12px;">
                    <div class="text-xs text-muted">Current Balance</div>
                    <div class="font-bold" style="font-size:1.1rem;">₹${(c.amount_due || 0).toLocaleString()}</div>
                </div>
                <div class="card stat-card" style="padding:12px;">
                    <div class="text-xs text-muted">Category</div>
                    <div class="font-bold">${c.business_type || 'N/A'}</div>
                </div>
            </div>
            <div class="form-group" style="margin-top:20px;">
                <label class="form-label">Internal Operational Notes</label>
                <div class="card" style="font-size:0.85rem; background:var(--bg); border:none;">${escapeHtml(c.notes || 'No notes.')}</div>
            </div>
        `;
    }
    lucide.createIcons();
}

async function recalculateCredit(cid) {
    showToast('Recalculating score...', 'info');
    try {
        const res = await api.recalculateScore(cid);
        showToast(`Trust Score: ${res.score.toFixed(1)} (${res.risk})`, 'success');
        switchCustomerDetailTab('credit', cid);
    } catch (e) { showToast('Recalculation failed.', 'error'); }
}

async function runSimulation(cid) {
    showToast('Simulating growth scenario...', 'info');
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
    if (!name) return;
    try {
        await api.createCustomer({
            name,
            phone: document.getElementById('c-phone').value,
            business_type: document.getElementById('c-type').value
        });
        closeModal('add-customer-modal');
        loadCustomers();
        showToast('Profile created and logged to Timeline.');
    } catch (e) { showToast('Save failed.', 'error'); }
}

function openAddCustomerModal() {
    document.getElementById('add-customer-modal').classList.remove('hidden');
}
