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

function normalizePhoneNumber(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) {
        return '91' + digits;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
        return '91' + digits.slice(1);
    }
    if (digits.length === 12 && digits.startsWith('91')) {
        return digits;
    }
    if (digits.length > 10) {
        return '91' + digits.slice(-10);
    }
    return digits;
}
window.normalizePhoneNumber = normalizePhoneNumber;

function buildWhatsAppUrl(phone, message) {
    const norm = normalizePhoneNumber(phone);
    return `https://wa.me/${norm}?text=${encodeURIComponent(message || '')}`;
}
window.buildWhatsAppUrl = buildWhatsAppUrl;

async function loadWhatsAppStudio() {
    const listEl = document.getElementById('wa-outreach-list');
    if (!listEl) return;

    try {
        _waOutreachList = await api.getWhatsAppOutreach();
        updateWATabCounts();
        renderFilteredWARecords();
    } catch(err) {
        const errorMsg = (typeof formatErrorMessage === 'function') ? formatErrorMessage(err, 'Unable to load outreach records. Please try again.') : (err.message || 'Error communicating with backend');
        listEl.innerHTML = `
            <div class="error-state">
                <div class="error-state-title">Failed to load WhatsApp records</div>
                <div class="error-state-desc">${escapeHtml(errorMsg)}</div>
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
        const waLink = buildWhatsAppUrl(o.customer_phone, o.message);
        const normPhone = normalizePhoneNumber(o.customer_phone);
        const langDisplay = (o.language || 'hinglish').toUpperCase();

        return `
        <div class="card mb-3" style="padding:16px; border-left:4px solid ${isSent ? 'var(--success)' : isFailed ? 'var(--danger)' : '#25d366'}; cursor:pointer;" onclick="openWhatsAppModal('${o.customer_id || ''}', '${escapeHtml(o.customer_name).replace(/'/g, "\\'")}', '${escapeHtml(o.customer_phone)}', '${escapeHtml(o.language || 'hinglish')}', '${escapeHtml(o.template_type || 'custom')}')">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                <div style="flex:1; min-width:180px;">
                    <h3 style="font-size:1.05rem; font-weight:700; color:var(--navy);">${escapeHtml(o.customer_name)}</h3>
                    <div class="text-xs text-muted" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:2px;">
                        <span style="white-space:nowrap;">${renderIcon('phone', 12)} +${escapeHtml(normPhone)}</span>
                        <span>•</span>
                        <span style="white-space:nowrap;">Created: ${formatDate(o.created_at)}</span>
                        ${o.sent_at ? `<span>•</span><span class="text-success" style="white-space:nowrap;">Sent: ${formatDateTime(o.sent_at)}</span>` : ''}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                    <span class="badge ${statusBadge}">${o.status.toUpperCase()}</span>
                    <span class="badge badge-neutral" style="font-size:10px;">${(o.template_type || 'custom').toUpperCase()}</span>
                    <span class="badge" style="background:rgba(124,58,237,0.1); color:#7c3aed; font-size:10px;">${langDisplay}</span>
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
    showToast('Opening WhatsApp...', 'info');

    let nativeLaunched = false;
    if (typeof AndroidBridge !== 'undefined' && typeof AndroidBridge.openWhatsApp === 'function') {
        try {
            nativeLaunched = AndroidBridge.openWhatsApp(url);
        } catch(e) {
            nativeLaunched = false;
        }
    }

    if (!nativeLaunched) {
        if (typeof AndroidBridge !== 'undefined') {
            showToast('WhatsApp app is not available. Opening WhatsApp Web...', 'info');
        }
        try {
            window.open(url, '_blank');
        } catch(e) {
            showToast('Unable to open WhatsApp. Please check popup settings.', 'error');
            return;
        }
    }

    const match = url.match(/wa\.me\/(\d+)/);
    const dest = match && match[1] ? `+${match[1]}` : 'customer';
    setTimeout(() => {
        showToast(`WhatsApp opened for ${dest}`, 'success');
    }, 400);
}

async function markWAOpened(id) {
    try {
        await api.updateWhatsAppOutreach(id, { status: 'whatsapp_opened' });
        if (typeof AndroidBridge !== 'undefined' && AndroidBridge.scheduleOutreachReminder) {
            AndroidBridge.scheduleOutreachReminder(id, "Customer Follow-up", "Follow up on customer WhatsApp response", 3600);
        }
        setTimeout(() => loadWhatsAppStudio(), 600);
    } catch(e) {}
}

async function markWASent(id) {
    try {
        await api.updateWhatsAppOutreach(id, { status: 'sent', reminder_active: false });
        if (typeof AndroidBridge !== 'undefined' && AndroidBridge.cancelOutreachReminder) {
            AndroidBridge.cancelOutreachReminder(id);
        }
        showToast('Outreach marked as SENT!', 'success');
        loadWhatsAppStudio();
    } catch(err) {
        const msg = (typeof formatErrorMessage === 'function') ? formatErrorMessage(err, 'Update failed') : (err.message || 'Error');
        showToast('Update failed: ' + msg, 'error');
    }
}

async function markWAFailed(id) {
    try {
        await api.updateWhatsAppOutreach(id, { status: 'failed', reminder_active: false });
        if (typeof AndroidBridge !== 'undefined' && AndroidBridge.cancelOutreachReminder) {
            AndroidBridge.cancelOutreachReminder(id);
        }
        showToast('Outreach marked as expired.', 'info');
        loadWhatsAppStudio();
    } catch(err) {
        const msg = (typeof formatErrorMessage === 'function') ? formatErrorMessage(err, 'Update failed') : (err.message || 'Error');
        showToast('Update failed: ' + msg, 'error');
    }
}

async function retryOutreach(id) {
    try {
        await api.updateWhatsAppOutreach(id, { status: 'pending' });
        showToast('Outreach reopened in Pending list.', 'success');
        _waFilterTab = 'pending';
        loadWhatsAppStudio();
    } catch(err) {
        const msg = (typeof formatErrorMessage === 'function') ? formatErrorMessage(err, 'Failed to retry') : (err.message || 'Error');
        showToast('Failed to retry: ' + msg, 'error');
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

function openWhatsAppModal(customerId = null, customerName = null, customerPhone = null, language = null, templateType = null) {
    const modal = document.getElementById('whatsapp-outreach-modal');
    if (!modal) return;

    const cidEl = document.getElementById('wa-customer-id');
    const nameEl = document.getElementById('wa-cust-name');
    const phoneEl = document.getElementById('wa-cust-phone');
    const langEl = document.getElementById('wa-language');
    const ttypeEl = document.getElementById('wa-template-type');

    if (cidEl) cidEl.value = customerId || '';
    if (nameEl) nameEl.value = customerName || '';
    if (phoneEl) {
        const raw = customerPhone || '';
        phoneEl.value = raw.replace(/\D/g, '').slice(-10);
    }
    if (langEl && language) langEl.value = language.toLowerCase();
    if (ttypeEl && templateType) ttypeEl.value = templateType;

    modal.classList.remove('hidden');
    autoGenerateWAMessage();
    if (window.lucide) lucide.createIcons();
}

async function autoGenerateWAMessage() {
    const name = document.getElementById('wa-cust-name')?.value || 'Customer';
    const phone = document.getElementById('wa-cust-phone')?.value || '';
    const ttype = document.getElementById('wa-template-type')?.value || 'kyc_reminder';
    const lang = (document.getElementById('wa-language')?.value || 'hinglish').toLowerCase();
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
            return;
        }
    } catch(e) {
        // Fall back to robust client-side templates
    }

    const fallbackTemplates = {
        kyc_reminder: {
            english: `Hi ${name}, your KYC verification is still pending. Please complete it to keep your services active.`,
            hindi: `नमस्ते ${name} जी, आपका KYC verification अभी pending है। कृपया इसे पूरा कर लें ताकि आपकी services active रहें।`,
            hinglish: `Namaste ${name} ji, aapka KYC verification abhi pending hai. Please ise complete kar lijiye taaki aapki services active rahen.`
        },
        payment_reminder: {
            english: `Hello ${name}, your Eko partner account has a pending settlement balance due. Please complete the payment today to ensure uninterrupted operations.`,
            hindi: `नमस्ते ${name} जी, आपके ईको अकाउंट का बकाया सेटलमेंट भुगतान लंबित है। निर्बाध सेवाओं के लिए कृपया आज ही भुगतान करें।`,
            hinglish: `Namaste ${name} ji, aapke Eko account ka settlement balance pending hai. Kripya samay par settlement clear karein taaki services chalti rahein.`
        },
        settlement_notice: {
            english: `Hello ${name}, today's operational settlement for your Eko service point has been successfully processed and reconciled.`,
            hindi: `नमस्ते ${name} जी, आपके ईको केंद्र का आज का सेटलमेंट सफलतापूर्वक प्रोसेस हो गया है। सभी लेन-देन का मिलान पूरा हुआ।`,
            hinglish: `Namaste ${name} ji, aapke Eko center ka daily settlement report process ho chuka hai. Statement portal par check karein.`
        },
        dispute_update: {
            english: `Hello ${name}, your transaction dispute is actively being coordinated with the banking switch. Resolution will be provided within SLA.`,
            hindi: `नमस्ते ${name} जी, आपके लेन-देन विवाद पर हमारी टीम बैंक स्विच से समन्वय कर रही है। SLA के तहत जल्द समाधान किया जाएगा।`,
            hinglish: `Namaste ${name} ji, aapki transaction dispute request Eko operations desk par actively monitor ho rahi hai. 24 hours ke bheetar resolution mil jayega.`
        },
        dmt: {
            english: `Hi ${name}, instant domestic money transfer (DMT) service is active at our counter. Send money to any bank account in India instantly with 100% security.`,
            hindi: `नमस्ते ${name} जी, हमारे केंद्र पर मनी ट्रांसफर (DMT) सेवा उपलब्ध है। किसी भी बैंक खाते में तुरंत पैसे भेजें।`,
            hinglish: `Namaste ${name} ji, instant money transfer counter par chalu hai. Desh ke kisi bhi bank me turant paisa bhejein.`
        },
        aeps: {
            english: `Hi ${name}, cash withdrawal and mini statement via Aadhaar (AePS) is available at our Eko banking point.`,
            hindi: `नमस्ते ${name} जी, हमारे केंद्र पर आधार से नकद निकासी (AePS) एवं बैलेंस जांच की सुविधा उपलब्ध है।`,
            hinglish: `Namaste ${name} ji, AePS cash withdrawal aur mini statement facility counter par available hai. Instant cash aur receipt payein.`
        },
        bbps: {
            english: `Hi ${name}, pay all your electricity, water, and broadband bills instantly with instant BBPS confirmation at our counter.`,
            hindi: `नमस्ते ${name} जी, बिजली, पानी एवं सभी उपयोगी बिलों का भुगतान हमारे ईको केंद्र पर तुरंत करें एवं पक्की रसीद पाएं।`,
            hinglish: `Namaste ${name} ji, electricity, water aur broadband bills ka instant payment hamare counter par karein. Official BBPS receipt instantly mil jayegi.`
        },
        recharge: {
            english: `Hi ${name}, recharge your mobile or DTH connection instantly with exciting cashback offers at our Eko service point.`,
            hindi: `नमस्ते ${name} जी, अपने मोबाइल एवं डीटीएच का रिचार्ज हमारे ईको केंद्र पर तुरंत करवाएं और पाएं बेहतरीन ऑफर्स।`,
            hinglish: `Namaste ${name} ji, mobile aur DTH recharge counter par available hai. Instant activation aur offers payein.`
        },
        offer: {
            english: `Hello ${name}! Special festive offer: Enjoy fast money transfers, cash withdrawals, and bill payments with highest commission and zero downtime!`,
            hindi: `नमस्ते ${name} जी, इस त्योहारी सीजन में अपने ग्राहकों को ईको की मनी ट्रांसफर, AePS एवं बिल सेवाएं दें और पाएं उच्चतम कमीशन!`,
            hinglish: `Namaste ${name} ji! Is festive season apne customers ko dein Eko ki fast DMT aur AePS services. Highest commission aur instant settlement ka labh uthayein!`
        },
        custom: {
            english: `Hello ${name}, operational update from Eko Operations. Please visit your dashboard or counter for details.`,
            hindi: `नमस्ते ${name} जी, ईको डिजिटल ऑपरेशंस से संदेश। किसी भी सहायता के लिए हमें तुरंत सूचित करें।`,
            hinglish: `Namaste ${name} ji, Eko operations center se update. Kisi bhi banking sahayata ke liye sampark karein.`
        }
    };

    const group = fallbackTemplates[ttype] || fallbackTemplates['custom'];
    const text = group[lang] || group['hinglish'] || group['english'];
    msgBox.value = text;
}

function copyWAMessage() {
    const msgBox = document.getElementById('wa-message-text');
    if (!msgBox || !msgBox.value) return;
    navigator.clipboard.writeText(msgBox.value).then(() => {
        showToast('Message copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Unable to copy message.', 'error');
    });
}
window.copyWAMessage = copyWAMessage;

async function submitWhatsAppOutreach(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-wa');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    const f = new FormData(e.target);
    const cName = f.get('customer_name');
    const cPhone = f.get('customer_phone');
    const tType = f.get('template_type');
    const lang = f.get('language') || document.getElementById('wa-language')?.value || 'hinglish';
    const msg = f.get('message');
    const freq = f.get('reminder_frequency');
    const active = document.getElementById('wa-reminder-active')?.checked || false;

    const normalizedPhone = normalizePhoneNumber(cPhone);
    if (!normalizedPhone || normalizedPhone.length !== 12) {
        showToast('Please enter a valid 10-digit Indian phone number.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Save Outreach'; }
        return;
    }

    try {
        const record = await api.createWhatsAppOutreach({
            customer_id: f.get('customer_id') || null,
            customer_name: cName,
            customer_phone: normalizedPhone.slice(-10),
            template_type: tType,
            language: lang,
            message: msg
        });

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
        showToast('Outreach created in Pending list!', 'success');

        _waFilterTab = 'pending';
        if (typeof loadWhatsAppStudio === 'function') loadWhatsAppStudio();
    } catch(err) {
        const msgStr = (typeof formatErrorMessage === 'function') ? formatErrorMessage(err, 'Unable to create outreach. Please check details.') : (err.message || 'Error');
        showToast('Failed to create outreach: ' + msgStr, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save Outreach'; }
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

