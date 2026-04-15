const STORAGE_KEY = 'smartTodoApp.tasks';
const THEME_KEY = 'smartTodoApp.theme';

const taskListElement = document.getElementById('taskList');
const todoForm = document.getElementById('todoForm');
const todoInput = document.getElementById('todoInput');
const dueDateInput = document.getElementById('dueDateInput');
const priorityInput = document.getElementById('priorityInput');
const searchInput = document.getElementById('searchInput');
const filterButtons = document.querySelectorAll('.filter-btn');
const sortSelect = document.getElementById('sortSelect');
const taskCountText = document.getElementById('taskCountText');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const deleteAllBtn = document.getElementById('deleteAllBtn');
const themeToggle = document.getElementById('themeToggle');

let tasks = [];
let activeFilter = 'all';
let currentSort = 'createdDesc';
let searchQuery = '';
let dragSourceId = null;

function loadTasks() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            tasks = JSON.parse(stored);
        } catch (error) {
            tasks = [];
        }
    }
}

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-theme');
        themeToggle.textContent = '☀️';
    } else {
        document.documentElement.classList.remove('dark-theme');
        themeToggle.textContent = '🌙';
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark-theme');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
}

function createTask(text, dueDate, priority) {
    return {
        id: crypto.randomUUID(),
        text: text.trim(),
        completed: false,
        createdAt: Date.now(),
        dueDate: dueDate || null,
        priority,
    };
}

function formatDueLabel(value) {
    if (!value) return '';
    const date = new Date(value);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function getFilteredTasks() {
    return tasks.filter(task => {
        if (activeFilter === 'active' && task.completed) return false;
        if (activeFilter === 'completed' && !task.completed) return false;
        if (searchQuery && !task.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });
}

function sortTasks(taskArray) {
    return [...taskArray].sort((a, b) => {
        if (currentSort === 'createdDesc') return b.createdAt - a.createdAt;
        if (currentSort === 'createdAsc') return a.createdAt - b.createdAt;
        if (currentSort === 'dueAsc') {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        if (currentSort === 'priorityDesc') {
            const values = { high: 3, medium: 2, low: 1 };
            return values[b.priority] - values[a.priority];
        }
        return 0;
    });
}

function renderTasks() {
    const visibleTasks = sortTasks(getFilteredTasks());
    taskListElement.innerHTML = '';
    taskListElement.classList.toggle('empty', visibleTasks.length === 0);

    visibleTasks.forEach(task => {
        const item = document.createElement('li');
        item.className = `task-item${task.completed ? ' completed' : ''}`;
        item.draggable = true;
        item.dataset.taskId = task.id;

        item.innerHTML = `
            <div class="task-top">
                <button class="task-checkbox${task.completed ? ' checked' : ''}" aria-label="Toggle complete"></button>
                <div class="task-title-group">
                    <p class="task-title${task.completed ? ' completed' : ''}" contenteditable="true" spellcheck="false">${escapeHtml(task.text)}</p>
                    <div class="task-badges">
                        ${task.dueDate ? `<span class="badge due">Due ${formatDueLabel(task.dueDate)}</span>` : ''}
                        <span class="badge ${task.priority}">${task.priority}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="action-btn edit-btn">Edit</button>
                    <button class="action-btn delete-btn">Delete</button>
                </div>
            </div>
            <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        `;

        const checkbox = item.querySelector('.task-checkbox');
        const title = item.querySelector('.task-title');
        const deleteBtn = item.querySelector('.delete-btn');
        const editBtn = item.querySelector('.edit-btn');

        checkbox.addEventListener('click', () => {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
        });

        deleteBtn.addEventListener('click', () => {
            tasks = tasks.filter(t => t.id !== task.id);
            saveTasks();
            renderTasks();
        });

        editBtn.addEventListener('click', () => {
            title.focus();
        });

        title.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                title.blur();
            }
        });

        title.addEventListener('blur', () => {
            const newText = title.textContent.trim();
            if (!newText) {
                title.textContent = task.text;
                return;
            }
            task.text = newText;
            saveTasks();
            renderTasks();
        });

        item.addEventListener('dragstart', () => {
            dragSourceId = task.id;
            item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
            dragSourceId = null;
            item.classList.remove('dragging');
        });

        item.addEventListener('dragover', event => {
            event.preventDefault();
            item.classList.add('drag-over');
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', event => {
            event.preventDefault();
            item.classList.remove('drag-over');
            const targetId = item.dataset.taskId;
            if (!dragSourceId || dragSourceId === targetId) return;
            reorderTasks(dragSourceId, targetId);
        });

        taskListElement.appendChild(item);
    });

    updateStatusPanel();
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#039;');
}

function reorderTasks(sourceId, targetId) {
    const sourceIndex = tasks.findIndex(task => task.id === sourceId);
    const targetIndex = tasks.findIndex(task => task.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    const [movedTask] = tasks.splice(sourceIndex, 1);
    tasks.splice(targetIndex, 0, movedTask);
    saveTasks();
    renderTasks();
}

function updateStatusPanel() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const active = total - completed;
    taskCountText.textContent = total === 0
        ? 'No tasks yet. Add your first one.'
        : `${total} task${total === 1 ? '' : 's'} • ${active} active • ${completed} completed`;
}

function clearCompletedTasks() {
    tasks = tasks.filter(task => !task.completed);
    saveTasks();
    renderTasks();
}

function deleteAllTasks() {
    const confirmed = confirm('Delete all tasks? This cannot be undone.');
    if (!confirmed) return;
    tasks = [];
    saveTasks();
    renderTasks();
}

function handleFormSubmit(event) {
    event.preventDefault();
    const text = todoInput.value.trim();
    if (!text) return;

    tasks.unshift(createTask(text, dueDateInput.value, priorityInput.value));
    saveTasks();
    renderTasks();
    todoForm.reset();
    dueDateInput.value = '';
    priorityInput.value = 'medium';
    todoInput.focus();
}

function bindEvents() {
    todoForm.addEventListener('submit', handleFormSubmit);

    searchInput.addEventListener('input', event => {
        searchQuery = event.target.value.trim();
        renderTasks();
    });

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeFilter = button.dataset.filter;
            renderTasks();
        });
    });

    sortSelect.addEventListener('change', event => {
        currentSort = event.target.value;
        renderTasks();
    });

    clearCompletedBtn.addEventListener('click', clearCompletedTasks);
    deleteAllBtn.addEventListener('click', deleteAllTasks);
    themeToggle.addEventListener('click', toggleTheme);
}

function initializeApp() {
    loadTasks();
    loadTheme();
    bindEvents();
    renderTasks();
}

initializeApp();
