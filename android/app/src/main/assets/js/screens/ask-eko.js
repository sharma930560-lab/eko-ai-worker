/**
 * Eko Partner Operations — Modern AI Assistant Experience
 * Redesigned for grounding, professionalism, deduplication and mobile-first polish.
 */

const QUICK_PROMPTS = [
    { icon: 'sun', label: 'Ops Brief', q: 'Summarize today\'s operations.' },
    { icon: 'alert-triangle', label: 'Failures', q: 'Show today\'s failed transactions.' },
    { icon: 'shield-check', label: 'Credit Analysis', q: 'Why is Rahul\'s assessment lower?' },
    { icon: 'message-square', label: 'Support Draft', q: 'Draft a message for a pending DMT.' },
];

let chatHistory = [];
let activeAiRequestId = null;

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
                       placeholder="Ask Eko... (e.g. 'Why is Rahul\'s assessment lower?')"
                       onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); sendToEko(); }"
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
                <p class="text-sm text-muted mt-2">I analyze verified operational records and real business activity to provide grounded advice. Try asking:</p>
                <div class="card mt-3" style="background:var(--bg); border:none; padding:12px;">
                    <ul class="text-sm" style="list-style:none; display:flex; flex-direction:column; gap:8px;">
                        <li style="display:flex; gap:8px; align-items:center;">${renderIcon('chevron-right', 12, 'text-primary')} "Why is Rahul's assessment lower?"</li>
                        <li style="display:flex; gap:8px; align-items:center;">${renderIcon('chevron-right', 12, 'text-primary')} "Which customers need follow-up today?"</li>
                        <li style="display:flex; gap:8px; align-items:center;">${renderIcon('chevron-right', 12, 'text-primary')} "Show today's failed transactions"</li>
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
                    <div class="ai-status-desc">Cloud reasoning is paused. Deterministic local records and cache remain available.</div>
                </div>
            </div>`;
    } else {
        statusEl.innerHTML = '';
    }
    lucide.createIcons();
}

async function sendToEko(cid = null, retryPrompt = null, replaceBubbleIndex = -1) {
    if (isAiRequestInProgress) return;

    const input = document.getElementById('eko-input');
    const sendBtn = document.getElementById('eko-send');
    const question = retryPrompt || input?.value.trim();

    if (!question) return;

    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    activeAiRequestId = requestId;
    isAiRequestInProgress = true;

    if (input) {
        input.value = '';
        input.disabled = true;
    }
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<div class="spinner" style="width:18px; height:18px; border-width:2px; margin:0;"></div>';
    }

    const thinkingBubble = {
        role: 'eko',
        isLoading: true,
        requestId: requestId,
        html: `<div style="display:flex; align-items:center; gap:10px;">
            <div class="spinner" style="width:16px; height:16px; margin:0; border-width:2px;"></div>
            <span class="text-xs text-muted">Eko is consulting records...</span>
        </div>`
    };

    if (replaceBubbleIndex >= 0 && replaceBubbleIndex < chatHistory.length) {
        // Reuse existing bubble for retry without duplicating user message
        chatHistory[replaceBubbleIndex] = thinkingBubble;
    } else {
        // Add new user message and thinking bubble
        chatHistory.push({ role: 'user', html: escapeHtml(question) });
        chatHistory.push(thinkingBubble);
    }
    renderChatHistory();

    try {
        const result = await api.askEko(question, [], cid);

        // Discard stale response if newer request started
        if (activeAiRequestId !== requestId) return;

        // Locate thinking bubble
        const idx = chatHistory.findIndex(m => m.requestId === requestId);
        const structuredHtml = renderStructuredAiResponse(result);
        const resolvedBubble = {
            role: 'eko',
            html: structuredHtml
        };

        if (idx >= 0) {
            chatHistory[idx] = resolvedBubble;
        } else {
            chatHistory.push(resolvedBubble);
        }
    } catch (e) {
        if (activeAiRequestId !== requestId) return;

        console.error('Ask Eko Error:', e);
        const idx = chatHistory.findIndex(m => m.requestId === requestId);
        const errorMsg = e.message || 'We couldn\'t reach the reasoning engine.';
        const isNetworkErr = !navigator.onLine || errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('fetch');

        const errorBubble = {
            role: 'eko',
            isError: true,
            questionText: question,
            html: `
                <div class="error-state" style="padding:16px; align-items:flex-start; text-align:left; background:var(--gold-light); border-color:#FDE68A; color:#92400E;">
                    <div class="font-bold text-sm" style="display:flex; align-items:center; gap:8px;">
                        ${renderIcon(isNetworkErr ? 'cloud-off' : 'alert-circle', 16)} AI Service Temporarily Unavailable
                    </div>
                    <div class="text-xs opacity-90 mt-1">${escapeHtml(errorMsg)} Your operational data remains safe on this device.</div>
                    <button class="btn-primary mt-3" style="min-height:32px; padding:6px 14px; font-size:0.8rem; background:#92400E; color:#FFF;"
                            onclick="retryAskEko('${escapeHtml(question).replace(/'/g, "\\'")}')">
                        ${renderIcon('rotate-cw', 12)} Try Again
                    </button>
                </div>`
        };

        if (idx >= 0) {
            chatHistory[idx] = errorBubble;
        } else {
            chatHistory.push(errorBubble);
        }
    } finally {
        isAiRequestInProgress = false;
        if (input) {
            input.disabled = false;
            input.focus();
        }
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = renderIcon('send', 18);
        }
        renderChatHistory();
    }
}

function retryAskEko(questionText) {
    if (isAiRequestInProgress) return;
    // Find the latest error bubble to replace
    const lastErrIdx = chatHistory.map(m => !!m.isError).lastIndexOf(true);
    sendToEko(null, questionText, lastErrIdx);
}

function renderStructuredAiResponse(res) {
    let rawAnswer = typeof res === 'string' ? res : (res.answer || res.text || 'Analysis completed.');
    let html = `<div class="font-semibold" style="color:var(--navy); line-height:1.5;">${formatAiResponse(rawAnswer)}</div>`;

    if (res.data_mode === 'grounded-local') {
        html = `<div style="display:inline-block; font-size:10px; font-weight:700; color:#D97706; background:#FEF3C7; padding:2px 8px; border-radius:10px; margin-bottom:8px;">LOCAL DETERMINISTIC EVALUATION</div>` + html;
    }

    if (res.facts?.length > 0) {
        html += `
            <div class="ai-fact-block" style="margin-top:10px; padding:10px; background:rgba(16, 185, 129, 0.08); border-left:3px solid var(--success); border-radius:4px;">
                <div class="text-xs font-bold text-success mb-1" style="display:flex; align-items:center; gap:6px;">
                    ${renderIcon('check-circle', 12)} VERIFIED OPERATIONAL FACTS
                </div>
                <ul class="text-xs" style="padding-left:14px; margin:0; display:flex; flex-direction:column; gap:4px;">
                    ${res.facts.map(f => {
                        const txt = typeof f === 'string' ? f : f.text;
                        return `<li>${escapeHtml(txt)}</li>`;
                    }).join('')}
                </ul>
            </div>`;
    }

    if (res.inferences?.length > 0) {
        html += `
            <div class="ai-inference-block" style="margin-top:8px; padding:10px; background:rgba(59, 130, 246, 0.08); border-left:3px solid #3B82F6; border-radius:4px;">
                <div class="text-xs font-bold" style="color:#2563EB; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                    ${renderIcon('trending-up', 12)} OPERATIONAL INFERENCE
                </div>
                <ul class="text-xs" style="padding-left:14px; margin:0; display:flex; flex-direction:column; gap:4px;">
                    ${res.inferences.map(inf => {
                        const txt = typeof inf === 'string' ? inf : inf.text;
                        const conf = inf.confidence ? ` <span class="opacity-70">(${Math.round(inf.confidence * 100)}% confidence)</span>` : '';
                        return `<li>${escapeHtml(txt)}${conf}</li>`;
                    }).join('')}
                </ul>
            </div>`;
    }

    if (res.recommendations?.length > 0) {
        html += `
            <div class="ai-rec-block" style="margin-top:8px; padding:10px; background:rgba(249, 115, 22, 0.08); border-left:3px solid var(--primary); border-radius:4px;">
                <div class="text-xs font-bold text-primary mb-1" style="display:flex; align-items:center; gap:6px;">
                    ${renderIcon('lightbulb', 12)} RECOMMENDED ACTIONS
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${res.recommendations.map(r => {
                        const txt = typeof r === 'string' ? r : r.text;
                        const reason = r.reason ? `<div class="text-xs text-muted" style="margin-top:2px;">${escapeHtml(r.reason)}</div>` : '';
                        return `
                            <div>
                                <div class="font-bold text-xs" style="color:var(--text-dark);">${escapeHtml(txt)}</div>
                                ${reason}
                            </div>`;
                    }).join('')}
                </div>
            </div>`;
    }

    if (res.insufficient_data && res.missing_info) {
        html += `
            <div class="card mt-2" style="background:var(--gold-light); border-color:#FDE68A; padding:8px 12px;">
                <div class="text-xs font-bold" style="color:#92400E; display:flex; align-items:center; gap:4px;">
                    ${renderIcon('alert-triangle', 12)} INFORMATION GAP DETECTED
                </div>
                <div class="text-xs mt-0.5" style="color:#78350F;">${escapeHtml(res.missing_info)}</div>
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
