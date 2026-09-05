/**
 * Eko AI Operations — Operational Tasks
 */

function renderTasksScreen() {
    return `
    <div class="container-responsive">
        <div class="screen-header-row">
            <div>
                <h1 class="screen-title">Operational Tasks</h1>
                <p class="text-sm text-muted">Prioritize daily service delivery.</p>
            </div>
            <button class="btn-primary" onclick="openAddTaskModal()">
                ${renderIcon('check-square', 18)}
                <span>Add Task</span>
            </button>
        </div>

        <div id="tasks-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>`;
}

async function loadTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    try {
        const tasks = await api.getTasks();
        if (!tasks || tasks.length === 0) {
            list.innerHTML = `<div class="empty-state"><h3>No tasks for today</h3></div>`;
            return;
        }
        list.innerHTML = tasks.map(t => `
            <div class="card-item" style="padding:16px; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:12px; width:100%;">
                    <div class="custom-checkbox ${t.completed ? 'checked' : ''}" style="width:20px; height:20px; border:2.5px solid var(--border); border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="toggleTask('${t.id}', ${!t.completed})">
                        ${t.completed ? renderIcon('check', 12) : ''}
                    </div>
                    <div style="flex:1;">
                        <div class="font-semibold ${t.completed ? 'text-light line-through' : 'text-main'}">${escapeHtml(t.title)}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                            <span class="badge ${t.priority === 'high' ? 'badge-danger' : 'badge-warning'}" style="font-size:0.6rem;">${t.priority}</span>
                            <span class="text-xs text-light">${t.due_date ? formatDate(t.due_date) : 'No deadline'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    } catch (e) { list.innerHTML = `<p>Error loading tasks.</p>`; }
}

async function toggleTask(id, completed) {
    try {
        await api.updateTask(id, { completed });
        loadTasks();
    } catch (e) {
        showToast('Failed to update task: ' + (e.message || 'Error'), 'error');
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
            <div class="form-group mb-3">
                <label class="form-label">Task Title *</label>
                <input type="text" id="task-title-input" class="form-input" placeholder="e.g. Audit float balance at Sharma Telecom" required>
            </div>
            <div class="form-group mb-3">
                <label class="form-label">Priority</label>
                <select id="task-priority-input" class="form-input">
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                </select>
            </div>
            <div class="form-group mb-4">
                <label class="form-label">Due Date</label>
                <input type="date" id="task-duedate-input" class="form-input">
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button type="button" class="btn-ghost" onclick="closeModal('customer-detail-modal')">Cancel</button>
                <button type="submit" class="btn-primary">Save Task</button>
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
