/**
 * Eko Partner Operations — Modern AI Assistant Experience
 * Redesigned for grounding, professionalism and mobile-first polish.
 */

const QUICK_PROMPTS = [
    { icon: 'sun', label: 'Ops Brief', q: 'Summarize today\'s operations.' },
    { icon: 'alert-triangle', label: 'Failures', q: 'Show today\'s failed transactions.' },
    { icon: 'shield-check', label: 'Credit Analysis', q: 'Why is Rahul\'s assessment lower?' },
    { icon: 'message-square', label: 'Support Draft', q: 'Draft a message for a pending DMT.' },
];

let chatHistory = [];

function renderAskEkoScreen() {
    return `
    <div class="ask-eko-container container-responsive" style="display:flex; flex-direction:column; height: calc(100vh - var(--header-height) - 40px);">
        <!-- Service Status Header -->
        <div id="ai-service-status" style="margin-bottom:12px;"></div>

        <!-- Scrollable Chat Area -->
        <div id="eko-chat" class="chat-history" style="flex:1; overflow-y:auto; padding-bottom:20px;">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>

        <!-- Fixed Bottom Interaction Area -->
        <div style="background:var(--bg); padding-top:10px; border-top:1px solid var(--border);">
            <div class="prompt-chips-wrap" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:8px; scrollbar-width:none;">
                ${QUICK_PROMPTS.map(p => `
                    <button class="chip" style="white-space:nowrap; display:flex; align-items:center; gap:6px;" onclick="sendQuickPrompt('${escapeHtml(p.q).replace(/'/g, "\\'")}')">
                        ${renderIcon(p.icon, 12, 'text-primary')}
                        <span>${escapeHtml(p.label)}</span>
                    </button>
                `).join('')}
            </div>

            <div class="ai-composer">
                <input type="text" id="eko-input" class="ai-input"
                       placeholder="Ask Eko... (e.g. 'Show activity from last year')"
                       onkeydown="if(event.key==='Enter') sendToEko()"
                       autocomplete="off">
                <button class="ai-send-btn" id="eko-send" onclick="sendToEko()" aria-label="Send Message">
                    ${renderIcon('send', 18)}
                </button>
            </div>
        </div>
    </div>`;
}

async function loadAskEko() {
    updateAiServiceStatus();

    if (chatHistory.length === 0) {
        chatHistory = [{
            role: 'eko',
            isWelcome: true,
            html: `
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                    <div class="ai-header-badge">${renderIcon('bot', 14)} Eko Partner AI Assistant</div>
                </div>
                <p><strong>Namaste! I am your operational partner.</strong></p>
                <p class="text-sm text-muted mt-2">I analyze your longitudinal records to provide grounded business advice. Try asking:</p>
                <div class="card mt-3" style="background:var(--bg); border:none; padding:12px;">
                    <ul class="text-sm" style="list-style:none; display:flex; flex-direction:column; gap:8px;">
                        <li style="display:flex; gap:8px; align-items:center;">${renderIcon('chevron-right', 12, 'text-primary')} "Show activity from last year"</li>
                        <li style="display:flex; gap:8px; align-items:center;">${renderIcon('chevron-right', 12, 'text-primary')} "Which customers need follow-up today?"</li>
                    </ul>
                </div>
            `
        }];
    }
    renderChatHistory();
}

function updateAiServiceStatus() {
    const statusEl = document.getElementById('ai-service-status');
    if (!statusEl) return;

    if (!navigator.onLine) {
        statusEl.innerHTML = `
            <div class="ai-status-card">
                <div class="ai-status-icon">${renderIcon('wifi-off', 18)}</div>
                <div class="ai-status-content">
                    <div class="ai-status-title">Offline Mode Active</div>
                    <div class="ai-status-desc">Cloud AI is paused. Deterministic local records and timeline remain available.</div>
                </div>
            </div>`;
    } else {
        statusEl.innerHTML = '';
    }
    lucide.createIcons();
}

async function sendToEko(cid = null) {
    const input = document.getElementById('eko-input');
    const sendBtn = document.getElementById('eko-send');
    const question = input?.value.trim();

    if (!question || isAiRequestInProgress) return;

    isAiRequestInProgress = true;
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<div class="spinner" style="width:18px; height:18px; border-width:2px; margin:0;"></div>';

    // Add user message
    chatHistory.push({ role: 'user', html: escapeHtml(question) });
    renderChatHistory();

    // Add thinking state
    chatHistory.push({
        role: 'eko',
        isLoading: true,
        html: `<div style="display:flex; align-items:center; gap:10px;">
            <div class="spinner" style="width:16px; height:16px; margin:0; border-width:2px;"></div>
            <span class="text-xs text-muted">Eko is consulting records...</span>
        </div>`
    });
    renderChatHistory();

    try {
        const result = await api.askEko(question, [], cid);
        chatHistory = chatHistory.filter(m => !m.isLoading);

        chatHistory.push({
            role: 'eko',
            html: renderStructuredAiResponse(result)
        });
    } catch (e) {
        chatHistory = chatHistory.filter(m => !m.isLoading);
        chatHistory.push({
            role: 'eko',
            isError: true,
            html: `
                <div class="error-state" style="padding:16px; align-items:flex-start; text-align:left; background:var(--gold-light); border-color:#FDE68A; color:#92400E;">
                    <div class="font-bold text-sm" style="display:flex; align-items:center; gap:8px;">
                        ${renderIcon('cloud-off', 16)} AI Service Unavailable
                    </div>
                    <div class="text-xs opacity-80 mt-1">We couldn't reach the reasoning engine. Your records are safe on this device.</div>
                    <button class="btn-primary mt-3" style="min-height:32px; padding:6px 14px; font-size:0.8rem; background:#92400E; color:#FFF;"
                            onclick="sendQuickPrompt('${escapeHtml(question).replace(/'/g, "\\'")}')">Try Again</button>
                </div>`
        });
    } finally {
        isAiRequestInProgress = false;
        input.disabled = false;
        input.focus();
        sendBtn.disabled = false;
        sendBtn.innerHTML = renderIcon('send', 18);
        renderChatHistory();
    }
}

function renderStructuredAiResponse(res) {
    let html = `<div class="font-semibold" style="color:var(--navy);">${formatAiResponse(res.answer)}</div>`;

    if (res.facts?.length > 0) {
        html += `
            <div class="ai-fact-block">
                <div class="text-xs font-bold text-success mb-2" style="display:flex; align-items:center; gap:6px;">
                    ${renderIcon('check-circle', 12)} VERIFIED RECORDS
                </div>
                <ul class="text-xs" style="padding-left:14px; display:flex; flex-direction:column; gap:6px;">
                    ${res.facts.map(f => `<li>${escapeHtml(f.text)}</li>`).join('')}
                </ul>
            </div>`;
    }

    if (res.recommendations?.length > 0) {
        html += `
            <div class="ai-rec-block">
                <div class="text-xs font-bold text-primary mb-2">${renderIcon('lightbulb', 12)} SUGGESTED ACTIONS</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${res.recommendations.map(r => `
                        <div>
                            <div class="font-bold text-xs">${escapeHtml(r.text)}</div>
                            <div class="text-xs text-muted mt-0.5">${escapeHtml(r.reason)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }

    if (res.insufficient_data) {
        html += `
            <div class="card mt-3" style="background:var(--warning-bg); border-color:var(--warning); padding:10px;">
                <div class="text-xs text-warning font-bold">INFO GAP DETECTED</div>
                <div class="text-xs mt-1">${escapeHtml(res.missing_info || 'More context required for complete analysis.')}</div>
            </div>`;
    }

    return html;
}

function renderChatHistory() {
    const chat = document.getElementById('eko-chat');
    if (!chat) return;

    chat.innerHTML = chatHistory.map(m => `
        <div class="chat-bubble ${m.role}">${m.html}</div>
    `).join('');

    chat.scrollTop = chat.scrollHeight;
    lucide.createIcons();
}

function sendQuickPrompt(q) {
    const inp = document.getElementById('eko-input');
    if (inp) inp.value = q;
    sendToEko();
}
