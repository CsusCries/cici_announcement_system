const KEY = 'cici_announcements';
const $ = (s) => document.querySelector(s);
const list = $('#list'), dialog = $('#dialog'), form = $('#form');
let editingId = null;

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = (items) => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} };
let items = load();

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmt = (t) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const cat = $('#filterCategory').value, pri = $('#filterPriority').value;
  const shown = items
    .filter((a) => (!q || (a.title + ' ' + a.body + ' ' + a.author).toLowerCase().includes(q))
      && (!cat || a.category === cat) && (!pri || a.priority === pri))
    .sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));

  list.innerHTML = shown.map((a) => `
    <li class="card ${a.priority} ${a.pinned ? 'pinned' : ''}" data-id="${a.id}">
      <div class="meta">
        ${a.pinned ? '<span>📌 Pinned</span>' : ''}
        <span class="tag ${esc(a.category)}">${esc(a.category)}</span>
        <span class="tag">${a.priority} priority</span>
        <span>${fmt(a.createdAt)}${a.author ? ' · ' + esc(a.author) : ''}</span>
      </div>
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.body)}</p>
      <div class="card-actions">
        <button class="btn" data-act="pin">${a.pinned ? 'Unpin' : 'Pin'}</button>
        <button class="btn" data-act="edit">Edit</button>
        <button class="btn" data-act="delete">Delete</button>
      </div>
    </li>`).join('');
  $('#empty').hidden = items.length > 0;
  $('#count').textContent = items.length ? `Showing ${shown.length} of ${items.length}` : '';
}

function openForm(a) {
  editingId = a ? a.id : null;
  form.reset();
  $('#formTitle').textContent = a ? 'Edit announcement' : 'New announcement';
  if (a) for (const k of ['title', 'body', 'category', 'priority', 'author']) form.elements[k].value = a[k];
  form.elements.pinned.checked = !!(a && a.pinned);
  dialog.showModal();
}

form.addEventListener('submit', () => {
  const f = form.elements;
  const data = { title: f.title.value.trim(), body: f.body.value.trim(), category: f.category.value,
    priority: f.priority.value, author: f.author.value.trim(), pinned: f.pinned.checked };
  if (editingId) items = items.map((a) => (a.id === editingId ? { ...a, ...data } : a));
  else items.push({ id: crypto.randomUUID?.() || String(Date.now()), createdAt: Date.now(), ...data });
  save(items); render();
});

list.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  const id = btn.closest('.card').dataset.id, a = items.find((x) => x.id === id);
  if (btn.dataset.act === 'pin') a.pinned = !a.pinned;
  if (btn.dataset.act === 'edit') return openForm(a);
  if (btn.dataset.act === 'delete' && confirm(`Delete "${a.title}"?`)) items = items.filter((x) => x.id !== id);
  save(items); render();
});

$('#newBtn').onclick = () => openForm();
$('#cancelBtn').onclick = () => dialog.close();
['#search', '#filterCategory', '#filterPriority'].forEach((s) => $(s).addEventListener('input', render));
render();
