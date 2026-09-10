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
                <p class="text-sm text-muted">Field-agent customer database, transaction history, and credit analysis.</p>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-primary" onclick="openCustomerSearchModal()" style="display:flex; align-items:center; gap:6px; font-size:0.85rem; padding:8px 14px; font-weight:700;">
                    ${renderIcon('search', 16)}
                    <span>Search Customer</span>
                </button>
                <button class="btn-secondary" onclick="openAddCustomerModal()" aria-label="Add Profile" style="display:flex; align-items:center; gap:6px; font-size:0.85rem; padding:8px 12px;">
                    ${renderIcon('user-plus', 16)}
                    <span>Register</span>
                </button>
            </div>
        </div>

        <div class="search-bar mb-4">
            <i data-lucide="search" class="search-bar-icon"></i>
            <input type="text" id="customer-search-input" class="form-input" placeholder="Search by name, mobile or customer ID..." oninput="handleCustomerSearch(this.value)">
        </div>

        <div id="customers-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>

    <!-- Dedicated Customer Search Modal -->
    <div id="customer-search-modal" class="modal-overlay hidden">
        <div class="modal-card" style="max-width:560px;">
            <div class="modal-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    ${renderIcon('search', 18, 'text-primary')}
                    <h2 style="font-size:1.1rem; margin:0;">Search Customer</h2>
                </div>
                <button class="modal-close" onclick="closeCustomerSearchModal()">${renderIcon('x', 16)}</button>
            </div>
            <div class="modal-body" style="padding:16px;">
                <!-- Search Input with Clear Button -->
                <div style="position:relative; margin-bottom:16px;">
                    <i data-lucide="search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:18px; height:18px; color:var(--text-light);"></i>
                    <input type="text" id="modal-customer-search-input" class="form-input"
                           placeholder="Search by name, mobile or customer ID"
                           style="padding-left:38px; padding-right:38px; font-size:0.95rem; height:44px;"
                           oninput="handleModalCustomerSearch(this.value)">
                    <button type="button" onclick="clearCustomerSearchModal()"
                            style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--text-light); padding:4px;"
                            title="Clear search">
                        ${renderIcon('x-circle', 18)}
                    </button>
                </div>

                <!-- Modal Results Container -->
                <div id="modal-customer-search-results" class="item-list" style="max-height:400px; overflow-y:auto;">
                    <div class="text-sm text-muted text-center py-4">Start typing to search customers...</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="closeCustomerSearchModal()">Close</button>
            </div>
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

    let filtered = window._allCustomers.filter(c => {
        if (!customerSearchTerm) return true;
        const q = customerSearchTerm;
        const nameMatch = c.name && c.name.toLowerCase().includes(q);
        const phoneMatch = c.phone && c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
        const idMatch = c.id && c.id.toLowerCase().includes(q);
        const partnerMatch = c.partner_name && c.partner_name.toLowerCase().includes(q);
        return nameMatch || phoneMatch || idMatch || partnerMatch;
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${renderIcon('users', 28)}</div>
                <h3>No profiles found</h3>
                <p>Try searching by name, mobile number or customer ID.</p>
            </div>`;
        return;
    }

    list.innerHTML = filtered.map(c => {
        const maskedPhone = c.masked_phone || (c.phone ? `••••${c.phone.slice(-4)}` : 'No phone');
        const shortId = c.id ? (c.id.length > 8 ? c.id.slice(0, 8) : c.id) : 'C000';
        const riskLevel = c.risk_level || 'LOW RISK';
        const riskClass = riskLevel.includes('HIGH') ? 'badge-danger' : riskLevel.includes('MOD') ? 'badge-warning' : 'badge-success';

        return `
        <div class="card-item" style="padding:14px; flex-direction:column; align-items:stretch; gap:10px;">
            <div style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="openCustomerDetail('${c.id}')">
                <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                    <div class="user-avatar" style="background:var(--primary-subtle); color:var(--primary); font-weight:700;">
                        ${(c.name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div class="min-w-0">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span class="font-bold text-main" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.95rem;">
                                ${escapeHtml(c.name)}
                            </span>
                            <span class="text-xs text-muted font-mono">(${escapeHtml(shortId)})</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                            <span class="badge ${c.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}" style="font-size:0.6rem;">${c.kyc_status || 'pending'}</span>
                            <span class="text-xs text-muted">· ${escapeHtml(maskedPhone)}</span>
                            ${c.partner_name ? `<span class="text-xs text-muted">· ${escapeHtml(c.partner_name)}</span>` : ''}
                        </div>
                    </div>
                </div>
                ${renderIcon('chevron-right', 18, 'text-light')}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); border-radius:8px; padding:8px 12px; font-size:0.8rem;">
                <div>
                    <span class="text-muted text-xs">Activity:</span>
                    <b>${c.total_transactions || 0} txns</b> · ₹${Number(c.total_volume || 0).toLocaleString('en-IN')}
                    <span class="badge ${riskClass}" style="font-size:0.6rem; margin-left:6px;">${riskLevel}</span>
                </div>
                <div>
                    <button class="btn-ghost" style="padding:4px 10px; font-size:0.75rem; color:var(--primary); font-weight:700; border:1px solid var(--primary-subtle); border-radius:6px;" onclick="event.stopPropagation(); openCreditAnalysisModal('${c.id}')">
                        ${renderIcon('sliders', 13)}
                        <span>Credit Analysis</span>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

// ── Search Customer Dedicated Modal Handlers ────────────────────────────────
function openCustomerSearchModal() {
    const modal = document.getElementById('customer-search-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const input = document.getElementById('modal-customer-search-input');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 50);
    }
    renderModalSearchResults('');
}

function closeCustomerSearchModal() {
    const modal = document.getElementById('customer-search-modal');
    if (modal) modal.classList.add('hidden');
}

function clearCustomerSearchModal() {
    const input = document.getElementById('modal-customer-search-input');
    if (input) {
        input.value = '';
        input.focus();
    }
    renderModalSearchResults('');
}

function handleModalCustomerSearch(val) {
    renderModalSearchResults(val);
}

function renderModalSearchResults(query) {
    const resultsContainer = document.getElementById('modal-customer-search-results');
    if (!resultsContainer) return;

    const customers = window._allCustomers || [];
    const q = (query || '').toLowerCase().trim();

    let matches = customers;
    if (q) {
        matches = customers.filter(c => {
            const nameMatch = c.name && c.name.toLowerCase().includes(q);
            const digits = q.replace(/\D/g, '');
            const phoneMatch = digits && c.phone && c.phone.replace(/\D/g, '').includes(digits);
            const idMatch = c.id && c.id.toLowerCase().includes(q);
            const partnerMatch = c.partner_name && c.partner_name.toLowerCase().includes(q);
            return nameMatch || phoneMatch || idMatch || partnerMatch;
        });
    }

    if (matches.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state" style="padding:32px 16px;">
                <div class="empty-state-icon">${renderIcon('search-x', 28)}</div>
                <h3>No customer found</h3>
                <p>Try searching by name, mobile number or customer ID.</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    resultsContainer.innerHTML = matches.map(c => {
        const maskedPhone = c.masked_phone || (c.phone ? `••••${c.phone.slice(-4)}` : 'No phone');
        const shortId = c.id ? (c.id.length > 8 ? c.id.slice(0, 8) : c.id) : 'C000';
        const riskLevel = c.risk_level || 'LOW RISK';
        const riskClass = riskLevel.includes('HIGH') ? 'badge-danger' : riskLevel.includes('MOD') ? 'badge-warning' : 'badge-success';
        const txnCount = c.total_transactions || 0;
        const volumeStr = '₹' + Number(c.total_volume || 0).toLocaleString('en-IN');

        return `
        <div class="card mb-3" style="padding:12px 14px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="font-bold text-main" style="font-size:0.95rem;">${escapeHtml(c.name)}</span>
                        <span class="text-xs text-muted font-mono">(${escapeHtml(shortId)})</span>
                    </div>
                    <div class="text-xs text-muted mt-1">
                        <span>${escapeHtml(maskedPhone)}</span>
                        ${c.partner_name ? `<span> · ${escapeHtml(c.partner_name)}</span>` : ''}
                    </div>
                    <div class="text-xs text-muted mt-1">
                        <b>${txnCount} Transactions</b> · ${volumeStr} · <span class="badge ${riskClass}" style="font-size:0.6rem;">${riskLevel}</span>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                    <button class="btn-primary" style="padding:4px 10px; font-size:0.75rem; font-weight:700;"
                            onclick="closeCustomerSearchModal(); openCreditAnalysisModal('${c.id}')">
                        ${renderIcon('sliders', 13)}
                        <span>Credit Analysis</span>
                    </button>
                    <button class="btn-ghost" style="padding:4px 10px; font-size:0.75rem;"
                            onclick="closeCustomerSearchModal(); openCustomerDetail('${c.id}')">
                        <span>Open Customer</span>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

async function openCustomerDetail(id) {
    const customer = window._allCustomers.find(c => c.id === id);
    if (!customer) return;

    const modal = document.getElementById('customer-detail-modal');
    const body = document.getElementById('cd-modal-body');
    const title = document.getElementById('cd-modal-title');
    if (!modal || !body || !title) return;

    title.textContent = 'Operational Customer 360';

    const cleanPhone = (customer.phone || '').replace(/\D/g, '');
    const hasValidPhone = cleanPhone.length >= 10;

    body.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid var(--border);">
            <div class="user-avatar" style="width:56px; height:56px; font-size:1.5rem; background:var(--primary-dark); color:#FFF;">${customer.name.charAt(0).toUpperCase()}</div>
            <div style="flex:1;">
                <h3 style="font-size:1.2rem; font-weight:800;">${escapeHtml(customer.name)}</h3>
                <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                    <span class="badge ${customer.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}">${customer.kyc_status}</span>
                    <span class="text-xs text-muted">${customer.business_type || 'Category N/A'}</span>
                    ${customer.phone ? `<span class="text-xs text-muted">· ${escapeHtml(customer.phone)}</span>` : ''}
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

        <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border);">
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                ${hasValidPhone ? `
                    <button class="btn-secondary" style="flex:1; min-height:42px; border-color:#25d366; color:#128c7e; font-weight:700;" onclick="closeModal('customer-detail-modal'); openWhatsAppModal('${customer.id}', '${escapeHtml(customer.name)}', '${escapeHtml(customer.phone)}');">
                        ${renderIcon('message-circle', 18)}
                        <span>WhatsApp Customer</span>
                    </button>
                ` : `
                    <button class="btn-secondary" disabled style="flex:1; min-height:42px; opacity:0.55; cursor:not-allowed; border-color:var(--border); color:var(--text-light); font-weight:600;" title="WhatsApp unavailable — customer phone number is missing.">
                        ${renderIcon('message-circle', 18)}
                        <span>WhatsApp Customer</span>
                    </button>
                `}
                <button class="btn-secondary" style="flex:1; min-height:42px; border-color:var(--primary); color:var(--primary); font-weight:700;" onclick="closeModal('customer-detail-modal'); openCreditAnalysisModal('${customer.id}');">
                    ${renderIcon('sliders', 18)}
                    <span>Credit Analysis</span>
                </button>
                <button class="btn-primary" style="flex:1; min-height:42px; font-weight:700;" onclick="closeModal('customer-detail-modal'); navigateTo('ask-eko'); sendToEko('${customer.id}')">
                    ${renderIcon('sparkles', 18)}
                    <span>Ask Eko AI</span>
                </button>
            </div>
            ${!hasValidPhone ? `
                <div style="font-size:0.75rem; color:var(--danger, #dc2626); font-weight:600; display:flex; align-items:center; gap:6px; margin-top:8px; padding:6px 10px; background:var(--danger-bg, #fef2f2); border-radius:6px;">
                    ${renderIcon('alert-circle', 14)}
                    <span>WhatsApp unavailable — customer phone number is missing.</span>
                </div>
            ` : ''}
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
                <div class="font-bold text-sm mb-1">${renderIcon('sliders', 14)} Interactive Credit Analysis &amp; Simulator</div>
                <div class="text-xs text-muted mb-3">Adjust KYC, performance, volume, and failures to recalculate score dynamically.</div>
                <button class="btn-primary" style="width:100%; font-size:0.85rem; min-height:40px;" onclick="closeModal('customer-detail-modal'); openCreditAnalysisModal('${cid}')">
                    ${renderIcon('sliders', 14)} Open Interactive Credit Analyzer
                </button>
            </div>
        `;
        try {
            const result = await api.recalculateScore(cid);
            const valEl = document.getElementById('credit-val-display');
            if (valEl) {
                valEl.textContent = result.risk === 'INSUFFICIENT_DATA' ? 'N/A' : Number(result.score).toFixed(1);
            }
        } catch (e) {
            const valEl = document.getElementById('credit-val-display');
            if (valEl) valEl.textContent = 'Unavailable';
        }
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
