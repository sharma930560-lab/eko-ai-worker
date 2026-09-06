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
                <div class="card mb-4" style="padding:12px 14px; background:var(--bg); border:none; cursor:pointer;" onclick="closeModal('customer-detail-modal'); if (typeof openPartnerProfile === 'function') openPartnerProfile('${c.customer.id}');">
                    <div class="text-xs font-bold text-muted">PARTNER / CUSTOMER</div>
                    <div class="font-bold text-sm mt-1" style="color:var(--primary);">${escapeHtml(c.customer.name)} (${escapeHtml(c.customer.phone || 'No phone')}) ↗</div>
                </div>
            ` : ''}

            <!-- Operational Controls (Assign, Status, Category) -->
            <div class="card mb-4" style="padding:14px; background:var(--bg); border:1px solid var(--border);">
                <div class="text-xs font-bold text-muted mb-2 uppercase tracking-wider">Operational Controls</div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-muted font-bold mb-1 block">ASSIGNED OWNER</label>
                        <select class="form-input" style="font-size:12px; padding:6px 10px;" onchange="assignComplaintOwner('${c.id}', this.value)">
                            <option value="Unassigned" ${!c.assigned_to || c.assigned_to === 'Unassigned' ? 'selected' : ''}>Unassigned</option>
                            <option value="Rohan Sharma (Field Lead)" ${c.assigned_to === 'Rohan Sharma (Field Lead)' ? 'selected' : ''}>Rohan Sharma (Field Lead)</option>
                            <option value="Deepak Verma (Switch Ops)" ${c.assigned_to === 'Deepak Verma (Switch Ops)' ? 'selected' : ''}>Deepak Verma (Switch Ops)</option>
                            <option value="Priya Mehta (Reconciliation)" ${c.assigned_to === 'Priya Mehta (Reconciliation)' ? 'selected' : ''}>Priya Mehta (Reconciliation)</option>
                            <option value="Amit Joshi (Customer Support)" ${c.assigned_to === 'Amit Joshi (Customer Support)' ? 'selected' : ''}>Amit Joshi (Customer Support)</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-muted font-bold mb-1 block">UPDATE STATUS</label>
                        <select class="form-input" style="font-size:12px; padding:6px 10px;" onchange="changeComplaintStatus('${c.id}', this.value)">
                            <option value="open" ${c.status === 'open' ? 'selected' : ''}>Open</option>
                            <option value="in_progress" ${c.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="waiting_for_customer" ${c.status === 'waiting_for_customer' ? 'selected' : ''}>Waiting for Customer</option>
                            <option value="escalated" ${c.status === 'escalated' ? 'selected' : ''}>Escalated</option>
                            <option value="resolved" ${c.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                            <option value="closed" ${c.status === 'closed' ? 'selected' : ''}>Closed</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Resolution Note (if present) -->
            ${c.resolution_note ? `
                <div class="card mb-4" style="padding:14px; background:rgba(16,185,129,0.08); border-left:4px solid var(--success);">
                    <div class="text-xs font-bold text-success mb-1">${renderIcon('check-circle', 12)} RESOLUTION NOTE</div>
                    <div class="text-xs" style="color:var(--text-main); line-height:1.5;">${escapeHtml(c.resolution_note)}</div>
                </div>
            ` : ''}

            <!-- Investigation Timeline & Operational Notes -->
            <div class="card mb-4" style="padding:14px; border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span class="text-xs font-bold text-muted uppercase tracking-wider">${renderIcon('clock', 12)} INVESTIGATION LOG &amp; NOTES</span>
                    <span class="badge badge-neutral" style="font-size:10px;">${(c.timeline_json ? JSON.parse(c.timeline_json || '[]').length : 0)} Notes</span>
                </div>
                <div id="comp-notes-container" style="display:flex; flex-direction:column; gap:8px; max-height:180px; overflow-y:auto; margin-bottom:12px;">
                    ${(() => {
                        let parsedNotes = [];
                        try { parsedNotes = c.timeline_json ? JSON.parse(c.timeline_json) : []; } catch(e) { parsedNotes = []; }
                        if (parsedNotes.length === 0) {
                            return `<div class="text-xs text-muted py-1">No operational notes yet. Add first investigation entry below.</div>`;
                        }
                        return parsedNotes.map(n => `
                            <div style="background:var(--bg); padding:8px 10px; border-radius:6px; font-size:12px;">
                                <div style="display:flex; justify-content:space-between; color:var(--text-muted); font-size:10px; margin-bottom:2px;">
                                    <strong>${escapeHtml(n.author || 'Operator')}</strong>
                                    <span>${formatDateTime(n.created_at)}</span>
                                </div>
                                <div>${escapeHtml(n.note || n.message || '')}</div>
                            </div>
                        `).join('');
                    })()}
                </div>
                <div style="display:flex; gap:6px;">
                    <input type="text" id="new-comp-note-input" class="form-input" placeholder="Add investigation or follow-up note..." style="font-size:12px;">
                    <button class="btn-secondary" style="font-size:12px; white-space:nowrap;" onclick="submitComplaintNote('${c.id}')">
                        ${renderIcon('plus', 12)} Add Note
                    </button>
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                ${!isResolved ? `
                    <div style="display:flex; gap:10px;">
                        <button class="btn-primary" style="flex:1; background:var(--success); border-color:var(--success);" onclick="promptResolveComplaint('${c.id}')">
                            ${renderIcon('check-circle', 16)} Mark as Resolved
                        </button>
                        <button class="btn-secondary" style="flex:1;" onclick="escalateComplaint('${c.id}')">
                            ${renderIcon('alert-triangle', 16)} Escalate (Urgent)
                        </button>
                    </div>
                ` : `
                    <button class="btn-secondary" onclick="reopenComplaint('${c.id}')">
                        ${renderIcon('rotate-ccw', 16)} Re-open Complaint
                    </button>
                `}
                <button class="btn-ghost" onclick="closeModal('customer-detail-modal'); if (typeof setAiContext === 'function') setAiContext({ complaint_id: '${c.id}', customer_id: '${c.customer_id || ''}', label: 'Complaint' }); navigateTo('ask-eko'); sendToEko(null, 'Draft support message for complaint ${c.id}: ${escapeHtml(c.subject).replace(/'/g, "\\'")}');">
                    ${renderIcon('sparkles', 16)} Ask Eko to Draft Customer Response
                </button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    } catch(e) {
        bodyEl.innerHTML = `<div class="error-state"><div class="error-state-title">Failed to load complaint</div><div class="text-sm text-muted">${escapeHtml(e.message || 'Error')}</div></div>`;
    }
}

async function assignComplaintOwner(id, owner) {
    try {
        await api.updateComplaint(id, { assigned_to: owner });
        showToast(`Assigned to ${owner}`, 'success');
        loadGrievances();
    } catch(err) {
        showToast('Assignment failed: ' + (err.message || 'Error'), 'error');
    }
}

async function changeComplaintStatus(id, newStatus) {
    try {
        await api.updateComplaint(id, { status: newStatus });
        showToast(`Status updated to ${newStatus}`, 'success');
        loadGrievances();
    } catch(err) {
        showToast('Status update failed: ' + (err.message || 'Error'), 'error');
    }
}

async function submitComplaintNote(id) {
    const input = document.getElementById('new-comp-note-input');
    if (!input || !input.value.trim()) return;
    const noteText = input.value.trim();
    try {
        await api.addComplaintNote(id, { note: noteText, author: currentUser?.name || 'Operator' });
        input.value = '';
        showToast('Operational note recorded.', 'success');
        showComplaintDetail(id);
    } catch(err) {
        showToast('Failed to add note: ' + (err.message || 'Error'), 'error');
    }
}

async function promptResolveComplaint(id) {
    const note = prompt("Enter resolution notes for audit closure (e.g. Beneficiary account credited or refund initiated):", "Transaction reconciled with bank switch and credited to beneficiary account.");
    if (note === null) return;
    try {
        await api.updateComplaint(id, { status: 'resolved', resolution_note: note });
        showToast('Complaint marked as resolved!', 'success');
        closeModal('customer-detail-modal');
        loadGrievances();
        if (typeof loadHomeScreen === 'function') loadHomeScreen();
    } catch(err) {
        showToast('Resolution failed: ' + (err.message || 'Error'), 'error');
    }
}

async function resolveComplaint(id) {
    promptResolveComplaint(id);
}

async function escalateComplaint(id) {
    try {
        await api.updateComplaint(id, { priority: 'urgent', status: 'escalated' });
        showToast('Complaint escalated to Urgent status!', 'warning');
        showComplaintDetail(id);
        loadGrievances();
    } catch(err) {
        showToast('Escalation failed: ' + (err.message || 'Error'), 'error');
    }
}

async function reopenComplaint(id) {
    try {
        await api.updateComplaint(id, { status: 'open' });
        showToast('Complaint re-opened.', 'info');
        showComplaintDetail(id);
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
window.promptResolveComplaint = promptResolveComplaint;
window.escalateComplaint = escalateComplaint;
window.reopenComplaint = reopenComplaint;
window.assignComplaintOwner = assignComplaintOwner;
window.changeComplaintStatus = changeComplaintStatus;
window.submitComplaintNote = submitComplaintNote;
window.submitCreateComplaint = submitCreateComplaint;
