/**
 * Eko Partner Operations — Complaints & Escalations
 * SLA tracking, connected transaction drill-down, and resolution workflows.
 */

let complaintRecords = [];
let _complaintFilter = 'all';
let _complaintSearchTerm = '';

function renderGrievancesScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Complaints &amp; Grievances</h1>
                <p class="text-sm text-muted">Track resolution SLAs, linked transactions, and escalations.</p>
            </div>
            <button class="btn-primary" onclick="openCreateComplaintModal()" style="display:flex; align-items:center; gap:8px;" aria-label="New Complaint">
                ${renderIcon('message-square-plus', 16)}
                <span>New Complaint</span>
            </button>
        </div>

        <div class="search-bar mb-4">
            <i data-lucide="search" class="search-bar-icon"></i>
            <input type="text" id="comp-search-input" class="form-input" placeholder="Search complaint by subject, ID, or customer..." oninput="handleComplaintSearch(this.value)">
        </div>

        <div class="filter-tabs mb-4">
            <button class="filter-tab active" data-status="all" onclick="filterComplaintTab('all')">
                All <span class="tab-count" id="comp-count-all">0</span>
            </button>
            <button class="filter-tab" data-status="pending" onclick="filterComplaintTab('pending')">
                Pending <span class="tab-count" id="comp-count-pending">0</span>
            </button>
            <button class="filter-tab" data-status="in_progress" onclick="filterComplaintTab('in_progress')">
                In Progress <span class="tab-count" id="comp-count-inprogress">0</span>
            </button>
            <button class="filter-tab" data-status="resolved" onclick="filterComplaintTab('resolved')">
                Resolved <span class="tab-count" id="comp-count-resolved">0</span>
            </button>
        </div>

        <div id="complaints-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>

    <!-- Create Complaint Modal -->
    <div id="create-complaint-modal" class="modal-overlay hidden">
        <div class="modal-card">
            <div class="modal-header">
                <h2 id="create-comp-modal-title">File Operational Complaint</h2>
                <button class="modal-close" onclick="closeModal('create-complaint-modal')" aria-label="Close">${renderIcon('x', 16)}</button>
            </div>
            <div class="modal-body">
                <form id="create-complaint-form" onsubmit="submitCreateComplaint(event)">
                    <input type="hidden" id="comp-txn-id" name="transaction_id">
                    <input type="hidden" id="comp-cust-id" name="customer_id">
                    
                    <div id="comp-context-banner" class="card mb-3 hidden" style="padding:10px 14px; background:var(--primary-light); border-color:var(--primary-subtle);">
                        <div class="text-xs text-primary font-bold">LINKED CONTEXT</div>
                        <div class="text-xs text-main mt-1" id="comp-context-text"></div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Subject / Issue Title *</label>
                        <input id="comp-subject" name="subject" class="form-input" placeholder="e.g. DMT payout failed but bank debited" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Issue Details &amp; Observation</label>
                        <textarea id="comp-description" name="description" class="form-input" rows="3" placeholder="Describe what happened, any bank error codes, or customer statement..."></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Priority Level</label>
                        <select id="comp-priority" name="priority" class="form-input">
                            <option value="medium">Medium (48h SLA)</option>
                            <option value="high" selected>High (24h SLA)</option>
                            <option value="urgent">Urgent (4h SLA)</option>
                        </select>
                    </div>

                    <div class="modal-footer" style="padding:16px 0 0; border-top:1px solid var(--border); margin-top:20px;">
                        <button type="button" class="btn-ghost" onclick="closeModal('create-complaint-modal')">Cancel</button>
                        <button type="submit" class="btn-primary" id="btn-save-comp">Submit Complaint</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    `;
}

async function loadGrievances() {
    const listEl = document.getElementById('complaints-list');
    if (!listEl) return;

    try {
        complaintRecords = await api.getComplaints();
        updateComplaintTabCounts();
        renderFilteredComplaints();
    } catch (e) {
        listEl.innerHTML = `
            <div class="error-state">
                <div class="error-state-title">Loading Failed</div>
                <div class="error-state-desc">Could not fetch active complaints. Cached data remains safe.</div>
            </div>`;
    }
}

function handleComplaintSearch(val) {
    _complaintSearchTerm = val.toLowerCase().trim();
    renderFilteredComplaints();
}

function filterComplaintTab(tab) {
    _complaintFilter = tab;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.status === tab);
    });
    renderFilteredComplaints();
}

function updateComplaintTabCounts() {
    const total = complaintRecords.length;
    const pending = complaintRecords.filter(c => c.status === 'pending' || c.status === 'open').length;
    const inProgress = complaintRecords.filter(c => c.status === 'in_progress').length;
    const resolved = complaintRecords.filter(c => c.status === 'resolved' || c.status === 'closed').length;

    const elAll = document.getElementById('comp-count-all');
    const elPending = document.getElementById('comp-count-pending');
    const elInProgress = document.getElementById('comp-count-inprogress');
    const elResolved = document.getElementById('comp-count-resolved');

    if (elAll) elAll.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elInProgress) elInProgress.textContent = inProgress;
    if (elResolved) elResolved.textContent = resolved;
}

function renderFilteredComplaints() {
    const listEl = document.getElementById('complaints-list');
    if (!listEl) return;

    let filtered = complaintRecords.filter(c => {
        const status = (c.status || '').toLowerCase();
        let matchesTab = true;
        if (_complaintFilter === 'pending') matchesTab = (status === 'pending' || status === 'open');
        else if (_complaintFilter === 'in_progress') matchesTab = (status === 'in_progress');
        else if (_complaintFilter === 'resolved') matchesTab = (status === 'resolved' || status === 'closed');

        const matchesSearch = !_complaintSearchTerm ||
            (c.subject && c.subject.toLowerCase().includes(_complaintSearchTerm)) ||
            (c.id && c.id.toLowerCase().includes(_complaintSearchTerm)) ||
            (c.customer_name && c.customer_name.toLowerCase().includes(_complaintSearchTerm));

        return matchesTab && matchesSearch;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${renderIcon('check-circle', 28, 'text-success')}</div>
                <h3>No complaints</h3>
                <p>${_complaintSearchTerm ? 'No complaints match your search query.' : 'All customer accounts and services are currently clear!'}</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    listEl.innerHTML = filtered.map(c => {
        const isResolved = c.status === 'resolved' || c.status === 'closed';
        let slaHtml = '';
        if (c.sla_hours_remaining !== null && !isResolved) {
            const isOverdue = c.sla_hours_remaining < 0;
            const absHours = Math.abs(Math.floor(c.sla_hours_remaining));
            const absMins = Math.round((Math.abs(c.sla_hours_remaining) % 1) * 60);
            const slaClass = isOverdue ? 'badge-danger' : (c.sla_hours_remaining < 12 ? 'badge-warning' : 'badge-info');
            const label = isOverdue ? 'OVERDUE' : 'SLA';
            slaHtml = `<span class="badge ${slaClass}">${label}: ${absHours}h ${absMins}m ${isOverdue ? 'ago' : 'left'}</span>`;
        } else if (isResolved) {
            slaHtml = `<span class="badge badge-success">Resolved</span>`;
        }

        const priorityBadge = c.priority === 'urgent' ? 'badge-danger' :
                              c.priority === 'high' ? 'badge-warning' : 'badge-neutral';

        return `
        <div class="card-item" onclick="showComplaintDetail('${c.id}')" style="cursor:pointer; padding:16px; align-items:flex-start;">
            <div style="flex:1; min-width:0;">
                <div class="font-bold text-main" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.95rem;">
                    ${escapeHtml(c.subject)}
                </div>
                <div class="text-xs text-muted mt-1">
                    ID: ${c.id.slice(0,8)} · ${formatDate(c.created_at)}
                    ${c.customer_name ? `· ${escapeHtml(c.customer_name)}` : ''}
                </div>
                <div class="mt-2" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    ${slaHtml}
                    <span class="badge ${c.status === 'in_progress' ? 'badge-info' : 'badge-neutral'}">${c.status || 'open'}</span>
                </div>
            </div>
            <div style="text-align:right; flex-shrink:0;">
                <span class="badge ${priorityBadge}">${c.priority || 'medium'}</span>
            </div>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

async function showComplaintDetail(id) {
    const modal = document.getElementById('customer-detail-modal');
    const bodyEl = document.getElementById('cd-modal-body');
    const titleEl = document.getElementById('cd-modal-title');
    if (!modal || !bodyEl || !titleEl) return;

    titleEl.textContent = 'Complaint Details';
    bodyEl.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    modal.classList.remove('hidden');

    try {
        const c = await api.getComplaintDetail(id);
        const isResolved = c.status === 'resolved' || c.status === 'closed';

        bodyEl.innerHTML = `
            <div style="margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                    <h3 style="font-size:1.15rem; font-weight:800; color:var(--navy);">${escapeHtml(c.subject)}</h3>
                    <span class="badge ${c.priority === 'urgent' ? 'badge-danger' : 'badge-warning'}">${c.priority}</span>
                </div>
                <div class="text-xs text-muted mt-2">
                    Reported on ${formatDateTime(c.created_at)} · Status: <strong>${c.status}</strong>
                </div>
            </div>

            ${c.description ? `
                <div class="form-group">
                    <label class="text-xs text-muted font-bold">DESCRIPTION</label>
                    <div class="card mt-1" style="background:var(--bg); border:none; font-size:0.85rem; line-height:1.6;">
                        ${escapeHtml(c.description)}
                    </div>
                </div>
            ` : ''}

            <!-- SLA Timer -->
            <div class="card mb-4" style="padding:14px; background:var(--bg); border-left:4px solid ${isResolved ? 'var(--success)' : (c.sla_hours_remaining < 0 ? 'var(--danger)' : 'var(--warning)')};">
                <div class="text-xs font-bold text-muted">SLA RESOLUTION TIMELINE</div>
                <div class="font-bold text-sm mt-1" style="color:${isResolved ? 'var(--success)' : (c.sla_hours_remaining < 0 ? 'var(--danger)' : 'var(--navy)')};">
                    ${isResolved ? 'Resolved' : (c.sla_hours_remaining < 0 ? `OVERDUE by ${Math.abs(Math.round(c.sla_hours_remaining))} hours` : `${Math.round(c.sla_hours_remaining)} hours remaining`)}
                </div>
            </div>

            <!-- Linked Transaction -->
            ${c.transaction ? `
                <div class="card mb-4" style="padding:14px; border:1px solid var(--border);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="text-xs font-bold text-primary">${renderIcon('arrow-left-right', 12)} LINKED TRANSACTION</span>
                        <span class="badge ${c.transaction.status === 'success' ? 'badge-success' : 'badge-danger'}" style="font-size:0.6rem;">${c.transaction.status}</span>
                    </div>
                    <div class="font-bold text-sm">${serviceName(c.transaction.service_name)} · ₹${(c.transaction.amount || 0).toLocaleString('en-IN')}</div>
                    <div class="text-xs text-muted mt-1">Ref: ${c.transaction.reference_id || c.transaction.id}</div>
                    ${c.transaction.failure_reason ? `<div class="text-xs text-danger mt-1">${escapeHtml(c.transaction.failure_reason)}</div>` : ''}
                    <button class="btn-ghost mt-3" style="font-size:0.75rem; padding:4px 10px;" onclick="closeModal('customer-detail-modal'); showActivityDetail('${c.transaction.id}');">
                        ${renderIcon('external-link', 12)} View Full Transaction Record
                    </button>
                </div>
            ` : ''}

            <!-- Linked Customer -->
            ${c.customer ? `
                <div class="card mb-4" style="padding:12px 14px; background:var(--bg); border:none;">
                    <div class="text-xs font-bold text-muted">PARTNER / CUSTOMER</div>
                    <div class="font-bold text-sm mt-1">${escapeHtml(c.customer.name)} (${escapeHtml(c.customer.phone || 'No phone')})</div>
                </div>
            ` : ''}

            <!-- Action Buttons -->
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                ${!isResolved ? `
                    <button class="btn-primary" style="background:var(--success); border-color:var(--success);" onclick="resolveComplaint('${c.id}')">
                        ${renderIcon('check-circle', 16)} Mark as Resolved
                    </button>
                    <button class="btn-secondary" onclick="escalateComplaint('${c.id}')">
                        ${renderIcon('alert-triangle', 16)} Escalate to Operations Head
                    </button>
                ` : `
                    <button class="btn-secondary" onclick="reopenComplaint('${c.id}')">
                        ${renderIcon('rotate-ccw', 16)} Re-open Complaint
                    </button>
                `}
                <button class="btn-ghost" onclick="closeModal('customer-detail-modal'); navigateTo('ask-eko'); sendToEko(null, 'Draft support message for complaint ${c.id}: ${c.subject}');">
                    ${renderIcon('sparkles', 16)} Ask Eko to Draft Customer Response
                </button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    } catch(e) {
        bodyEl.innerHTML = `<div class="error-state"><div class="error-state-title">Failed to load complaint</div><div class="text-sm text-muted">${escapeHtml(e.message || 'Error')}</div></div>`;
    }
}

async function resolveComplaint(id) {
    try {
        await api.updateComplaint(id, { status: 'resolved' });
        showToast('Complaint resolved successfully!', 'success');
        closeModal('customer-detail-modal');
        loadGrievances();
        if (typeof loadHomeScreen === 'function') loadHomeScreen();
    } catch(err) {
        showToast('Failed to resolve complaint: ' + (err.message || 'Error'), 'error');
    }
}

async function escalateComplaint(id) {
    try {
        await api.updateComplaint(id, { priority: 'urgent', status: 'in_progress' });
        showToast('Complaint escalated to Urgent status!', 'warning');
        closeModal('customer-detail-modal');
        loadGrievances();
    } catch(err) {
        showToast('Escalation failed: ' + (err.message || 'Error'), 'error');
    }
}

async function reopenComplaint(id) {
    try {
        await api.updateComplaint(id, { status: 'pending' });
        showToast('Complaint re-opened.', 'info');
        closeModal('customer-detail-modal');
        loadGrievances();
    } catch(err) {
        showToast('Action failed: ' + (err.message || 'Error'), 'error');
    }
}

function openCreateComplaintModal(txnId = null, customerId = null, customerName = null) {
    const modal = document.getElementById('create-complaint-modal');
    if (!modal) return;

    const txnInput = document.getElementById('comp-txn-id');
    const custInput = document.getElementById('comp-cust-id');
    const banner = document.getElementById('comp-context-banner');
    const bannerText = document.getElementById('comp-context-text');
    const subjInput = document.getElementById('comp-subject');

    if (txnInput) txnInput.value = txnId || '';
    if (custInput) custInput.value = customerId || '';

    if (txnId || customerId) {
        if (banner && bannerText) {
            banner.classList.remove('hidden');
            bannerText.textContent = `Auto-linked: ${customerName ? 'Partner: ' + customerName : ''} ${txnId ? '(Txn ID: ' + txnId.slice(0,8) + ')' : ''}`;
        }
        if (subjInput && !subjInput.value) {
            subjInput.value = `Dispute for failed transaction ${txnId ? txnId.slice(0,8) : ''}`;
        }
    } else {
        if (banner) banner.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

async function submitCreateComplaint(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-comp');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

    const form = e.target;
    const f = new FormData(form);

    try {
        await api.createComplaint({
            subject: f.get('subject'),
            description: f.get('description'),
            priority: f.get('priority') || 'medium',
            transaction_id: f.get('transaction_id') || null,
            customer_id: f.get('customer_id') || null
        });

        closeModal('create-complaint-modal');
        form.reset();
        showToast('Complaint filed and SLA countdown started!', 'success');
        loadGrievances();
        if (typeof loadHomeScreen === 'function') loadHomeScreen();
    } catch(err) {
        showToast('Failed to file complaint: ' + (err.message || 'Unknown error'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Complaint'; }
    }
}

window.renderGrievancesScreen = renderGrievancesScreen;
window.loadGrievances = loadGrievances;
window.showComplaintDetail = showComplaintDetail;
window.openCreateComplaintModal = openCreateComplaintModal;
window.resolveComplaint = resolveComplaint;
window.escalateComplaint = escalateComplaint;
window.reopenComplaint = reopenComplaint;
window.submitCreateComplaint = submitCreateComplaint;
