/**
 * Eko AI Operations — Utility Tools Suite
 */

let activeAiTab = 'scanner';
let _voiceRecording = false;
let _recognition = null;

function renderAiToolsScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">AI Operational Suite</h1>
                <p class="text-sm text-muted">Productivity superpowers for Eko partners.</p>
            </div>
        </div>

        <div style="display:flex; background:var(--surface); padding:4px; border-radius:var(--radius-md); gap:4px; margin-bottom:24px; border:1px solid var(--border);">
            <button class="segment-tab ${activeAiTab === 'scanner' ? 'active' : ''}" onclick="switchAiToolTab('scanner')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px;">
                ${renderIcon('scan', 16)} <span class="nav-label">Scanner</span>
            </button>
            <button class="segment-tab ${activeAiTab === 'voice' ? 'active' : ''}" onclick="switchAiToolTab('voice')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px;">
                ${renderIcon('mic', 16)} <span class="nav-label">Voice</span>
            </button>
            <button class="segment-tab ${activeAiTab === 'whatsapp' ? 'active' : ''}" onclick="switchAiToolTab('whatsapp')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px;">
                ${renderIcon('message-circle', 16)} <span class="nav-label">Studio</span>
            </button>
            <button class="segment-tab ${activeAiTab === 'flyer' ? 'active' : ''}" onclick="switchAiToolTab('flyer')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px;">
                ${renderIcon('megaphone', 16)} <span class="nav-label">Campaign</span>
            </button>
        </div>

        <div id="ai-tool-content"></div>
    </div>`;
}

function switchAiToolTab(tab) {
    activeAiTab = tab;
    const container = document.getElementById('ai-tool-content');
    if (!container) return;

    document.querySelectorAll('.segment-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.segment-tab').forEach(b => {
        const label = b.querySelector('.nav-label')?.textContent.trim().toLowerCase();
        if (
            (tab === 'scanner'  && label === 'scanner')  ||
            (tab === 'voice'    && label === 'voice')    ||
            (tab === 'whatsapp' && label === 'studio')   ||
            (tab === 'flyer'    && label === 'campaign')
        ) b.classList.add('active');
    });

    if (tab === 'scanner') {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding:48px 24px; border-style:dashed;">
                <div style="width:64px; height:64px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
                    ${renderIcon('camera', 32)}
                </div>
                <h3>Bill &amp; Document Scanner</h3>
                <p class="text-sm text-muted mt-2 mb-6">Capture utility bills for automated BBPS data extraction.</p>
                <button class="btn-primary" onclick="triggerBillCapture()">
                    <span>Scan Document</span>
                </button>
            </div>
            <div id="scanner-result-box" class="mt-6"></div>
        `;
    } else if (tab === 'voice') {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding:48px 24px; border-style:dashed;">
                <div id="voice-mic-btn" style="width:64px; height:64px; border-radius:50%; background:var(--primary); color:#FFF; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; cursor:pointer;" onclick="toggleVoiceRecording()">
                    ${renderIcon('mic', 32)}
                </div>
                <h3 id="voice-mic-label">Voice Activity Records</h3>
                <p class="text-sm text-muted mt-2">Log service events using vernacular voice commands. Tap the mic to start.</p>
            </div>
            <div id="voice-result-box" class="mt-6"></div>
        `;
    } else if (tab === 'whatsapp') {
        container.innerHTML = `
            <div class="card" style="padding:20px; margin-bottom:16px;">
                <div class="font-bold mb-3" style="display:flex; align-items:center; gap:8px; color:var(--primary);">
                    ${renderIcon('message-circle', 18)} WhatsApp Message Studio
                </div>
                <p class="text-sm text-muted mb-4">Generate professional customer-facing messages in English, Hindi, or Hinglish. Paste into WhatsApp with one tap.</p>
                <div class="form-group">
                    <label class="form-label">Message Context / Topic</label>
                    <select id="wa-template" class="form-input" onchange="prefillWaContext(this.value)">
                        <option value="">— Select a template —</option>
                        <option value="dmt_success">✅ DMT Transfer Successful</option>
                        <option value="dmt_failed">❌ DMT Transfer Failed</option>
                        <option value="aeps_success">✅ AePS Cash Withdrawal Done</option>
                        <option value="bbps_success">✅ Bill Payment Successful</option>
                        <option value="recharge_success">✅ Mobile Recharge Done</option>
                        <option value="complaint_update">📋 Complaint Status Update</option>
                        <option value="custom">✏️ Custom Message</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Recipient Name</label>
                    <input id="wa-recipient" class="form-input" placeholder="e.g. Rajesh Kumar" />
                </div>
                <div class="form-group">
                    <label class="form-label">Additional Details (Amount, Ref ID, etc.)</label>
                    <textarea id="wa-details" class="form-input" rows="2" placeholder="e.g. ₹5,000 transferred to HDFC XXXX1234, Ref: EKO20240901..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Language</label>
                    <select id="wa-lang" class="form-input">
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Hinglish">Hinglish</option>
                    </select>
                </div>
                <button class="btn-primary" style="width:100%;" onclick="generateWaMessage()">
                    ${renderIcon('sparkles', 16)} Generate Message with AI
                </button>
            </div>
            <div id="wa-result-box"></div>
        `;
    } else if (tab === 'flyer') {
        container.innerHTML = `
            <div class="card" style="padding:20px; margin-bottom:16px;">
                <div class="font-bold mb-3" style="display:flex; align-items:center; gap:8px; color:var(--primary);">
                    ${renderIcon('megaphone', 18)} Campaign Broadcaster
                </div>
                <p class="text-sm text-muted mb-4">Compose bulk campaign announcements for your partner network. AI drafts it, you broadcast it.</p>
                <div class="form-group">
                    <label class="form-label">Campaign Type</label>
                    <select id="camp-type" class="form-input">
                        <option value="offer">🎁 New Offer / Scheme</option>
                        <option value="alert">⚠️ Service Alert</option>
                        <option value="reminder">🔔 Payment Reminder</option>
                        <option value="motivation">🚀 Partner Motivation</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Key Message / Highlights</label>
                    <textarea id="camp-details" class="form-input" rows="3" placeholder="e.g. DMT commission increased to 1.2% this week. Minimum 5 transactions to qualify..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Target Audience</label>
                    <select id="camp-audience" class="form-input">
                        <option value="all partners">All Partners</option>
                        <option value="retailers">Retailers Only</option>
                        <option value="enterprise partners">Enterprise Partners</option>
                        <option value="inactive partners">Inactive Partners</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Language</label>
                    <select id="camp-lang" class="form-input">
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Hinglish">Hinglish</option>
                    </select>
                </div>
                <button class="btn-primary" style="width:100%;" onclick="generateCampaign()">
                    ${renderIcon('sparkles', 16)} Draft Campaign with AI
                </button>
            </div>
            <div id="campaign-result-box"></div>
        `;
    }
    if (window.lucide) lucide.createIcons();
}

// ── Voice Recording ────────────────────────────────────────────────────────────
function toggleVoiceRecording() {
    const btn = document.getElementById('voice-mic-btn');
    const label = document.getElementById('voice-mic-label');
    const resultBox = document.getElementById('voice-result-box');

    // Android native path
    if (typeof AndroidBridge !== 'undefined' && AndroidBridge.startVoiceRecording) {
        if (!_voiceRecording) {
            _voiceRecording = true;
            if (btn) { btn.style.background = 'var(--danger)'; }
            if (label) label.textContent = 'Recording… Tap to stop';
            AndroidBridge.startVoiceRecording();
        } else {
            _voiceRecording = false;
            if (btn) { btn.style.background = 'var(--primary)'; }
            if (label) label.textContent = 'Voice Activity Records';
            if (AndroidBridge.stopVoiceRecording) AndroidBridge.stopVoiceRecording();
        }
        return;
    }

    // Web Speech API path
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        if (resultBox) {
            resultBox.innerHTML = `
                <div class="card" style="padding:16px; background:var(--warning-bg); border-color:var(--warning);">
                    <div class="font-bold text-sm mb-1" style="color:var(--warning-dark);">${renderIcon('info', 14)} Voice Requires Microphone Access</div>
                    <div class="text-sm text-muted">Voice commands work in Chrome/Edge on desktop, or via the Eko Android App. On this browser, use the <strong>Ask Eko AI</strong> chat for natural language queries.</div>
                    <button class="btn-primary mt-3" onclick="navigateTo('ask-eko')" style="font-size:0.85rem;">
                        ${renderIcon('sparkles', 14)} Open Ask Eko AI Chat
                    </button>
                </div>`;
            if (window.lucide) lucide.createIcons();
        }
        return;
    }

    if (_voiceRecording && _recognition) {
        _recognition.stop();
        return;
    }

    _recognition = new SpeechRecognition();
    _recognition.lang = 'hi-IN';
    _recognition.interimResults = true;
    _recognition.continuous = false;

    _recognition.onstart = () => {
        _voiceRecording = true;
        if (btn) { btn.style.background = 'var(--danger)'; }
        if (label) label.textContent = 'Listening… speak now';
        if (resultBox) resultBox.innerHTML = `<div class="card" style="padding:14px; border-style:dashed;"><div class="text-sm text-muted text-center">🎙 Listening...</div></div>`;
    };

    _recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
        if (resultBox) {
            resultBox.innerHTML = `
                <div class="card" style="padding:16px;">
                    <div class="text-xs text-muted font-bold mb-2">VOICE INPUT CAPTURED</div>
                    <div class="font-semibold text-sm mb-3">"${escapeHtml(transcript)}"</div>
                    <button class="btn-primary" style="width:100%;" onclick="navigateTo('ask-eko'); setTimeout(() => { const inp = document.getElementById('eko-input'); if(inp){ inp.value=${JSON.stringify(transcript)}; sendToEko(); } }, 400);">
                        ${renderIcon('sparkles', 14)} Send to Eko AI
                    </button>
                </div>`;
            if (window.lucide) lucide.createIcons();
        }
    };

    _recognition.onerror = (e) => {
        _voiceRecording = false;
        if (btn) btn.style.background = 'var(--primary)';
        if (label) label.textContent = 'Voice Activity Records';
        if (resultBox) resultBox.innerHTML = `<div class="text-sm text-danger text-center p-4">Microphone error: ${e.error}. Please allow microphone access and try again.</div>`;
    };

    _recognition.onend = () => {
        _voiceRecording = false;
        if (btn) { btn.style.background = 'var(--primary)'; }
        if (label) label.textContent = 'Voice Activity Records';
        _recognition = null;
    };

    _recognition.start();
}

// ── WhatsApp Studio ────────────────────────────────────────────────────────────
function prefillWaContext(template) {
    const detailsEl = document.getElementById('wa-details');
    const prefills = {
        dmt_success: 'Amount: ₹[amount], Receiver: [name], Bank: [bank], Ref: [ref_id]',
        dmt_failed: 'Amount: ₹[amount], Receiver: [name], Reason: [failure_reason], Ref: [ref_id]',
        aeps_success: 'Amount: ₹[amount], Aadhaar: XXXX[last4], Bank: [bank], Ref: [ref_id]',
        bbps_success: 'Bill: [category], Provider: [provider], Amount: ₹[amount], Consumer No: [consumer_no]',
        recharge_success: 'Mobile: [number], Operator: [operator], Plan: ₹[amount], Validity: [days] days',
        complaint_update: 'Complaint ID: [id], Status: [status], Resolution: [details]',
        custom: ''
    };
    if (detailsEl && prefills[template] !== undefined) {
        detailsEl.placeholder = prefills[template] || 'Enter relevant details...';
        detailsEl.value = '';
    }
}

async function generateWaMessage() {
    const template = document.getElementById('wa-template')?.value;
    const recipient = document.getElementById('wa-recipient')?.value.trim() || 'Customer';
    const details = document.getElementById('wa-details')?.value.trim();
    const lang = document.getElementById('wa-lang')?.value || 'English';
    const resultBox = document.getElementById('wa-result-box');

    if (!template) { showToast('Please select a message template', 'error'); return; }
    if (!details) { showToast('Please enter message details', 'error'); return; }

    resultBox.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Generating message...</p></div>';

    const prompt = `Generate a professional WhatsApp message in ${lang} for an Eko financial services partner to send to their customer named ${recipient}.
Template type: ${template}
Transaction/Event details: ${details}
Requirements:
- Keep it concise (3 short paragraphs max)
- Use appropriate emojis sparingly
- Use *bold* for key numbers and names (WhatsApp markdown)
- End with: "Powered by Eko Partner Services 🟠"
- Do not use HTML tags`;

    try {
        const res = await api.askAi({ question: prompt, context: null, history: [] });
        const msg = res.answer || res.response || 'Message generated.';
        resultBox.innerHTML = `
            <div class="card" style="padding:20px;">
                <div class="font-bold mb-3" style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="display:flex; align-items:center; gap:6px; color:var(--success);">${renderIcon('check-circle', 16)} Message Ready</span>
                    <span class="badge badge-success" style="font-size:0.6rem;">${lang}</span>
                </div>
                <div id="wa-message-text" style="white-space:pre-wrap; font-size:0.9rem; line-height:1.7; background:var(--bg); padding:14px; border-radius:8px; border:1px solid var(--border);">${escapeHtml(msg)}</div>
                <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
                    <button class="btn-primary" style="flex:1; min-width:120px;" onclick="copyWaMessage()">
                        ${renderIcon('copy', 14)} Copy
                    </button>
                    <button class="btn-secondary" style="flex:1; min-width:120px;" onclick="shareWaMessage()">
                        ${renderIcon('share-2', 14)} Share via WhatsApp
                    </button>
                </div>
            </div>`;
        if (window.lucide) lucide.createIcons();
    } catch(e) {
        resultBox.innerHTML = `<div class="text-sm text-danger text-center p-4">AI generation failed: ${escapeHtml(e.message || 'Error')}. Check your connection.</div>`;
    }
}

function copyWaMessage() {
    const el = document.getElementById('wa-message-text');
    if (!el) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(el.textContent);
        showToast('Message copied to clipboard!', 'success');
    } else {
        showToast('Copy: ' + el.textContent.slice(0, 60) + '…');
    }
}

function shareWaMessage() {
    const el = document.getElementById('wa-message-text');
    if (!el) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(el.textContent)}`, '_blank');
}

// ── Campaign Broadcaster ───────────────────────────────────────────────────────
async function generateCampaign() {
    const type = document.getElementById('camp-type')?.value || 'offer';
    const details = document.getElementById('camp-details')?.value.trim();
    const audience = document.getElementById('camp-audience')?.value || 'all partners';
    const lang = document.getElementById('camp-lang')?.value || 'English';
    const resultBox = document.getElementById('campaign-result-box');

    if (!details) { showToast('Please enter campaign details', 'error'); return; }

    resultBox.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Drafting campaign...</p></div>';

    const prompt = `Draft an Eko partner network broadcast message in ${lang}.
Campaign Type: ${type}
Target Audience: ${audience}
Key Message: ${details}
Requirements:
- Motivational and professional tone
- Use relevant emojis
- Include a clear call-to-action
- Sign off as "— Eko Operations Team"
- Max 4 short paragraphs
- Format for WhatsApp broadcast`;

    try {
        const res = await api.askAi({ question: prompt, context: null, history: [] });
        const msg = res.answer || res.response || 'Campaign drafted.';
        resultBox.innerHTML = `
            <div class="card" style="padding:20px;">
                <div class="font-bold mb-1" style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="display:flex; align-items:center; gap:6px; color:var(--primary);">${renderIcon('megaphone', 16)} Campaign Draft</span>
                    <span class="badge badge-info" style="font-size:0.6rem;">${audience}</span>
                </div>
                <div class="text-xs text-muted mb-3">Review before broadcasting. Edit as needed.</div>
                <div id="campaign-text" style="white-space:pre-wrap; font-size:0.9rem; line-height:1.7; background:var(--bg); padding:14px; border-radius:8px; border:1px solid var(--border); margin-bottom:12px;">${escapeHtml(msg)}</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn-primary" style="flex:1; min-width:120px;" onclick="copyCampaign()">
                        ${renderIcon('copy', 14)} Copy
                    </button>
                    <button class="btn-secondary" style="flex:1; min-width:120px;" onclick="shareCampaign()">
                        ${renderIcon('share-2', 14)} Share
                    </button>
                </div>
            </div>`;
        if (window.lucide) lucide.createIcons();
    } catch(e) {
        resultBox.innerHTML = `<div class="text-sm text-danger text-center p-4">Generation failed: ${escapeHtml(e.message || 'Error')}</div>`;
    }
}

function copyCampaign() {
    const el = document.getElementById('campaign-text');
    if (!el) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(el.textContent);
        showToast('Campaign copied!', 'success');
    }
}

function shareCampaign() {
    const el = document.getElementById('campaign-text');
    if (!el) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(el.textContent)}`, '_blank');
}

// ── Scanner ────────────────────────────────────────────────────────────────────
function triggerBillCapture() {
    if (typeof AndroidBridge !== 'undefined') AndroidBridge.openCamera();
    else showToast('Camera scanner is available in the Eko Android App', 'info');
}

window.handleNativeCameraImage = async function(base64) {
    const box = document.getElementById('scanner-result-box');
    box.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>AI is reading document...</p></div>';
    try {
        const res = await api.scanBill({ image_base64: 'data:image/jpeg;base64,' + base64 });
        renderScanResult(res.data);
    } catch (e) { box.innerHTML = '<p class="text-danger">Failed to process.</p>'; }
};

function renderScanResult(data) {
    const box = document.getElementById('scanner-result-box');
    box.innerHTML = `
        <div class="card">
            <div class="font-bold text-main mb-4" style="display:flex; justify-content:space-between;">
                <span>Extracted Details</span>
                <span class="badge badge-warning">${data.payment_status}</span>
            </div>
            <div class="form-group">
                <label class="form-label">Biller / Provider</label>
                <input class="form-input" value="${escapeHtml(data.store_or_customer_name)}">
            </div>
            <div class="grid-cols-2">
                <div class="form-group">
                    <label class="form-label">Amount</label>
                    <input class="form-input" value="${data.total_amount}">
                </div>
                <div class="form-group">
                    <label class="form-label">Due Date</label>
                    <input class="form-input" value="${data.due_date}">
                </div>
            </div>
            <button class="btn-primary mt-4" style="width:100%;" onclick="openServiceFlow('bbps')">Proceed to Bill Payment</button>
        </div>
    `;
}
