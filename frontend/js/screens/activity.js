/**
 * Eko Partner Operations — Transaction Operations Center
 * Redesigned for premium mobile monitoring.
 */

let activityRecords = [];

function renderActivityScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Transaction Center</h1>
                <p class="text-sm text-muted">Monitor service health and resolution states.</p>
            </div>
            <button class="icon-btn primary" onclick="showToast('New transaction workflow initiated')" aria-label="New Transaction">
                ${renderIcon('plus', 20)}
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
        listEl.innerHTML = `
            <div class="error-state">
                <div class="error-state-title">Connection Problem</div>
                <div class="error-state-desc">Could not load transaction records. Verified local data is still safe.</div>
            </div>`;
    }
}

function renderActivityList(records) {
    const listEl = document.getElementById('activity-list');
    if (!listEl) return;

    if (!records || records.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${renderIcon('file-text', 24)}</div>
                <h3>No transactions yet</h3>
                <p>Activity will appear here once service processing begins.</p>
            </div>`;
        return;
    }

    listEl.innerHTML = records.map(record => {
        const statusBadge = record.status === 'success' ? 'badge-success' :
                            record.status === 'failed' ? 'badge-danger' : 'badge-warning';

        return `
        <div class="transaction-card" onclick="showActivityDetail('${record.id}')" style="cursor:pointer; margin-bottom:8px;">
            <div class="transaction-icon" style="background:var(--bg); color:var(--primary);">
                ${getServiceIcon(record.service_name)}
            </div>
            <div class="transaction-info">
                <div class="transaction-title">${escapeHtml(record.customer_name || 'Walk-in Customer')}</div>
                <div class="transaction-meta">${record.service_name} • ${formatDateTime(record.created_at)}</div>
                <div style="margin-top:6px;"><span class="badge ${statusBadge}">${record.status}</span></div>
            </div>
            <div class="transaction-amount">₹${record.amount.toLocaleString('en-IN')}</div>
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
        titleEl.textContent = 'Transaction Center';
        bodyEl.innerHTML = `
            <div style="text-align:center; padding-bottom:24px; margin-bottom:24px; border-bottom:1px solid var(--border);">
                <div class="text-xs text-muted font-bold" style="text-transform:uppercase; letter-spacing:0.05em;">Amount Processed</div>
                <div style="font-size:2.5rem; font-weight:800; color:var(--navy); line-height:1.1; margin-top:4px;">₹${record.amount.toLocaleString('en-IN')}</div>
                <div style="margin-top:12px;"><span class="badge ${record.status === 'success' ? 'badge-success' : 'badge-warning'}">${record.status.toUpperCase()}</span></div>
            </div>

            <div class="grid-cols-2" style="gap:20px;">
                <div>
                    <label class="text-xs text-muted font-bold">Service Type</label>
                    <div class="font-semibold text-sm">${record.service_name}</div>
                </div>
                <div>
                    <label class="text-xs text-muted font-bold">Commission</label>
                    <div class="font-bold text-sm text-success">₹${(record.commission || 0).toFixed(2)}</div>
                </div>
                <div>
                    <label class="text-xs text-muted font-bold">Customer</label>
                    <div class="font-semibold text-sm">${escapeHtml(record.customer_name || 'N/A')}</div>
                </div>
                <div>
                    <label class="text-xs text-muted font-bold">Reference ID</label>
                    <div class="text-xs" style="font-family:monospace; color:var(--slate);">${record.reference_id || record.id}</div>
                </div>
            </div>

            ${record.failure_reason ? `
                <div style="margin-top:24px; padding:14px; background:var(--danger-bg); border-radius:var(--radius-md); border:1px solid #FECACA;">
                    <div class="text-xs text-danger font-bold mb-1" style="display:flex; align-items:center; gap:6px;">
                        ${renderIcon('alert-circle', 12)} FAILURE ANALYSIS
                    </div>
                    <div class="text-xs text-danger line-height-relaxed">${escapeHtml(record.failure_reason)}</div>
                </div>
            ` : ''}

            <div style="margin-top:32px; display:flex; flex-direction:column; gap:10px;">
                <button class="btn-primary" onclick="showToast('Receipt printed')">
                    ${renderIcon('printer', 18)}
                    <span>Print Transaction Receipt</span>
                </button>
                <button class="btn-secondary" onclick="navigateTo('grievances'); closeModal('customer-detail-modal');">
                    ${renderIcon('message-square-warning', 18)}
                    <span>Raise Support Dispute</span>
                </button>
            </div>
        `;
        modal.classList.remove('hidden');
        lucide.createIcons();
    }
}
