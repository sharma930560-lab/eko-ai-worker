/**
 * Eko Partner Operations — Grievance & Escalation Center
 * Track complaints, investigations, and resolution SLAs.
 */

let complaintRecords = [];

function renderGrievancesScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Grievance Center</h1>
                <p class="text-sm text-muted">Track complaints and resolution SLAs.</p>
            </div>
            <button class="icon-btn primary" onclick="openAddComplaintModal()" aria-label="New Complaint">
                ${renderIcon('message-square-plus', 20)}
            </button>
        </div>

        <div id="complaints-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>`;
}

async function loadGrievances() {
    const listEl = document.getElementById('complaints-list');
    if (!listEl) return;

    try {
        complaintRecords = await api.getComplaints();
        renderComplaintList(complaintRecords);
    } catch (e) {
        listEl.innerHTML = `
            <div class="error-state">
                <div class="error-state-title">Loading Failed</div>
                <div class="error-state-desc">Could not fetch active grievances. Ensure you are signed in correctly.</div>
            </div>`;
    }
}

function renderComplaintList(records) {
    const listEl = document.getElementById('complaints-list');
    if (!listEl) return;

    if (!records || records.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${renderIcon('check-circle', 24)}</div>
                <h3>All clear!</h3>
                <p>No active grievances or complaints reported for your account.</p>
            </div>`;
        return;
    }

    listEl.innerHTML = records.map(c => {
        let slaHtml = '';
        if (c.sla_hours_remaining !== null && c.status !== 'closed') {
            const isOverdue = c.sla_hours_remaining < 0;
            const absHours = Math.abs(Math.floor(c.sla_hours_remaining));
            const absMins = Math.round((Math.abs(c.sla_hours_remaining) % 1) * 60);

            const slaClass = isOverdue ? 'sla-overdue' : (c.sla_hours_remaining < 12 ? 'sla-warning' : 'sla-ok');
            const label = isOverdue ? 'OVERDUE' : 'SLA';

            slaHtml = `<span class="sla-countdown ${slaClass}">${label}: ${absHours}h ${absMins}m ${isOverdue ? 'ago' : 'left'}</span>`;
        } else {
            slaHtml = `<span class="badge badge-success">Resolved</span>`;
        }

        return `
        <div class="card-item" onclick="showComplaintDetail('${c.id}')" style="cursor:pointer; padding:16px; align-items:flex-start;">
            <div style="flex:1; min-width:0;">
                <div class="font-bold text-main" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.subject)}</div>
                <div class="text-xs text-muted mt-1">ID: ${c.id} • ${formatDate(c.created_at)}</div>
                <div class="mt-3">${slaHtml}</div>
            </div>
            <div style="text-align:right;">
                <span class="badge ${c.priority === 'urgent' ? 'badge-danger' : (c.priority === 'high' ? 'badge-warning' : 'badge-neutral')}">${c.priority}</span>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function openAddComplaintModal() {
    showToast('Redirect to Customer Timeline to link complaint', 'info');
    navigateTo('customers');
}

function showComplaintDetail(id) {
    showToast('Detailed grievance tracking (In development)', 'info');
}
