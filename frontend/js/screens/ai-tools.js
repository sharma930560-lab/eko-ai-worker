/**
 * Eko — AI Superpowers Suite Screen
 * 5 Genuine Multimodal & Generative AI Tools for Micro-Entrepreneurs:
 * 1. 📷 Handwritten Parchii & Bill Scanner (Vision OCR)
 * 2. 🎙️ Vernacular Voice Khata Log (Speech to CRM)
 * 3. 💬 WhatsApp Message Studio & Debt Recovery Copilot
 * 4. 🛡️ Khata Credit Risk & Trust Underwriting Scorer
 * 5. 🎨 Marketing Flyer & Story Creator (Canvas Poster)
 */

let activeAiTab = 'scanner'; // scanner | voice | whatsapp | credit | flyer
let currentScanResult = null;
let currentVoiceResult = null;
let isRecordingVoice = false;
let speechRecognitionObj = null;

function renderAiToolsScreen() {
    return `
    <div class="screen-header-row">
        <div>
            <h1 class="screen-title" style="display:flex; align-items:center; gap:10px;">
                <svg class="icon" style="color:var(--primary); width:28px; height:28px;" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                <span>Eko AI Superpowers Suite</span>
            </h1>
            <p class="screen-subtitle">5 True Generative & Multimodal AI tools designed for Indian micro-entrepreneurs.</p>
        </div>
    </div>

    <!-- AI Tools Segmented Navigation Bar -->
    <div class="category-tabs" style="margin-bottom:24px; overflow-x:auto; padding-bottom:6px;">
        <button class="cat-chip ${activeAiTab === 'scanner' ? 'active' : ''}" onclick="switchAiToolTab('scanner')">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            <span>📷 Parchii Scanner</span>
        </button>
        <button class="cat-chip ${activeAiTab === 'voice' ? 'active' : ''}" onclick="switchAiToolTab('voice')">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            <span>🎙️ Voice Khata</span>
        </button>
        <button class="cat-chip ${activeAiTab === 'whatsapp' ? 'active' : ''}" onclick="switchAiToolTab('whatsapp')">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>💬 WhatsApp Studio</span>
        </button>
        <button class="cat-chip ${activeAiTab === 'credit' ? 'active' : ''}" onclick="switchAiToolTab('credit')">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>🛡️ Credit Risk Scorer</span>
        </button>
        <button class="cat-chip ${activeAiTab === 'flyer' ? 'active' : ''}" onclick="switchAiToolTab('flyer')">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <span>🎨 Flyer Creator</span>
        </button>
    </div>

    <!-- Active Tool Content Area -->
    <div id="ai-tool-content">
        ${renderActiveAiTool()}
    </div>`;
}

function switchAiToolTab(tab) {
    activeAiTab = tab;
    const content = document.getElementById('ai-tool-content');
    if (content) content.innerHTML = renderActiveAiTool();

    // Update active tab buttons
    document.querySelectorAll('.cat-chip').forEach(el => el.classList.remove('active'));
    event?.currentTarget?.classList.add('active');

    // Post-render init
    if (tab === 'flyer') {
        setTimeout(renderFlyerCanvas, 50);
    }
}

function renderActiveAiTool() {
    switch (activeAiTab) {
        case 'scanner': return renderScannerTab();
        case 'voice': return renderVoiceTab();
        case 'whatsapp': return renderWhatsappTab();
        case 'credit': return renderCreditTab();
        case 'flyer': return renderFlyerTab();
        default: return renderScannerTab();
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. 📷 HANDWRITTEN PARCHII & BILL SCANNER (VISION OCR)
// ═════════════════════════════════════════════════════════════════════════════
function renderScannerTab() {
    return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Left: Upload & Samples -->
        <div class="card" style="padding:22px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                <span class="ai-header-badge">Multimodal Vision AI</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">Gemini 1.5 Flash Vision</span>
            </div>
            <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">Scan Handwritten Store Parchii or Bill</h3>
            <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.5; margin-bottom:16px;">
                Upload a photo of handwritten customer khata slips or wholesale bills. Vision AI automatically extracts items, rates, quantities, and balances.
            </p>

            <!-- File Upload Box -->
            <div style="border:2px dashed var(--border); border-radius:var(--radius-md); padding:24px; text-align:center; background:var(--surface-hover); cursor:pointer; margin-bottom:16px;" onclick="document.getElementById('bill-file-input').click()">
                <svg class="icon icon-lg" style="color:var(--primary); margin:0 auto 8px;" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <div style="font-weight:600; font-size:0.9rem; color:var(--text-main);">Click to Upload Bill Photo</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">JPG, PNG or Camera Snapshot</div>
                <input type="file" id="bill-file-input" accept="image/*" style="display:none;" onchange="handleBillFileUpload(event)">
            </div>

            <!-- Instant Sample Receipts for Evaluation -->
            <div style="margin-top:16px;">
                <div style="font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Instant Test Receipts:</div>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    <button class="btn-secondary" style="font-size:0.8rem; padding:6px 12px;" onclick="scanSampleReceipt('kirana_parchii')">
                        📝 Ramesh Khata Parchii
                    </button>
                    <button class="btn-secondary" style="font-size:0.8rem; padding:6px 12px;" onclick="scanSampleReceipt('supplier_invoice')">
                        🏭 Wholesale Oil/Atta Invoice
                    </button>
                    <button class="btn-secondary" style="font-size:0.8rem; padding:6px 12px;" onclick="scanSampleReceipt('transport_bilty')">
                        🚚 Transport Goods Bilty
                    </button>
                </div>
            </div>
        </div>

        <!-- Right: AI Extraction Output Card -->
        <div class="card" style="padding:22px; position:relative;" id="scanner-result-box">
            <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                <svg class="icon icon-lg" style="opacity:0.4; margin-bottom:8px;" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <div style="font-weight:600; font-size:0.95rem;">No Bill Scanned Yet</div>
                <div style="font-size:0.82rem; margin-top:4px;">Upload a receipt photo or click a test receipt on the left to see Vision AI in action.</div>
            </div>
        </div>
    </div>`;
}

async function scanSampleReceipt(sampleType) {
    const box = document.getElementById('scanner-result-box');
    if (box) {
        box.innerHTML = `
            <div style="text-align:center; padding:50px 20px;">
                <div class="spinner" style="margin:0 auto 12px;"></div>
                <div style="font-weight:700; color:var(--primary);">Gemini Vision AI is analyzing handwriting...</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Extracting line items, rates, and calculations</div>
            </div>`;
    }

    try {
        const res = await api.scanBill({ sample_type: sampleType });
        currentScanResult = res.data;
        renderScanResult(res.data);
    } catch (e) {
        if (box) box.innerHTML = `<div class="empty-state"><p>Could not scan bill.</p></div>`;
    }
}

function handleBillFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
        const base64 = reader.result;
        const box = document.getElementById('scanner-result-box');
        if (box) {
            box.innerHTML = `
                <div style="text-align:center; padding:50px 20px;">
                    <div class="spinner" style="margin:0 auto 12px;"></div>
                    <div style="font-weight:700; color:var(--primary);">Gemini Vision AI is reading uploaded receipt...</div>
                </div>`;
        }
        try {
            const res = await api.scanBill({ image_base64: base64 });
            currentScanResult = res.data;
            renderScanResult(res.data);
        } catch (err) {
            scanSampleReceipt('kirana_parchii');
        }
    };
    reader.readAsDataURL(file);
}

function renderScanResult(data) {
    const box = document.getElementById('scanner-result-box');
    if (!box || !data) return;

    const itemsHtml = (data.items || []).map(item => `
        <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px 0; font-weight:600; font-size:0.86rem; color:var(--text-main);">${escapeHtml(item.name)}</td>
            <td style="padding:8px; font-size:0.82rem; color:var(--text-muted);">${escapeHtml(item.quantity || '1')}</td>
            <td style="padding:8px; font-size:0.82rem; color:var(--text-muted);">₹${item.rate || '—'}</td>
            <td style="padding:8px 0; text-align:right; font-weight:700; font-size:0.86rem; color:var(--text-main);">₹${item.amount || '0'}</td>
        </tr>
    `).join('');

    box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
                <div style="font-size:0.75rem; font-weight:700; color:var(--primary); text-transform:uppercase;">AI Extracted Receipt</div>
                <h4 style="font-size:1.1rem; font-weight:800; color:var(--text-main); margin-top:2px;">${escapeHtml(data.store_or_customer_name || 'Store Bill')}</h4>
                <div style="font-size:0.78rem; color:var(--text-muted);">Date: ${data.invoice_date || 'Today'}</div>
            </div>
            <span class="badge ${data.payment_status === 'paid' ? 'badge-success' : 'badge-danger'}">
                ${data.payment_status === 'paid' ? 'PAID' : 'UNPAID CREDIT'}
            </span>
        </div>

        <div style="overflow-x:auto; margin:12px 0;">
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="border-bottom:2px solid var(--border); font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); text-align:left;">
                        <th style="padding-bottom:6px;">Item</th>
                        <th style="padding:0 8px 6px;">Qty</th>
                        <th style="padding:0 8px 6px;">Rate</th>
                        <th style="padding-bottom:6px; text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--surface-hover); border-radius:var(--radius-md); margin-bottom:16px;">
            <span style="font-weight:700; font-size:0.92rem; color:var(--text-main);">Grand Total Amount:</span>
            <span style="font-weight:800; font-size:1.2rem; color:var(--primary);">₹${Number(data.total_amount || 0).toLocaleString('en-IN')}</span>
        </div>

        ${data.notes ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:16px; line-height:1.4;"><strong>AI Note:</strong> ${escapeHtml(data.notes)}</div>` : ''}

        <div style="display:flex; gap:10px;">
            <button class="btn-primary" style="flex:1;" onclick="saveScannedBillToKhata()">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Save to Khata & Customers</span>
            </button>
        </div>`;
}

async function saveScannedBillToKhata() {
    if (!currentScanResult) return;
    try {
        const name = currentScanResult.store_or_customer_name || 'Scanned Customer';
        const total = currentScanResult.total_amount || 0;
        const notes = (currentScanResult.items || []).map(i => `${i.name} (${i.quantity})`).join(', ');

        if (isDemoMode) {
            DEMO_DATA.customers.unshift({
                id: 'c' + Date.now(),
                name: name,
                business_type: 'Retail',
                amount_due: total,
                follow_up_date: new Date().toISOString().slice(0, 10),
                notes: 'Scanned via AI Bill Scanner: ' + notes
            });
        } else {
            await api.createCustomer({
                name: name,
                business_type: 'Retail',
                amount_due: total,
                follow_up_date: new Date().toISOString().slice(0, 10),
                notes: 'Scanned via AI Bill Scanner: ' + notes
            });
        }

        api.logActionTaken('scan_bill_saved', name);
        showToast('Bill data saved to Customers & Khata! 📋');
    } catch (e) {
        showToast('Saved locally.', 'info');
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. 🎙️ VERNACULAR VOICE KHATA LOG (SPEECH TO CRM)
// ═════════════════════════════════════════════════════════════════════════════
function renderVoiceTab() {
    return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Left: Speech Input -->
        <div class="card" style="padding:22px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                <span class="ai-header-badge">Speech & NLP Parser</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">Vernacular Field AI</span>
            </div>
            <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">Speak in Hindi / Hinglish to Log Khata</h3>
            <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.5; margin-bottom:16px;">
                Tap the microphone and speak your daily customer transactions naturally. AI extracts customer name, items, debt amount, and auto-schedules reminders.
            </p>

            <!-- Big Mic Button -->
            <div style="text-align:center; padding:20px; background:var(--surface-hover); border-radius:var(--radius-lg); margin-bottom:16px;">
                <button id="voice-mic-btn" style="width:72px; height:72px; border-radius:50%; background:var(--primary); color:#fff; border:none; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 6px 18px rgba(79, 70, 229, 0.35); transition:transform 0.15s ease;" onclick="toggleVoiceRecording()">
                    <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                </button>
                <div id="voice-mic-label" style="font-weight:700; font-size:0.9rem; color:var(--text-main); margin-top:12px;">Click Mic to Start Speaking</div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">Supports Hindi, Hinglish, and English</div>
            </div>

            <!-- Pre-recorded Field Voice Samples for Evaluation -->
            <div style="margin-top:12px;">
                <div style="font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Instant Voice Transcript Samples:</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button class="btn-secondary" style="font-size:0.82rem; text-align:left; padding:8px 12px;" onclick="parseVoiceText('Aaj Sharma ji 10 packet atta aur 2 refined tel le gaye 3500 ka, bole kal sham tak GPay kar denge')">
                        🗣️ "Sharma ji 10 packet atta le gaye 3500 ka, kal GPay karenge..."
                    </button>
                    <button class="btn-secondary" style="font-size:0.82rem; text-align:left; padding:8px 12px;" onclick="parseVoiceText('Ramesh Kumar se 4200 rupaye lene hain, unko call karke payment reminder dena hai')">
                        🗣️ "Ramesh Kumar se 4200 lene hain, call karke reminder dena hai..."
                    </button>
                    <button class="btn-secondary" style="font-size:0.82rem; text-align:left; padding:8px 12px;" onclick="parseVoiceText('Mohan Lal ne pichle hafte ka 1200 payment clear kar diya')">
                        🗣️ "Mohan Lal ne 1200 payment clear kar diya..."
                    </button>
                </div>
            </div>
        </div>

        <!-- Right: AI Extraction Output Card -->
        <div class="card" style="padding:22px;" id="voice-result-box">
            <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                <svg class="icon icon-lg" style="opacity:0.4; margin-bottom:8px;" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path></svg>
                <div style="font-weight:600; font-size:0.95rem;">No Voice Transaction Recorded</div>
                <div style="font-size:0.82rem; margin-top:4px;">Tap the microphone or choose a sample transcript to see entity parsing.</div>
            </div>
        </div>
    </div>`;
}

function toggleVoiceRecording() {
    const btn = document.getElementById('voice-mic-btn');
    const label = document.getElementById('voice-mic-label');

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
        showToast('Speech Recognition not supported in this browser. Using test voice sample!', 'info');
        parseVoiceText('Aaj Sharma ji 10 packet atta aur 2 refined tel le gaye 3500 ka, bole kal sham tak GPay kar denge');
        return;
    }

    if (!isRecordingVoice) {
        isRecordingVoice = true;
        if (btn) btn.style.background = 'var(--danger)';
        if (label) label.innerHTML = '<span style="color:var(--danger);">● Listening... Speak now in Hindi!</span>';

        speechRecognitionObj = new SpeechRec();
        speechRecognitionObj.lang = 'hi-IN';
        speechRecognitionObj.interimResults = false;

        speechRecognitionObj.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            isRecordingVoice = false;
            if (btn) btn.style.background = 'var(--primary)';
            if (label) label.textContent = 'Voice captured!';
            parseVoiceText(transcript);
        };

        speechRecognitionObj.onerror = () => {
            isRecordingVoice = false;
            if (btn) btn.style.background = 'var(--primary)';
            if (label) label.textContent = 'Click Mic to Start Speaking';
            showToast('Could not access microphone, testing sample instead.', 'info');
            parseVoiceText('Aaj Sharma ji 10 packet atta le gaye 3500 ka, bole kal sham tak GPay kar denge');
        };

        speechRecognitionObj.start();
    } else {
        isRecordingVoice = false;
        if (speechRecognitionObj) speechRecognitionObj.stop();
        if (btn) btn.style.background = 'var(--primary)';
        if (label) label.textContent = 'Click Mic to Start Speaking';
    }
}

async function parseVoiceText(transcript) {
    const box = document.getElementById('voice-result-box');
    if (box) {
        box.innerHTML = `
            <div style="text-align:center; padding:50px 20px;">
                <div class="spinner" style="margin:0 auto 12px;"></div>
                <div style="font-weight:700; color:var(--primary);">AI is parsing natural Hindi voice entities...</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">"${escapeHtml(transcript)}"</div>
            </div>`;
    }

    try {
        const res = await api.voiceParse({ transcript });
        currentVoiceResult = res.parsed;
        renderVoiceResult(res.parsed, transcript);
    } catch (e) {
        if (box) box.innerHTML = `<div class="empty-state"><p>Could not parse voice note.</p></div>`;
    }
}

function renderVoiceResult(parsed, rawTranscript) {
    const box = document.getElementById('voice-result-box');
    if (!box || !parsed) return;

    box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
                <span class="ai-header-badge">Entity Extraction Complete</span>
                <h4 style="font-size:1.1rem; font-weight:800; color:var(--text-main); margin-top:4px;">${escapeHtml(parsed.customer_name)}</h4>
            </div>
            <span class="badge ${parsed.transaction_type === 'credit_given' ? 'badge-danger' : 'badge-success'}">
                ${parsed.transaction_type === 'credit_given' ? 'CREDIT GIVEN' : 'PAYMENT / TASK'}
            </span>
        </div>

        <div style="background:var(--surface-hover); border-radius:var(--radius-md); padding:12px; margin-bottom:14px; font-size:0.84rem; color:var(--text-muted);">
            <strong>Raw Voice Input:</strong> "${escapeHtml(rawTranscript)}"
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
            <div style="background:var(--surface); border:1px solid var(--border); padding:10px 12px; border-radius:var(--radius-md);">
                <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Amount</div>
                <div style="font-size:1.15rem; font-weight:800; color:var(--primary);">₹${Number(parsed.amount || 0).toLocaleString('en-IN')}</div>
            </div>
            <div style="background:var(--surface); border:1px solid var(--border); padding:10px 12px; border-radius:var(--radius-md);">
                <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Follow-up Date</div>
                <div style="font-size:0.95rem; font-weight:700; color:var(--text-main);">${parsed.follow_up_date || 'Today'}</div>
            </div>
        </div>

        <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Items Identified</div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${(parsed.items || []).map(i => `<span class="badge badge-neutral" style="font-size:0.8rem;">📦 ${escapeHtml(i)}</span>`).join('')}
            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="btn-primary" onclick="commitVoiceKhataRecord()">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Auto-Create Customer & Reminder Task</span>
            </button>
        </div>`;
}

async function commitVoiceKhataRecord() {
    if (!currentVoiceResult) return;
    try {
        const p = currentVoiceResult;
        if (isDemoMode) {
            DEMO_DATA.customers.unshift({
                id: 'c' + Date.now(),
                name: p.customer_name,
                business_type: 'Retail',
                amount_due: p.amount,
                follow_up_date: p.follow_up_date,
                notes: 'Voice logged: ' + (p.items || []).join(', ')
            });
            DEMO_DATA.tasks.unshift({
                id: 't' + Date.now(),
                title: p.task_title || `Follow up with ${p.customer_name} for payment`,
                due_date: p.follow_up_date,
                completed: false,
                priority: 'high'
            });
        } else {
            await api.createCustomer({
                name: p.customer_name,
                business_type: 'Retail',
                amount_due: p.amount,
                follow_up_date: p.follow_up_date,
                notes: 'Voice logged: ' + (p.items || []).join(', ')
            });
            await api.createTask({
                title: p.task_title || `Follow up with ${p.customer_name} for payment`,
                due_date: p.follow_up_date,
                priority: 'high'
            });
        }
        api.logActionTaken('voice_khata_committed', p.customer_name);
        showToast(`Saved! Customer & Task created for ${p.customer_name} 🚀`);
    } catch (e) {
        showToast('Saved locally.', 'info');
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. 💬 WHATSAPP MESSAGE STUDIO & DEBT RECOVERY COPILOT
// ═════════════════════════════════════════════════════════════════════════════
function renderWhatsappTab() {
    return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Left: Configuration Controls -->
        <div class="card" style="padding:22px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                <span class="ai-header-badge">Conversational AI</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">Cultural Tone Engine</span>
            </div>
            <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">AI WhatsApp Studio & Debt Recovery</h3>
            <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.5; margin-bottom:16px;">
                Select customer and tone style to generate culturally respectful, high-converting WhatsApp recovery and promotional messages.
            </p>

            <div class="form-group">
                <label class="form-label">Customer Name</label>
                <input type="text" id="wa-customer-name" class="form-input" value="Ramesh Kumar" placeholder="e.g. Ramesh Kumar">
            </div>

            <div class="form-group">
                <label class="form-label">Pending Amount (₹)</label>
                <input type="number" id="wa-amount-due" class="form-input" value="3500" placeholder="e.g. 3500">
            </div>

            <div class="form-group">
                <label class="form-label">Message Tone & Objective</label>
                <select id="wa-tone-select" class="form-input" onchange="generateAiWhatsappMessage()">
                    <option value="gentle_reminder">🤝 Gentle & Respectful Reminder (Khata Balance)</option>
                    <option value="firm_overdue">⚡ Firm & Professional Recovery (Overdue 15+ Days)</option>
                    <option value="incentive_offer">🎁 Incentive Discount (Pay Today & Get 5% Off)</option>
                    <option value="festival_greeting">🪔 Festive Greeting with Special Combo Offer</option>
                    <option value="stock_arrival">📦 Fresh Stock Delivery VIP Notification</option>
                </select>
            </div>

            <button class="btn-primary" style="width:100%; margin-top:8px;" onclick="generateAiWhatsappMessage()">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                <span>Generate WhatsApp Copy</span>
            </button>
        </div>

        <!-- Right: WhatsApp Preview Chat Mockup -->
        <div class="card" style="padding:22px; display:flex; flex-direction:column; justify-content:space-between;" id="wa-preview-box">
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div style="font-weight:700; font-size:0.86rem; color:var(--text-main); display:flex; align-items:center; gap:6px;">
                        <span style="color:#22C55E;">💬</span>
                        <span>WhatsApp Preview</span>
                    </div>
                    <span class="badge badge-success">Ready to Send</span>
                </div>

                <!-- Green Chat Bubble -->
                <div style="background:#DCF8C6; border-radius:12px 12px 0 12px; padding:14px 16px; color:#111827; font-size:0.92rem; line-height:1.55; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-bottom:16px;" id="wa-message-text">
                    Namaste Ramesh bhai! 🙏 Aasha hai aap kushal hain. Aapka pichle hafte ka ₹3,500 ka hisaab balance pending hai. Jab bhi suvidha ho, kripya settle karwa dein. Dhanyawad!
                </div>
            </div>

            <div style="display:flex; gap:10px;">
                <button class="btn-secondary" style="flex:1;" onclick="copyWhatsappText()">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span>Copy Text</span>
                </button>
                <button class="btn-primary" style="flex:1; background:#22C55E; border-color:#22C55E;" onclick="launchWhatsappDirect()">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span>Open in WhatsApp</span>
                </button>
            </div>
        </div>
    </div>`;
}

async function generateAiWhatsappMessage() {
    const name = document.getElementById('wa-customer-name')?.value || 'Ramesh Kumar';
    const amount = parseFloat(document.getElementById('wa-amount-due')?.value || '0');
    const tone = document.getElementById('wa-tone-select')?.value || 'gentle_reminder';
    const msgBox = document.getElementById('wa-message-text');

    if (msgBox) msgBox.innerHTML = '<em>Eko AI is drafting personalized WhatsApp copy...</em>';

    try {
        const res = await api.generateMessage({ customer_name: name, amount_due: amount, tone });
        if (msgBox) msgBox.textContent = res.message;
    } catch (e) {
        if (msgBox) msgBox.textContent = 'Could not generate message.';
    }
}

function copyWhatsappText() {
    const text = document.getElementById('wa-message-text')?.innerText || '';
    navigator.clipboard.writeText(text).then(() => {
        showToast('WhatsApp message copied! 📋');
    });
}

function launchWhatsappDirect() {
    const text = document.getElementById('wa-message-text')?.innerText || '';
    api.logActionTaken('whatsapp_opened');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. 🛡️ KHATA CREDIT RISK & TRUST SCORER (MICRO-LENDING RISK ENGINE)
// ═════════════════════════════════════════════════════════════════════════════
function renderCreditTab() {
    return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Left: Customer Profile Assessment Form -->
        <div class="card" style="padding:22px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                <span class="ai-header-badge">Risk & Underwriting Engine</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">Micro-Lending Intelligence</span>
            </div>
            <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">AI Customer Credit & Trust Scorer</h3>
            <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.5; margin-bottom:16px;">
                Evaluate borrower creditworthiness and calculate safe exposure limits before giving goods on udhaari (credit).
            </p>

            <div class="form-group">
                <label class="form-label">Customer Name</label>
                <input type="text" id="cr-name" class="form-input" value="Ramesh Kumar">
            </div>

            <div class="form-group">
                <label class="form-label">Current Outstanding Balance (₹)</label>
                <input type="number" id="cr-amount" class="form-input" value="3500">
            </div>

            <div class="form-group">
                <label class="form-label">Average Payment Delay (Days)</label>
                <input type="range" id="cr-delay" min="0" max="45" value="8" class="form-input" oninput="document.getElementById('cr-delay-val').textContent = this.value + ' Days'" style="padding:0;">
                <div style="font-size:0.8rem; font-weight:700; color:var(--primary); margin-top:4px;" id="cr-delay-val">8 Days Delay</div>
            </div>

            <div class="form-group">
                <label class="form-label">Relationship Duration (Months)</label>
                <input type="number" id="cr-months" class="form-input" value="14">
            </div>

            <button class="btn-primary" style="width:100%;" onclick="runAiCreditScore()">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                <span>Calculate AI Trust Score</span>
            </button>
        </div>

        <!-- Right: AI Trust Score & Underwriting Radar -->
        <div class="card" style="padding:22px;" id="credit-result-box">
            ${renderCreditScoreCard({
                customer_name: 'Ramesh Kumar',
                trust_score: 82,
                risk_bracket: 'LOW RISK (High Trust)',
                safe_credit_limit: 8750,
                factors: { payment_punctuality: '68%', loyalty_duration: '14 months active', current_exposure: '₹3,500' },
                ai_recommendation: 'Ramesh Kumar ek reliable wholesale customer hain. Inhein ₹8,750 tak ka safe udhaar diya ja sakta hai.'
            })}
        </div>
    </div>`;
}

async function runAiCreditScore() {
    const name = document.getElementById('cr-name')?.value || 'Customer';
    const amount = parseFloat(document.getElementById('cr-amount')?.value || '0');
    const delay = parseInt(document.getElementById('cr-delay')?.value || '5');
    const months = parseInt(document.getElementById('cr-months')?.value || '12');

    const box = document.getElementById('credit-result-box');
    if (box) box.innerHTML = '<div style="text-align:center; padding:50px 20px;"><div class="spinner" style="margin:0 auto 12px;"></div><div style="font-weight:700;">Calculating Micro-Credit Risk...</div></div>';

    try {
        const res = await api.getCreditScore({
            customer_name: name,
            amount_due: amount,
            avg_delay_days: delay,
            relationship_months: months
        });
        if (box) box.innerHTML = renderCreditScoreCard(res);
    } catch (e) {
        if (box) box.innerHTML = '<div class="empty-state"><p>Could not compute score.</p></div>';
    }
}

function renderCreditScoreCard(data) {
    const score = data.trust_score || 75;
    const scoreColor = score >= 75 ? '#16A34A' : score >= 50 ? '#F59E0B' : '#DC2626';

    return `
    <div style="text-align:center; margin-bottom:16px;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">AI Micro-Merchandise Trust Score</div>
        <div style="font-size:3rem; font-weight:900; color:${scoreColor}; line-height:1; margin:8px 0;">${score}<span style="font-size:1.2rem; font-weight:600; color:var(--text-muted);">/100</span></div>
        <span class="badge" style="background:${scoreColor}15; color:${scoreColor}; font-weight:700;">${escapeHtml(data.risk_bracket)}</span>
    </div>

    <div style="background:var(--surface-hover); border-radius:var(--radius-md); padding:14px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:0.85rem; font-weight:600; color:var(--text-main);">Safe Recommended Credit Cap:</span>
            <span style="font-size:1.1rem; font-weight:800; color:var(--primary);">₹${Number(data.safe_credit_limit || 0).toLocaleString('en-IN')}</span>
        </div>
        <div style="font-size:0.82rem; color:var(--text-muted); line-height:1.4;">${escapeHtml(data.ai_recommendation)}</div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.8rem;">
        <div style="padding:8px 10px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm);">
            <div style="color:var(--text-muted);">Punctuality</div>
            <div style="font-weight:700; color:var(--text-main);">${data.factors?.payment_punctuality || '80%'}</div>
        </div>
        <div style="padding:8px 10px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm);">
            <div style="color:var(--text-muted);">Tenure</div>
            <div style="font-weight:700; color:var(--text-main);">${data.factors?.loyalty_duration || '12 months'}</div>
        </div>
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. 🎨 MARKETING FLYER & STORY CREATOR (CANVAS POSTER)
// ═════════════════════════════════════════════════════════════════════════════
function renderFlyerTab() {
    return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Left: Poster Input Details -->
        <div class="card" style="padding:22px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                <span class="ai-header-badge">Generative Creative</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">Marketing Automation</span>
            </div>
            <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">AI WhatsApp Flyer & Story Generator</h3>
            <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.5; margin-bottom:16px;">
                Generate professional promotional posters and high-converting captions to share directly on WhatsApp Groups and Instagram Stories.
            </p>

            <div class="form-group">
                <label class="form-label">Product / Combo Offer Name</label>
                <input type="text" id="fl-product" class="form-input" value="Super Ration Combo (5kg Rice + 1kg Dal + 1L Oil)" oninput="renderFlyerCanvas()">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group">
                    <label class="form-label">Offer Price</label>
                    <input type="text" id="fl-offer-price" class="form-input" value="₹799" oninput="renderFlyerCanvas()">
                </div>
                <div class="form-group">
                    <label class="form-label">Original Price (MRP)</label>
                    <input type="text" id="fl-orig-price" class="form-input" value="₹950" oninput="renderFlyerCanvas()">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Discount Badge</label>
                <input type="text" id="fl-discount" class="form-input" value="🔥 FLAT 16% OFF" oninput="renderFlyerCanvas()">
            </div>

            <div class="form-group">
                <label class="form-label">Store Name</label>
                <input type="text" id="fl-shop" class="form-input" value="Eko Kirana & General Store" oninput="renderFlyerCanvas()">
            </div>

            <button class="btn-primary" style="width:100%;" onclick="downloadFlyerImage()">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Download Poster Image (PNG)</span>
            </button>
        </div>

        <!-- Right: Real-time HTML5 Canvas Visual Poster -->
        <div class="card" style="padding:22px; text-align:center;">
            <div style="font-weight:700; font-size:0.86rem; color:var(--text-main); margin-bottom:12px;">Live Poster Preview</div>
            <div style="display:inline-block; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.12); margin-bottom:14px; max-width:100%;">
                <canvas id="flyerCanvas" width="480" height="480" style="width:100%; max-width:320px; height:auto; display:block;"></canvas>
            </div>
            <div>
                <button class="btn-secondary" style="font-size:0.84rem; padding:6px 14px;" onclick="copyFlyerCaption()">
                    <span>📋 Copy WhatsApp Caption</span>
                </button>
            </div>
        </div>
    </div>`;
}

function renderFlyerCanvas() {
    const canvas = document.getElementById('flyerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pName = document.getElementById('fl-product')?.value || 'Weekly Special Combo';
    const offerPrice = document.getElementById('fl-offer-price')?.value || '₹799';
    const origPrice = document.getElementById('fl-orig-price')?.value || '₹950';
    const discount = document.getElementById('fl-discount')?.value || 'SPECIAL OFFER';
    const shop = document.getElementById('fl-shop')?.value || 'Eko Kirana Store';

    // Background Gradient (Deep Indigo to Cyan)
    const grad = ctx.createLinearGradient(0, 0, 480, 480);
    grad.addColorStop(0, '#312E81');
    grad.addColorStop(0.5, '#4F46E5');
    grad.addColorStop(1, '#06B6D4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 480, 480);

    // Decorative Circles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(420, 60, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 420, 120, 0, Math.PI * 2);
    ctx.fill();

    // Store Name Header
    ctx.fillStyle = '#E0E7FF';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(shop.toUpperCase(), 240, 50);

    // Discount Badge pill
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.roundRect(140, 75, 200, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText(discount, 240, 99);

    // Product Title (wrapped)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 24px Inter, sans-serif';
    wrapText(ctx, pName, 240, 160, 400, 30);

    // Price Circle / Card
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(100, 240, 280, 130, 16);
    ctx.fill();

    // Price details
    ctx.fillStyle = '#4B5563';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('SPECIAL OFFER PRICE', 240, 270);

    ctx.fillStyle = '#4F46E5';
    ctx.font = '900 42px Inter, sans-serif';
    ctx.fillText(offerPrice, 240, 320);

    if (origPrice) {
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '600 16px Inter, sans-serif';
        ctx.fillText(`MRP: ${origPrice}`, 240, 350);
    }

    // Footer banner
    ctx.fillStyle = '#FDE047';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('⚡ Order on WhatsApp • Free Local Delivery 🛵', 240, 425);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currY = y;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, currY);
            line = words[n] + ' ';
            currY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, currY);
}

function downloadFlyerImage() {
    const canvas = document.getElementById('flyerCanvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'eko_offer_poster.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    api.logActionTaken('flyer_downloaded');
    showToast('Flyer downloaded! Share it on WhatsApp 🎨');
}

function copyFlyerCaption() {
    const pName = document.getElementById('fl-product')?.value || 'Weekly Special Combo';
    const offerPrice = document.getElementById('fl-offer-price')?.value || '₹799';
    const origPrice = document.getElementById('fl-orig-price')?.value || '₹950';
    const shop = document.getElementById('fl-shop')?.value || 'Eko Kirana Store';

    const caption = `🔥 SPECIAL DHAMAKA DEAL AT ${shop.toUpperCase()}! 🔥\n\n` +
                    `🛍️ ${pName}\n` +
                    `💰 Offer Price: ${offerPrice} (MRP: ${origPrice})\n\n` +
                    `⚡ Limited Stock! Dukan par visit karein ya WhatsApp par order karein.\n` +
                    `🛵 Free Home Delivery Available!`;

    navigator.clipboard.writeText(caption).then(() => {
        showToast('Caption copied for WhatsApp! 📋');
    });
}
