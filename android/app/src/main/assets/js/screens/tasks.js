/**
 * Eko AI Operations — Operational Tasks
 */

let _taskRecords = [];
let _taskFilter = 'all';
let _taskSearchTerm = '';

function renderTasksScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row mb-4">
            <div>
                <h1 class="screen-title">Operational Tasks</h1>
                <p class="text-sm text-muted">Prioritize and track daily service delivery.</p>
            </div>
            <button class="btn-primary" onclick="openAddTaskModal()" style="display:flex; align-items:center; gap:8px;">
                ${renderIcon('check-square', 18)}
                <span>Add Task</span>
            </button>
        </div>

        <!-- Task Filters & Search Card -->
        <div class="card mb-6 p-4">
            <div class="filter-tabs mb-4">
                <button class="filter-tab ${_taskFilter === 'all' ? 'active' : ''}" data-filter="all" onclick="filterTasksTab('all')">
                    All (<span id="task-count-all">0</span>)
                </button>
                <button class="filter-tab ${_taskFilter === 'pending' ? 'active' : ''}" data-filter="pending" onclick="filterTasksTab('pending')">
                    Pending (<span id="task-count-pending">0</span>)
                </button>
                <button class="filter-tab ${_taskFilter === 'completed' ? 'active' : ''}" data-filter="completed" onclick="filterTasksTab('completed')">
                    Completed (<span id="task-count-completed">0</span>)
                </button>
            </div>
            <div style="position:relative;">
                <input type="text" id="task-search-input" class="form-input text-xs" style="padding-left:34px;" placeholder="Search tasks by title or priority..." oninput="handleTaskSearch(this.value)">
                <div style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-light); pointer-events:none;">
                    ${renderIcon('search', 14)}
                </div>
            </div>
        </div>

        <div id="tasks-list" class="item-list" style="display:flex; flex-direction:column; gap:var(--sp-3);">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>`;
}

async function loadTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;

    list.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

    try {
        let tasks = null;
        try {
            tasks = await api.getTasks();
            if (typeof offlineCache !== 'undefined' && offlineCache.set) {
                offlineCache.set('/api/tasks', tasks);
            }
        } catch (netErr) {
            // Check offline cache on network failure
            if (typeof offlineCache !== 'undefined' && offlineCache.get) {
                const cached = await offlineCache.get('/api/tasks');
                if (cached && Array.isArray(cached)) {
                    tasks = cached;
                    showToast('Viewing cached tasks (offline)', 'info');
                }
            }
            if (!tasks) throw netErr;
        }

        _taskRecords = Array.isArray(tasks) ? tasks : [];
        updateTaskTabCounts();
        renderFilteredTasks();
    } catch (e) {
        const msg = (typeof formatErrorMessage === 'function')
            ? formatErrorMessage(e, 'Could not fetch operational tasks.')
            : (e.message || 'Error loading tasks');

        list.innerHTML = `
            <div class="card p-6 text-center" style="border:1px dashed var(--border);">
                <div style="width:48px; height:48px; border-radius:50%; background:var(--danger-bg); color:var(--danger); display:flex; align-items:center; justify-content:center; margin:0 auto 12px;">
                    ${renderIcon('alert-triangle', 24)}
                </div>
                <h3 style="font-size:1rem; font-weight:700; color:var(--navy); margin-bottom:4px;">Unable to load tasks</h3>
                <p class="text-xs text-muted mb-4">${escapeHtml(msg)}</p>
                <button class="btn-primary" onclick="loadTasks()" style="display:inline-flex; align-items:center; gap:8px; padding:8px 16px; font-size:0.85rem; margin:0 auto;">
                    ${renderIcon('refresh-cw', 14)}
                    <span>Try Again</span>
                </button>
            </div>`;
        if (window.lucide) lucide.createIcons();
    }
}

function handleTaskSearch(val) {
    _taskSearchTerm = val.toLowerCase().trim();
    renderFilteredTasks();
}

function filterTasksTab(tab) {
    _taskFilter = tab;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === tab);
    });
    renderFilteredTasks();
}

function updateTaskTabCounts() {
    const total = _taskRecords.length;
    const pending = _taskRecords.filter(t => !t.completed).length;
    const completed = _taskRecords.filter(t => t.completed).length;

    const elAll = document.getElementById('task-count-all');
    const elPending = document.getElementById('task-count-pending');
    const elCompleted = document.getElementById('task-count-completed');

    if (elAll) elAll.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elCompleted) elCompleted.textContent = completed;
}

function renderFilteredTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;

    let filtered = _taskRecords.filter(t => {
        if (_taskFilter === 'pending' && t.completed) return false;
        if (_taskFilter === 'completed' && !t.completed) return false;
        if (_taskSearchTerm) {
            const titleMatch = (t.title || '').toLowerCase().includes(_taskSearchTerm);
            const prioMatch = (t.priority || '').toLowerCase().includes(_taskSearchTerm);
            if (!titleMatch && !prioMatch) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="card p-6 text-center" style="background:var(--bg); border:1px dashed var(--border);">
                <div style="width:48px; height:48px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; margin:0 auto 12px;">
                    ${renderIcon('check-circle', 24)}
                </div>
                <h3 style="font-size:1rem; font-weight:700; color:var(--navy); margin-bottom:4px;">No tasks found</h3>
                <p class="text-xs text-muted">${_taskSearchTerm ? 'No tasks match your search filter.' : 'All operational tasks are clear for today!'}</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    list.innerHTML = filtered.map(t => {
        const isUrgent = t.priority === 'urgent';
        const isHigh = t.priority === 'high';
        const badgeClass = isUrgent ? 'badge-danger' : (isHigh ? 'badge-warning' : 'badge-neutral');

        return `
        <div class="card p-4 hover-card" style="display:flex; align-items:center; gap:14px; border-left:${t.completed ? '3px solid var(--border)' : (isUrgent ? '3px solid var(--danger)' : '3px solid var(--primary)')};">
            <div class="custom-checkbox ${t.completed ? 'checked' : ''}" 
                 style="width:22px; height:22px; border:2px solid ${t.completed ? 'var(--primary)' : 'var(--border)'}; border-radius:6px; background:${t.completed ? 'var(--primary)' : 'var(--surface)'}; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;" 
                 onclick="toggleTask('${t.id}', ${!t.completed})"
                 role="checkbox"
                 aria-checked="${t.completed}">
                ${t.completed ? `<i data-lucide="check" style="width:14px; height:14px; color:#fff;"></i>` : ''}
            </div>
            <div style="flex:1; min-width:0;">
                <div class="font-semibold text-sm ${t.completed ? 'text-light line-through' : 'text-main'}" style="line-height:1.4;">
                    ${escapeHtml(t.title)}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; flex-wrap:wrap; gap:8px;">
                    <span class="badge ${badgeClass}" style="font-size:0.65rem; text-transform:uppercase; font-weight:700;">${escapeHtml(t.priority || 'medium')}</span>
                    <span class="text-xs text-light" style="display:inline-flex; align-items:center; gap:4px;">
                        <i data-lucide="calendar" style="width:12px; height:12px;"></i>
                        ${t.due_date ? formatDate(t.due_date) : 'No deadline'}
                    </span>
                </div>
            </div>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

async function toggleTask(id, completed) {
    try {
        await api.updateTask(id, { completed });
        // Update local state immediately for instant feedback
        const target = _taskRecords.find(t => t.id === id);
        if (target) target.completed = completed;
        updateTaskTabCounts();
        renderFilteredTasks();
        showToast(completed ? 'Task marked as complete' : 'Task reopened', 'success');
    } catch (e) {
        showToast('Failed to update task: ' + (e.message || 'Error'), 'error');
        loadTasks();
    }
}

function openAddTaskModal() {
    const modal = document.getElementById('customer-detail-modal');
    const title = document.getElementById('cd-modal-title');
    const body = document.getElementById('cd-modal-body');
    if (!modal || !title || !body) return;

    title.textContent = 'Create Operational Task';
    body.innerHTML = `
        <form onsubmit="submitCreateTask(event)">
            <div class="form-group mb-4">
                <label class="form-label font-semibold text-xs mb-1" style="display:block;">Task Title *</label>
                <input type="text" id="task-title-input" class="form-input text-sm" placeholder="e.g. Audit float balance at Sharma Telecom" required>
            </div>
            <div class="form-group mb-4">
                <label class="form-label font-semibold text-xs mb-1" style="display:block;">Priority</label>
                <select id="task-priority-input" class="form-input text-sm">
                    <option value="low">Low Priority</option>
                    <option value="medium" selected>Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                </select>
            </div>
            <div class="form-group mb-6">
                <label class="form-label font-semibold text-xs mb-1" style="display:block;">Due Date</label>
                <input type="date" id="task-duedate-input" class="form-input text-sm">
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="btn-ghost" onclick="closeModal('customer-detail-modal')">Cancel</button>
                <button type="submit" class="btn-primary" style="display:inline-flex; align-items:center; gap:6px;">
                    <i data-lucide="check" style="width:14px; height:14px;"></i>
                    <span>Save Task</span>
                </button>
            </div>
        </form>
    `;
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

async function submitCreateTask(e) {
    e.preventDefault();
    const title = document.getElementById('task-title-input')?.value.trim();
    const priority = document.getElementById('task-priority-input')?.value;
    const due_date = document.getElementById('task-duedate-input')?.value;
    if (!title) return;

    try {
        await api.createTask({ title, priority, due_date: due_date || null });
        closeModal('customer-detail-modal');
        showToast('Task created successfully!', 'success');
        loadTasks();
    } catch (err) {
        showToast('Failed to create task: ' + (err.message || 'Error'), 'error');
    }
}
