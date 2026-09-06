/**
 * Eko Partner Operations — Core Services & Sandbox Engine (v1.4.0)
 * 7-Stage Sandbox Simulation: Input -> Validation -> Summary -> Confirm -> Processing -> Result -> Retry/Back
 */

let _activeSandboxState = {
    service: 'dmt',
    stage: 'input',
    formData: {},
    validationErrors: [],
    result: null
};

function renderServicesScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row mb-4">
            <div>
                <div style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; background:rgba(59,130,246,0.1); color:#1d4ed8; font-size:11px; font-weight:700; margin-bottom:6px;">
                    ${renderIcon('flask-conical', 12)} Sandbox Environment · Eko Operations v1.4.0
                </div>
                <h1 class="screen-title">Financial Services Hub</h1>
                <p class="text-sm text-muted">Execute sandbox simulations for money transfers, Aadhaar banking, bill collections, and recharges.</p>
            </div>
            <button class="btn-primary" onclick="openServiceFlow('dmt')" style="display:flex; align-items:center; gap:8px;">
                ${renderIcon('send', 16)}
                <span>Send Money</span>
            </button>
        </div>

        <!-- Service Cards Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="card service-hub-card" onclick="openServiceFlow('dmt')" style="cursor:pointer; padding:20px; transition:transform 0.2s, box-shadow 0.2s; border-top:4px solid #2563eb;">
                <div style="width:48px; height:48px; border-radius:12px; background:rgba(37,99,235,0.1); display:flex; align-items:center; justify-content:center; color:#2563eb; margin-bottom:12px;">
                    ${renderIcon('send', 24)}
                </div>
                <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:4px;">Send Money (DMT)</h3>
                <p class="text-xs text-muted" style="line-height:1.4; margin-bottom:12px;">Instant 24x7 IMPS/NEFT transfers to any Indian bank account with auto-reconciliation.</p>
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <span class="badge badge-info" style="font-size:10px;">Instant IMPS</span>
                    <span class="text-xs font-bold text-primary">Simulate ↗</span>
                </div>
            </div>

            <div class="card service-hub-card" onclick="openServiceFlow('aeps')" style="cursor:pointer; padding:20px; transition:transform 0.2s, box-shadow 0.2s; border-top:4px solid #059669;">
                <div style="width:48px; height:48px; border-radius:12px; background:rgba(5,150,105,0.1); display:flex; align-items:center; justify-content:center; color:#059669; margin-bottom:12px;">
                    ${renderIcon('fingerprint', 24)}
                </div>
                <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:4px;">Aadhaar Banking (AePS)</h3>
                <p class="text-xs text-muted" style="line-height:1.4; margin-bottom:12px;">Biometric cash withdrawal, live balance inquiry, and mini-statement services.</p>
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <span class="badge badge-success" style="font-size:10px;">Micro-ATM</span>
                    <span class="text-xs font-bold text-success">Simulate ↗</span>
                </div>
            </div>

            <div class="card service-hub-card" onclick="openServiceFlow('bbps')" style="cursor:pointer; padding:20px; transition:transform 0.2s, box-shadow 0.2s; border-top:4px solid #d97706;">
                <div style="width:48px; height:48px; border-radius:12px; background:rgba(217,119,6,0.1); display:flex; align-items:center; justify-content:center; color:#d97706; margin-bottom:12px;">
                    ${renderIcon('receipt', 24)}
                </div>
                <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:4px;">Pay Bills (BBPS)</h3>
                <p class="text-xs text-muted" style="line-height:1.4; margin-bottom:12px;">Bharat BillPay for electricity, water, municipal tax, gas cylinders, and broadband.</p>
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <span class="badge badge-warning" style="font-size:10px;">BBPS Assured</span>
                    <span class="text-xs font-bold text-warning">Simulate ↗</span>
                </div>
            </div>

            <div class="card service-hub-card" onclick="openServiceFlow('recharge')" style="cursor:pointer; padding:20px; transition:transform 0.2s, box-shadow 0.2s; border-top:4px solid #7c3aed;">
                <div style="width:48px; height:48px; border-radius:12px; background:rgba(124,58,237,0.1); display:flex; align-items:center; justify-content:center; color:#7c3aed; margin-bottom:12px;">
                    ${renderIcon('smartphone', 24)}
                </div>
                <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:4px;">Mobile Recharge</h3>
                <p class="text-xs text-muted" style="line-height:1.4; margin-bottom:12px;">Prepaid mobile &amp; DTH recharges across Jio, Airtel, Vi, BSNL, Tata Play.</p>
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <span class="badge badge-neutral" style="font-size:10px;">All Operators</span>
                    <span class="text-xs font-bold text-secondary">Simulate ↗</span>
                </div>
            </div>
        </div>

        <!-- Outreach & Growth Studio -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div class="card service-hub-card" onclick="navigateTo('whatsapp-studio')" style="cursor:pointer; padding:18px; border-left:4px solid #25d366; display:flex; align-items:center; gap:16px;">
                <div style="width:48px; height:48px; border-radius:12px; background:rgba(37,211,102,0.12); display:flex; align-items:center; justify-content:center; color:#128c7e; flex-shrink:0;">
                    ${renderIcon('message-circle', 26)}
                </div>
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 style="font-size:1rem; font-weight:700;">WhatsApp Outreach Studio</h3>
                        <span class="badge badge-success" style="font-size:10px;">Automated Follow-ups</span>
                    </div>
                    <p class="text-xs text-muted" style="margin-top:2px;">AI-drafted customer payment reminders, service updates &amp; scheduled WorkManager alerts.</p>
                </div>
                <span class="text-xs font-bold text-success">Open ↗</span>
            </div>
            <div class="card service-hub-card" onclick="navigateTo('poster-studio')" style="cursor:pointer; padding:18px; border-left:4px solid #ea580c; display:flex; align-items:center; gap:16px;">
                <div style="width:48px; height:48px; border-radius:12px; background:rgba(234,88,12,0.12); display:flex; align-items:center; justify-content:center; color:#ea580c; flex-shrink:0;">
                    ${renderIcon('image', 26)}
                </div>
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 style="font-size:1rem; font-weight:700;">Banner &amp; Poster Studio</h3>
                        <span class="badge badge-warning" style="font-size:10px;">Store Branding</span>
                    </div>
                    <p class="text-xs text-muted" style="margin-top:2px;">Create high-resolution promotional marketing banners for DMT, AePS and BBPS.</p>
                </div>
                <span class="text-xs font-bold text-warning">Open ↗</span>
            </div>
        </div>

        <!-- Recent Sandbox Activity Section -->
        <div class="card" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div>
                    <h3 style="font-size:1.05rem; font-weight:700;">Recent Service Operations</h3>
                    <p class="text-xs text-muted">Audited transaction records processed through connected partner counters.</p>
                </div>
                <button class="btn-secondary" style="font-size:12px; padding:6px 12px;" onclick="navigateTo('activity')">
                    View Transaction Center ↗
                </button>
            </div>
            <div id="services-recent-list">
                <div class="loading-state"><div class="spinner"></div></div>
            </div>
        </div>
    </div>
    `;
}

async function loadServices() {
    const listEl = document.getElementById('services-recent-list');
    if (!listEl) return;

    try {
        const activities = await api.getActivity();
        if (!activities || activities.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state" style="padding:24px;">
                    <div class="empty-state-icon">${renderIcon('activity', 24)}</div>
                    <p class="text-sm text-muted">No recent operations. Start a simulation above!</p>
                </div>`;
            return;
        }

        const recent = activities.slice(0, 6);
        listEl.innerHTML = `
            <div class="table-responsive">
                <table class="table w-full">
                    <thead>
                        <tr style="text-align:left; font-size:11px; text-transform:uppercase; color:var(--text-muted); border-bottom:1px solid var(--border);">
                            <th style="padding:8px 12px;">Service</th>
                            <th style="padding:8px 12px;">Partner / Customer</th>
                            <th style="padding:8px 12px;">Amount</th>
                            <th style="padding:8px 12px;">Status</th>
                            <th style="padding:8px 12px;">Reference ID</th>
                            <th style="padding:8px 12px;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recent.map(a => {
                            const isSuccess = a.status === 'success';
                            const isFailed = a.status === 'failed';
                            const badgeCls = isSuccess ? 'badge-success' : isFailed ? 'badge-danger' : 'badge-warning';
                            return `
                                <tr style="border-bottom:1px solid var(--border); font-size:13px; cursor:pointer;" onclick="showActivityDetail('${a.id}')">
                                    <td style="padding:10px 12px; font-weight:600;">${escapeHtml(serviceName(a.service_name))}</td>
                                    <td style="padding:10px 12px;">${escapeHtml(a.customer_name || 'Retail Counter')}</td>
                                    <td style="padding:10px 12px; font-weight:700;">₹${(a.amount || 0).toLocaleString('en-IN')}</td>
                                    <td style="padding:10px 12px;"><span class="badge ${badgeCls}">${a.status}</span></td>
                                    <td style="padding:10px 12px; font-family:monospace; font-size:11px; color:var(--text-muted);">${a.reference_id || a.id.slice(0,10)}</td>
                                    <td style="padding:10px 12px; color:var(--text-muted); font-size:12px;">${formatDateTime(a.created_at)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch(err) {
        listEl.innerHTML = `<p class="text-xs text-danger py-2">Could not load recent operations.</p>`;
    }
}

// ── 7-Stage Sandbox Flow Controller ──────────────────────────────────────────

function openServiceFlow(service) {
    _activeSandboxState = {
        service: service || 'dmt',
        stage: 'input',
        formData: {},
        validationErrors: [],
        result: null
    };
    renderSandboxModal();
}

function openServiceFlowWithContext(service, context = {}) {
    openServiceFlow(service);
    if (context.customer_name) {
        _activeSandboxState.formData.customer_name = context.customer_name;
    }
    if (context.customer_id) {
        _activeSandboxState.formData.customer_id = context.customer_id;
    }
    renderSandboxModal();
}

function renderSandboxModal() {
    const el = document.getElementById('service-flow-modal');
    const body = document.getElementById('service-flow-body');
    const title = document.getElementById('service-flow-title');
    if (!el || !body) return;

    const titles = {
        dmt: 'Send Money (DMT) · Sandbox Simulation',
        aeps: 'Aadhaar Banking (AePS) · Sandbox Simulation',
        bbps: 'Pay Bills (BBPS) · Sandbox Simulation',
        recharge: 'Mobile Recharge · Sandbox Simulation'
    };
    if (title) title.textContent = titles[_activeSandboxState.service] || 'Service Simulation';

    body.innerHTML = getSandboxStageHtml();
    el.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function getSandboxStageHtml() {
    const st = _activeSandboxState;

    // Stage Stepper Header
    const stages = ['input', 'summary', 'processing', 'result'];
    const currentIdx = st.stage === 'validation' ? 0 : stages.indexOf(st.stage);
    
    const stepperHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid var(--border);">
            <div style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; background:rgba(59,130,246,0.1); color:#1d4ed8; font-size:11px; font-weight:700;">
                ${renderIcon('flask-conical', 12)} Sandbox Flow · Demo Simulation
            </div>
            <div class="text-xs text-muted" style="text-transform:uppercase; font-weight:700; letter-spacing:0.05em;">
                Stage: <span style="color:var(--primary);">${st.stage.toUpperCase()}</span>
            </div>
        </div>
    `;

    if (st.stage === 'input' || st.stage === 'validation') {
        return stepperHtml + getServiceFormHtml(st.service);
    }
    if (st.stage === 'summary') {
        return stepperHtml + getSummaryStageHtml();
    }
    if (st.stage === 'processing') {
        return stepperHtml + getProcessingStageHtml();
    }
    if (st.stage === 'result') {
        return stepperHtml + getResultStageHtml();
    }
    return '';
}

function getServiceFormHtml(service) {
    const fd = _activeSandboxState.formData || {};
    const errs = _activeSandboxState.validationErrors || [];

    const errHtml = errs.length > 0 ? `
        <div style="padding:10px 14px; background:rgba(239,68,68,0.1); border-left:4px solid #ef4444; border-radius:6px; margin-bottom:14px; color:#b91c1c; font-size:12px;">
            <div style="font-weight:700; margin-bottom:4px;">Please correct the following:</div>
            <ul style="margin:0; padding-left:16px;">
                ${errs.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
            </ul>
        </div>
    ` : '';

    if (service === 'dmt') {
        return `
        ${errHtml}
        <form onsubmit="handleSandboxValidation(event, 'dmt')">
            <div class="form-group">
                <label class="form-label">Sender / Partner Outlet Name</label>
                <input class="form-input" name="customer_name" value="${escapeHtml(fd.customer_name || 'Sharma Telecom & Digital Seva')}" required placeholder="Retail counter or customer name">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div class="form-group">
                    <label class="form-label">Beneficiary Name</label>
                    <input class="form-input" name="receiver_name" value="${escapeHtml(fd.receiver_name || 'Amit Kumar')}" required placeholder="Recipient name (or 'FAIL')">
                </div>
                <div class="form-group">
                    <label class="form-label">Transfer Amount (₹)</label>
                    <input class="form-input" name="amount" type="number" min="10" max="50000" value="${fd.amount || 2500}" required placeholder="₹10 to ₹50,000">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div class="form-group">
                    <label class="form-label">Bank Account Number</label>
                    <input class="form-input" name="receiver_account" value="${escapeHtml(fd.receiver_account || '918273645019')}" required placeholder="Account number">
                </div>
                <div class="form-group">
                    <label class="form-label">IFSC Code</label>
                    <input class="form-input" name="receiver_ifsc" value="${escapeHtml(fd.receiver_ifsc || 'SBIN0001234')}" required placeholder="e.g. SBIN0001234">
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px; margin-bottom:16px;">
                <button type="button" class="btn-ghost" style="font-size:11px; padding:4px 8px;" onclick="fillDemoDmt(true)">⚡ Preset: Success Transfer (₹2,500)</button>
                <button type="button" class="btn-ghost" style="font-size:11px; padding:4px 8px; color:var(--danger);" onclick="fillDemoDmt(false)">⚠️ Preset: Bank Timeout Failure</button>
            </div>
            <button class="btn-primary" type="submit" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px;">
                <span>Review &amp; Validate Transfer</span>
                ${renderIcon('arrow-right', 16)}
            </button>
        </form>
        `;
    }

    if (service === 'aeps') {
        return `
        ${errHtml}
        <form onsubmit="handleSandboxValidation(event, 'aeps')">
            <div class="form-group">
                <label class="form-label">Customer Name</label>
                <input class="form-input" name="customer_name" value="${escapeHtml(fd.customer_name || 'Ramesh Chandra')}" required placeholder="Customer full name">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div class="form-group">
                    <label class="form-label">Aadhaar Last 4 Digits</label>
                    <input class="form-input" name="aadhaar_last4" maxlength="4" value="${escapeHtml(fd.aadhaar_last4 || '4829')}" required placeholder="4 digits ('0000' to test fail)">
                </div>
                <div class="form-group">
                    <label class="form-label">Operation Type</label>
                    <select class="form-input" name="service_type" onchange="toggleAePSAmountField(this.value)">
                        <option value="withdrawal" ${fd.service_type === 'withdrawal' ? 'selected' : ''}>Cash Withdrawal</option>
                        <option value="balance" ${fd.service_type === 'balance' ? 'selected' : ''}>Balance Inquiry</option>
                        <option value="mini_statement" ${fd.service_type === 'mini_statement' ? 'selected' : ''}>Mini Statement</option>
                    </select>
                </div>
            </div>
            <div class="form-group" id="aeps-amount-wrapper" style="${fd.service_type === 'balance' || fd.service_type === 'mini_statement' ? 'display:none;' : ''}">
                <label class="form-label">Withdrawal Amount (₹)</label>
                <input class="form-input" name="amount" type="number" min="100" max="10000" value="${fd.amount || 1000}" placeholder="₹100 to ₹10,000">
            </div>
            <div style="display:flex; gap:8px; margin-top:8px; margin-bottom:16px;">
                <button type="button" class="btn-ghost" style="font-size:11px; padding:4px 8px;" onclick="fillDemoAeps(true)">⚡ Preset: ₹1,000 Cash Withdrawal</button>
                <button type="button" class="btn-ghost" style="font-size:11px; padding:4px 8px; color:var(--danger);" onclick="fillDemoAeps(false)">⚠️ Preset: Biometric Timeout (0000)</button>
            </div>
            <button class="btn-primary" type="submit" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px;">
                <span>Review &amp; Validate AePS Operation</span>
                ${renderIcon('arrow-right', 16)}
            </button>
        </form>
        `;
    }

    if (service === 'bbps') {
        return `
        ${errHtml}
        <form onsubmit="handleSandboxValidation(event, 'bbps')">
            <div class="form-group">
                <label class="form-label">Consumer / Customer Name</label>
                <input class="form-input" name="customer_name" value="${escapeHtml(fd.customer_name || 'Sunita Devi')}" required placeholder="Bill payer name">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div class="form-group">
                    <label class="form-label">Bill Category</label>
                    <select class="form-input" name="category">
                        <option value="electricity" ${fd.category === 'electricity' ? 'selected' : ''}>Electricity</option>
                        <option value="water" ${fd.category === 'water' ? 'selected' : ''}>Water Utility</option>
                        <option value="gas" ${fd.category === 'gas' ? 'selected' : ''}>Piped Gas / LPG</option>
                        <option value="broadband" ${fd.category === 'broadband' ? 'selected' : ''}>Broadband &amp; Landline</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Provider / Biller Name</label>
                    <input class="form-input" name="provider" value="${escapeHtml(fd.provider || 'BSES Rajdhani Power Ltd.')}" required placeholder="e.g. BSES, Delhi Jal Board">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div class="form-group">
                    <label class="form-label">Consumer / CA Number</label>
                    <input class="form-input" name="consumer_number" value="${escapeHtml(fd.consumer_number || '10294857102')}" required placeholder="Consumer Number ('000000' fail)">
                </div>
                <div class="form-group">
                    <label class="form-label">Bill Amount (₹)</label>
                    <input class="form-input" name="amount" type="number" min="1" max="100000" value="${fd.amount || 1450}" required placeholder="Bill amount">
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px; margin-bottom:16px;">
                <button type="button" class="btn-ghost" style="font-size:11px; padding:4px 8px;" onclick="fillDemoBbps(true)">⚡ Preset: Electricity Bill ₹1,450</button>
                <button type="button" class="btn-ghost" style="font-size:11px; padding:4px 8px; color:var(--danger);" onclick="fillDemoBbps(false)">⚠️ Preset: Biller Switch Error</button>
            </div>
            <button class="btn-primary" type="submit" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px;">
                <span>Review &amp; Validate Bill Payment</span>
                ${renderIcon('arrow-right', 16)}
            </button>
        </form>
        `;
    }

    if (service === 'recharge') {
        return `
        ${errHtml}
        <form onsubmit="handleSandboxValidation(event, 'recharge')">
            <div class="form-group">
                <label class="form-label">Customer Name</label>
                <input class="form-input" name="customer_name" value="${escapeHtml(fd.customer_name || 'Anil Joshi')}" required placeholder="Customer name">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div class="form-group">
                    <label class="form-label">Mobile Number</label>
                    <input class="form-input" name="mobile_number" maxlength="10" value="${escapeHtml(fd.mobile_number || '9876543210')}" required placeholder="10-digit mobile number">
                </div>
                <div class="form-group">
                    <label class="form-label">Telecom Operator</label>
                    <select class="form-input" name="operator">
                        <option value="Jio" ${fd.operator === 'Jio' ? 'selected' : ''}>Reliance Jio</option>
                        <option value="Airtel" ${fd.operator === 'Airtel' ? 'selected' : ''}>Bharti Airtel</option>
                        <option value="Vi" ${fd.operator === 'Vi' ? 'selected' : ''}>Vodafone Idea (Vi)</option>
                        <option value="BSNL" ${fd.operator === 'BSNL' ? 'selected' : ''}>BSNL Prepaid</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Plan Amount (₹)</label>
                <input class="form-input" name="plan_amount" type="number" min="10" max="5000" value="${fd.plan_amount || 299}" required placeholder="e.g. 299">
            </div>
            <div style="display:flex; gap:8px; margin-top:8px; margin-bottom:16px;">
                <button type="button" class="btn-ghost" style="font-size:11px; padding:4px 8px;" onclick="fillDemoRecharge(299)">⚡ 1.5GB/day 28 Days (₹299)</button>
                <button type="button" class="btn-ghost" style="font-size:11px; padding:4px 8px;" onclick="fillDemoRecharge(749)">⚡ 2GB/day 84 Days (₹749)</button>
            </div>
            <button class="btn-primary" type="submit" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px;">
                <span>Review &amp; Validate Recharge</span>
                ${renderIcon('arrow-right', 16)}
            </button>
        </form>
        `;
    }
    return '';
}

function toggleAePSAmountField(val) {
    const wrap = document.getElementById('aeps-amount-wrapper');
    if (wrap) wrap.style.display = (val === 'balance' || val === 'mini_statement') ? 'none' : '';
}

// Preset helper buttons
function fillDemoDmt(isSuccess) {
    const f = document.querySelector('#service-flow-body form');
    if (!f) return;
    f.customer_name.value = "Paras General Store & Banking Point";
    f.receiver_name.value = isSuccess ? "Amit Kumar Patel" : "FAIL";
    f.receiver_account.value = "918273645019";
    f.receiver_ifsc.value = "SBIN0001234";
    f.amount.value = isSuccess ? "2500" : "99999";
}

function fillDemoAeps(isSuccess) {
    const f = document.querySelector('#service-flow-body form');
    if (!f) return;
    f.customer_name.value = "Mohammad Imran";
    f.aadhaar_last4.value = isSuccess ? "8821" : "0000";
    f.service_type.value = "withdrawal";
    toggleAePSAmountField("withdrawal");
    f.amount.value = isSuccess ? "1000" : "500";
}

function fillDemoBbps(isSuccess) {
    const f = document.querySelector('#service-flow-body form');
    if (!f) return;
    f.customer_name.value = "Verma Communication Hub";
    f.category.value = "electricity";
    f.provider.value = "BSES Rajdhani";
    f.consumer_number.value = isSuccess ? "1002948192" : "000000";
    f.amount.value = isSuccess ? "1450" : "99999";
}

function fillDemoRecharge(amt) {
    const f = document.querySelector('#service-flow-body form');
    if (!f) return;
    f.customer_name.value = "Gupta Daily Mart & CSP";
    f.mobile_number.value = "9898989898";
    f.operator.value = "Jio";
    f.plan_amount.value = amt;
}

// ── Stage 2: Validation ───────────────────────────────────────────────────────
function handleSandboxValidation(e, service) {
    e.preventDefault();
    const form = e.target;
    const f = new FormData(form);
    const errors = [];

    const data = {};
    for (const [k, v] of f.entries()) {
        data[k] = v.trim();
    }

    if (service === 'dmt') {
        const amt = parseFloat(data.amount);
        if (isNaN(amt) || amt < 10) errors.push("Amount must be at least ₹10.");
        if (!data.receiver_name) errors.push("Beneficiary name is required.");
        if (!data.receiver_account || data.receiver_account.length < 6) errors.push("Valid bank account number is required.");
        if (!data.receiver_ifsc || data.receiver_ifsc.length < 8) errors.push("Valid IFSC code (e.g. SBIN0001234) is required.");
    } else if (service === 'aeps') {
        if (!data.aadhaar_last4 || data.aadhaar_last4.length !== 4) errors.push("Aadhaar last 4 digits must be exactly 4 numbers.");
        if (data.service_type === 'withdrawal') {
            const amt = parseFloat(data.amount);
            if (isNaN(amt) || amt < 100) errors.push("Minimum cash withdrawal is ₹100.");
        }
    } else if (service === 'bbps') {
        const amt = parseFloat(data.amount);
        if (isNaN(amt) || amt < 1) errors.push("Valid bill amount is required.");
        if (!data.consumer_number) errors.push("Consumer / Account ID is required.");
    } else if (service === 'recharge') {
        if (!data.mobile_number || data.mobile_number.length !== 10) errors.push("Mobile number must be exactly 10 digits.");
        const amt = parseFloat(data.plan_amount);
        if (isNaN(amt) || amt < 10) errors.push("Recharge amount must be at least ₹10.");
    }

    _activeSandboxState.formData = data;
    _activeSandboxState.validationErrors = errors;

    if (errors.length > 0) {
        _activeSandboxState.stage = 'validation';
        renderSandboxModal();
        return;
    }

    _activeSandboxState.stage = 'summary';
    renderSandboxModal();
}

// ── Stage 3: Summary ─────────────────────────────────────────────────────────
function getSummaryStageHtml() {
    const st = _activeSandboxState;
    const fd = st.formData;
    const service = st.service;

    let rows = [];
    let estimatedFee = "₹0.00";
    let estCommission = "₹0.00";

    if (service === 'dmt') {
        const amt = parseFloat(fd.amount || 0);
        estCommission = `₹${(amt * 0.0045).toFixed(2)}`;
        rows = [
            { label: 'Beneficiary Name', value: fd.receiver_name },
            { label: 'Bank Account', value: fd.receiver_account },
            { label: 'IFSC Code', value: fd.receiver_ifsc },
            { label: 'Transfer Amount', value: `₹${amt.toLocaleString('en-IN')}`, bold: true },
            { label: 'Transfer Mode', value: 'IMPS Instant (24x7)' },
            { label: 'Partner Outlet', value: fd.customer_name },
            { label: 'Expected Partner Earning', value: estCommission, highlight: true }
        ];
    } else if (service === 'aeps') {
        const amt = parseFloat(fd.amount || 0);
        const typeLabel = { withdrawal: 'Cash Withdrawal', balance: 'Balance Check', mini_statement: 'Mini Statement' }[fd.service_type] || 'AePS';
        estCommission = fd.service_type === 'withdrawal' ? `₹${(amt * 0.004).toFixed(2)}` : '₹1.50';
        rows = [
            { label: 'Service Operation', value: typeLabel, bold: true },
            { label: 'Customer Name', value: fd.customer_name },
            { label: 'Aadhaar Reference', value: `XXXX-XXXX-${fd.aadhaar_last4}` },
            { label: 'Operation Amount', value: fd.service_type === 'withdrawal' ? `₹${amt.toLocaleString('en-IN')}` : 'N/A' },
            { label: 'Biometric Auth Gateway', value: 'NPCI Aadhaar Switch' },
            { label: 'Expected Commission', value: estCommission, highlight: true }
        ];
    } else if (service === 'bbps') {
        const amt = parseFloat(fd.amount || 0);
        estCommission = `₹${Math.max(3.5, amt * 0.002).toFixed(2)}`;
        rows = [
            { label: 'Category', value: (fd.category || '').toUpperCase() },
            { label: 'Biller / Provider', value: fd.provider },
            { label: 'Consumer Number', value: fd.consumer_number },
            { label: 'Bill Amount', value: `₹${amt.toLocaleString('en-IN')}`, bold: true },
            { label: 'Payment Channel', value: 'Bharat BillPay (BBPS)' },
            { label: 'Commission Credit', value: estCommission, highlight: true }
        ];
    } else if (service === 'recharge') {
        const amt = parseFloat(fd.plan_amount || 0);
        estCommission = `₹${(amt * 0.015).toFixed(2)}`;
        rows = [
            { label: 'Mobile Number', value: `+91 ${fd.mobile_number}` },
            { label: 'Operator', value: fd.operator },
            { label: 'Recharge Amount', value: `₹${amt.toLocaleString('en-IN')}`, bold: true },
            { label: 'Customer Name', value: fd.customer_name },
            { label: 'Estimated Margin', value: estCommission, highlight: true }
        ];
    }

    return `
        <div style="background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:16px; margin-bottom:16px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:12px; letter-spacing:0.05em;">
                Transaction Pre-Execution Summary
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${rows.map(r => `
                    <div style="display:flex; justify-content:space-between; font-size:13px; padding-bottom:6px; border-bottom:1px dashed var(--border);">
                        <span class="text-muted">${r.label}</span>
                        <span style="${r.bold ? 'font-weight:700;' : ''} ${r.highlight ? 'color:var(--success); font-weight:700;' : ''}">${escapeHtml(r.value)}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div style="padding:10px 12px; border-radius:8px; background:rgba(234,179,8,0.1); border:1px solid rgba(234,179,8,0.3); font-size:12px; color:#854d0e; margin-bottom:16px;">
            <strong>Sandbox Safety Assurance:</strong> This is a secure operational simulation. No physical bank account or wallet funds will be debited.
        </div>

        <div style="display:flex; gap:10px;">
            <button class="btn-secondary" style="flex:1;" onclick="stepBackToInput()">
                ${renderIcon('arrow-left', 14)} Edit Inputs
            </button>
            <button class="btn-primary" style="flex:2;" onclick="executeSandboxProcessing()">
                ${renderIcon('check-circle', 16)} Confirm &amp; Execute
            </button>
        </div>
    `;
}

function stepBackToInput() {
    _activeSandboxState.stage = 'input';
    renderSandboxModal();
}

// ── Stage 4 & 5: Processing Simulation ───────────────────────────────────────
function executeSandboxProcessing() {
    _activeSandboxState.stage = 'processing';
    renderSandboxModal();

    const steps = [
        "Connecting to banking switch...",
        "Validating NPCI route & limits...",
        "Simulating IMPS settlement...",
        "Recording transaction in operational ledger..."
    ];

    let stepIdx = 0;
    const stepTextEl = document.getElementById('sandbox-processing-step');
    const interval = setInterval(() => {
        stepIdx++;
        if (stepTextEl && stepIdx < steps.length) {
            stepTextEl.textContent = steps[stepIdx];
        }
    }, 450);

    // Call actual backend sandbox endpoint
    const st = _activeSandboxState;
    const fd = st.formData;
    let promise;

    if (st.service === 'dmt') {
        promise = api.initDMT({
            customer_name: fd.customer_name,
            receiver_name: fd.receiver_name,
            receiver_account: fd.receiver_account,
            receiver_ifsc: fd.receiver_ifsc,
            amount: parseFloat(fd.amount)
        });
    } else if (st.service === 'aeps') {
        promise = api.initAePS({
            customer_name: fd.customer_name,
            aadhaar_last4: fd.aadhaar_last4,
            service_type: fd.service_type,
            amount: parseFloat(fd.amount || 0)
        });
    } else if (st.service === 'bbps') {
        promise = api.initBBPS({
            customer_name: fd.customer_name,
            category: fd.category,
            provider: fd.provider,
            consumer_number: fd.consumer_number,
            amount: parseFloat(fd.amount)
        });
    } else if (st.service === 'recharge') {
        promise = api.initRecharge({
            customer_name: fd.customer_name,
            mobile_number: fd.mobile_number,
            operator: fd.operator,
            plan_amount: parseFloat(fd.plan_amount)
        });
    }

    promise.then(res => {
        clearInterval(interval);
        setTimeout(() => {
            _activeSandboxState.result = res;
            _activeSandboxState.stage = 'result';
            renderSandboxModal();
            if (typeof loadServices === 'function') loadServices();
            if (typeof loadHomeScreen === 'function') loadHomeScreen();
        }, 1200);
    }).catch(err => {
        clearInterval(interval);
        _activeSandboxState.result = {
            status: 'failed',
            failure_reason: err.message || 'Simulation network error',
            amount: parseFloat(fd.amount || fd.plan_amount || 0)
        };
        _activeSandboxState.stage = 'result';
        renderSandboxModal();
    });
}

function getProcessingStageHtml() {
    return `
        <div style="text-align:center; padding:36px 16px;">
            <div class="spinner" style="width:48px; height:48px; margin:0 auto 20px; border-width:4px;"></div>
            <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:8px;">Processing Operation</h3>
            <p id="sandbox-processing-step" class="text-xs text-muted" style="min-height:18px;">Connecting to banking switch...</p>
            <div style="margin-top:20px; display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:999px; background:rgba(59,130,246,0.1); color:#1d4ed8; font-size:11px; font-weight:600;">
                ${renderIcon('shield-check', 12)} End-to-End Audit Trail Active
            </div>
        </div>
    `;
}

// ── Stage 6 & 7: Result & Retry/Back ─────────────────────────────────────────
function getResultStageHtml() {
    const res = _activeSandboxState.result || {};
    const isSuccess = res.status === 'success';
    const st = _activeSandboxState;
    const label = { dmt: 'Send Money', aeps: 'AePS', bbps: 'Bill Payment', recharge: 'Recharge' }[st.service] || 'Service';

    return `
        <div style="text-align:center; padding:16px 8px;">
            <div style="width:64px; height:64px; border-radius:50%; margin:0 auto 16px;
                background:${isSuccess ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'};
                display:flex; align-items:center; justify-content:center;">
                ${renderIcon(isSuccess ? 'check-circle' : 'x-circle', 36, isSuccess ? 'text-success' : 'text-danger')}
            </div>
            <h3 style="font-size:1.25rem; font-weight:800; color:${isSuccess ? 'var(--success)' : 'var(--danger)'};">
                ${isSuccess ? 'Transaction Completed' : 'Transaction Failed'}
            </h3>
            <p class="text-sm text-muted mt-1">${label} · ₹${(res.amount || 0).toLocaleString('en-IN')}</p>

            ${res.reference_id ? `
                <div style="display:inline-block; margin-top:8px; padding:4px 12px; background:var(--bg); border:1px solid var(--border); border-radius:6px; font-family:monospace; font-size:12px;">
                    Ref: ${res.reference_id}
                </div>
            ` : ''}

            ${!isSuccess && res.failure_reason ? `
                <div style="margin-top:16px; padding:14px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px; text-align:left;">
                    <div class="text-xs font-bold text-danger mb-1">${renderIcon('alert-triangle', 12)} Failure Root Cause</div>
                    <div class="text-xs text-danger" style="line-height:1.5;">${escapeHtml(res.failure_reason)}</div>
                    <div class="text-xs text-muted mt-2">To test customer resolution workflows, you can file an operational complaint for this incident.</div>
                </div>
            ` : ''}

            ${isSuccess && res.commission ? `
                <div style="margin-top:16px; padding:12px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span class="text-xs text-muted font-semibold">Partner Commission Earned</span>
                    <span class="text-sm font-bold text-success">+₹${(res.commission || 0).toFixed(2)}</span>
                </div>
            ` : ''}

            <div style="display:flex; flex-direction:column; gap:10px; margin-top:24px;">
                ${!isSuccess ? `
                    <button class="btn-primary" style="background:var(--danger); border-color:var(--danger);" onclick="closeModal('service-flow-modal'); openCreateComplaintModal('${res.id || ''}', '${st.formData.customer_id || ''}', '${escapeHtml(st.formData.customer_name || '')}');">
                        ${renderIcon('message-square-warning', 16)} File Operational Complaint
                    </button>
                    <button class="btn-secondary" onclick="openServiceFlow('${st.service}')">
                        ${renderIcon('rotate-ccw', 14)} Retry Simulation
                    </button>
                ` : `
                    <button class="btn-primary" onclick="closeModal('service-flow-modal'); navigateTo('activity');">
                        ${renderIcon('external-link', 16)} View in Transaction Center
                    </button>
                    <button class="btn-secondary" onclick="openServiceFlow('${st.service}')">
                        ${renderIcon('plus-circle', 14)} Run Another Transfer
                    </button>
                `}
                <button class="btn-ghost" onclick="closeModal('service-flow-modal')">Close Window</button>
            </div>
        </div>
    `;
}

window.renderServicesScreen = renderServicesScreen;
window.loadServices = loadServices;
window.openServiceFlow = openServiceFlow;
window.openServiceFlowWithContext = openServiceFlowWithContext;
window.handleSandboxValidation = handleSandboxValidation;
window.stepBackToInput = stepBackToInput;
window.executeSandboxProcessing = executeSandboxProcessing;
window.toggleAePSAmountField = toggleAePSAmountField;
window.fillDemoDmt = fillDemoDmt;
window.fillDemoAeps = fillDemoAeps;
window.fillDemoBbps = fillDemoBbps;
window.fillDemoRecharge = fillDemoRecharge;
