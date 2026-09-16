/**
 * Eko AI Operations — Operational Journal
 */

let _noteRecords = [];
let _noteSearchTerm = '';

function renderNotesScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row mb-4">
            <div>
                <h1 class="screen-title">Operational Journal</h1>
                <p class="text-sm text-muted">Incident logs, agent handovers, and service delivery notes.</p>
            </div>
        </div>

        <!-- Note Input Card -->
        <div class="card mb-6 p-4">
            <label class="form-label font-semibold text-xs mb-2" style="display:block; color:var(--text-muted);">
                NEW OPERATIONAL NOTE
            </label>
            <textarea id="new-note-input" rows="3" class="form-input text-sm" placeholder="Record an incident, bank switch escalation, or partner update..." style="resize:vertical; min-height:80px;"></textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
                <span class="text-xs text-muted">Logged with timestamp &amp; user signature</span>
                <button class="btn-primary" id="save-note-btn" onclick="saveNote()" style="display:inline-flex; align-items:center; gap:6px; padding:8px 18px; font-size:0.85rem;">
                    <i data-lucide="plus-circle" style="width:14px; height:14px;"></i>
                    <span>Save Note</span>
                </button>
            </div>
        </div>

        <!-- Search Bar -->
        <div class="card mb-6 p-4">
            <div style="position:relative;">
                <input type="text" id="note-search-input" class="form-input text-xs" style="padding-left:34px;" placeholder="Search operational notes..." oninput="handleNoteSearch(this.value)">
                <div style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-light); pointer-events:none;">
                    ${renderIcon('search', 14)}
                </div>
            </div>
        </div>

        <!-- Notes List -->
        <div class="section-header mb-4" style="display:flex; justify-content:space-between; align-items:center;">
            <h2 class="section-title">Recorded Journal Entries</h2>
            <span class="text-xs text-muted" id="note-count-label">0 entries</span>
        </div>

        <div id="notes-list" class="item-list" style="display:flex; flex-direction:column; gap:var(--sp-3);">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>`;
}

async function loadNotes() {
    const list = document.getElementById('notes-list');
    if (!list) return;

    list.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

    try {
        let notes = null;
        try {
            notes = await api.getNotes();
            if (typeof offlineCache !== 'undefined' && offlineCache.set) {
                offlineCache.set('/api/notes', notes);
            }
        } catch (netErr) {
            // Check offline cache on network failure
            if (typeof offlineCache !== 'undefined' && offlineCache.get) {
                const cached = await offlineCache.get('/api/notes');
                if (cached && Array.isArray(cached)) {
                    notes = cached;
                    showToast('Viewing cached journal entries (offline)', 'info');
                }
            }
            if (!notes) throw netErr;
        }

        _noteRecords = Array.isArray(notes) ? notes : [];
        const countLabel = document.getElementById('note-count-label');
        if (countLabel) countLabel.textContent = `${_noteRecords.length} entr${_noteRecords.length === 1 ? 'y' : 'ies'}`;
        renderFilteredNotes();
    } catch (e) {
        const msg = (typeof formatErrorMessage === 'function')
            ? formatErrorMessage(e, 'Could not fetch operational notes.')
            : (e.message || 'Error loading notes');

        list.innerHTML = `
            <div class="card p-6 text-center" style="border:1px dashed var(--border);">
                <div style="width:48px; height:48px; border-radius:50%; background:var(--danger-bg); color:var(--danger); display:flex; align-items:center; justify-content:center; margin:0 auto 12px;">
                    ${renderIcon('alert-triangle', 24)}
                </div>
                <h3 style="font-size:1rem; font-weight:700; color:var(--navy); margin-bottom:4px;">Unable to load notes</h3>
                <p class="text-xs text-muted mb-4">${escapeHtml(msg)}</p>
                <button class="btn-primary" onclick="loadNotes()" style="display:inline-flex; align-items:center; gap:8px; padding:8px 16px; font-size:0.85rem; margin:0 auto;">
                    ${renderIcon('refresh-cw', 14)}
                    <span>Try Again</span>
                </button>
            </div>`;
        if (window.lucide) lucide.createIcons();
    }
}

function handleNoteSearch(val) {
    _noteSearchTerm = val.toLowerCase().trim();
    renderFilteredNotes();
}

function renderFilteredNotes() {
    const list = document.getElementById('notes-list');
    if (!list) return;

    let filtered = _noteRecords.filter(n => {
        if (_noteSearchTerm) {
            return (n.content || '').toLowerCase().includes(_noteSearchTerm);
        }
        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="card p-6 text-center" style="background:var(--bg); border:1px dashed var(--border);">
                <div style="width:48px; height:48px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; margin:0 auto 12px;">
                    ${renderIcon('file-text', 24)}
                </div>
                <h3 style="font-size:1rem; font-weight:700; color:var(--navy); margin-bottom:4px;">No notes recorded</h3>
                <p class="text-xs text-muted">${_noteSearchTerm ? 'No notes match your search filter.' : 'Operational journal is clean. Record important field updates above.'}</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    list.innerHTML = filtered.map(n => `
        <div class="card p-4 hover-card" style="border-left:3px solid var(--primary);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="text-xs font-bold" style="color:var(--primary); letter-spacing:0.02em; display:inline-flex; align-items:center; gap:4px;">
                    <i data-lucide="clock" style="width:12px; height:12px;"></i>
                    ${formatDateTime(n.created_at).toUpperCase()}
                </span>
                <button class="btn-icon" style="border:none; width:28px; height:28px; padding:4px; border-radius:6px;" onclick="deleteNoteById('${n.id}')" aria-label="Delete Note" title="Delete Note">
                    ${renderIcon('trash-2', 14, 'text-light')}
                </button>
            </div>
            <div class="text-sm text-main" style="line-height:1.6; white-space:pre-wrap;">${escapeHtml(n.content)}</div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

async function saveNote() {
    const input = document.getElementById('new-note-input');
    const btn = document.getElementById('save-note-btn');
    const content = input?.value.trim();
    if (!content) {
        showToast('Please enter note content', 'warning');
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner" style="width:14px; height:14px;"></span> Saving...`;
        }
        await api.createNote({ content });
        input.value = '';
        showToast('Note saved to operational journal', 'success');
        loadNotes();
    } catch (e) {
        showToast('Failed to save note: ' + (e.message || 'Error'), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="plus-circle" style="width:14px; height:14px;"></i> <span>Save Note</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function deleteNoteById(id) {
    if (!confirm('Delete this operational note?')) return;
    try {
        await api.deleteNote(id);
        showToast('Note deleted', 'success');
        loadNotes();
    } catch (e) {
        showToast('Failed to delete note: ' + (e.message || 'Error'), 'error');
    }
}
