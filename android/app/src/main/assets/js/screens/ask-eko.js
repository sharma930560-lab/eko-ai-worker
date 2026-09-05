/**
 * Eko AI Assistant — Grounded Operational Partner
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
    <div class="ask-eko-container container-responsive">
        <div class="prompt-chips-wrap">
            ${QUICK_PROMPTS.map(p => `
                <button class="prompt-chip" onclick="sendQuickPrompt('${escapeHtml(p.q).replace(/'/g, "\\'")}')">
                    ${renderIcon(p.icon, 14, 'text-primary')}
                    <span>${escapeHtml(p.label)}</span>
                </button>
            `).join('')}
        </div>

        <div id="eko-chat" class="chat-history"></div>

        <div class="chat-input-row">
            <input type="text" id="eko-input" class="chat-input" placeholder="Ask Eko... (e.g. 'Show activity from last year')" onkeydown="if(event.key==='Enter') sendToEko()">
            <button class="chat-send-btn" onclick="sendToEko()" id="eko-send">
                ${renderIcon('send', 20)}
            </button>
        </div>
    </div>`;
}

async function loadAskEko() {
    if (chatHistory.length === 0) {
        chatHistory = [{
            role: 'eko',
            isWelcome: true,
            html: `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                    <div class="ai-header-badge">${renderIcon('bot', 14)} Eko Partner AI Assistant</div>
                </div>
                <p><strong>Namaste! I am your operational partner.</strong></p>
                <p class="text-sm text-muted mt-2">I analyze your longitudinal 360 records to provide grounded business advice. Try asking:</p>
                <ul class="text-sm mt-3" style="list-style:none; display:flex; flex-direction:column; gap:8px;">
                    <li>${renderIcon('chevron-right', 12)} <em>"Show activity from last year"</em></li>
                    <li>${renderIcon('chevron-right', 12)} <em>"Which customers need follow-up today?"</em></li>
                </ul>
            `
        }];
    }
    renderChatHistory();
}

async function sendToEko(cid = null) {
    const input = document.getElementById('eko-input');
    const question = input?.value.trim();
    if (!question || isAiRequestInProgress) return;

    isAiRequestInProgress = true;
    input.value = '';

    chatHistory.push({ role: 'user', html: escapeHtml(question) });
    renderChatHistory();

    chatHistory.push({
        role: 'eko',
        isLoading: true,
        html: `<div style="display:flex; align-items:center; gap:10px;">
            <div class="spinner" style="width:16px; height:16px; margin:0; border-width:2px;"></div>
            <span class="text-xs text-muted">Consulting longitudinal records...</span>
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
        chatHistory.push({ role: 'eko', html: '<p class="text-danger">AI service unavailable. Local records remain safe.</p>' });
    } finally {
        isAiRequestInProgress = false;
        renderChatHistory();
        lucide.createIcons();
    }
}

function renderStructuredAiResponse(res) {
    let html = `<div class="font-semibold mb-2">${formatAiResponse(res.answer)}</div>`;

    if (res.facts?.length > 0) {
        html += `
            <div class="card mt-3" style="background:var(--bg); border:none; padding:12px;">
                <div class="text-xs font-bold text-success mb-2" style="display:flex; align-items:center; gap:4px;">
                    ${renderIcon('check-circle', 12)} VERIFIED FACTS
                </div>
                <ul class="text-xs" style="padding-left:16px; display:flex; flex-direction:column; gap:4px;">
                    ${res.facts.map(f => `<li>${escapeHtml(f.text)}</li>`).join('')}
                </ul>
            </div>`;
    }

    if (res.recommendations?.length > 0) {
        html += `
            <div class="card mt-3" style="background:var(--primary-light); border:1px solid var(--primary-subtle); padding:12px;">
                <div class="text-xs font-bold text-primary mb-2">${renderIcon('lightbulb', 12)} SUGGESTED ACTIONS</div>
                ${res.recommendations.map(r => `
                    <div class="mb-2">
                        <div class="font-bold text-xs">${escapeHtml(r.text)}</div>
                        <div class="text-xs opacity-70">${escapeHtml(r.reason)}</div>
                    </div>
                `).join('')}
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
