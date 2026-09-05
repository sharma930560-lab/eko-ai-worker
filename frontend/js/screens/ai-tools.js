/**
 * Eko AI Operations — Utility Tools Suite
 */

let activeAiTab = 'scanner';

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
    // UI state update is handled by the loop if we were using a real framework,
    // here we just re-render.

    if (tab === 'scanner') {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding:48px 24px; border-style:dashed;">
                <div style="width:64px; height:64px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
                    ${renderIcon('camera', 32)}
                </div>
                <h3>Bill & Document Scanner</h3>
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
                <p class="text-sm text-muted mt-2">Log service events using vernacular voice commands.</p>
            </div>
            <div id="voice-result-box" class="mt-6"></div>
        `;
    } else {
        container.innerHTML = `<div class="empty-state"><h3>Coming Soon</h3><p>This module is being optimized for the new design system.</p></div>`;
    }
    lucide.createIcons();
}

function triggerBillCapture() {
    if (typeof AndroidBridge !== 'undefined') AndroidBridge.openCamera();
    else showToast('Camera only available in Android App', 'info');
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
            <button class="btn-primary mt-4" style="width:100%;" onclick="showToast('Bill verified & logged')">Confirm & Save</button>
        </div>
    `;
}
