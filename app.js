// Persistencia en localStorage
const STORAGE_KEY = 'taskManager.tasks';

// Estado en memoria
let tasks = [];

// Controles y elementos
const form = document.getElementById('task-form');
const taskIdInput = document.getElementById('taskId');
const dueDateInput = document.getElementById('dueDate');
const subjectInput = document.getElementById('subject');
const priorityInput = document.getElementById('priority');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const resetFormBtn = document.getElementById('resetFormBtn');

const sortBySelect = document.getElementById('sortBy');
const filterSubjectInput = document.getElementById('filterSubject');
const filterPrioritySelect = document.getElementById('filterPriority');
const filterStatusSelect = document.getElementById('filterStatus');

const cardsGrid = document.getElementById('cardsGrid');

// Modal
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalDueDate = document.getElementById('modalDueDate');
const modalSubject = document.getElementById('modalSubject');
const modalPriority = document.getElementById('modalPriority');
const modalStatus = document.getElementById('modalStatus');
const modalTitleText = document.getElementById('modalTitleText');
const modalDescription = document.getElementById('modalDescription');
const modalMarkCompletedBtn = document.getElementById('modalMarkCompletedBtn');
const modalEditBtn = document.getElementById('modalEditBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');

let currentModalTaskId = null;

// Utilidades
const priorityWeight = { 'Alta': 3, 'Media': 2, 'Baja': 1 };

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks }));
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    } catch (e) {
      tasks = [];
    }
  }
}

function genId() {
  return `tsk_${Date.now()}_${Math.floor(Math.random()*1000)}`;
}

function computeStatus(task) {
  if (task.completed) return 'Entregada';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(task.dueDate); due.setHours(0,0,0,0);
  return due < today ? 'Retrasada' : 'Pendiente';
}

function statusClass(status) {
  if (status === 'Entregada') return 'state-entregada';
  if (status === 'Retrasada') return 'state-retrasada';
  return 'state-pendiente';
}

function priorityBadgeClass(prio) {
  const p = (prio || '').toLowerCase();
  if (p === 'alta') return 'prio-alta';
  if (p === 'media') return 'prio-media';
  return 'prio-baja';
}

// CRUD
function addTask(task) {
  tasks.push(task);
  saveToStorage();
  renderTasks();
}

function updateTask(id, data) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    tasks[idx] = { ...tasks[idx], ...data };
    saveToStorage();
    renderTasks();
  }
}

function deleteTask(id) {
  const confirmDelete = window.confirm('¿Deseas eliminar esta tarea?');
  if (!confirmDelete) return;
  tasks = tasks.filter(t => t.id !== id);
  saveToStorage();
  renderTasks();
}

// Render
function ellipsisText(text, lines = 3) {
  // Lo controlamos por CSS line-clamp; aquí solo retornamos el texto
  return text ?? '';
}

function createCard(task) {
  const status = computeStatus(task);
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = task.id;

  // Header
  const header = document.createElement('div'); header.className = 'card-header';
  const titleEl = document.createElement('h4'); titleEl.className = 'card-title'; titleEl.textContent = task.title;
  const actions = document.createElement('div'); actions.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary';
  editBtn.textContent = 'Editar';
  editBtn.addEventListener('click', (e) => { e.stopPropagation(); loadTaskIntoForm(task); });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-danger';
  delBtn.textContent = 'Eliminar';
  delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task.id); });

  actions.append(editBtn, delBtn);
  header.append(titleEl, actions);

  // Meta
  const meta = document.createElement('div'); meta.className = 'card-meta';
  const dueEl = document.createElement('span'); dueEl.className = 'card-due'; dueEl.textContent = formatDate(task.dueDate);
  const subjEl = document.createElement('span'); subjEl.textContent = `Materia: ${task.subject}`;
  const prioEl = document.createElement('span'); prioEl.className = `badge ${priorityBadgeClass(task.priority)}`; prioEl.textContent = `Prioridad: ${task.priority}`;
  const statusEl = document.createElement('span'); statusEl.className = `chip ${statusClass(status)}`; statusEl.textContent = status;
  meta.append(dueEl, subjEl, prioEl, statusEl);

  // Descripción con "Ver más"
  const descWrap = document.createElement('div'); descWrap.className = 'card-desc';
  const short = document.createElement('div'); short.className = 'ellipsis'; short.textContent = ellipsisText(task.description);
  const toggle = document.createElement('div'); toggle.className = 'toggle'; toggle.textContent = 'Ver más';
  let expanded = false;
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    expanded = !expanded;
    short.style.webkitLineClamp = expanded ? 'unset' : '3';
    short.style.overflow = expanded ? 'visible' : 'hidden';
    toggle.textContent = expanded ? 'Ver menos' : 'Ver más';
  });
  descWrap.append(short, toggle);

  // Footer microacciones
  const footer = document.createElement('div'); footer.className = 'card-footer';
  const micro = document.createElement('div'); micro.className = 'micro';
  const markBtn = document.createElement('button'); markBtn.textContent = task.completed ? 'Marcar como pendiente' : 'Marcar completada';
  markBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    updateTask(task.id, { completed: !task.completed });
  });
  const detailBtn = document.createElement('button'); detailBtn.textContent = 'Ver detalles';
  detailBtn.addEventListener('click', (e) => { e.stopPropagation(); openModal(task.id); });
  micro.append(markBtn, detailBtn);

  footer.append(micro);

  // Click en tarjeta abre modal
  card.addEventListener('click', () => openModal(task.id));

  // Ensamble
  card.append(header, meta, descWrap, footer);
  return card;
}

function renderTasks() {
  cardsGrid.innerHTML = '';
  let list = [...tasks];

  // Filtros
  const subjFilter = (filterSubjectInput.value || '').trim().toLowerCase();
  const prioFilter = filterPrioritySelect.value;
  const statusFilter = filterStatusSelect.value;

  list = list.filter(t => {
    const status = computeStatus(t);
    const matchesSubject = subjFilter ? t.subject.toLowerCase().includes(subjFilter) : true;
    const matchesPriority = prioFilter ? t.priority === prioFilter : true;
    const matchesStatus = statusFilter ? status === statusFilter : true;
    return matchesSubject && matchesPriority && matchesStatus;
  });

  // Orden
  const sortBy = sortBySelect.value;
  list.sort((a, b) => {
    if (sortBy === 'dueDateAsc') return new Date(a.dueDate) - new Date(b.dueDate);
    if (sortBy === 'dueDateDesc') return new Date(b.dueDate) - new Date(a.dueDate);
    if (sortBy === 'priorityDesc') return priorityWeight[b.priority] - priorityWeight[a.priority];
    if (sortBy === 'priorityAsc') return priorityWeight[a.priority] - priorityWeight[b.priority];
    if (sortBy === 'titleAsc') return a.title.localeCompare(b.title);
    return 0;
  });

  // Render
  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#a8acc4';
    empty.textContent = 'No hay tareas para mostrar.';
    cardsGrid.append(empty);
    return;
    }
  list.forEach(task => cardsGrid.appendChild(createCard(task)));
}

// Formulario
function clearForm() {
  taskIdInput.value = '';
  form.reset();
}

function loadTaskIntoForm(task) {
  taskIdInput.value = task.id;
  dueDateInput.value = task.dueDate;
  subjectInput.value = task.subject;
  priorityInput.value = task.priority;
  titleInput.value = task.title;
  descriptionInput.value = task.description;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    dueDate: dueDateInput.value,
    subject: subjectInput.value.trim(),
    priority: priorityInput.value,
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
  };

  if (!data.dueDate || !data.subject || !data.priority || !data.title || !data.description) {
    alert('Completa todos los campos.');
    return;
  }

  const existingId = taskIdInput.value;
  if (existingId) {
    updateTask(existingId, data);
  } else {
    addTask({ id: genId(), ...data, completed: false });
  }
  clearForm();
});

resetFormBtn.addEventListener('click', () => clearForm());

// Filtros y orden
[sortBySelect, filterPrioritySelect, filterStatusSelect].forEach(el => {
  el.addEventListener('change', renderTasks);
});
filterSubjectInput.addEventListener('input', renderTasks);

// Modal
function openModal(id) {
  currentModalTaskId = id;
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const status = computeStatus(task);

  modalDueDate.textContent = formatDate(task.dueDate);
  modalSubject.textContent = task.subject;
  modalPriority.textContent = task.priority;
  modalStatus.textContent = status;
  modalStatus.className = `chip ${statusClass(status)}`;
  modalTitleText.textContent = task.title;
  modalDescription.textContent = task.description;

  modalBackdrop.classList.add('show');
  modalBackdrop.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modalBackdrop.classList.remove('show');
  modalBackdrop.setAttribute('aria-hidden', 'true');
  currentModalTaskId = null;
}

closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});

modalMarkCompletedBtn.addEventListener('click', () => {
  if (!currentModalTaskId) return;
  const task = tasks.find(t => t.id === currentModalTaskId);
  if (!task) return;
  updateTask(currentModalTaskId, { completed: !task.completed });
  openModal(currentModalTaskId); // refrescar contenido del modal
});

modalEditBtn.addEventListener('click', () => {
  if (!currentModalTaskId) return;
  const task = tasks.find(t => t.id === currentModalTaskId);
  if (!task) return;
  loadTaskIntoForm(task);
  closeModal();
});

modalDeleteBtn.addEventListener('click', () => {
  if (!currentModalTaskId) return;
  deleteTask(currentModalTaskId);
  closeModal();
});

// Util: formato de fecha (destacado visual)
function formatDate(isoDateStr) {
  try {
    const d = new Date(isoDateStr + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoDateStr;
  }
}

// Inicialización
loadFromStorage();
renderTasks();
