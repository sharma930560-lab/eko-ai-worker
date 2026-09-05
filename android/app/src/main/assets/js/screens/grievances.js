/**
 * Eko AI Operations — Grievance & Escalation Center
 */

let complaintRecords = [];

function renderGrievancesScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Grievance Center</h1>
                <p class="text-sm text-muted">Track complaints, investigations, and resolution SLAs.</p>
            </div>
            <button class="btn-primary" onclick="openAddComplaintModal()">
                ${renderIcon('message-square-plus', 18)}
                <span>New Complaint</span>
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
        listEl.innerHTML = `<div class="empty-state"><p>Could not load grievances.</p></div>`;
    }
}

function renderComplaintList(records) {
    const listEl = document.getElementById('complaints-list');
    if (!listEl) return;

    if (!records || records.length === 0) {
        listEl.innerHTML = `<div class="empty-state"><h3>All clear!</h3><p>No active grievances reported.</p></div>`;
        return;
    }

    listEl.innerHTML = records.map(c => {
        const slaText = c.sla_hours_remaining !== null
            ? (c.sla_hours_remaining > 0
                ? `<span style="display:inline-flex; align-items:center; gap:4px;">${renderIcon('clock', 12)} ${Math.floor(c.sla_hours_remaining)}h ${Math.round((c.sla_hours_remaining % 1) * 60)}m left</span>`
                : `<span class="text-danger font-bold" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon('alert-octagon', 12)} OVERDUE (${Math.abs(Math.floor(c.sla_hours_remaining))}h)</span>`)
            : 'SLA Met';

        return `
        <div class="card-item" onclick="showComplaintDetail('${c.id}')">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                <div>
                    <div class="font-bold text-main">${escapeHtml(c.subject)}</div>
                    <div class="text-xs text-muted mt-1">ID: ${c.id} • Registered ${formatDate(c.created_at)}</div>
                    <div class="text-xs mt-2 font-semibold" style="color:var(--primary);">${slaText}</div>
                </div>
                <div style="text-align:right;">
                    <span class="badge ${c.status === 'resolved' ? 'badge-success' : 'badge-warning'}">${c.status}</span>
                </div>
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
    showToast('Detailed grievance tracking coming in v2.1', 'info');
}
