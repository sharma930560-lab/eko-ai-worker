/**
 * Eko — Modern Tasks Screen (Tabbed views, Priority Chips, Checkboxes)
 */

let currentTaskTab = 'pending';
let currentPriorityFilter = 'all';

function renderTasksScreen() {
    return `
    <div class="screen-header-row">
        <div>
            <h1 class="screen-title">Tasks & To-Dos</h1>
        </div>
        <button class="btn-primary" onclick="openAddTaskModal()">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Add Task</span>
        </button>
    </div>

    <!-- Segmented Tabs & Filters -->
    <div class="filter-search-bar">
        <div class="segment-tabs">
            <button class="segment-tab active" onclick="switchTaskTab(this, 'pending')">Pending</button>
            <button class="segment-tab" onclick="switchTaskTab(this, 'today')">Today</button>
            <button class="segment-tab" onclick="switchTaskTab(this, 'done')">Completed</button>
            <button class="segment-tab" onclick="switchTaskTab(this, 'all')">All</button>
        </div>

        <div style="display:flex; gap:6px; margin-left:auto;">
            <button class="btn-ghost" style="padding:6px 12px; font-size:0.82rem;" onclick="filterTaskPriority(this, 'all')">All Priority</button>
            <button class="btn-ghost" style="padding:6px 12px; font-size:0.82rem;" onclick="filterTaskPriority(this, 'high')">High</button>
            <button class="btn-ghost" style="padding:6px 12px; font-size:0.82rem;" onclick="filterTaskPriority(this, 'medium')">Medium</button>
        </div>
    </div>

    <!-- Tasks List -->
    <div id="tasks-list" class="item-list">
        <div class="loading-state"><div class="spinner"></div></div>
    </div>

    <!-- Add Task Modal -->
    <div id="add-task-modal" class="modal-overlay hidden">
        <div class="modal-card">
            <div class="modal-header">
                <h2>New Task / Checklist Item</h2>
                <button class="modal-close" onclick="closeModal('add-task-modal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Task Description *</label>
                    <input id="t-title" type="text" placeholder="e.g. Call supplier for sugar stock" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Due Date</label>
                    <input id="t-due" type="date" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Priority Level</label>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="btn-secondary chip-priority active" onclick="selectPriority(this, 'high')" style="flex:1;">🔴 High</button>
                        <button type="button" class="btn-secondary chip-priority" onclick="selectPriority(this, 'medium')" style="flex:1;">🟡 Medium</button>
                        <button type="button" class="btn-secondary chip-priority" onclick="selectPriority(this, 'low')" style="flex:1;">🟢 Low</button>
                    </div>
                    <input type="hidden" id="t-priority" value="high">
                </div>
                <div id="task-form-error" class="form-error hidden"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="closeModal('add-task-modal')">Cancel</button>
                <button class="btn-primary" onclick="saveTask()">Save Task</button>
            </div>
        </div>
    </div>`;
}

async function loadTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    try {
        const tasks = isDemoMode ? DEMO_DATA.tasks : await api.getTasks();
        window._allTasks = tasks;
        renderTaskList();
    } catch (e) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg class="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <h3>Could not load tasks</h3>
                <p>Verify backend connectivity.</p>
            </div>`;
    }
}

function switchTaskTab(btn, tab) {
    currentTaskTab = tab;
    document.querySelectorAll('.segment-tabs .segment-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTaskList();
}

function filterTaskPriority(btn, priority) {
    currentPriorityFilter = priority;
    renderTaskList();
}

function renderTaskList() {
    const list = document.getElementById('tasks-list');
    if (!list || !window._allTasks) return;

    let filtered = window._allTasks;

    if (currentTaskTab === 'pending') {
        filtered = filtered.filter(t => !t.completed);
    } else if (currentTaskTab === 'today') {
        filtered = filtered.filter(t => !t.completed && t.due_date === today());
    } else if (currentTaskTab === 'done') {
        filtered = filtered.filter(t => t.completed);
    }

    if (currentPriorityFilter !== 'all') {
        filtered = filtered.filter(t => t.priority === currentPriorityFilter);
    }

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg class="icon icon-lg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <h3>${currentTaskTab === 'pending' ? "You're all caught up!" : 'No tasks in this category'}</h3>
                <p>${currentTaskTab === 'pending' ? 'No pending tasks right now. Great job!' : 'Add a task or check other filter tabs.'}</p>
            </div>`;
        return;
    }

    list.innerHTML = filtered.map(t => `
        <div class="card-item task-card-row">
            <div class="task-item">
                <div class="custom-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTask('${t.id}', ${!t.completed})">
                    ${t.completed ? '<svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </div>
                <div class="task-details">
                    <div class="task-title ${t.completed ? 'done' : ''}">${escapeHtml(t.title)}</div>
                    <div class="task-meta">
                        ${t.due_date ? `<span class="${isOverdue(t.due_date) && !t.completed ? 'overdue' : ''}">📅 ${formatDate(t.due_date)}</span>` : ''}
                        <span class="badge-priority ${t.priority}">${t.priority}</span>
                    </div>
                </div>
            </div>
            <button class="btn-icon btn-icon-danger" onclick="deleteTaskById('${t.id}')" title="Delete Task">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
    `).join('');
}

function openAddTaskModal() {
    const err = document.getElementById('task-form-error');
    if (err) err.classList.add('hidden');
    document.getElementById('t-title').value = '';
    document.getElementById('t-due').value = today();
    document.getElementById('t-priority').value = 'high';
    const modal = document.getElementById('add-task-modal');
    if (modal) modal.classList.remove('hidden');
}

function selectPriority(btn, priority) {
    document.querySelectorAll('.chip-priority').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('t-priority').value = priority;
}

async function saveTask() {
    const titleInput = document.getElementById('t-title');
    const errEl = document.getElementById('task-form-error');
    const title = titleInput ? titleInput.value.trim() : '';

    if (!title) {
        if (errEl) {
            errEl.textContent = 'Task description is required.';
            errEl.classList.remove('hidden');
        }
        return;
    }

    const data = {
        title,
        due_date: document.getElementById('t-due')?.value || null,
        priority: document.getElementById('t-priority')?.value || 'medium',
    };

    try {
        if (isDemoMode) {
            DEMO_DATA.tasks.unshift({ id: 't' + Date.now(), completed: false, ...data });
        } else {
            await api.createTask(data);
        }
        closeModal('add-task-modal');
        await loadTasks();
        showToast('Task added successfully!');
    } catch (e) {
        if (errEl) {
            errEl.textContent = e.message || 'Could not save task.';
            errEl.classList.remove('hidden');
        }
    }
}

async function toggleTask(id, completed) {
    try {
        if (isDemoMode) {
            const t = DEMO_DATA.tasks.find(x => x.id === id);
            if (t) t.completed = completed;
        } else {
            await api.updateTask(id, { completed });
        }
        await loadTasks();
    } catch (e) {
        showToast('Could not update task status', 'error');
    }
}

async function deleteTaskById(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        if (isDemoMode) {
            DEMO_DATA.tasks = DEMO_DATA.tasks.filter(t => t.id !== id);
        } else {
            await api.deleteTask(id);
        }
        await loadTasks();
        showToast('Task deleted');
    } catch (e) {
        showToast('Could not delete task', 'error');
    }
}
