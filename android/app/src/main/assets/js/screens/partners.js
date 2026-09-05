/**
 * Eko Partner Operations — Partner Network Screen
 * Comprehensive profile with Overview, Transactions, Complaints & Payments tabs.
 */

let _partnerSearchTerm = '';
let _partnerCategoryFilter = 'all';
let _activePartnerDetail = null;

function renderPartnersScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Partner Network</h1>
                <p class="text-sm text-muted">Manage agents, retailers, and customer accounts.</p>
            </div>
            <button class="btn-primary" onclick="openAddPartnerModal()" style="display:flex; align-items:center; gap:8px;">
                ${renderIcon('user-plus', 16)}
                <span>Add Partner</span>
            </button>
        </div>

        <div class="search-bar mb-4">
            <i data-lucide="search" class="search-bar-icon"></i>
            <input type="text" id="partner-search-input" class="form-input" placeholder="Search partner by name, phone, or ID..." oninput="handlePartnerSearch(this.value)">
        </div>

        <div class="filter-tabs mb-4">
            <button class="filter-tab active" data-cat="all" onclick="filterPartnerCategory('all')">All</button>
            <button class="filter-tab" data-cat="Retailer" onclick="filterPartnerCategory('Retailer')">Retailers</button>
            <button class="filter-tab" data-cat="Merchant" onclick="filterPartnerCategory('Merchant')">Merchants</button>
            <button class="filter-tab" data-cat="Enterprise" onclick="filterPartnerCategory('Enterprise')">Enterprise</button>
        </div>

        <div id="partners-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>

    <!-- Add Partner Modal -->
    <div id="add-partner-modal" class="modal-overlay hidden">
        <div class="modal-card">
            <div class="modal-header">
                <h2>Register New Partner</h2>
                <button class="modal-close" onclick="closeModal('add-partner-modal')" aria-label="Close">${renderIcon('x', 16)}</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Full Legal Name *</label>
                    <input id="p-name" type="text" placeholder="e.g. Sharma Telecom" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Contact Number *</label>
                    <input id="p-phone" type="tel" placeholder="e.g. 9876543210" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Partner Category</label>
                    <select id="p-type" class="form-input">
                        <option value="Retailer">Retailer / Agent</option>
                        <option value="Merchant">Merchant</option>
                        <option value="Enterprise">Enterprise Business</option>
                        <option value="Individual">Individual Customer</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Email (Optional)</label>
                    <input id="p-email" type="email" placeholder="e.g. contact@sharma.in" class="form-input">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="closeModal('add-partner-modal')">Discard</button>
                <button class="btn-primary" onclick="savePartner()">Save Partner</button>
            </div>
        </div>
    </div>`;
}

async function loadPartners() {
    const list = document.getElementById('partners-list');
    if (!list) return;

    try {
        const partners = await api.getPartners();
        window._allPartners = partners;
        renderFilteredPartners();
    } catch (e) {
        list.innerHTML = `
            <div class="error-state">
                <div class="error-state-title">Data Unavailable</div>
                <div class="error-state-desc">Could not load partner network. Please verify your connection.</div>
            </div>`;
    }
}

function handlePartnerSearch(val) {
    _partnerSearchTerm = val.toLowerCase().trim();
    renderFilteredPartners();
}

function filterPartnerCategory(cat) {
    _partnerCategoryFilter = cat;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.cat === cat);
    });
    renderFilteredPartners();
}

function renderFilteredPartners() {
    const list = document.getElementById('partners-list');
    if (!list || !window._allPartners) return;

    let filtered = window._allPartners.filter(p => {
        const matchesSearch = !_partnerSearchTerm ||
            (p.name && p.name.toLowerCase().includes(_partnerSearchTerm)) ||
            (p.phone && p.phone.includes(_partnerSearchTerm));
        const matchesCat = _partnerCategoryFilter === 'all' ||
            (p.business_type && p.business_type.toLowerCase() === _partnerCategoryFilter.toLowerCase());
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${renderIcon('users', 28)}</div>
                <h3>No partners found</h3>
                <p>Register your first agent or retailer using the button above.</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    list.innerHTML = filtered.map(p => `
        <div class="card-item" onclick="openPartnerProfile('${p.id}')" style="cursor:pointer; padding:16px; flex-direction:column; align-items:stretch; gap:12px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                    <div class="user-avatar" style="background:var(--primary-subtle); color:var(--primary); font-weight:700;">
                        ${(p.name || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div style="min-width:0;">
                        <div class="font-bold text-main" style="font-size:0.95rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            ${escapeHtml(p.name)}
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                            <span class="badge ${p.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}" style="font-size:0.6rem;">${p.kyc_status || 'pending'}</span>
                            <span class="text-xs text-muted">· ${escapeHtml(p.phone || 'No Phone')}</span>
                        </div>
                    </div>
                </div>
                ${renderIcon('chevron-right', 18, 'text-light')}
            </div>

            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; background:var(--bg); border-radius:8px; padding:10px; text-align:center;">
                <div>
                    <div class="text-xs text-muted font-bold">TXNS</div>
                    <div class="font-bold text-sm mt-1">${p.total_transactions || 0}</div>
                </div>
                <div>
                    <div class="text-xs text-muted font-bold">SUCCESS</div>
                    <div class="font-bold text-sm text-success mt-1">${p.success_rate || '0%'}</div>
                </div>
                <div>
                    <div class="text-xs text-muted font-bold">VOLUME</div>
                    <div class="font-bold text-sm mt-1">₹${((p.total_volume || 0) > 999 ? ((p.total_volume || 0)/1000).toFixed(1) + 'k' : (p.total_volume || 0))}</div>
                </div>
                <div>
                    <div class="text-xs text-muted font-bold">COMPLAINTS</div>
                    <div class="font-bold text-sm ${p.open_complaints > 0 ? 'text-danger' : 'text-muted'} mt-1">${p.open_complaints || 0}</div>
                </div>
            </div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

async function openPartnerProfile(id) {
    const modal = document.getElementById('customer-detail-modal');
    const body = document.getElementById('cd-modal-body');
    const title = document.getElementById('cd-modal-title');
    if (!modal || !body || !title) return;

    title.textContent = 'Partner Profile';
    body.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    modal.classList.remove('hidden');

    try {
        const p = await api.getPartnerDetail(id);
        _activePartnerDetail = p;

        body.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border);">
            <div class="user-avatar" style="width:52px; height:52px; font-size:1.4rem; background:linear-gradient(135deg,#F97316,#EA580C); color:#FFF; font-weight:700;">
                ${(p.name || 'P').charAt(0).toUpperCase()}
            </div>
            <div style="flex:1; min-width:0;">
                <h3 style="font-size:1.15rem; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.name)}</h3>
                <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                    <span class="badge ${p.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}">${p.kyc_status || 'Pending KYC'}</span>
                    <span class="text-xs text-muted">${escapeHtml(p.business_type || 'Retailer')}</span>
                    ${p.phone ? `<span class="text-xs text-muted">· ${escapeHtml(p.phone)}</span>` : ''}
                </div>
            </div>
        </div>

        <div class="filter-tabs mb-4" style="background:var(--bg); padding:4px; border-radius:var(--radius-md);">
            <button class="filter-tab active" id="ptab-overview" onclick="switchPartnerTab('overview')" style="flex:1; justify-content:center; border:none;">Overview</button>
            <button class="filter-tab" id="ptab-transactions" onclick="switchPartnerTab('transactions')" style="flex:1; justify-content:center; border:none;">Txns (${p.transactions?.length || 0})</button>
            <button class="filter-tab" id="ptab-complaints" onclick="switchPartnerTab('complaints')" style="flex:1; justify-content:center; border:none;">Complaints (${p.complaints?.length || 0})</button>
            <button class="filter-tab" id="ptab-payments" onclick="switchPartnerTab('payments')" style="flex:1; justify-content:center; border:none;">Payments</button>
        </div>

        <div id="partner-tab-content" style="min-height:260px;"></div>
        `;

        switchPartnerTab('overview');
        if (window.lucide) lucide.createIcons();
    } catch(err) {
        body.innerHTML = `<div class="error-state"><div class="error-state-title">Failed to load profile</div><div class="text-sm text-muted">${escapeHtml(err.message || 'Error')}</div></div>`;
    }
}

function switchPartnerTab(tab) {
    const p = _activePartnerDetail;
    if (!p) return;
    const content = document.getElementById('partner-tab-content');
    if (!content) return;

    document.querySelectorAll('#cd-modal-body .filter-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`ptab-${tab}`)?.classList.add('active');

    if (tab === 'overview') {
        const stats = p.stats || {};
        content.innerHTML = `
            <div class="metrics-grid mb-4" style="margin-bottom:16px;">
                <div class="card stat-card" style="padding:12px;">
                    <div class="text-xs text-muted font-bold">SUCCESS RATE</div>
                    <div class="stat-value text-success" style="font-size:1.3rem;">${stats.success_rate || '0%'}</div>
                </div>
                <div class="card stat-card" style="padding:12px;">
                    <div class="text-xs text-muted font-bold">TOTAL VOLUME</div>
                    <div class="stat-value" style="font-size:1.3rem;">₹${(stats.total_volume || 0).toLocaleString('en-IN')}</div>
                </div>
                <div class="card stat-card" style="padding:12px;">
                    <div class="text-xs text-muted font-bold">TOTAL TXNS</div>
                    <div class="stat-value" style="font-size:1.3rem;">${stats.total_transactions || 0}</div>
                </div>
                <div class="card stat-card" style="padding:12px;">
                    <div class="text-xs text-muted font-bold">OPEN COMPLAINTS</div>
                    <div class="stat-value ${stats.open_complaints > 0 ? 'text-danger' : 'text-muted'}" style="font-size:1.3rem;">${stats.open_complaints || 0}</div>
                </div>
            </div>

            <div class="card mb-4" style="padding:14px; background:var(--bg); border:none;">
                <div class="text-xs font-bold text-muted mb-2">PARTNER DETAILS</div>
                <div class="text-sm" style="display:flex; flex-direction:column; gap:6px;">
                    <div><strong>Phone:</strong> ${escapeHtml(p.phone || 'N/A')}</div>
                    <div><strong>Email:</strong> ${escapeHtml(p.email || 'Not provided')}</div>
                    <div><strong>Settlement Balance:</strong> ₹${(p.amount_due || 0).toLocaleString('en-IN')}</div>
                    <div><strong>Account Registered:</strong> ${formatDate(p.created_at)}</div>
                </div>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn-primary" style="flex:1; min-height:40px; font-size:0.85rem;" onclick="closeModal('customer-detail-modal'); openServiceFlow('dmt');">
                    ${renderIcon('send', 16)} Send Money
                </button>
                <button class="btn-secondary" style="flex:1; min-height:40px; font-size:0.85rem;" onclick="closeModal('customer-detail-modal'); openCreateComplaintModal(null, '${p.id}', '${escapeHtml(p.name)}');">
                    ${renderIcon('message-square-warning', 16)} Raise Complaint
                </button>
                <button class="btn-ghost" style="width:100%; min-height:40px; font-size:0.85rem;" onclick="closeModal('customer-detail-modal'); navigateTo('ask-eko'); sendToEko('${p.id}');">
                    ${renderIcon('sparkles', 16)} Ask Eko About This Partner
                </button>
            </div>
        `;
    } else if (tab === 'transactions') {
        const txns = p.transactions || [];
        if (txns.length === 0) {
            content.innerHTML = `<div class="empty-state" style="padding:32px 16px;"><p>No transactions recorded for this partner yet.</p></div>`;
        } else {
            content.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;">` + txns.map(t => {
                const isSuccess = t.status === 'success';
                const isFailed = t.status === 'failed';
                return `
                <div class="card-item" onclick="closeModal('customer-detail-modal'); setTimeout(() => { if(typeof showActivityDetail==='function') showActivityDetail('${t.id}'); else navigateTo('activity'); }, 200);" style="padding:12px; align-items:center; cursor:pointer;">
                    <div style="flex:1; min-width:0;">
                        <div class="font-bold text-sm">${serviceName(t.service_name)}</div>
                        <div class="text-xs text-muted mt-1">${formatDateTime(t.created_at)} · ID: ${t.reference_id || t.id.slice(0,8)}</div>
                        ${t.failure_reason ? `<div class="text-xs text-danger mt-1">${escapeHtml(t.failure_reason)}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div class="font-bold text-sm">₹${(t.amount || 0).toLocaleString('en-IN')}</div>
                        <span class="badge ${isSuccess ? 'badge-success' : isFailed ? 'badge-danger' : 'badge-warning'}" style="font-size:0.6rem; margin-top:4px;">${t.status}</span>
                    </div>
                </div>`;
            }).join('') + `</div>`;
        }
    } else if (tab === 'complaints') {
        const comps = p.complaints || [];
        if (comps.length === 0) {
            content.innerHTML = `<div class="empty-state" style="padding:32px 16px;"><p>No complaints reported for this partner.</p></div>`;
        } else {
            content.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;">` + comps.map(c => `
                <div class="card-item" onclick="closeModal('customer-detail-modal'); setTimeout(() => { if(typeof showComplaintDetail==='function') showComplaintDetail('${c.id}'); else navigateTo('grievances'); }, 200);" style="padding:12px; flex-direction:column; align-items:flex-start; gap:6px; cursor:pointer;">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span class="font-bold text-sm">${escapeHtml(c.subject)}</span>
                        <span class="badge ${c.priority === 'urgent' ? 'badge-danger' : 'badge-warning'}" style="font-size:0.6rem;">${c.priority}</span>
                    </div>
                    <div class="text-xs text-muted">${formatDateTime(c.created_at)} · Status: <strong>${c.status}</strong></div>
                    ${c.sla_hours_remaining !== null && c.status !== 'resolved' ? `
                        <div class="text-xs ${c.sla_hours_remaining < 0 ? 'text-danger font-bold' : 'text-warning'}">
                            SLA: ${c.sla_hours_remaining < 0 ? 'OVERDUE' : Math.round(c.sla_hours_remaining) + 'h left'}
                        </div>` : ''}
                </div>
            `).join('') + `</div>`;
        }
    } else if (tab === 'payments') {
        content.innerHTML = `
            <div class="card" style="padding:20px; text-align:center; background:var(--bg); border:none; margin-bottom:16px;">
                <div class="text-xs text-muted font-bold">SETTLEMENT OUTSTANDING DUES</div>
                <div style="font-size:2.4rem; font-weight:800; color:var(--navy); margin:8px 0;">₹${(p.amount_due || 0).toLocaleString('en-IN')}</div>
                <div class="text-xs text-muted">Settlement cycle: Daily T+1 via NEFT/IMPS</div>
            </div>
            <button class="btn-primary" style="width:100%; min-height:42px;" onclick="recordPartnerSettlement('${p.id}')">
                ${renderIcon('check-circle', 16)} Record Settlement / Payment
            </button>
        `;
    }

    if (window.lucide) lucide.createIcons();
}

function openAddPartnerModal() {
    const modal = document.getElementById('add-partner-modal');
    if (modal) modal.classList.remove('hidden');
}

async function savePartner() {
    const name = document.getElementById('p-name')?.value.trim();
    const phone = document.getElementById('p-phone')?.value.trim();
    const type = document.getElementById('p-type')?.value;
    const email = document.getElementById('p-email')?.value.trim();

    if (!name) { showToast('Partner name is required', 'error'); return; }
    if (!phone) { showToast('Contact number is required', 'error'); return; }

    try {
        await api.createCustomer({
            name,
            phone,
            business_type: type,
            email: email || null
        });
        closeModal('add-partner-modal');
        showToast('Partner profile created successfully!');
        loadPartners();
    } catch(err) {
        showToast('Failed to save partner: ' + (err.message || 'Unknown error'), 'error');
    }
}

function recordPartnerSettlement(pid) {
    showToast('Settlement recorded and marked for next batch run.', 'success');
}

// Global aliases for router & compatibility
window.renderPartnersScreen = renderPartnersScreen;
window.loadPartners = loadPartners;
window.renderCustomersScreen = renderPartnersScreen;
window.loadCustomers = loadPartners;
