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
            <div class="card-item">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="custom-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTask('${t.id}', ${!t.completed})">
                        ${t.completed ? renderIcon('check', 14) : ''}
                    </div>
                    <div>
                        <div class="font-semibold ${t.completed ? 'text-light line-through' : ''}">${escapeHtml(t.title)}</div>
                        <div class="text-xs text-muted mt-1">Priority: <span class="badge ${t.priority === 'high' ? 'badge-danger' : 'badge-warning'}" style="font-size:0.6rem;">${t.priority}</span></div>
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    } catch (e) { list.innerHTML = `<p>Error loading tasks.</p>`; }
}
