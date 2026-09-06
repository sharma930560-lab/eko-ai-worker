/**
 * Eko Partner Operations — WhatsApp Studio & Automated Outreach (v1.4.0)
 * 3-Tab Lifecycle: Pending -> Sent -> Failed with WorkManager Follow-up Reminders
 */

let _waOutreachList = [];
let _waFilterTab = 'pending';
let _waSearchTerm = '';

function renderWhatsAppStudioScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row mb-4">
            <div>
                <div style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; background:rgba(37,211,102,0.1); color:#128c7e; font-size:11px; font-weight:700; margin-bottom:6px;">
                    ${renderIcon('message-circle', 12)} WhatsApp Business Studio · v1.4.0
                </div>
                <h1 class="screen-title">WhatsApp Outreach &amp; Studio</h1>
                <p class="text-sm text-muted">Generate AI-grounded customer messages, send via WhatsApp deep-link, and track automated reminders.</p>
            </div>
            <button class="btn-primary" style="background:#25d366; border-color:#25d366; color:#fff; display:flex; align-items:center; gap:8px;" onclick="openWhatsAppModal()">
                ${renderIcon('plus', 16)}
                <span>New Outreach</span>
            </button>
        </div>

        <!-- Search & Filter Controls -->
        <div class="search-bar mb-4">
            <i data-lucide="search" class="search-bar-icon"></i>
            <input type="text" id="wa-search-input" class="form-input" placeholder="Search by customer name, phone, or template..." oninput="handleWASearch(this.value)">
        </div>

        <div class="filter-tabs mb-4" style="overflow-x:auto; scrollbar-width:none; padding-bottom:4px;">
            <button class="filter-tab active" data-tab="pending" onclick="filterWATab('pending')">
                Pending <span class="tab-count" id="wa-count-pending">0</span>
            </button>
            <button class="filter-tab" data-tab="sent" onclick="filterWATab('sent')">
                Sent <span class="tab-count" id="wa-count-sent">0</span>
            </button>
            <button class="filter-tab" data-tab="delivered" onclick="filterWATab('delivered')">
                Delivered <span class="tab-count" id="wa-count-delivered">0</span>
            </button>
            <button class="filter-tab" data-tab="read" onclick="filterWATab('read')">
                Read <span class="tab-count" id="wa-count-read">0</span>
            </button>
            <button class="filter-tab" data-tab="failed" onclick="filterWATab('failed')">
                Failed <span class="tab-count" id="wa-count-failed">0</span>
            </button>
            <button class="filter-tab" data-tab="all" onclick="filterWATab('all')">
                All <span class="tab-count" id="wa-count-all">0</span>
            </button>
        </div>

        <!-- Outreach Items List -->
        <div id="wa-outreach-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>
    `;
}

async function loadWhatsAppStudio() {
    const listEl = document.getElementById('wa-outreach-list');
    if (!listEl) return;

    try {
        _waOutreachList = await api.getWhatsAppOutreach();
        updateWATabCounts();
        renderFilteredWARecords();
    } catch(err) {
        listEl.innerHTML = `
            <div class="error-state">
                <div class="error-state-title">Failed to load WhatsApp records</div>
                <div class="error-state-desc">${escapeHtml(err.message || 'Error communicating with backend')}</div>
            </div>`;
    }
}

function updateWATabCounts() {
    const total = _waOutreachList.length;
    const pending = _waOutreachList.filter(o => o.status === 'pending' || o.status === 'draft' || o.status === 'whatsapp_opened').length;
    const sent = _waOutreachList.filter(o => o.status === 'sent').length;
    const delivered = _waOutreachList.filter(o => o.status === 'delivered').length;
    const read = _waOutreachList.filter(o => o.status === 'read').length;
    const failed = _waOutreachList.filter(o => o.status === 'failed' || o.status === 'cancelled').length;

    const elP = document.getElementById('wa-count-pending');
    const elS = document.getElementById('wa-count-sent');
    const elD = document.getElementById('wa-count-delivered');
    const elR = document.getElementById('wa-count-read');
    const elF = document.getElementById('wa-count-failed');
    const elA = document.getElementById('wa-count-all');

    if (elP) elP.textContent = pending;
    if (elS) elS.textContent = sent;
    if (elD) elD.textContent = delivered;
    if (elR) elR.textContent = read;
    if (elF) elF.textContent = failed;
    if (elA) elA.textContent = total;
}

function filterWATab(tab) {
    _waFilterTab = tab;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    renderFilteredWARecords();
}

function handleWASearch(val) {
    _waSearchTerm = (val || '').toLowerCase().trim();
    renderFilteredWARecords();
}

function renderFilteredWARecords() {
    const listEl = document.getElementById('wa-outreach-list');
    if (!listEl) return;

    let filtered = _waOutreachList.filter(o => {
        const s = (o.status || '').toLowerCase();
        let matchesTab = true;
        if (_waFilterTab === 'pending') matchesTab = (s === 'pending' || s === 'draft' || s === 'whatsapp_opened');
        else if (_waFilterTab === 'sent') matchesTab = (s === 'sent');
        else if (_waFilterTab === 'delivered') matchesTab = (s === 'delivered');
        else if (_waFilterTab === 'read') matchesTab = (s === 'read');
        else if (_waFilterTab === 'failed') matchesTab = (s === 'failed' || s === 'cancelled');

        const matchesSearch = !_waSearchTerm ||
            (o.customer_name && o.customer_name.toLowerCase().includes(_waSearchTerm)) ||
            (o.customer_phone && o.customer_phone.includes(_waSearchTerm)) ||
            (o.template_type && o.template_type.toLowerCase().includes(_waSearchTerm)) ||
            (o.message && o.message.toLowerCase().includes(_waSearchTerm));

        return matchesTab && matchesSearch;
    });

    if (filtered.length === 0) {
        let emptyMsg = 'No outreach records found.';
        if (_waFilterTab === 'pending') emptyMsg = 'No pending WhatsApp outreach.';
        else if (_waFilterTab === 'sent') emptyMsg = 'No sent WhatsApp outreach records.';
        else if (_waFilterTab === 'delivered') emptyMsg = 'No delivered WhatsApp messages.';
        else if (_waFilterTab === 'read') emptyMsg = 'No read receipts recorded.';
        else if (_waFilterTab === 'failed') emptyMsg = 'No failed or expired outreach.';

        listEl.innerHTML = `
            <div class="empty-state" style="padding:40px 16px;">
                <div class="empty-state-icon" style="color:#25d366;">${renderIcon('message-circle', 36)}</div>
                <h3 style="margin-top:10px; font-weight:700;">${escapeHtml(emptyMsg)}</h3>
                <p class="text-sm text-muted">${_waSearchTerm ? 'No records match your search filter.' : 'All customer follow-ups are up to date! Click "+ New Outreach" to start.'}</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    listEl.innerHTML = filtered.map(o => {
        const isSent = o.status === 'sent' || o.status === 'delivered' || o.status === 'read';
        const isPending = o.status === 'pending' || o.status === 'draft' || o.status === 'whatsapp_opened';
        const isFailed = o.status === 'failed' || o.status === 'cancelled';

        const statusBadge = isSent ? 'badge-success' : isFailed ? 'badge-danger' : 'badge-warning';
        const phoneFormatted = o.customer_phone.replace(/\D/g, '');
        const waLink = `https://wa.me/91${phoneFormatted.slice(-10)}?text=${encodeURIComponent(o.message)}`;

        return `
        <div class="card mb-3" style="padding:16px; border-left:4px solid ${isSent ? 'var(--success)' : isFailed ? 'var(--danger)' : '#25d366'}; cursor:pointer;" onclick="openWhatsAppModal('${o.customer_id || ''}', '${escapeHtml(o.customer_name).replace(/'/g, "\\'")}', '${escapeHtml(o.customer_phone)}')">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                <div style="flex:1; min-width:180px;">
                    <h3 style="font-size:1.05rem; font-weight:700; color:var(--navy);">${escapeHtml(o.customer_name)}</h3>
                    <div class="text-xs text-muted" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:2px;">
                        <span style="white-space:nowrap;">${renderIcon('phone', 12)} +91 ${escapeHtml(o.customer_phone)}</span>
                        <span>•</span>
                        <span style="white-space:nowrap;">Created: ${formatDate(o.created_at)}</span>
                        ${o.sent_at ? `<span>•</span><span class="text-success" style="white-space:nowrap;">Sent: ${formatDateTime(o.sent_at)}</span>` : ''}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                    <span class="badge ${statusBadge}">${o.status.toUpperCase()}</span>
                    <span class="badge badge-neutral" style="font-size:10px;">${(o.template_type || 'custom').toUpperCase()}</span>
                </div>
            </div>

            <!-- Message Preview -->
            <div style="padding:10px 12px; background:var(--bg); border-radius:8px; font-size:13px; line-height:1.5; color:var(--text-main); margin-bottom:12px; border:1px solid var(--border);">
                ${escapeHtml(o.message)}
            </div>

            <!-- Reminder Status Info -->
            ${o.reminder_frequency && o.reminder_frequency !== 'none' ? `
                <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-muted); margin-bottom:12px;" onclick="event.stopPropagation()">
                    ${renderIcon('bell', 12, o.reminder_active ? 'text-warning' : '')}
                    <span>Reminder: <strong>${o.reminder_frequency}</strong></span>
                    <span>•</span>
                    <span style="color:${o.reminder_active ? 'var(--success)' : 'var(--muted)'}; font-weight:600;">
                        ${o.reminder_active ? 'Active on WorkManager' : 'Paused'}
                    </span>
                    <button class="btn-ghost" style="padding:1px 6px; font-size:10px;" onclick="toggleWAReminder('${o.id}', ${!o.reminder_active})">
                        ${o.reminder_active ? 'Pause' : 'Resume'}
                    </button>
                </div>
            ` : ''}

            <!-- Action Controls -->
            <div style="display:flex; gap:8px; flex-wrap:wrap;" onclick="event.stopPropagation()">
                ${isPending ? `
                    <button class="btn-primary" style="background:#25d366; border-color:#25d366; color:#fff; font-size:12px; padding:6px 14px; display:inline-flex; align-items:center; gap:6px;" onclick="launchWhatsAppLink('${waLink}', '${o.id}')">
                        ${renderIcon('message-circle', 14)} Open WhatsApp ↗
                    </button>
                    <button class="btn-secondary" style="font-size:12px; padding:6px 14px;" onclick="markWASent('${o.id}')">
                        ${renderIcon('check', 14)} Mark as Sent
                    </button>
                    <button class="btn-ghost" style="font-size:12px; padding:6px 10px; color:var(--danger);" onclick="markWAFailed('${o.id}')">
                        Cancel / Expired
                    </button>
                ` : isSent ? `
                    <span class="text-xs text-success font-bold" style="display:inline-flex; align-items:center; gap:4px; padding:6px 0;">
                        ${renderIcon('check-circle', 14)} Verified Delivered to Customer
                    </span>
                ` : `
                    <button class="btn-secondary" style="font-size:12px; padding:6px 12px;" onclick="retryOutreach('${o.id}')">
                        ${renderIcon('rotate-ccw', 14)} Re-Open Outreach
                    </button>
                `}
            </div>
        </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function launchWhatsAppLink(url, id = null) {
    if (id) {
        markWAOpened(id);
    }
    if (typeof AndroidBridge !== 'undefined' && AndroidBridge.openWhatsApp) {
        try {
            AndroidBridge.openWhatsApp(url);
            return;
        } catch(e) {}
    }
    window.open(url, '_blank');
}

async function markWAOpened(id) {
    try {
        await api.updateWhatsAppOutreach(id, { status: 'whatsapp_opened' });
        // Schedule Android WorkManager notification if bridge is present
        if (typeof AndroidBridge !== 'undefined' && AndroidBridge.scheduleOutreachReminder) {
            AndroidBridge.scheduleOutreachReminder(id, "Customer Follow-up", "Follow up on customer WhatsApp response", 3600);
        }
        setTimeout(() => loadWhatsAppStudio(), 800);
    } catch(e) {}
}

async function markWASent(id) {
    try {
        await api.updateWhatsAppOutreach(id, { status: 'sent' });
        if (typeof AndroidBridge !== 'undefined' && AndroidBridge.cancelOutreachReminder) {
            AndroidBridge.cancelOutreachReminder(id);
        }
        showToast('Outreach marked as SENT!', 'success');
        loadWhatsAppStudio();
    } catch(err) {
        showToast('Update failed: ' + (err.message || 'Error'), 'error');
    }
}

async function markWAFailed(id) {
    try {
        await api.updateWhatsAppOutreach(id, { status: 'failed' });
        if (typeof AndroidBridge !== 'undefined' && AndroidBridge.cancelOutreachReminder) {
            AndroidBridge.cancelOutreachReminder(id);
        }
        showToast('Outreach marked as expired.', 'info');
        loadWhatsAppStudio();
    } catch(err) {
        showToast('Update failed: ' + (err.message || 'Error'), 'error');
    }
}

async function retryOutreach(id) {
    try {
        await api.updateWhatsAppOutreach(id, { status: 'pending' });
        showToast('Outreach reopened in Pending list.', 'success');
        _waFilterTab = 'pending';
        loadWhatsAppStudio();
    } catch(err) {
        showToast('Failed to retry: ' + (err.message || 'Error'), 'error');
    }
}

async function toggleWAReminder(id, active) {
    try {
        await api.updateWhatsAppOutreach(id, { reminder_active: active });
        if (typeof AndroidBridge !== 'undefined') {
            if (active && AndroidBridge.scheduleOutreachReminder) {
                AndroidBridge.scheduleOutreachReminder(id, "Customer Follow-up", "Follow up on customer WhatsApp response", 3600);
            } else if (!active && AndroidBridge.cancelOutreachReminder) {
                AndroidBridge.cancelOutreachReminder(id);
            }
        }
        showToast(`Reminder ${active ? 'resumed' : 'paused'}.`, 'info');
        loadWhatsAppStudio();
    } catch(err) {
        showToast('Failed to update reminder.', 'error');
    }
}

// ── Compose & AI Generator ───────────────────────────────────────────────────

function openWhatsAppModal(customerId = null, customerName = null, customerPhone = null) {
    const modal = document.getElementById('whatsapp-outreach-modal');
    if (!modal) return;

    const cidEl = document.getElementById('wa-customer-id');
    const nameEl = document.getElementById('wa-cust-name');
    const phoneEl = document.getElementById('wa-cust-phone');

    if (cidEl) cidEl.value = customerId || '';
    if (nameEl) nameEl.value = customerName || '';
    if (phoneEl) phoneEl.value = customerPhone ? customerPhone.replace(/\D/g, '').slice(-10) : '';

    modal.classList.remove('hidden');
    autoGenerateWAMessage();
    if (window.lucide) lucide.createIcons();
}

async function autoGenerateWAMessage() {
    const name = document.getElementById('wa-cust-name')?.value || 'Partner';
    const phone = document.getElementById('wa-cust-phone')?.value || '';
    const ttype = document.getElementById('wa-template-type')?.value || 'kyc_reminder';
    const lang = document.getElementById('wa-language')?.value || 'hinglish';
    const msgBox = document.getElementById('wa-message-text');

    if (!msgBox) return;
    try {
        const res = await api.generateWhatsAppMessage({
            customer_name: name,
            customer_phone: phone,
            template_type: ttype,
            language: lang
        });
        if (res && res.message) {
            msgBox.value = res.message;
        }
    } catch(e) {
        // Fallback deterministic copy
        if (ttype === 'kyc_reminder') {
            msgBox.value = `Namaste ${name} ji, Eko operations team ki taraf se pranam. Aapka KYC verification process abhi pending hai. Kripya apna Aadhaar aur PAN verify karwayein taaki transaction limit active ho sakein.`;
        } else if (ttype === 'payment_reminder') {
            msgBox.value = `Namaste ${name} ji, Aapke Eko partner account ka pending settlement due hai. Kripya samay par settlement clear karein taaki services chalti rahein.`;
        } else {
            msgBox.value = `Namaste ${name} ji, Eko operations center se update. Kisi bhi digital banking sahayata ke liye sampark karein.`;
        }
    }
}

async function submitWhatsAppOutreach(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-wa');
    if (btn) { btn.disabled = true; btn.textContent = 'Launching…'; }

    const f = new FormData(e.target);
    const cName = f.get('customer_name');
    const cPhone = f.get('customer_phone');
    const tType = f.get('template_type');
    const msg = f.get('message');
    const freq = f.get('reminder_frequency');
    const active = document.getElementById('wa-reminder-active')?.checked || false;

    try {
        const record = await api.createWhatsAppOutreach({
            customer_id: f.get('customer_id') || null,
            customer_name: cName,
            customer_phone: cPhone,
            template_type: tType,
            message: msg
        });

        // Set reminder preferences
        if (freq !== 'none') {
            await api.updateWhatsAppOutreach(record.id, {
                reminder_frequency: freq,
                reminder_active: active
            });
            if (typeof AndroidBridge !== 'undefined' && AndroidBridge.scheduleOutreachReminder && active) {
                const sec = freq === 'once' ? 3600 : freq === '4hours' ? 14400 : 86400;
                AndroidBridge.scheduleOutreachReminder(record.id, `Follow up: ${cName}`, `WhatsApp follow-up reminder for ${cName}`, sec);
            }
        }

        closeModal('whatsapp-outreach-modal');
        e.target.reset();
        showToast('Outreach saved! Opening WhatsApp…', 'success');

        // Launch WhatsApp link
        const cleanPhone = cPhone.replace(/\D/g, '').slice(-10);
        const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');

        if (typeof loadWhatsAppStudio === 'function') loadWhatsAppStudio();
    } catch(err) {
        showToast('Failed to create outreach: ' + (err.message || 'Error'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save & Launch WhatsApp'; }
    }
}

window.renderWhatsAppStudioScreen = renderWhatsAppStudioScreen;
window.loadWhatsAppStudio = loadWhatsAppStudio;
window.openWhatsAppModal = openWhatsAppModal;
window.filterWATab = filterWATab;
window.handleWASearch = handleWASearch;
window.autoGenerateWAMessage = autoGenerateWAMessage;
window.submitWhatsAppOutreach = submitWhatsAppOutreach;
window.markWAOpened = markWAOpened;
window.markWASent = markWASent;
window.markWAFailed = markWAFailed;
window.retryOutreach = retryOutreach;
window.toggleWAReminder = toggleWAReminder;
