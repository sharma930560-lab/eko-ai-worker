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
        <div class="metrics-grid mb-4" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
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
        <div class="card mb-4" style="padding:16px; border-left:4px solid var(--primary); background:linear-gradient(to right, var(--bg-card), var(--bg));">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
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
        <div class="card mb-4" style="padding:12px;">
            <!-- Status Tabs -->
            <div class="filter-tabs mb-3">
                <button class="filter-tab active" data-status="all" onclick="filterCommissionStatus('all')">All</button>
                <button class="filter-tab" data-status="EARNED" onclick="filterCommissionStatus('EARNED')">Earned</button>
                <button class="filter-tab" data-status="PENDING" onclick="filterCommissionStatus('PENDING')">Pending</button>
                <button class="filter-tab" data-status="PAID" onclick="filterCommissionStatus('PAID')">Paid</button>
                <button class="filter-tab" data-status="REVERSED" onclick="filterCommissionStatus('REVERSED')">Reversed</button>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <!-- Service Dropdown -->
                <div style="flex:1; min-width:140px;">
                    <select id="commission-service-select" class="form-input text-xs" style="padding:6px 10px;" onchange="filterCommissionService(this.value)">
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
                <div style="display:flex; gap:6px;">
                    <button class="chip active text-xs" data-date="all" onclick="filterCommissionDate('all')">All Time</button>
                    <button class="chip text-xs" data-date="today" onclick="filterCommissionDate('today')">Today</button>
                    <button class="chip text-xs" data-date="week" onclick="filterCommissionDate('week')">This Week</button>
                    <button class="chip text-xs" data-date="month" onclick="filterCommissionDate('month')">This Month</button>
                </div>
            </div>
        </div>

        <!-- Commission History List -->
        <div class="section-header" style="display:flex; justify-content:space-between; align-items:center;">
            <h2 class="section-title">Commission Ledger</h2>
            <span class="text-xs text-muted" id="commission-count-label">Loading records...</span>
        </div>

        <div id="commissions-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>

    <!-- Settlement History Modal -->
    <div id="settlement-history-modal" class="modal-overlay hidden">
        <div class="modal-card">
            <div class="modal-header">
                <h2>Settlement History & Nodal Payouts</h2>
                <button class="modal-close" onclick="closeModal('settlement-history-modal')">${renderIcon('x', 16)}</button>
            </div>
            <div class="modal-body" id="settlement-modal-body">
                <div class="loading-state"><div class="spinner"></div></div>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="closeModal('settlement-history-modal')">Close</button>
            </div>
        </div>
    </div>

    <!-- Commission Detail Modal -->
    <div id="commission-detail-modal" class="modal-overlay hidden">
        <div class="modal-card">
            <div class="modal-header">
                <h2>Commission Breakdown</h2>
                <button class="modal-close" onclick="closeModal('commission-detail-modal')">${renderIcon('x', 16)}</button>
            </div>
            <div class="modal-body" id="commission-detail-body">
                <div class="loading-state"><div class="spinner"></div></div>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="closeModal('commission-detail-modal')">Done</button>
            </div>
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
            setEl('earn-stat-month', fmt(summary.monthly_earnings));
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

    list.innerHTML = filtered.map(item => {
        const isReversed = item.status === 'REVERSED';
        const isPaid = item.status === 'PAID';
        const isPending = item.status === 'PENDING';
        const isEarned = item.status === 'EARNED';

        const badgeClass = isPaid ? 'badge-success' : isEarned ? 'badge-info' : isPending ? 'badge-warning' : 'badge-danger';
        const commPrefix = isReversed ? '-₹' : '+₹';
        const commColor = isReversed ? 'text-danger' : isPending ? 'text-warning' : 'text-success';
        const formattedComm = Math.abs(item.commission_amount || 0).toFixed(2);
        const formattedTxnAmt = Number(item.transaction_amount || 0).toLocaleString('en-IN');

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
                        <span class="text-xs text-muted" style="margin-left:6px;">Txn: ₹${formattedTxnAmt}</span>
                    </div>
                    <div class="font-bold text-sm ${commColor}" style="flex-shrink:0;">
                        ${commPrefix}${formattedComm}
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                    <span class="badge ${badgeClass}" style="font-size:0.6rem; padding:2px 6px;">${item.status}</span>
                    <span class="text-xs text-muted">${dateDisplay}</span>
                </div>
            </div>
            ${renderIcon('chevron-right', 16, 'text-light')}
        </div>
        `;
    }).join('');

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

async function openCommissionDetail(cid) {
    const modal = document.getElementById('commission-detail-modal');
    const body = document.getElementById('commission-detail-body');
    if (!modal || !body) return;

    modal.classList.remove('hidden');
    body.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

    try {
        const data = await api.getCommissionDetail(cid);
        const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
        const ratePct = ((data.commission_rate || 0) * 100).toFixed(2);

        body.innerHTML = `
            <div style="text-align:center; padding:16px 0; border-bottom:1px solid var(--border);">
                <div class="text-xs text-muted font-bold">COMMISSION AMOUNT</div>
                <div class="font-bold text-2xl text-success mt-1">+${fmt(data.commission_amount)}</div>
                <span class="badge badge-success text-xs mt-2">${data.status}</span>
            </div>

            <div style="padding:16px 0; display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.85rem;">
                <div>
                    <span class="text-muted text-xs">Service Type</span>
                    <div class="font-bold">${escapeHtml(data.service || 'N/A')}</div>
                </div>
                <div>
                    <span class="text-muted text-xs">Transaction Volume</span>
                    <div class="font-bold">${fmt(data.transaction_amount)}</div>
                </div>
                <div>
                    <span class="text-muted text-xs">Calculated Rate</span>
                    <div class="font-bold">${ratePct}% Base Plan</div>
                </div>
                <div>
                    <span class="text-muted text-xs">Transaction ID</span>
                    <div class="font-mono text-xs" style="overflow:hidden; text-overflow:ellipsis;">${escapeHtml(data.transaction_id || 'N/A')}</div>
                </div>
                <div>
                    <span class="text-muted text-xs">Associated Partner</span>
                    <div class="font-bold">${escapeHtml(data.partner_name || 'Eko Network')}</div>
                </div>
                <div>
                    <span class="text-muted text-xs">Settlement Reference</span>
                    <div class="font-bold text-primary">${escapeHtml(data.settlement_id || 'Pending Batch')}</div>
                </div>
            </div>

            <div class="text-xs text-muted" style="background:var(--bg); padding:10px; border-radius:8px; margin-top:8px;">
                Deterministic commission verified by Eko partner agreement schedule. Payout credits into the designated nodal bank account on the settlement cycle.
            </div>
        `;
    } catch (err) {
        body.innerHTML = `<div class="text-danger p-4 text-center">Failed to load commission breakdown: ${escapeHtml(err.message || 'Unknown error')}</div>`;
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
            const dateStr = s.settled_at ? new Date(s.settled_at).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
            }) : 'Scheduled';

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
