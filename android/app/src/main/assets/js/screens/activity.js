/**
 * Eko Partner Operations — Transaction Center
 * Real-time monitoring with filter tabs, search, detail view, and linked complaint creation.
 */

let activityRecords = [];
let _activityFilter = 'all';
let _activitySearchTerm = '';

function renderActivityScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Transaction Center</h1>
                <p class="text-sm text-muted">Real-time monitoring and resolution workflows.</p>
            </div>
            <button class="btn-primary" onclick="openServiceFlow('dmt')" style="display:flex; align-items:center; gap:8px;" aria-label="New Transaction">
                ${renderIcon('plus', 16)}
                <span>New Transaction</span>
            </button>
        </div>

        <div class="search-bar mb-4">
            <i data-lucide="search" class="search-bar-icon"></i>
            <input type="text" id="txn-search-input" class="form-input" placeholder="Search by ID, customer name, service, or amount..." oninput="handleActivitySearch(this.value)">
        </div>

        <div class="filter-tabs mb-4">
            <button class="filter-tab active" data-filter="all" onclick="filterActivityTab('all')">
                All <span class="tab-count" id="count-all">0</span>
            </button>
            <button class="filter-tab" data-filter="success" onclick="filterActivityTab('success')">
                Success <span class="tab-count" id="count-success">0</span>
            </button>
            <button class="filter-tab" data-filter="pending" onclick="filterActivityTab('pending')">
                Pending <span class="tab-count" id="count-pending">0</span>
            </button>
            <button class="filter-tab" data-filter="failed" onclick="filterActivityTab('failed')">
                Failed <span class="tab-count" id="count-failed">0</span>
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
        if (Array.isArray(activityRecords) && activityRecords.length > 0) {
            try {
                localStorage.setItem('eko_cached_activity', JSON.stringify(activityRecords));
            } catch (_) {}
        }
        updateActivityTabCounts();
        renderFilteredActivity();
    } catch (e) {
        console.warn('loadActivity: backend API call failed, attempting cached fallback', e);
        let cached = null;
        try {
            const raw = localStorage.getItem('eko_cached_activity');
            if (raw) cached = JSON.parse(raw);
        } catch (_) {}

        if (Array.isArray(cached) && cached.length > 0) {
            activityRecords = cached;
            updateActivityTabCounts();
            renderFilteredActivity();
            return;
        }

        listEl.innerHTML = `
            <div class="error-state">
                <div class="error-state-title">Connection Problem</div>
                <div class="error-state-desc">Could not load transactions. Cached data remains safe.</div>
            </div>`;
    }
}

function handleActivitySearch(val) {
    _activitySearchTerm = val.toLowerCase().trim();
    renderFilteredActivity();
}

function filterActivityTab(tab) {
    _activityFilter = tab;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.filter === tab);
    });
    renderFilteredActivity();
}

function updateActivityTabCounts() {
    const total = activityRecords.length;
    const success = activityRecords.filter(r => r.status === 'success').length;
    const pending = activityRecords.filter(r => r.status === 'pending').length;
    const failed = activityRecords.filter(r => r.status === 'failed').length;

    const elAll = document.getElementById('count-all');
    const elSuccess = document.getElementById('count-success');
    const elPending = document.getElementById('count-pending');
    const elFailed = document.getElementById('count-failed');

    if (elAll) elAll.textContent = total;
    if (elSuccess) elSuccess.textContent = success;
    if (elPending) elPending.textContent = pending;
    if (elFailed) elFailed.textContent = failed;
}

function renderFilteredActivity() {
    const listEl = document.getElementById('activity-list');
    if (!listEl) return;

    let filtered = activityRecords.filter(record => {
        const matchesTab = _activityFilter === 'all' || record.status === _activityFilter;
        const matchesSearch = !_activitySearchTerm ||
            (record.customer_name && record.customer_name.toLowerCase().includes(_activitySearchTerm)) ||
            (record.reference_id && record.reference_id.toLowerCase().includes(_activitySearchTerm)) ||
            (record.service_name && record.service_name.toLowerCase().includes(_activitySearchTerm)) ||
            (record.id && record.id.toLowerCase().includes(_activitySearchTerm)) ||
            String(record.amount).includes(_activitySearchTerm);
        return matchesTab && matchesSearch;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${renderIcon('arrow-left-right', 28)}</div>
                <h3>No transactions found</h3>
                <p>${_activitySearchTerm ? 'Try adjusting your search criteria.' : 'Transactions will appear here once processed.'}</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    listEl.innerHTML = filtered.map(record => {
        const isSuccess = record.status === 'success';
        const isFailed = record.status === 'failed';
        const statusBadge = isSuccess ? 'badge-success' : isFailed ? 'badge-danger' : 'badge-warning';

        return `
        <div class="transaction-card" onclick="showActivityDetail('${record.id}')" style="cursor:pointer; margin-bottom:10px;">
            <div class="transaction-icon" style="background:${isSuccess ? 'var(--success-bg)' : isFailed ? 'var(--danger-bg)' : 'var(--warning-bg)'}; color:${isSuccess ? 'var(--success)' : isFailed ? 'var(--danger)' : 'var(--warning)'};">
                ${getServiceIcon(record.service_name)}
            </div>
            <div class="transaction-info" style="min-width:0;">
                <div class="transaction-title font-bold text-main" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${escapeHtml(record.customer_name || 'Walk-in Customer')}
                </div>
                <div class="transaction-meta text-xs text-muted" style="margin-top:2px;">
                    ${serviceName(record.service_name)} · ${formatDateTime(record.created_at)}
                </div>
                ${record.failure_reason ? `<div class="text-xs text-danger mt-1" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(record.failure_reason)}</div>` : ''}
                <div style="margin-top:6px;"><span class="badge ${statusBadge}">${record.status}</span></div>
            </div>
            <div style="text-align:right; flex-shrink:0;">
                <div class="transaction-amount" style="font-weight:800;">₹${(record.amount || 0).toLocaleString('en-IN')}</div>
                ${record.commission ? `<div class="text-xs text-success font-semibold" style="margin-top:4px;">+₹${record.commission.toFixed(2)}</div>` : ''}
            </div>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function getServiceIcon(service) {
    const s = (service || '').toLowerCase();
    if (s.includes('dmt') || s.includes('money')) return renderIcon('send', 18);
    if (s.includes('aeps') || s.includes('aadhaar')) return renderIcon('fingerprint', 18);
    if (s.includes('bbps') || s.includes('bill')) return renderIcon('receipt', 18);
    if (s.includes('recharge') || s.includes('mobile')) return renderIcon('smartphone', 18);
    return renderIcon('arrow-left-right', 18);
}

async function showActivityDetail(id) {
    let record = activityRecords.find(r => r.id === id);
    if (!record) {
        try {
            record = await api.getTransaction(id);
        } catch(e) {
            console.error('Could not fetch transaction detail:', e);
            return;
        }
    }
    if (!record) return;

    const modal = document.getElementById('customer-detail-modal');
    const bodyEl = document.getElementById('cd-modal-body');
    const titleEl = document.getElementById('cd-modal-title');

    if (!modal || !bodyEl || !titleEl) return;

    const isSuccess = record.status === 'success';
    const isFailed = record.status === 'failed';
    const statusBadge = isSuccess ? 'badge-success' : isFailed ? 'badge-danger' : 'badge-warning';

    titleEl.textContent = 'Transaction Detail';
    bodyEl.innerHTML = `
        <div style="text-align:center; padding-bottom:20px; margin-bottom:20px; border-bottom:1px solid var(--border);">
            <div class="text-xs text-muted font-bold" style="text-transform:uppercase; letter-spacing:0.05em;">Amount Processed</div>
            <div style="font-size:2.4rem; font-weight:800; color:var(--navy); line-height:1.1; margin-top:4px;">₹${(record.amount || 0).toLocaleString('en-IN')}</div>
            <div style="margin-top:10px;"><span class="badge ${statusBadge}">${record.status.toUpperCase()}</span></div>
        </div>

        <div class="grid-cols-2 mb-4" style="gap:16px;">
            <div>
                <label class="text-xs text-muted font-bold">Service</label>
                <div class="font-semibold text-sm mt-1">${serviceName(record.service_name)}</div>
            </div>
            <div>
                <label class="text-xs text-muted font-bold">Commission Earned</label>
                <div class="font-bold text-sm text-success mt-1">₹${(record.commission || 0).toFixed(2)}</div>
            </div>
            <div>
                <label class="text-xs text-muted font-bold">Customer / Partner</label>
                <div class="font-semibold text-sm mt-1" ${record.customer_id ? `style="color:var(--primary); cursor:pointer;" onclick="closeModal('customer-detail-modal'); if (typeof openPartnerProfile === 'function') openPartnerProfile('${record.customer_id}');"` : ''}>
                    ${escapeHtml(record.customer_name || 'N/A')} ${record.customer_id ? '↗' : ''}
                </div>
            </div>
            <div>
                <label class="text-xs text-muted font-bold">Date & Time</label>
                <div class="font-semibold text-sm mt-1">${formatDateTime(record.created_at)}</div>
            </div>
        </div>

        <div class="card mb-4" style="padding:12px 16px; background:var(--bg); border:none;">
            <div class="text-xs text-muted font-bold">REFERENCE ID</div>
            <div class="text-xs font-mono text-main mt-1" style="word-break:break-all;">${record.reference_id || record.id}</div>
        </div>

        ${record.failure_reason ? `
            <div style="margin-bottom:20px; padding:14px; background:var(--danger-bg); border-radius:var(--radius-md); border:1px solid #FECACA;">
                <div class="text-xs text-danger font-bold mb-1" style="display:flex; align-items:center; gap:6px;">
                    ${renderIcon('alert-circle', 14)} FAILURE ANALYSIS
                </div>
                <div class="text-xs text-danger line-height-relaxed">${escapeHtml(record.failure_reason)}</div>
                <div class="text-xs text-muted mt-2">Recommended: Create an operational complaint to notify the bank/provider.</div>
            </div>
        ` : ''}

        <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
            ${isFailed ? `
                <button class="btn-primary" style="background:var(--danger); border-color:var(--danger);" onclick="closeModal('customer-detail-modal'); openCreateComplaintModal('${record.id}', '${record.customer_id || ''}', '${escapeHtml(record.customer_name || '')}');">
                    ${renderIcon('message-square-warning', 16)}
                    <span>Create Complaint for Failed Transaction</span>
                </button>
            ` : ''}
            <button class="btn-secondary" onclick="copyTxnReference('${record.reference_id || record.id}')">
                ${renderIcon('copy', 16)}
                <span>Copy Reference ID</span>
            </button>
            <button class="btn-ghost" onclick="closeModal('customer-detail-modal'); if (typeof setAiContext === 'function') setAiContext({ transaction_id: '${record.id}', customer_id: '${record.customer_id || ''}', label: 'Transaction: ₹${(record.amount || 0).toLocaleString('en-IN')} ${serviceName(record.service_name)}' }); navigateTo('ask-eko'); sendToEko(null, 'Explain transaction ${record.reference_id || record.id} of ₹${(record.amount || 0).toLocaleString('en-IN')}');">
                ${renderIcon('sparkles', 16)}
                <span>Analyze with Eko AI</span>
            </button>
        </div>
    `;

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function copyTxnReference(ref) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(ref);
        showToast('Reference ID copied to clipboard!', 'success');
    } else {
        showToast(`Reference: ${ref}`);
    }
}

window.renderActivityScreen = renderActivityScreen;
window.loadActivity = loadActivity;
window.showActivityDetail = showActivityDetail;
