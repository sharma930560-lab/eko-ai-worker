/**
 * Eko — Modern Notes Screen (Business Commercial Journal & Logs)
 */

function renderNotesScreen() {
    return `
    <div class="screen-header-row">
        <div>
            <h1 class="screen-title">Business Journal & Notes</h1>
        </div>
    </div>

    <!-- Note Creator Card -->
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:20px; box-shadow:var(--shadow-xs); margin-bottom:24px;">
        <div style="font-weight:700; font-size:0.95rem; color:var(--text-main); margin-bottom:10px; display:flex; align-items:center; gap:8px;">
            <svg class="icon icon-sm" style="color:var(--primary);" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            <span>Write New Entry</span>
        </div>
        <textarea id="new-note-input" rows="3" class="form-input" placeholder="Aaj ka hisab, stock delivery, price badlav ya koi zaroori baat likhein... (Write today's business notes...)" style="resize:vertical;"></textarea>
        <div style="display:flex; justify-content:flex-end; margin-top:12px;">
            <button class="btn-primary" onclick="saveNote()">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                <span>Save Note</span>
            </button>
        </div>
    </div>

    <!-- Notes Journal List -->
    <div class="section-header" style="margin-bottom:12px;">
        <h2 class="section-title">Timeline History</h2>
    </div>
    <div id="notes-list" class="item-list">
        <div class="loading-state"><div class="spinner"></div></div>
    </div>`;
}

async function loadNotes() {
    const list = document.getElementById('notes-list');
    if (!list) return;
    try {
        const notes = isDemoMode ? DEMO_DATA.notes : await api.getNotes();
        if (notes.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <h3>No journal notes yet</h3>
                    <p>Record your daily transactions, wholesale rate changes, or customer requests above.</p>
                </div>`;
            return;
        }

        list.innerHTML = notes.map(n => `
            <div class="card-item" style="align-items:flex-start; position:relative;">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.78rem; font-weight:600; color:var(--text-muted); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span>${formatDateTime(n.created_at)}</span>
                    </div>
                    <div style="font-size:0.94rem; color:var(--text-main); line-height:1.55; white-space:pre-wrap;">${escapeHtml(n.content)}</div>
                </div>
                <button class="btn-icon btn-icon-danger" onclick="deleteNoteById('${n.id}')" title="Delete Note" style="margin-left:12px;">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `
            <div class="empty-state">
                <p style="color:var(--text-muted);">Could not load notes timeline.</p>
            </div>`;
    }
}

async function saveNote() {
    const input = document.getElementById('new-note-input');
    const content = input ? input.value.trim() : '';
    if (!content) {
        showToast('Please type a note first.', 'error');
        return;
    }
    try {
        if (isDemoMode) {
            DEMO_DATA.notes.unshift({ id: 'n' + Date.now(), content, created_at: new Date().toISOString() });
        } else {
            await api.createNote({ content });
        }
        input.value = '';
        await loadNotes();
        showToast('Journal note saved!');
    } catch (e) {
        showToast(e.offline ? 'You are offline. Note saved locally.' : 'Could not save note.', 'error');
    }
}

async function deleteNoteById(id) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
        if (isDemoMode) {
            DEMO_DATA.notes = DEMO_DATA.notes.filter(n => n.id !== id);
        } else {
            await api.deleteNote(id);
        }
        await loadNotes();
        showToast('Note deleted');
    } catch (e) {
        showToast('Could not delete note', 'error');
    }
}
