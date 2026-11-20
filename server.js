const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'notes-store.json');

// ---------- Persistent JSON store (atomic writes, no native deps) ----------
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('data dir error:', e.message);
  }
}

function defaultStore() {
  return {
    categories: [
      { id: uuidv4(), name: 'Personal', color: '#8b5cf6', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'Work', color: '#3b82f6', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'Ideas', color: '#10b981', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'Tasks', color: '#f59e0b', createdAt: new Date().toISOString() }
    ],
    notes: [],
    tags: []
  };
}

let store = defaultStore();

function loadStore() {
  ensureDataDir();
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.notes)) {
        store = {
          categories: parsed.categories || defaultStore().categories,
          notes: parsed.notes || [],
          tags: parsed.tags || []
        };
        return;
      }
    }
  } catch (e) {
    console.error('load store failed, using defaults:', e.message);
  }
  store = defaultStore();
  saveStore();
}

function saveStore() {
  ensureDataDir();
  const tmp = DB_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(store, null, 0), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('save store failed:', e.message);
    try { fs.writeFileSync(DB_FILE, JSON.stringify(store), 'utf8'); } catch (_) {}
  }
}

loadStore();

// ---------- Helpers ----------
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

function noteToClient(n) {
  const cat = store.categories.find(c => c.id === n.categoryId);
  const tags = (n.tagIds || []).map(id => store.tags.find(t => t.id === id)).filter(Boolean)
    .map(t => ({ id: t.id, name: t.name }));
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    categoryId: n.categoryId || null,
    categoryName: cat ? cat.name : null,
    categoryColor: cat ? cat.color : null,
    pinned: !!n.pinned,
    archived: !!n.archived,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    tags
  };
}

function ensureTags(names) {
  const ids = [];
  if (!Array.isArray(names)) return ids;
  for (const raw of names) {
    const name = String(raw).trim().slice(0, 50);
    if (!name) continue;
    let tag = store.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      tag = { id: uuidv4(), name, createdAt: new Date().toISOString() };
      store.tags.push(tag);
    }
    ids.push(tag.id);
  }
  return ids;
}

// ---------- Middleware ----------
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

// ---------- Health (must respond immediately) ----------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// ---------- Stats ----------
app.get('/api/stats', (req, res) => {
  try {
    const active = store.notes.filter(n => !n.archived);
    const total = active.length;
    const pinned = active.filter(n => n.pinned).length;
    const archived = store.notes.filter(n => n.archived).length;
    const categories = store.categories.map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      count: active.filter(n => n.categoryId === c.id).length
    }));
    const recent = active
      .slice()
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 5)
      .map(noteToClient);
    res.json({ total, pinned, archived, categories, recent });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ---------- Notes ----------
app.get('/api/notes', (req, res) => {
  try {
    const { search = '', category, tag, sort = 'updated', archived = '0' } = req.query;
    const isArchived = archived === '1' || archived === 'true';
    let list = store.notes.filter(n => !!n.archived === isArchived);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      );
    }
    if (category) list = list.filter(n => n.categoryId === category);
    if (tag) list = list.filter(n => (n.tagIds || []).includes(tag));

    list = list.slice();
    switch (sort) {
      case 'oldest':
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        break;
      case 'alpha':
        list.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
        break;
      case 'newest':
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        break;
      default:
        list.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        });
    }
    res.json(list.map(noteToClient));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

app.get('/api/notes/:id', (req, res) => {
  const n = store.notes.find(x => x.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'Note not found' });
  res.json(noteToClient(n));
});

app.post('/api/notes', (req, res) => {
  try {
    const { title = '', content = '', categoryId = null, tags = [], pinned = false } = req.body || {};
    const now = new Date().toISOString();
    const note = {
      id: uuidv4(),
      title: String(title).slice(0, 500).trim() || 'Untitled',
      content: sanitizeHtml(String(content || '')),
      categoryId: categoryId || null,
      tagIds: ensureTags(tags),
      pinned: !!pinned,
      archived: false,
      createdAt: now,
      updatedAt: now
    };
    store.notes.unshift(note);
    saveStore();
    res.status(201).json(noteToClient(note));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

app.put('/api/notes/:id', (req, res) => {
  try {
    const idx = store.notes.findIndex(x => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Note not found' });
    const n = store.notes[idx];
    const body = req.body || {};
    if (body.title !== undefined) n.title = String(body.title).slice(0, 500).trim() || 'Untitled';
    if (body.content !== undefined) n.content = sanitizeHtml(String(body.content));
    if (body.categoryId !== undefined) n.categoryId = body.categoryId || null;
    if (body.pinned !== undefined) n.pinned = !!body.pinned;
    if (body.archived !== undefined) n.archived = !!body.archived;
    if (Array.isArray(body.tags)) n.tagIds = ensureTags(body.tags);
    n.updatedAt = new Date().toISOString();
    store.notes[idx] = n;
    saveStore();
    res.json(noteToClient(n));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

app.patch('/api/notes/:id', (req, res) => {
  try {
    const idx = store.notes.findIndex(x => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Note not found' });
    const n = store.notes[idx];
    const body = req.body || {};
    if (body.pinned !== undefined) n.pinned = !!body.pinned;
    if (body.archived !== undefined) n.archived = !!body.archived;
    n.updatedAt = new Date().toISOString();
    store.notes[idx] = n;
    saveStore();
    res.json(noteToClient(n));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

app.delete('/api/notes/:id', (req, res) => {
  const before = store.notes.length;
  store.notes = store.notes.filter(x => x.id !== req.params.id);
  if (store.notes.length === before) return res.status(404).json({ error: 'Note not found' });
  saveStore();
  res.status(204).end();
});

// ---------- Categories ----------
app.get('/api/categories', (req, res) => {
  const active = store.notes.filter(n => !n.archived);
  res.json(store.categories.map(c => ({
    id: c.id,
    name: c.name,
    color: c.color,
    noteCount: active.filter(n => n.categoryId === c.id).length,
    createdAt: c.createdAt
  })));
});

app.post('/api/categories', (req, res) => {
  const name = String((req.body && req.body.name) || '').trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (store.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: 'Category already exists' });
  }
  const color = (req.body && req.body.color) || '#6366f1';
  const cat = { id: uuidv4(), name, color, createdAt: new Date().toISOString() };
  store.categories.push(cat);
  saveStore();
  res.status(201).json({ id: cat.id, name: cat.name, color: cat.color, noteCount: 0 });
});

app.put('/api/categories/:id', (req, res) => {
  const cat = store.categories.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  if (req.body && req.body.name !== undefined) cat.name = String(req.body.name).trim().slice(0, 80);
  if (req.body && req.body.color !== undefined) cat.color = req.body.color;
  saveStore();
  res.json({ id: cat.id, name: cat.name, color: cat.color });
});

app.delete('/api/categories/:id', (req, res) => {
  const before = store.categories.length;
  store.categories = store.categories.filter(c => c.id !== req.params.id);
  if (store.categories.length === before) return res.status(404).json({ error: 'Category not found' });
  store.notes.forEach(n => {
    if (n.categoryId === req.params.id) n.categoryId = null;
  });
  saveStore();
  res.status(204).end();
});

// ---------- Tags ----------
app.get('/api/tags', (req, res) => {
  res.json(store.tags.map(t => ({
    id: t.id,
    name: t.name,
    noteCount: store.notes.filter(n => (n.tagIds || []).includes(t.id)).length,
    createdAt: t.createdAt
  })));
});

// ---------- Export ----------
app.get('/api/export', (req, res) => {
  const notes = store.notes.map(n => {
    const cat = store.categories.find(c => c.id === n.categoryId);
    const tags = (n.tagIds || []).map(id => {
      const t = store.tags.find(x => x.id === id);
      return t ? t.name : null;
    }).filter(Boolean);
    return {
      id: n.id,
      title: n.title,
      content: n.content,
      category: cat ? cat.name : null,
      pinned: !!n.pinned,
      archived: !!n.archived,
      tags,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt
    };
  });
  res.setHeader('Content-Disposition', 'attachment; filename="quicknote-export.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    version: '2.0.2',
    notes,
    categories: store.categories.map(c => ({ id: c.id, name: c.name, color: c.color }))
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start immediately — no async work before listen
app.listen(PORT, '0.0.0.0', () => {
  console.log(`QuickNote Smart Notes running on 0.0.0.0:${PORT}`);
});

module.exports = app;
