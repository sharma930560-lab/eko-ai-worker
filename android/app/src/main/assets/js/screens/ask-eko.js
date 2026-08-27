/**
 * Eko — Modern Ask Eko AI Assistant Screen
 * Grounded AI business assistant with structured recommendation cards & action triggers.
 */

const QUICK_PROMPTS = [
    { label: 'Follow-ups today?', q: 'Which customers should I follow up with today?' },
    { label: 'Payment reminder', q: 'Write a polite WhatsApp message for Ramesh Kumar who has an outstanding payment of 3500.' },
    { label: 'Weekly promotion', q: 'Suggest a high-margin weekly ration bundle or offer for my store.' },
    { label: 'Daily plan summary', q: 'Summarize my pending tasks and priorities for today.' },
];

let chatHistory = [];

function renderAskEkoScreen() {
    return `
    <div class="ask-eko-container">
        <!-- Quick Prompts Chips -->
        <div class="prompt-chips-wrap">
            ${QUICK_PROMPTS.map(p => `
                <button class="prompt-chip" onclick="sendQuickPrompt('${escapeHtml(p.q).replace(/'/g, "\\'")}')">
                    <svg class="icon icon-sm" style="color:var(--primary);" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <span>${escapeHtml(p.label)}</span>
                </button>
            `).join('')}
        </div>

        <!-- Chat History -->
        <div id="eko-chat" class="chat-history"></div>

        <!-- Input Row -->
        <div class="chat-input-row">
            <input type="text" id="eko-input" class="chat-input" placeholder="Kuch bhi puchho... (Ask anything about your business)" onkeydown="if(event.key==='Enter') sendToEko()">
            <button class="chat-send-btn" onclick="sendToEko()" id="eko-send" title="Send Question">
                <svg class="icon" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
        </div>
    </div>`;
}

function loadAskEko() {
    if (chatHistory.length === 0) {
        chatHistory = [
            {
                role: 'eko',
                html: `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <span class="ai-header-badge">
                            <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>
                            <span>Eko Business Assistant</span>
                        </span>
                    </div>
                    <strong>Namaste! Main Eko hoon — aapka AI business assistant.</strong><br>
                    Aap mujhse customer follow-ups, payment reminders, stock planning ya daily summary ke baare mein pooch sakte hain.
                `
            }
        ];
    }
    renderChatHistory();
}

function renderChatHistory() {
    const chat = document.getElementById('eko-chat');
    if (!chat) return;

    chat.innerHTML = chatHistory.map((msg, idx) => {
        let actionCardHtml = '';
        if (msg.suggested_action && !msg.failure) {
            actionCardHtml = renderAiActionCard(msg, idx);
        }

        return `
        <div class="chat-bubble ${msg.role}">
            <div>${msg.html}</div>
            ${actionCardHtml}
            ${msg.failure ? '<div style="font-size:0.75rem; color:var(--danger); margin-top:8px; font-weight:600;">⚠️ Offline / Server fallback message</div>' : ''}
        </div>`;
    }).join('');

    chat.scrollTop = chat.scrollHeight;
}

function renderAiActionCard(msg, idx) {
    const action = msg.suggested_action;
    const title = msg.action_title || 'Follow up on business item';
    const customer = msg.related_customer || '';
    const priority = msg.priority || 'medium';

    if (action === 'create_task') {
        const isCompleted = msg._actionDone;
        return `
        <div style="margin-top:12px; padding:12px 14px; background:rgba(79, 70, 229, 0.05); border:1px solid rgba(79, 70, 229, 0.2); border-radius:var(--radius-md); display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:700; font-size:0.84rem; color:var(--primary); display:flex; align-items:center; gap:6px;">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    <span>Suggested Action</span>
                </div>
                <span class="badge ${priority === 'high' ? 'badge-danger' : 'badge-neutral'}" style="font-size:0.7rem; text-transform:uppercase;">${priority}</span>
            </div>
            <div style="font-size:0.88rem; color:var(--text-main); font-weight:600;">${escapeHtml(title)}</div>
            <div style="display:flex; justify-content:flex-end; margin-top:4px;">
                ${isCompleted
                    ? `<button class="btn-secondary" disabled style="font-size:0.8rem; padding:5px 12px; opacity:0.8; color:var(--success);"><svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Task Added ✓</button>`
                    : `<button class="btn-primary" style="font-size:0.8rem; padding:6px 14px;" onclick="executeAiCreateTask(${idx}, '${escapeHtml(title).replace(/'/g, "\\'")}', '${priority}')">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        <span>Add to Tasks</span>
                    </button>`
                }
            </div>
        </div>`;
    }

    if (action === 'follow_up' && customer) {
        return `
        <div style="margin-top:12px; padding:10px 14px; background:rgba(6, 182, 212, 0.06); border:1px solid rgba(6, 182, 212, 0.25); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.84rem; color:var(--text-main); font-weight:600; display:flex; align-items:center; gap:6px;">
                <svg class="icon icon-sm" style="color:var(--accent);" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                <span>Customer: <strong>${escapeHtml(customer)}</strong></span>
            </div>
            <button class="btn-secondary" style="font-size:0.8rem; padding:5px 12px;" onclick="executeAiViewCustomer('${escapeHtml(customer).replace(/'/g, "\\'")}')">
                <span>View Profile →</span>
            </button>
        </div>`;
    }

    if (action === 'send_reminder') {
        return `
        <div style="margin-top:12px; padding:10px 14px; background:rgba(34, 197, 94, 0.06); border:1px solid rgba(34, 197, 94, 0.25); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div style="font-size:0.84rem; color:var(--text-main); font-weight:600; display:flex; align-items:center; gap:6px;">
                <svg class="icon icon-sm" style="color:var(--success);" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>WhatsApp Reminder</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn-secondary" style="font-size:0.8rem; padding:5px 10px;" onclick="executeAiCopyMessage(${idx})">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span>Copy Text</span>
                </button>
                <button class="btn-primary" style="font-size:0.8rem; padding:5px 12px; background:#22C55E; border-color:#22C55E;" onclick="executeAiSendWhatsApp(${idx})">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span>Send</span>
                </button>
            </div>
        </div>`;
    }

    if (action === 'select_customer') {
        return `
        <div style="margin-top:12px; padding:12px 14px; background:rgba(220, 38, 38, 0.04); border:1px solid rgba(220, 38, 38, 0.2); border-radius:var(--radius-md); display:flex; flex-direction:column; gap:8px;">
            <div style="font-weight:700; font-size:0.84rem; color:var(--danger); display:flex; align-items:center; gap:6px;">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span>Information Missing</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:4px;">
                <button class="btn-primary" style="font-size:0.8rem; padding:6px 14px; background:var(--text-main); border-color:var(--text-main);" onclick="navigateTo('customers')">
                    <span>Select Customer</span>
                </button>
                <button class="btn-ghost" style="font-size:0.8rem; padding:6px 14px;" onclick="showToast('Action cancelled')">
                    <span>Cancel</span>
                </button>
            </div>
        </div>`;
    }

    return '';
}

async function executeAiCreateTask(idx, title, priority) {
    try {
        if (isDemoMode) {
            DEMO_DATA.tasks.unshift({
                id: 't' + Date.now(),
                title: title,
                due_date: new Date().toISOString().slice(0, 10),
                completed: false,
                priority: priority || 'medium'
            });
        } else {
            await api.createTask({
                title: title,
                due_date: new Date().toISOString().slice(0, 10),
                priority: priority || 'medium'
            });
        }

        // Log the recommendation accepted metric
        api.logActionTaken('create_task', title);

        if (chatHistory[idx]) {
            chatHistory[idx]._actionDone = true;
        }
        renderChatHistory();
        showToast('Task added to your list! 📋');
    } catch (e) {
        showToast('Could not create task.', 'error');
    }
}

function executeAiViewCustomer(customerName) {
    api.logActionTaken('follow_up', customerName);
    navigateTo('customers');
    const search = document.getElementById('customer-search');
    if (search) {
        search.value = customerName;
        filterCustomers();
    }
}

function extractCleanWhatsAppMessage(rawText) {
    if (!rawText) return '';
    // Look for quoted message inside "..." or “...” or &quot;...&quot;
    const quoteMatch = rawText.match(/(?:&quot;|["“])([^"”&]+)(?:&quot;|["”])/);
    if (quoteMatch && quoteMatch[1].trim().length > 10) {
        return quoteMatch[1].trim();
    }
    // Clean preamble and suffix if quotes are not found
    let text = rawText.replace(/<[^>]+>/g, '').trim();
    text = text.replace(/^[\s\S]*?(?:message bhej sakte hain|message hai|reminder:?)\s*[:：]?\s*/i, '');
    text = text.replace(/Yeh message (?:professional|courteous|polite)[\s\S]*$/i, '').trim();
    text = text.replace(/^["“”]/, '').replace(/["“”]$/, '').trim();
    return text;
}

function executeAiCopyMessage(idx) {
    const msg = chatHistory[idx];
    if (!msg) return;
    api.logActionTaken('send_reminder', 'whatsapp_copy');

    const raw = msg.raw_answer || msg.html || '';
    const textToCopy = extractCleanWhatsAppMessage(raw);

    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('WhatsApp message copied to clipboard! 📋');
    }).catch(() => {
        showToast('Message copied!');
    });
}

function executeAiSendWhatsApp(idx) {
    const msg = chatHistory[idx];
    if (!msg) return;
    api.logActionTaken('send_reminder', 'whatsapp_direct');

    const raw = msg.raw_answer || msg.html || '';
    const textToSend = extractCleanWhatsAppMessage(raw);

    window.open(`https://wa.me/?text=${encodeURIComponent(textToSend)}`, '_blank');
}

function sendQuickPrompt(q) {
    const input = document.getElementById('eko-input');
    if (input) input.value = q;
    sendToEko();
}

async function sendToEko() {
    const input = document.getElementById('eko-input');
    const question = input ? input.value.trim() : '';
    if (!question) return;

    input.value = '';

    // Add user message
    chatHistory.push({ role: 'user', html: escapeHtml(question) });
    renderChatHistory();

    const sendBtn = document.getElementById('eko-send');
    if (sendBtn) sendBtn.disabled = true;

    // Offline scenario
    if (!navigator.onLine) {
        chatHistory.push({
            role: 'eko',
            html: `Internet connection nahi hai abhi. 📵<br>Aapka data device mein safe hai. Online aate hi Eko dobara active ho jayega.`,
            failure: true,
        });
        renderChatHistory();
        if (sendBtn) sendBtn.disabled = false;
        return;
    }

    // Add typing loader
    chatHistory.push({
        role: 'eko',
        html: `<div style="display:flex; align-items:center; gap:8px; color:var(--text-muted);">
            <div class="spinner" style="width:16px; height:16px; margin:0; border-width:2px;"></div>
            <span>Eko is thinking...</span>
        </div>`,
        isLoading: true
    });
    renderChatHistory();

    try {
        let result;
        if (isDemoMode) {
            result = await simulateDemoAI(question);
        } else {
            result = await api.askEko(question);
        }

        // Remove loading state
        chatHistory = chatHistory.filter(m => !m.isLoading);

        if (result.failure) {
            chatHistory.push({
                role: 'eko',
                html: escapeHtml(result.answer),
                raw_answer: result.answer,
                failure: true,
            });
        } else {
            chatHistory.push({
                role: 'eko',
                html: formatAiResponse(result.answer),
                raw_answer: result.answer,
                suggested_action: result.suggested_action || null,
                action_title: result.action_title || null,
                related_customer: result.related_customer || null,
                priority: result.priority || null,
                failure: false,
            });
        }
    } catch (e) {
        chatHistory = chatHistory.filter(m => !m.isLoading);
        chatHistory.push({
            role: 'eko',
            html: `Kuch technical samasya aa gayi. Kripya thodi der baad koshish karein. 🔄`,
            failure: true,
        });
    }

    renderChatHistory();
    if (sendBtn) sendBtn.disabled = false;
}

function formatAiResponse(text) {
    if (!text) return '';
    return escapeHtml(text)
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// ── Demo AI Simulation (Contextual & Structured) ──────────────────────────────
async function simulateDemoAI(question) {
    await new Promise(r => setTimeout(r, 600));
    const q = question.toLowerCase();
    const customers = DEMO_DATA.customers;
    const tasks = DEMO_DATA.tasks.filter(t => !t.completed);
    const due = customers.filter(c => c.follow_up_date || (c.amount_due && c.amount_due > 0));

    if (q.includes('follow up') && !q.includes('ramesh') && !q.includes('mohan') && !q.includes('sunita')) {
        // Intentional Failure: Missing customer identity
        return {
            answer: `Mujhe samajh nahi aaya ki aap **kis customer** ki baat kar rahe hain. 🔍\n\nKripya customer ka naam batayein ya neeche diye gaye button se select karein taaki main follow-up reminder set kar sakun.`,
            suggested_action: 'select_customer',
            related_customer: null,
            failure: false
        };
    }

    if (q.includes('kya karna') || q.includes('aaj') || q.includes('plan') || q.includes('summary') || q.includes('today') || q.includes('kaam') || q.includes('routine')) {
        return {
            answer: `📋 **Aaj ka Business Action Plan**:\n\n` +
                    `• **Payment Recovery**: ${due.length} customers ki payment pending hai (Total: ₹4,700).\n` +
                    `  👉 Sabse pehle **Ramesh Kumar** (₹3,500 due) ko call karein.\n` +
                    `• **Pending Tasks**: ${tasks.length} tasks scheduled (${tasks[0]?.title || 'Stock order'})\n` +
                    `• **Recommended Focus**: Subah 11 baje tak payment follow-ups karein, sham ko supplier delivery check karein.`,
            suggested_action: 'create_task',
            action_title: 'Aaj ki pending payment recovery complete karein',
            related_customer: 'Ramesh Kumar',
            priority: 'high',
            failure: false
        };
    }
    if (q.includes('follow') || q.includes('customer') || q.includes('khata') || q.includes('udhari') || q.includes('hisab')) {
        return {
            answer: `Aaj **${due.length} customers** ke saath follow up karein:\n\n` +
                    `1. **Ramesh Kumar**: ₹3,500 due (Wholesale). Sabse pehle inhein call karein.\n` +
                    `2. **Mohan Lal**: ₹1,200 due (Restaurant delivery).\n\n` +
                    `💡 Tip: Customer profile par jaakar seedha reminder draft kar sakte hain.`,
            suggested_action: 'follow_up',
            action_title: null,
            related_customer: 'Ramesh Kumar',
            priority: 'high',
            failure: false
        };
    }
    if (q.includes('payment') || q.includes('reminder') || q.includes('whatsapp') || q.includes('message')) {
        return {
            answer: `Yeh polite WhatsApp message bhej sakte hain:\n\n` +
                    `"Namaste Ramesh bhai! 🙏 Aapka pichle hafte ka ₹3,500 ka payment pending hai. Kripya jab bhi time mile settle kar dein. Kisi bhi naye saaman ki zaroorat ho toh batayein. Dhanyawad!"\n\n` +
                    `Yeh message polite aur professional hai.`,
            suggested_action: 'send_reminder',
            action_title: null,
            related_customer: 'Ramesh Kumar',
            priority: 'medium',
            failure: false
        };
    }
    if (q.includes('promotion') || q.includes('offer') || q.includes('bundle') || q.includes('bikri') || q.includes('sales')) {
        return {
            answer: `Is hafte ke liye **Weekly Ration Bundle** promotion suggest karta hoon:\n\n` +
                    `📦 **Bundle Offer**: 5kg Basmati Rice + 1kg Toor Dal + 1L Mustard Oil = **₹X (10% Discount)**\n\n` +
                    `Fayeda: Isse customers ek sath zyada saaman khareedte hain aur daily sales badhti hai.`,
            suggested_action: 'create_task',
            action_title: 'Weekly ration promotion offer dukaan par lagayein',
            related_customer: null,
            priority: 'medium',
            failure: false
        };
    }

    return {
        answer: `Aapke business mein abhi **${customers.length} customers** aur **${tasks.length} pending tasks** hain.\n\nAap mujhse kisi specific customer ke balance, WhatsApp payment reminder ya daily business advice ke baare mein pooch sakte hain. 😊`,
        suggested_action: null,
        action_title: null,
        related_customer: null,
        priority: null,
        failure: false
    };
}
