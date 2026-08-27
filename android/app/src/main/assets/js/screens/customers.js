/**
 * Eko — Modern Customers Screen (Directory, Search, Filter & Detail)
 */

let customerSearchTerm = '';
let customerTypeFilter = 'all';

function renderCustomersScreen() {
    return `
    <div class="screen-header-row">
        <div>
            <h1 class="screen-title">Customers & Khata</h1>
        </div>
        <button class="btn-primary" onclick="openAddCustomerModal()">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Add Customer</span>
        </button>
    </div>

    <!-- Search & Filters -->
    <div class="filter-search-bar">
        <div class="search-input-wrap">
            <svg class="icon icon-sm search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="customer-search-input" class="search-input" placeholder="Search by name, phone or type..." oninput="handleCustomerSearch(this.value)">
        </div>
        <div class="segment-tabs">
            <button class="segment-tab active" onclick="filterCustomerType(this, 'all')">All</button>
            <button class="segment-tab" onclick="filterCustomerType(this, 'Retail')">Retail</button>
            <button class="segment-tab" onclick="filterCustomerType(this, 'Wholesale')">Wholesale</button>
            <button class="segment-tab" onclick="filterCustomerType(this, 'Restaurant')">Restaurant</button>
        </div>
    </div>

    <!-- Customers List -->
    <div id="customers-list" class="item-list">
        <div class="loading-state"><div class="spinner"></div></div>
    </div>

    <!-- Add Customer Modal -->
    <div id="add-customer-modal" class="modal-overlay hidden">
        <div class="modal-card">
            <div class="modal-header">
                <h2>New Customer Account</h2>
                <button class="modal-close" onclick="closeModal('add-customer-modal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Full Name *</label>
                    <input id="c-name" type="text" placeholder="e.g. Ramesh Kumar" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Phone Number</label>
                    <input id="c-phone" type="tel" placeholder="e.g. 9876543210" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Business Category</label>
                    <select id="c-type" class="form-input">
                        <option value="">Select Category</option>
                        <option value="Retail">Retail Store / Kirana</option>
                        <option value="Wholesale">Wholesale Trader</option>
                        <option value="Restaurant">Restaurant / Dhaba</option>
                        <option value="Other">Other Services</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Amount Due / Credit Balance (₹)</label>
                    <input id="c-amount" type="number" placeholder="0" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Next Payment / Follow-up Date</label>
                    <input id="c-followup" type="date" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Notes & Preferences</label>
                    <textarea id="c-notes" rows="2" placeholder="e.g. Preferred delivery time, credit limit..." class="form-input"></textarea>
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
        const customers = isDemoMode ? DEMO_DATA.customers : await api.getCustomers();
        window._allCustomers = customers;
        renderFilteredCustomers();
    } catch (e) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg class="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <h3>Could not load customer accounts</h3>
                <p>Verify your backend connection or switch to Demo Mode.</p>
            </div>`;
    }
}

function handleCustomerSearch(val) {
    customerSearchTerm = val.toLowerCase().trim();
    renderFilteredCustomers();
}

function filterCustomerType(btn, type) {
    customerTypeFilter = type;
    document.querySelectorAll('.segment-tabs .segment-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderFilteredCustomers();
}

function renderFilteredCustomers() {
    const list = document.getElementById('customers-list');
    if (!list || !window._allCustomers) return;

    let filtered = window._allCustomers.filter(c => {
        const matchSearch =
            !customerSearchTerm ||
            c.name.toLowerCase().includes(customerSearchTerm) ||
            (c.phone && c.phone.includes(customerSearchTerm)) ||
            (c.business_type && c.business_type.toLowerCase().includes(customerSearchTerm));

        const matchType =
            customerTypeFilter === 'all' ||
            (c.business_type && c.business_type.toLowerCase() === customerTypeFilter.toLowerCase());

        return matchSearch && matchType;
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <h3>No customers found</h3>
                <p>Try clearing your search or add a new customer account.</p>
            </div>`;
        return;
    }

    list.innerHTML = filtered.map(c => `
        <div class="card-item customer-card" onclick="openCustomerDetail('${c.id}')">
            <div style="display:flex; align-items:center; gap:14px; min-width:0;">
                <div class="customer-avatar">${c.name.charAt(0).toUpperCase()}</div>
                <div class="customer-info-block">
                    <div class="customer-name">${escapeHtml(c.name)}</div>
                    <div class="customer-sub">
                        <span>${c.business_type || 'Customer'}</span>
                        ${c.phone ? `<span>· 📞 ${escapeHtml(c.phone)}</span>` : ''}
                    </div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                ${c.amount_due > 0 ? `<span class="badge-amount">₹${c.amount_due.toLocaleString('en-IN')} due</span>` : ''}
                ${c.follow_up_date && c.follow_up_date <= today() ? `<span class="badge-followup">Follow up today</span>` : ''}
                <svg class="icon icon-sm" style="color:var(--text-light);" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
        </div>
    `).join('');
}

function openAddCustomerModal() {
    const err = document.getElementById('customer-form-error');
    if (err) err.classList.add('hidden');
    ['c-name', 'c-phone', 'c-type', 'c-amount', 'c-followup', 'c-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const modal = document.getElementById('add-customer-modal');
    if (modal) modal.classList.remove('hidden');
}

async function saveCustomer() {
    const nameInput = document.getElementById('c-name');
    const errEl = document.getElementById('customer-form-error');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        if (errEl) {
            errEl.textContent = 'Customer name is required.';
            errEl.classList.remove('hidden');
        }
        return;
    }

    const data = {
        name,
        phone: document.getElementById('c-phone')?.value.trim() || null,
        business_type: document.getElementById('c-type')?.value || null,
        amount_due: parseFloat(document.getElementById('c-amount')?.value) || null,
        follow_up_date: document.getElementById('c-followup')?.value || null,
        notes: document.getElementById('c-notes')?.value.trim() || null,
    };

    try {
        if (isDemoMode) {
            DEMO_DATA.customers.unshift({ id: 'd' + Date.now(), ...data });
        } else {
            await api.createCustomer(data);
        }
        closeModal('add-customer-modal');
        await loadCustomers();
        showToast('Customer account saved!');
    } catch (e) {
        if (errEl) {
            errEl.textContent = e.message || 'Could not save. Please try again.';
            errEl.classList.remove('hidden');
        }
    }
}

// ── Customer Detail Modal ─────────────────────────────────────────────────────
function openCustomerDetail(id) {
    const customer = (window._allCustomers || []).find(c => c.id === id);
    if (!customer) return;

    const modal = document.getElementById('customer-detail-modal');
    const body = document.getElementById('cd-modal-body');
    const title = document.getElementById('cd-modal-title');
    if (!modal || !body || !title) return;

    title.textContent = customer.name;

    body.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border);">
            <div class="customer-avatar" style="width:52px; height:52px; font-size:1.4rem;">${customer.name.charAt(0).toUpperCase()}</div>
            <div>
                <h3 style="font-size:1.1rem; font-weight:700;">${escapeHtml(customer.name)}</h3>
                <div style="color:var(--text-muted); font-size:0.86rem;">${customer.business_type || 'Customer'} ${customer.phone ? `· ${customer.phone}` : ''}</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
            <div style="background:var(--bg); padding:12px 16px; border-radius:var(--radius-md);">
                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Amount Due</div>
                <div style="font-size:1.3rem; font-weight:700; color:${customer.amount_due > 0 ? 'var(--danger)' : 'var(--text-main)'}; margin-top:2px;">
                    ₹${(customer.amount_due || 0).toLocaleString('en-IN')}
                </div>
            </div>
            <div style="background:var(--bg); padding:12px 16px; border-radius:var(--radius-md);">
                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Follow-up Date</div>
                <div style="font-size:1rem; font-weight:600; color:var(--text-main); margin-top:4px;">
                    ${customer.follow_up_date ? `📅 ${formatDate(customer.follow_up_date)}` : 'Not set'}
                </div>
            </div>
        </div>

        ${customer.notes ? `
            <div style="margin-bottom:20px;">
                <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Notes & Observations</div>
                <div style="background:var(--bg); border-radius:var(--radius-md); padding:12px 14px; font-size:0.9rem; line-height:1.5;">
                    ${escapeHtml(customer.notes)}
                </div>
            </div>
        ` : ''}

        <div style="display:flex; gap:10px;">
            ${customer.phone ? `
                <a href="tel:${customer.phone}" class="btn-primary" style="flex:1; text-decoration:none; justify-content:center;">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    <span>Call Customer</span>
                </a>
            ` : ''}
            <button class="btn-secondary" style="flex:1; justify-content:center;" onclick="closeModal('customer-detail-modal'); navigateTo('ask-eko'); setTimeout(() => { const inp = document.getElementById('eko-input'); if(inp) { inp.value = 'Draft a polite payment reminder for ${escapeHtml(customer.name)} for ₹${customer.amount_due || 0}'; sendToEko(); } }, 200);">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>
                <span>Draft Reminder</span>
            </button>
        </div>
    `;

    modal.classList.remove('hidden');
}
