/**
 * Eko Partner Operations — Earnings & Commission Engine
 * Dedicated module for real-time commission tracking, settlement reconciliation,
 * and service payout analysis.
 */

let _commissionFilterStatus = 'all';
let _commissionFilterService = 'all';
let _commissionFilterDate = 'all';
let _allCommissions = [];

function renderEarningsScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Earnings & Commission</h1>
                <p class="text-sm text-muted">Deterministic real-time commission tracking and nodal settlements.</p>
            </div>
            <button class="btn-primary" onclick="openSettlementHistoryModal()" style="display:flex; align-items:center; gap:8px;">
                ${renderIcon('wallet', 16)}
                <span>Settlements</span>
            </button>
        </div>

        <!-- 5-Metric Earnings Grid -->
        <div class="metrics-grid mb-6" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--sp-4);">
            <div class="card stat-card">
                <div class="text-xs text-muted font-bold">TOTAL EARNED</div>
                <div class="stat-value text-primary mt-1" id="earn-stat-total">₹0</div>
                <div class="text-xs text-muted mt-1">All time eligible</div>
            </div>
            <div class="card stat-card">
                <div class="text-xs text-muted font-bold">TODAY</div>
                <div class="stat-value text-success mt-1" id="earn-stat-today">₹0</div>
                <div class="text-xs text-muted mt-1">Live daily credited</div>
            </div>
            <div class="card stat-card">
                <div class="text-xs text-muted font-bold">THIS MONTH</div>
                <div class="stat-value mt-1" id="earn-stat-month">₹0</div>
                <div class="text-xs text-muted mt-1">Current billing cycle</div>
            </div>
            <div class="card stat-card">
                <div class="text-xs text-muted font-bold">PENDING</div>
                <div class="stat-value text-warning mt-1" id="earn-stat-pending">₹0</div>
                <div class="text-xs text-muted mt-1">Awaiting batch clear</div>
            </div>
            <div class="card stat-card">
                <div class="text-xs text-muted font-bold">SETTLED (PAID)</div>
                <div class="stat-value text-main mt-1" id="earn-stat-paid">₹0</div>
                <div class="text-xs text-muted mt-1">Disbursed to bank</div>
            </div>
        </div>

        <!-- Settlement Status Card -->
        <div class="card mb-6 p-4" style="border-left:4px solid var(--primary); background:linear-gradient(to right, var(--surface), var(--bg));">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                <div>
                    <div class="text-xs font-bold text-muted">AVAILABLE FOR SETTLEMENT</div>
                    <div class="font-bold text-xl text-primary mt-1" id="settle-available">₹0</div>
                    <div class="text-xs text-muted mt-1" id="settle-next-date">Next Nodal Payout: Calculating...</div>
                </div>
                <div style="text-align:right;">
                    <div class="text-xs font-bold text-muted">LAST SETTLEMENT</div>
                    <div class="font-bold text-sm text-success mt-1" id="settle-last-amount">₹0 (PAID)</div>
                    <div class="text-xs text-muted mt-1" id="settle-last-ref">Ref: --</div>
                </div>
            </div>
        </div>

        <!-- Filter Controls -->
        <div class="card mb-6 p-4">
            <!-- Status Tabs -->
            <div class="filter-tabs mb-4">
                <button class="filter-tab active" data-status="all" onclick="filterCommissionStatus('all')">All</button>
                <button class="filter-tab" data-status="EARNED" onclick="filterCommissionStatus('EARNED')">Earned</button>
                <button class="filter-tab" data-status="PENDING" onclick="filterCommissionStatus('PENDING')">Pending</button>
                <button class="filter-tab" data-status="PAID" onclick="filterCommissionStatus('PAID')">Paid</button>
                <button class="filter-tab" data-status="REVERSED" onclick="filterCommissionStatus('REVERSED')">Reversed</button>
            </div>

            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                <!-- Service Dropdown -->
                <div style="flex:1; min-width:160px;">
                    <select id="commission-service-select" class="form-input text-xs" style="padding:8px 12px;" onchange="filterCommissionService(this.value)">
                        <option value="all">All Services</option>
                        <option value="DMT">DMT (Money Transfer)</option>
                        <option value="AePS">AePS (Aadhaar Banking)</option>
                        <option value="BBPS">BBPS (Bill Pay)</option>
                        <option value="Recharge">Recharge</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Micro ATM">Micro ATM</option>
                        <option value="Indo-Nepal">Indo-Nepal Remittance</option>
                    </select>
                </div>

                <!-- Date Range Filter -->
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="chip active text-xs" data-date="all" onclick="filterCommissionDate('all')">All Time</button>
                    <button class="chip text-xs" data-date="today" onclick="filterCommissionDate('today')">Today</button>
                    <button class="chip text-xs" data-date="week" onclick="filterCommissionDate('week')">This Week</button>
                    <button class="chip text-xs" data-date="month" onclick="filterCommissionDate('month')">This Month</button>
                </div>
            </div>
        </div>

        <!-- Commission History List -->
        <div class="section-header mb-4" style="display:flex; justify-content:space-between; align-items:center;">
            <h2 class="section-title">Commission Ledger</h2>
            <span class="text-xs text-muted" id="commission-count-label">Loading records...</span>
        </div>

        <div id="commissions-list" class="item-list" style="display:flex; flex-direction:column; gap:var(--sp-3);">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>
    `;
}

async function loadEarningsScreen() {
    const list = document.getElementById('commissions-list');
    if (!list) return;

    try {
        // 1. Fetch Earnings Summary & Settlements in parallel
        const [summary, settlements, comms] = await Promise.all([
            api.getEarningsSummary().catch(() => null),
            api.getSettlements().catch(() => []),
            api.getCommissions().catch(() => [])
        ]);

        if (summary) {
            const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
            const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setEl('earn-stat-total', fmt(summary.total_earnings));
            setEl('earn-stat-today', fmt(summary.today_earnings));
            setEl('earn-stat-month', fmt(summary.this_month_earnings !== undefined ? summary.this_month_earnings : summary.monthly_earnings));
            setEl('earn-stat-pending', fmt(summary.pending_earnings));
            setEl('earn-stat-paid', fmt(summary.paid_earnings));
            setEl('settle-available', fmt(summary.available_for_settlement));
            setEl('settle-next-date', `Next Nodal Payout: ${summary.next_settlement_date || 'Daily 18:00 IST'}`);
        }

        if (settlements && settlements.length > 0) {
            const last = settlements[0];
            const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setEl('settle-last-amount', `₹${Number(last.amount || 0).toLocaleString('en-IN')} (${last.status})`);
            setEl('settle-last-ref', `UTR: ${last.bank_reference || last.id} • ${last.payout_account || 'Bank Nodal'}`);
        }

        _allCommissions = comms || [];
        renderFilteredCommissions();

    } catch (err) {
        console.error('Error loading earnings:', err);
        list.innerHTML = `
            <div class="error-state">
                <div class="error-state-title">Earnings Ledger Unavailable</div>
                <div class="error-state-desc">Could not load commission records. Please verify connection.</div>
            </div>`;
    }
}

function filterCommissionStatus(status) {
    _commissionFilterStatus = status;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.status === status);
    });
    renderFilteredCommissions();
}

function filterCommissionService(svc) {
    _commissionFilterService = svc;
    renderFilteredCommissions();
}

function filterCommissionDate(range) {
    _commissionFilterDate = range;
    document.querySelectorAll('.chip[data-date]').forEach(c => {
        c.classList.toggle('active', c.dataset.date === range);
    });
    renderFilteredCommissions();
}

function renderFilteredCommissions() {
    const list = document.getElementById('commissions-list');
    const countLabel = document.getElementById('commission-count-label');
    if (!list) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const filtered = _allCommissions.filter(c => {
        // Status filter
        if (_commissionFilterStatus !== 'all') {
            if (c.status !== _commissionFilterStatus) return false;
        }

        // Service filter
        if (_commissionFilterService !== 'all') {
            if ((c.service || '').toLowerCase() !== _commissionFilterService.toLowerCase()) return false;
        }

        // Date filter
        if (_commissionFilterDate !== 'all' && c.created_at) {
            const dt = new Date(c.created_at);
            const dtStr = dt.toISOString().split('T')[0];
            if (_commissionFilterDate === 'today' && dtStr !== todayStr) return false;
            if (_commissionFilterDate === 'week') {
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
                if (dt < oneWeekAgo) return false;
            }
            if (_commissionFilterDate === 'month') {
                if (dt.getMonth() !== now.getMonth() || dt.getFullYear() !== now.getFullYear()) return false;
            }
        }
        return true;
    });

    if (countLabel) {
        countLabel.textContent = `${filtered.length} of ${_allCommissions.length} records`;
    }

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${renderIcon('receipt', 28)}</div>
                <h3>No commission entries found</h3>
                <p>No transactions match the selected status, service, or date filter.</p>
            </div>`;
        return;
    }

    // Desktop Table HTML
    const desktopRows = filtered.map(item => {
        const isReversed = item.status === 'REVERSED';
        const isPaid = item.status === 'PAID';
        const isPending = item.status === 'PENDING';
        const isEarned = item.status === 'EARNED';

        const badgeClass = isPaid ? 'badge-success' : isEarned ? 'badge-info' : isPending ? 'badge-warning' : 'badge-danger';
        const commPrefix = isReversed ? '-₹' : '+₹';
        const commColor = isReversed ? 'text-danger' : isPending ? 'text-warning' : 'text-success';
        const formattedComm = Math.abs(item.commission_amount || 0).toFixed(2);
        const formattedTxnAmt = Number(item.transaction_amount || 0).toLocaleString('en-IN');
        const refId = item.transaction_reference || item.transaction_id || '--';
        const partnerName = item.partner_name || 'Eko Partner Outlet';

        const dateDisplay = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'Recent';

        return `
        <tr onclick="openCommissionDetail('${item.id}')">
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="metric-icon-wrap" style="background:var(--primary-subtle); color:var(--primary); width:28px; height:28px; flex-shrink:0;">
                        ${renderServiceIcon(item.service)}
                    </div>
                    <span class="font-bold text-main">${escapeHtml(item.service || 'Financial Service')}</span>
                </div>
            </td>
            <td>
                <span class="text-sm text-main">${escapeHtml(partnerName)}</span>
            </td>
            <td>
                <span class="text-xs font-mono text-muted">${escapeHtml(refId)}</span>
            </td>
            <td>
                <span class="text-sm font-semibold text-main">₹${formattedTxnAmt}</span>
            </td>
            <td>
                <span class="text-sm font-bold ${commColor}">${commPrefix}${formattedComm}</span>
            </td>
            <td>
                <span class="badge ${badgeClass}" style="font-size:0.65rem; padding:2px 8px;">${item.status}</span>
            </td>
            <td>
                <span class="text-xs text-muted">${dateDisplay}</span>
            </td>
            <td style="text-align:right;">
                <button class="btn btn-secondary text-xs" style="padding:4px 8px;" onclick="event.stopPropagation(); openCommissionDetail('${item.id}');">
                    Details
                </button>
            </td>
        </tr>`;
    }).join('');

    // Mobile Cards HTML
    const mobileCards = filtered.map(item => {
        const isReversed = item.status === 'REVERSED';
        const isPaid = item.status === 'PAID';
        const isPending = item.status === 'PENDING';
        const isEarned = item.status === 'EARNED';

        const badgeClass = isPaid ? 'badge-success' : isEarned ? 'badge-info' : isPending ? 'badge-warning' : 'badge-danger';
        const commPrefix = isReversed ? '-₹' : '+₹';
        const commColor = isReversed ? 'text-danger' : isPending ? 'text-warning' : 'text-success';
        const formattedComm = Math.abs(item.commission_amount || 0).toFixed(2);
        const formattedTxnAmt = Number(item.transaction_amount || 0).toLocaleString('en-IN');
        const refId = item.transaction_reference || item.transaction_id || '';
        const partnerName = item.partner_name || 'Eko Partner Outlet';

        const dateDisplay = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        }) : 'Recent';

        return `
        <div class="card-item" onclick="openCommissionDetail('${item.id}')" style="cursor:pointer; padding:14px; gap:12px;">
            <div class="metric-icon-wrap" style="background:var(--primary-subtle); color:var(--primary); width:40px; height:40px; flex-shrink:0;">
                ${renderServiceIcon(item.service)}
            </div>
            <div style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="min-width:0;">
                        <span class="font-bold text-main" style="font-size:0.95rem;">${escapeHtml(item.service || 'Financial Service')}</span>
                        <div class="text-xs text-muted" style="margin-top:2px;">${escapeHtml(partnerName)}</div>
                    </div>
                    <div class="font-bold text-sm ${commColor}" style="flex-shrink:0;">
                        ${commPrefix}${formattedComm}
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                    <div class="text-xs text-muted" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                        <span>Txn: ₹${formattedTxnAmt}</span>
                        ${refId ? `<span style="font-family:monospace; font-size:0.75rem;">• ${escapeHtml(refId)}</span>` : ''}
                    </div>
                    <span class="badge ${badgeClass}" style="font-size:0.65rem; padding:2px 6px;">${item.status}</span>
                </div>
                <div class="text-xs text-muted" style="margin-top:4px;">${dateDisplay}</div>
            </div>
            ${renderIcon('chevron-right', 16, 'text-light')}
        </div>`;
    }).join('');

    list.innerHTML = `
        <div class="commission-table-wrap desktop-only">
            <table class="commission-table">
                <thead>
                    <tr>
                        <th>Service</th>
                        <th>Partner / Outlet</th>
                        <th>Reference ID</th>
                        <th>Volume</th>
                        <th>Commission</th>
                        <th>Status</th>
                        <th>Date & Time</th>
                        <th style="text-align:right;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${desktopRows}
                </tbody>
            </table>
        </div>
        <div class="mobile-only" style="display:flex; flex-direction:column; gap:var(--sp-3);">
            ${mobileCards}
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

function renderServiceIcon(service) {
    const s = (service || '').toLowerCase();
    if (s.includes('dmt') || s.includes('money')) return renderIcon('send', 18);
    if (s.includes('aeps') || s.includes('aadhaar')) return renderIcon('fingerprint', 18);
    if (s.includes('bbps') || s.includes('bill')) return renderIcon('receipt', 18);
    if (s.includes('recharge')) return renderIcon('smartphone', 18);
    if (s.includes('insurance')) return renderIcon('shield', 18);
    if (s.includes('atm')) return renderIcon('credit-card', 18);
    return renderIcon('arrow-left-right', 18);
}

let _activeCommissionDetailReqId = 0;

function formatCommissionAmount(comm) {
    const isReversed = comm.status === 'REVERSED';
    const isPending = comm.status === 'PENDING';
    const rawAmt = Number(comm.commission_amount !== undefined && comm.commission_amount !== null ? comm.commission_amount : 0);
    const absAmt = Math.abs(rawAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    let prefix = '+₹';
    let colorClass = 'text-success';
    
    if (isReversed || rawAmt < 0) {
        prefix = '-₹';
        colorClass = 'text-danger';
    } else if (isPending) {
        prefix = '+₹';
        colorClass = 'text-warning';
    }
    
    return {
        display: `${prefix}${absAmt}`,
        colorClass
    };
}

function formatStatusBadge(status) {
    const st = (status || '').toUpperCase().trim();
    if (!st) {
        return { label: 'UNKNOWN', badgeClass: 'badge-neutral' };
    }
    let badgeClass = 'badge-neutral';
    if (st === 'PAID') badgeClass = 'badge-success';
    else if (st === 'EARNED') badgeClass = 'badge-info';
    else if (st === 'PENDING') badgeClass = 'badge-warning';
    else if (st === 'REVERSED') badgeClass = 'badge-danger';
    
    return { label: st, badgeClass };
}

function formatSettlementDisplay(comm, txn) {
    if (comm.settlement_reference && String(comm.settlement_reference).trim()) {
        return escapeHtml(comm.settlement_reference);
    }
    if (comm.settlement_id && String(comm.settlement_id).trim()) {
        return escapeHtml(comm.settlement_id);
    }
    if (comm.status === 'PAID') {
        return 'Disbursed (Bank Nodal)';
    }
    if (comm.status === 'PENDING') {
        return 'Pending Settlement';
    }
    if (comm.status === 'EARNED') {
        return 'Awaiting Settlement Cycle';
    }
    if (comm.status === 'REVERSED') {
        return 'Not Applicable (Reversed)';
    }
    return 'Not Settled';
}

function formatPartnerDisplay(comm, txn) {
    const pName = comm.partner_name || (txn && (txn.customer_name || txn.partner_name));
    if (pName && String(pName).trim() && pName.trim().toLowerCase() !== 'eko network') {
        return escapeHtml(pName);
    }
    if (pName && String(pName).trim()) {
        return escapeHtml(pName);
    }
    return 'N/A';
}

function formatServiceDisplay(comm, txn) {
    const s = comm.service || (txn && (txn.service_name || txn.service));
    if (s && String(s).trim()) {
        return escapeHtml(s);
    }
    return 'N/A';
}

function formatTransactionAmountDisplay(comm, txn) {
    const amt = comm.transaction_amount !== undefined && comm.transaction_amount !== null
        ? comm.transaction_amount
        : (txn && txn.amount !== undefined && txn.amount !== null ? txn.amount : null);
    if (amt === null || amt === undefined || isNaN(amt)) {
        return 'N/A';
    }
    return '₹' + Number(amt).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatTransactionRefDisplay(comm, txn) {
    const ref = comm.transaction_reference || (txn && txn.reference_id) || comm.transaction_id || (txn && txn.id);
    if (ref && String(ref).trim()) {
        return escapeHtml(ref);
    }
    return 'N/A';
}

function formatRateDisplay(comm, txn) {
    if (comm.commission_rate !== undefined && comm.commission_rate !== null && !isNaN(comm.commission_rate)) {
        const pct = (Number(comm.commission_rate) * 100).toFixed(2);
        return `${pct}% Base Plan`;
    }
    const amt = comm.transaction_amount !== undefined && comm.transaction_amount !== null ? comm.transaction_amount : (txn ? txn.amount : null);
    const commAmt = Math.abs(Number(comm.commission_amount || 0));
    if (amt && amt > 0 && commAmt > 0) {
        const pct = ((commAmt / amt) * 100).toFixed(2);
        return `${pct}% Calculated`;
    }
    if (comm.status === 'REVERSED') {
        return '0.00% (Reversed)';
    }
    return 'N/A';
}

function formatDateTimeDisplay(comm, txn) {
    const raw = comm.created_at || comm.earned_at || (txn && txn.created_at);
    if (!raw) return 'N/A';
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return escapeHtml(raw);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    } catch (e) {
        return 'N/A';
    }
}

function renderCommissionDetailModalContent(comm, txn) {
    const amountInfo = formatCommissionAmount(comm);
    const statusInfo = formatStatusBadge(comm.status);

    return `
        <div style="text-align:center; padding:16px 0; border-bottom:1px solid var(--border);">
            <div class="text-xs text-muted font-bold" style="letter-spacing:0.05em;">COMMISSION AMOUNT</div>
            <div class="font-bold text-2xl ${amountInfo.colorClass} mt-1">${amountInfo.display}</div>
            <span class="badge ${statusInfo.badgeClass} text-xs mt-2">${statusInfo.label}</span>
        </div>

        <div style="padding:16px 0; display:grid; grid-template-columns:1fr 1fr; gap:14px; font-size:0.85rem;">
            <div>
                <span class="text-muted text-xs">Service Type</span>
                <div class="font-bold text-main mt-0.5">${formatServiceDisplay(comm, txn)}</div>
            </div>
            <div>
                <span class="text-muted text-xs">Transaction Volume</span>
                <div class="font-bold text-main mt-0.5">${formatTransactionAmountDisplay(comm, txn)}</div>
            </div>
            <div>
                <span class="text-muted text-xs">Calculated Rate</span>
                <div class="font-bold text-main mt-0.5">${formatRateDisplay(comm, txn)}</div>
            </div>
            <div>
                <span class="text-muted text-xs">Transaction ID / Ref</span>
                <div class="font-mono text-xs text-main mt-0.5" style="overflow:hidden; text-overflow:ellipsis;" title="${formatTransactionRefDisplay(comm, txn)}">${formatTransactionRefDisplay(comm, txn)}</div>
            </div>
            <div>
                <span class="text-muted text-xs">Associated Partner</span>
                <div class="font-bold text-main mt-0.5" style="overflow:hidden; text-overflow:ellipsis;" title="${formatPartnerDisplay(comm, txn)}">${formatPartnerDisplay(comm, txn)}</div>
            </div>
            <div>
                <span class="text-muted text-xs">Settlement Reference</span>
                <div class="font-bold text-primary mt-0.5" style="overflow:hidden; text-overflow:ellipsis;" title="${formatSettlementDisplay(comm, txn)}">${formatSettlementDisplay(comm, txn)}</div>
            </div>
            <div style="grid-column: span 2;">
                <span class="text-muted text-xs">Transaction Date & Time</span>
                <div class="font-medium text-main mt-0.5">${formatDateTimeDisplay(comm, txn)}</div>
            </div>
        </div>

        <div class="text-xs text-muted" style="background:var(--bg); padding:10px; border-radius:8px; margin-top:8px; line-height:1.4;">
            Deterministic commission verified by Eko partner agreement schedule. Payout credits into the designated nodal bank account on the settlement cycle.
        </div>
    `;
}

function ensureCommissionDetailModal() {
    let modal = document.getElementById('commission-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'commission-detail-modal';
        modal.className = 'modal-overlay hidden';
        modal.innerHTML = `
            <div class="modal-card" style="max-width:480px;">
                <div class="modal-header">
                    <h2 style="margin:0; font-size:1.1rem; font-weight:800;">Commission Breakdown</h2>
                    <button class="modal-close" onclick="closeModal('commission-detail-modal')" aria-label="Close"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
                </div>
                <div class="modal-body" id="commission-detail-body"></div>
                <div class="modal-footer">
                    <button class="btn-ghost" onclick="closeModal('commission-detail-modal')">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (window.lucide) lucide.createIcons();
    }
    return modal;
}

async function openCommissionDetail(cid) {
    const modal = ensureCommissionDetailModal();
    const body = document.getElementById('commission-detail-body');
    if (!modal || !body) return;

    const reqId = ++_activeCommissionDetailReqId;
    modal.classList.remove('hidden');

    // 1. Immediately render cached record from ledger if present (zero latency / no flicker)
    const cached = _allCommissions.find(c => c.id === cid);
    if (cached) {
        body.innerHTML = renderCommissionDetailModalContent(cached, null);
    } else {
        body.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    }

    try {
        const data = await api.getCommissionDetail(cid);
        // Prevent race conditions: discard response if user clicked another record while waiting
        if (reqId !== _activeCommissionDetailReqId) return;

        // Safely unwrap: handles { commission: {...}, transaction: {...} } OR direct flat object
        const comm = (data && data.commission) ? data.commission : (data || cached || {});
        const txn = (data && data.transaction) ? data.transaction : null;

        body.innerHTML = renderCommissionDetailModalContent(comm, txn);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        if (reqId !== _activeCommissionDetailReqId) return;
        if (!cached) {
            body.innerHTML = `<div class="text-danger p-4 text-center">Failed to load commission breakdown: ${escapeHtml(err.message || 'Unknown error')}</div>`;
        } else {
            console.warn('[Earnings] Could not fetch extended commission details, showing ledger record:', err);
        }
    }
}

async function openSettlementHistoryModal() {
    const modal = document.getElementById('settlement-history-modal');
    const body = document.getElementById('settlement-modal-body');
    if (!modal || !body) return;

    modal.classList.remove('hidden');
    body.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

    try {
        const settlements = await api.getSettlements();
        if (!settlements || settlements.length === 0) {
            body.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${renderIcon('wallet', 24)}</div>
                    <h3>No settlements recorded</h3>
                    <p>Settlement batches disburse automatically according to the nodal cycle.</p>
                </div>`;
            return;
        }

        body.innerHTML = settlements.map(s => {
            const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
            let dateStr = 'Scheduled';
            if (s.settled_at) {
                const d = new Date(s.settled_at);
                dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric'
                }) : escapeHtml(s.settled_at);
            }

            return `
            <div class="card mb-3" style="padding:14px; border-left:4px solid ${s.status === 'PAID' ? 'var(--success)' : 'var(--warning)'};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div class="font-bold text-main" style="font-size:1rem;">${fmt(s.amount)}</div>
                        <div class="text-xs text-muted mt-1">UTR: ${escapeHtml(s.bank_reference || s.id)}</div>
                    </div>
                    <div style="text-align:right;">
                        <span class="badge ${s.status === 'PAID' ? 'badge-success' : 'badge-warning'} text-xs">${s.status}</span>
                        <div class="text-xs text-muted mt-1">${dateStr}</div>
                    </div>
                </div>
                <div class="text-xs text-muted mt-2 pt-2" style="border-top:1px dashed var(--border);">
                    Disbursed to: <b>${escapeHtml(s.payout_account || 'Bank Nodal Account')}</b>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        body.innerHTML = `<div class="text-danger p-4 text-center">Failed to load settlements: ${escapeHtml(err.message || 'Unknown error')}</div>`;
    }
}
