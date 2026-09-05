/**
 * Eko AI Operations — Transaction Operations Center
 */

let activityRecords = [];

function renderActivityScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Transaction Center</h1>
                <p class="text-sm text-muted">Monitor service health and resolve operational issues.</p>
            </div>
            <button class="btn-primary" onclick="showToast('New transaction workflow initiated')">
                ${renderIcon('plus', 18)}
                <span>New Transaction</span>
            </button>
        </div>

        <div id="activity-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>`;
}

async function loadActivity() {
    const listEl = document.getElementById('activity-list');
    if (!listEl) return;

    try {
        activityRecords = await api.getActivity();
        renderActivityList(activityRecords);
    } catch (e) {
        listEl.innerHTML = `<div class="empty-state"><p>Could not load transaction logs.</p></div>`;
    }
}

function renderActivityList(records) {
    const listEl = document.getElementById('activity-list');
    if (!listEl) return;

    if (!records || records.length === 0) {
        listEl.innerHTML = `<div class="empty-state"><h3>No transactions yet</h3></div>`;
        return;
    }

    listEl.innerHTML = records.map(record => {
        const statusClass = record.status === 'success' ? 'badge-success' :
                            record.status === 'failed' ? 'badge-danger' : 'badge-warning';

        return `
        <div class="card-item" onclick="showActivityDetail('${record.id}')">
            <div style="display:flex; align-items:center; gap:16px; width:100%;">
                <div class="customer-avatar" style="background:var(--bg); color:var(--primary);">
                    ${getServiceIcon(record.service_name)}
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <span class="font-bold text-main" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(record.customer_name || 'Walk-in Customer')}</span>
                        <span class="font-bold text-main">₹${record.amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <span class="text-xs text-muted">${record.service_name} • ${formatDateTime(record.created_at)}</span>
                        <span class="badge ${statusClass}" style="font-size:0.6rem;">${record.status}</span>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function getServiceIcon(service) {
    const s = (service || '').toLowerCase();
    if (s.includes('dmt')) return renderIcon('send', 18);
    if (s.includes('aeps')) return renderIcon('fingerprint', 18);
    if (s.includes('bill')) return renderIcon('receipt', 18);
    return renderIcon('arrow-left-right', 18);
}

function showActivityDetail(id) {
    const record = activityRecords.find(r => r.id === id);
    if (!record) return;

    const modal = document.getElementById('customer-detail-modal');
    const bodyEl = document.getElementById('cd-modal-body');
    const titleEl = document.getElementById('cd-modal-title');

    if (modal && bodyEl) {
        titleEl.textContent = 'Transaction Lifecycle';
        bodyEl.innerHTML = `
            <div style="text-align:center; padding-bottom:24px; margin-bottom:24px; border-bottom:1px solid var(--border);">
                <div class="text-xs text-muted font-bold" style="text-transform:uppercase;">Amount Processed</div>
                <div style="font-size:2.5rem; font-weight:800; color:var(--navy); line-height:1.2;">₹${record.amount.toLocaleString('en-IN')}</div>
                <div class="badge ${record.status === 'success' ? 'badge-success' : 'badge-warning'}" style="margin-top:12px;">${record.status.toUpperCase()}</div>
            </div>

            <div class="grid-cols-2" style="gap:24px;">
                <div>
                    <label class="text-xs text-muted font-bold">Service</label>
                    <div class="font-semibold">${record.service_name}</div>
                </div>
                <div>
                    <label class="text-xs text-muted font-bold">Commission</label>
                    <div class="font-semibold text-success">₹${(record.commission || 0).toFixed(2)}</div>
                </div>
                <div>
                    <label class="text-xs text-muted font-bold">Customer</label>
                    <div class="font-semibold">${escapeHtml(record.customer_name || 'N/A')}</div>
                </div>
                <div>
                    <label class="text-xs text-muted font-bold">Ref ID</label>
                    <div class="text-xs" style="font-family:monospace;">${record.reference_id || record.id}</div>
                </div>
            </div>

            ${record.failure_reason ? `
                <div style="margin-top:24px; padding:12px; background:var(--danger-bg); border-radius:var(--radius-md); border:1px solid var(--border);">
                    <div class="text-xs text-danger font-bold mb-1">FAILURE REASON</div>
                    <div class="text-sm text-danger">${escapeHtml(record.failure_reason)}</div>
                </div>
            ` : ''}

            <div style="margin-top:32px; display:flex; flex-direction:column; gap:10px;">
                <button class="btn-primary" onclick="showToast('Receipt printed')">
                    ${renderIcon('printer', 18)}
                    <span>Print Digital Receipt</span>
                </button>
                <button class="btn-secondary" onclick="navigateTo('grievances'); closeModal('customer-detail-modal');">
                    ${renderIcon('alert-triangle', 18)}
                    <span>Raise Operational Dispute</span>
                </button>
            </div>
        `;
        modal.classList.remove('hidden');
        lucide.createIcons();
    }
}
