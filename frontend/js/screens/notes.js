/**
 * Eko AI Operations — Operational Journal
 */

function renderNotesScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Operational Journal</h1>
                <p class="text-sm text-muted">Incident logs and service notes.</p>
            </div>
        </div>

        <div class="card mb-6">
            <textarea id="new-note-input" rows="3" class="form-input" placeholder="Write an operational note..." style="border:none; padding:0; box-shadow:none; resize:none;"></textarea>
            <div style="display:flex; justify-content:flex-end; margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
                <button class="btn-primary" onclick="saveNote()" style="padding:8px 16px; font-size:0.85rem;">Save Note</button>
            </div>
        </div>

        <div id="notes-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>`;
}

async function loadNotes() {
    const list = document.getElementById('notes-list');
    if (!list) return;
    try {
        const notes = await api.getNotes();
        if (!notes || notes.length === 0) {
            list.innerHTML = `<div class="empty-state"><h3>No notes recorded</h3></div>`;
            return;
        }
        list.innerHTML = notes.map(n => `
            <div class="card" style="padding:16px; margin-bottom:12px; border-color:var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="text-xs text-light font-bold" style="letter-spacing:0.02em;">${formatDateTime(n.created_at).toUpperCase()}</span>
                    <button class="btn-icon" style="border:none; width:auto; height:auto; padding:4px;" onclick="deleteNoteById('${n.id}')" aria-label="Delete Note">
                        ${renderIcon('trash-2', 14, 'text-light')}
                    </button>
                </div>
                <div class="text-sm text-main" style="line-height:1.6;">${escapeHtml(n.content)}</div>
            </div>
        `).join('');
        lucide.createIcons();
    } catch (e) { list.innerHTML = `<p>Error.</p>`; }
}
