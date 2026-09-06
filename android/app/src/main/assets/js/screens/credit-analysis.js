/**
 * Eko Partner Operations — Interactive Credit Analysis & Risk Simulator
 * v1.4.0 Engine: Deterministic, Grounded, Dynamic Multi-Factor Recalculation.
 */

let _activeCreditCustomerId = null;
let _baselineCreditData = null;
let _currentCreditData = null;
let _creditDebounceTimer = null;
let _isCreditAnalyzing = false;

async function openCreditAnalysisModal(customerId = null) {
    const modal = document.getElementById('credit-analysis-modal');
    if (!modal) return;

    // Push history state so Android hardware back closes modal first
    try {
        window.history.pushState({ modal: 'credit-analysis-modal' }, '');
    } catch (e) {}

    modal.classList.remove('hidden');

    // Populate partner dropdown
    await populateCreditPartnerDropdown(customerId);

    // Load initial analysis
    const targetId = customerId || _activeCreditCustomerId;
    if (targetId) {
        await loadCreditAnalysis(targetId);
    }
}

function closeCreditAnalysisModal() {
    const modal = document.getElementById('credit-analysis-modal');
    if (modal) modal.classList.add('hidden');
    if (window.history.state && window.history.state.modal === 'credit-analysis-modal') {
        window.history.back();
    }
}

// Handle popstate for back button
window.addEventListener('popstate', (e) => {
    const modal = document.getElementById('credit-analysis-modal');
    if (modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
    }
});

async function populateCreditPartnerDropdown(selectedId = null) {
    const select = document.getElementById('ca-partner-select');
    if (!select) return;

    let partners = window._allPartners || window._allCustomers || [];
    if (partners.length === 0) {
        try {
            partners = await api.getPartners();
            window._allPartners = partners;
        } catch (e) {
            console.error('Failed to load partners for credit modal:', e);
        }
    }

    select.innerHTML = '';
    let targetSelected = null;

    partners.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.category || p.business_type || 'Partner'})`;
        if (selectedId && p.id === selectedId) {
            opt.selected = true;
            targetSelected = p.id;
        } else if (!targetSelected && !selectedId && p.name.toLowerCase().includes('rahul')) {
            opt.selected = true;
            targetSelected = p.id;
        }
        select.appendChild(opt);
    });

    if (!targetSelected && select.options.length > 0) {
        targetSelected = select.options[0].value;
        select.options[0].selected = true;
    }

    _activeCreditCustomerId = targetSelected;
}

async function onCreditPartnerChange(customerId) {
    if (!customerId || customerId === _activeCreditCustomerId) return;
    _activeCreditCustomerId = customerId;
    await loadCreditAnalysis(customerId);
}

async function loadCreditAnalysis(customerId) {
    const body = document.getElementById('ca-modal-body');
    if (!body) return;

    body.innerHTML = '<div class="loading-state" style="padding:40px 0;"><div class="spinner"></div><div class="text-xs text-muted mt-2">Loading verified operational records...</div></div>';

    try {
        const data = await api.analyzeCreditScore({ customer_id: customerId });
        _baselineCreditData = JSON.parse(JSON.stringify(data));
        _currentCreditData = data;
        renderCreditAnalysisUI(data);
    } catch (err) {
        console.error('Credit Analysis Error:', err);
        body.innerHTML = `
            <div class="error-state" style="padding:24px 16px;">
                <div class="error-state-title">Unable to Load Assessment</div>
                <div class="text-sm text-muted mt-1">${escapeHtml(err.message || 'Network or database failure')}</div>
                <button class="btn-primary mt-4" onclick="loadCreditAnalysis('${customerId}')">
                    ${renderIcon('rotate-cw', 14)} Try Again
                </button>
            </div>
        `;
    }
}

function renderCreditAnalysisUI(data) {
    const body = document.getElementById('ca-modal-body');
    if (!body) return;

    const factors = data.factors || {};
    const kyc = (factors.kyc_status || 'pending').toLowerCase();
    const failedTxns = factors.failed_transactions !== undefined ? factors.failed_transactions : 0;
    const vol = factors.transaction_volume || 0;
    const perf = (factors.recent_performance || '100%').replace('%', '').trim();
    const tenure = factors.operational_tenure_days || 0;
    const riskInd = (factors.risk_indicators || 'none').toLowerCase();

    body.innerHTML = `
        <!-- Verified Partner Profile Banner -->
        <div class="card mb-3" style="padding:12px 14px; background:var(--bg); border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div class="font-bold text-sm" style="color:var(--text-main);">${escapeHtml(data.customer_name || 'Partner')}</div>
                    <div class="text-xs text-muted">ID: ${escapeHtml(data.customer_id || '')}</div>
                </div>
                <div style="text-align:right;">
                    <span class="badge ${data.baseline_risk === 'LOW' ? 'badge-success' : data.baseline_risk === 'HIGH' ? 'badge-danger' : 'badge-warning'} text-xs">
                        Baseline: ${data.baseline_score}/100
                    </span>
                    <div class="text-xs text-muted mt-1">Verified records</div>
                </div>
            </div>
        </div>

        <!-- Dynamic Results Card (Re-renders on factor change) -->
        <div id="ca-result-card">
            ${renderCreditResultCard(data)}
        </div>

        <!-- Interactive Factor Controls Section -->
        <div class="card mt-3 mb-2" style="padding:14px; border:1px solid var(--border);">
            <div class="text-xs font-bold text-muted mb-3" style="letter-spacing:0.5px; text-transform:uppercase;">
                Operational Risk &amp; Assessment Factors
            </div>

            <!-- KYC Status -->
            <div class="form-group mb-3">
                <label class="form-label" style="display:flex; justify-content:space-between;">
                    <span>KYC Verification Status</span>
                    <span class="text-xs text-muted" id="ca-kyc-impact">+7.0 pts when verified</span>
                </label>
                <div style="display:flex; gap:8px;">
                    <label class="ca-segment-btn ${kyc === 'verified' ? 'active' : ''}">
                        <input type="radio" name="ca_kyc" value="verified" ${kyc === 'verified' ? 'checked' : ''} onchange="onCreditFactorChange()">
                        <span>Verified</span>
                    </label>
                    <label class="ca-segment-btn ${kyc === 'pending' ? 'active' : ''}">
                        <input type="radio" name="ca_kyc" value="pending" ${kyc === 'pending' ? 'checked' : ''} onchange="onCreditFactorChange()">
                        <span>Pending</span>
                    </label>
                    <label class="ca-segment-btn ${kyc === 'rejected' ? 'active' : ''}">
                        <input type="radio" name="ca_kyc" value="rejected" ${kyc === 'rejected' ? 'checked' : ''} onchange="onCreditFactorChange()">
                        <span>Rejected</span>
                    </label>
                </div>
            </div>

            <!-- Failed Transactions -->
            <div class="form-group mb-3">
                <label class="form-label" style="display:flex; justify-content:space-between;">
                    <span>Failed Transactions (Payout/Switch Faults)</span>
                    <span class="text-xs text-muted" id="ca-fail-impact">High impact risk factor</span>
                </label>
                <select id="ca-factor-failed" class="form-input" onchange="onCreditFactorChange()">
                    <option value="0" ${failedTxns === 0 ? 'selected' : ''}>0 (None recorded - Strong)</option>
                    <option value="1" ${failedTxns === 1 ? 'selected' : ''}>1 (Isolated switch timeout)</option>
                    <option value="3" ${failedTxns === 3 ? 'selected' : ''}>3 (Moderate failure rate)</option>
                    <option value="5" ${failedTxns >= 5 ? 'selected' : ''}>5+ (Critical failure cluster)</option>
                </select>
            </div>

            <!-- Transaction Volume -->
            <div class="form-group mb-3">
                <label class="form-label" style="display:flex; justify-content:space-between;">
                    <span>Processed Transaction Volume</span>
                    <span class="text-xs text-muted">Scales partner limit</span>
                </label>
                <select id="ca-factor-volume" class="form-input" onchange="onCreditFactorChange()">
                    <option value="10000" ${vol < 20000 ? 'selected' : ''}>Low (Under ₹20,000)</option>
                    <option value="25000" ${vol >= 20000 && vol < 50000 ? 'selected' : ''}>Moderate (₹20,000 – ₹50,000)</option>
                    <option value="75000" ${vol >= 50000 && vol < 100000 ? 'selected' : ''}>High (₹50,000 – ₹1,00,000)</option>
                    <option value="150000" ${vol >= 100000 ? 'selected' : ''}>Very High (₹1,50,000+)</option>
                </select>
            </div>

            <!-- Recent Performance -->
            <div class="form-group mb-3">
                <label class="form-label">Recent Operational Performance</label>
                <select id="ca-factor-perf" class="form-input" onchange="onCreditFactorChange()">
                    <option value="100%" ${perf >= 95 ? 'selected' : ''}>Excellent (100% Success Rate)</option>
                    <option value="85%" ${perf >= 75 && perf < 95 ? 'selected' : ''}>Good (85% Success Rate)</option>
                    <option value="60%" ${perf >= 50 && perf < 75 ? 'selected' : ''}>Average (60% Success Rate)</option>
                    <option value="35%" ${perf < 50 ? 'selected' : ''}>Subpar (Under 40% Success)</option>
                </select>
            </div>

            <!-- Operational Tenure -->
            <div class="form-group mb-3">
                <label class="form-label">Operational Tenure</label>
                <select id="ca-factor-tenure" class="form-input" onchange="onCreditFactorChange()">
                    <option value="2" ${tenure <= 14 ? 'selected' : ''}>&lt; 1 Month (New Partner)</option>
                    <option value="60" ${tenure > 14 && tenure <= 90 ? 'selected' : ''}>1 – 3 Months (Building Track Record)</option>
                    <option value="180" ${tenure > 90 && tenure <= 270 ? 'selected' : ''}>6 – 9 Months (Established)</option>
                    <option value="365" ${tenure > 270 ? 'selected' : ''}>1+ Year (Matured Partner)</option>
                </select>
            </div>

            <!-- Risk Indicators -->
            <div class="form-group">
                <label class="form-label">Active Risk Indicators</label>
                <select id="ca-factor-risk-ind" class="form-input" onchange="onCreditFactorChange()">
                    <option value="none" ${riskInd === 'none' ? 'selected' : ''}>None (Normal operations)</option>
                    <option value="reversals" ${riskInd === 'reversals' ? 'selected' : ''}>Frequent Chargebacks / Reversals</option>
                    <option value="timeouts" ${riskInd === 'timeouts' ? 'selected' : ''}>Repeated Switch Timeouts</option>
                    <option value="limits" ${riskInd === 'limits' ? 'selected' : ''}>Daily Limit Violation Attempts</option>
                </select>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

function renderCreditResultCard(data) {
    const score = Number(data.score || 0).toFixed(1);
    const risk = data.risk || 'MODERATE';
    const delta = data.delta || 0;
    const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;
    const deltaClass = delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-muted';
    const riskBadge = risk === 'LOW' ? 'badge-success' : risk === 'HIGH' ? 'badge-danger' : 'badge-warning';
    const factors = data.factors || {};

    return `
        <div class="card" style="padding:16px; border:2px solid ${risk === 'LOW' ? '#10B981' : risk === 'HIGH' ? '#EF4444' : '#F59E0B'}; background:var(--surface);">
            <!-- Top Status Row -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                    <span class="text-xs text-muted font-bold" style="letter-spacing:0.5px; text-transform:uppercase;">RECALCULATED ASSESSMENT</span>
                    <div style="display:flex; align-items:baseline; gap:8px; margin-top:2px;">
                        <span id="ca-score-display" style="font-size:2.4rem; font-weight:800; color:var(--text-main); line-height:1;">${score}</span>
                        <span class="text-sm text-muted">/ 100</span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span class="badge ${riskBadge}" style="font-size:0.85rem; padding:4px 10px; font-weight:700;">${risk}</span>
                    <div class="text-xs font-bold ${deltaClass} mt-1">
                        ${delta !== 0 ? `${deltaSign} pts vs verified` : 'At verified baseline'}
                    </div>
                </div>
            </div>

            <!-- What Changed Delta Banner -->
            <div class="card mb-3" style="padding:10px 12px; background:rgba(249,115,22,0.06); border-left:3px solid var(--primary); border-radius:4px;">
                <div class="text-xs font-bold text-primary mb-0.5" style="display:flex; align-items:center; gap:6px;">
                    ${renderIcon('sparkles', 12)} WHAT CHANGED?
                </div>
                <div class="text-xs" style="color:var(--text-main); line-height:1.4;">${escapeHtml(data.what_changed || 'Baseline verified operational state.')}</div>
            </div>

            <!-- Key Factors Human-Readable Breakdown -->
            <div class="text-xs font-bold text-muted mb-2" style="letter-spacing:0.5px;">FACTOR SUMMARY</div>
            <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; margin-bottom:12px;">
                <div class="ca-factor-item">
                    <div class="text-xs text-muted">Recent Performance</div>
                    <div class="font-bold text-sm">${escapeHtml(factors.recent_performance || '100%')}</div>
                    <div class="text-xs text-success">${Number((factors.recent_performance || '100').replace('%', '')) >= 80 ? 'Strong velocity' : 'Subpar'}</div>
                </div>
                <div class="ca-factor-item">
                    <div class="text-xs text-muted">Transaction Volume</div>
                    <div class="font-bold text-sm">${escapeHtml(factors.volume_formatted || fmt_inr(factors.transaction_volume || 0))}</div>
                    <div class="text-xs text-muted">${(factors.transaction_volume || 0) >= 50000 ? 'High activity' : 'Low activity'}</div>
                </div>
                <div class="ca-factor-item">
                    <div class="text-xs text-muted">Failed Transactions</div>
                    <div class="font-bold text-sm ${factors.failed_transactions > 0 ? 'text-danger' : 'text-success'}">${factors.failed_transactions || 0}</div>
                    <div class="text-xs text-muted">${factors.failed_transactions > 0 ? 'Penalty applied' : 'Zero failures'}</div>
                </div>
                <div class="ca-factor-item">
                    <div class="text-xs text-muted">KYC Status</div>
                    <div class="font-bold text-sm ${factors.kyc_status === 'verified' ? 'text-success' : 'text-warning'}">${escapeHtml((factors.kyc_status || 'Pending').toUpperCase())}</div>
                    <div class="text-xs text-muted">${factors.kyc_status === 'verified' ? 'Bonus active' : 'Needs attention'}</div>
                </div>
            </div>

            <!-- Recommended Actions -->
            <div style="background:rgba(59,130,246,0.06); border-left:3px solid #3B82F6; padding:10px 12px; border-radius:4px; margin-bottom:10px;">
                <div class="text-xs font-bold" style="color:#2563EB; margin-bottom:3px; display:flex; align-items:center; gap:6px;">
                    ${renderIcon('lightbulb', 12)} RECOMMENDED ACTION
                </div>
                <div class="text-xs" style="color:var(--text-main); line-height:1.4;">${escapeHtml(data.recommendations || 'Complete KYC verification and maintain consistent transaction activity.')}</div>
            </div>

            <!-- Verified Grounding Footer -->
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; color:var(--text-light); border-top:1px solid var(--border); padding-top:8px;">
                <span>${renderIcon('shield-check', 11)} Calculated from verified operational factors</span>
                <span>Last updated: Just now</span>
            </div>
        </div>
    `;
}

function onCreditFactorChange() {
    // Immediate UI feedback
    const scoreDisplay = document.getElementById('ca-score-display');
    if (scoreDisplay) {
        scoreDisplay.style.opacity = '0.5';
    }

    // Update segment active classes
    const kycChecked = document.querySelector('input[name="ca_kyc"]:checked');
    document.querySelectorAll('.ca-segment-btn').forEach(btn => {
        const inp = btn.querySelector('input');
        if (inp && kycChecked && inp.value === kycChecked.value) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (_creditDebounceTimer) clearTimeout(_creditDebounceTimer);

    _creditDebounceTimer = setTimeout(async () => {
        await executeCreditRecalculation();
    }, 120);
}

async function executeCreditRecalculation() {
    if (!_activeCreditCustomerId) return;

    const kycVal = document.querySelector('input[name="ca_kyc"]:checked')?.value || 'pending';
    const failedVal = parseInt(document.getElementById('ca-factor-failed')?.value || '0', 10);
    const volumeVal = parseFloat(document.getElementById('ca-factor-volume')?.value || '20000');
    const perfVal = document.getElementById('ca-factor-perf')?.value || '100%';
    const tenureVal = parseInt(document.getElementById('ca-factor-tenure')?.value || '2', 10);
    const riskIndVal = document.getElementById('ca-factor-risk-ind')?.value || 'none';

    try {
        const payload = {
            customer_id: _activeCreditCustomerId,
            factors: {
                kyc_status: kycVal,
                failed_transactions: failedVal,
                transaction_volume: volumeVal,
                recent_performance: perfVal,
                operational_tenure_days: tenureVal,
                risk_indicators: riskIndVal
            }
        };

        const result = await api.analyzeCreditScore(payload);
        _currentCreditData = result;

        const cardEl = document.getElementById('ca-result-card');
        if (cardEl) {
            cardEl.innerHTML = renderCreditResultCard(result);
            if (window.lucide) lucide.createIcons();
        }
    } catch (err) {
        console.error('Recalculation failed:', err);
    }
}

async function resetCreditAnalysis() {
    if (!_activeCreditCustomerId) return;
    showToast('Resetting factors to verified database state...', 'info');
    await loadCreditAnalysis(_activeCreditCustomerId);
}

function askEkoFromCreditAnalysis() {
    if (!_activeCreditCustomerId || !_currentCreditData) return;

    const customerName = _currentCreditData.customer_name || 'Partner';
    const factors = _currentCreditData.factors || {};

    closeCreditAnalysisModal();

    if (typeof setAiContext === 'function') {
        setAiContext({
            customer_id: _activeCreditCustomerId,
            label: `Credit Analysis: ${customerName}`,
            credit_factors: factors
        });
    }

    navigateTo('ask-eko');
    sendToEko(_activeCreditCustomerId, `Explain the credit assessment for ${customerName}`);
}
