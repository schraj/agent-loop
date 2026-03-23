const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/my-widgets — widgets for the current user's role
router.get('/my-widgets', authenticate, (req, res) => {
  const widgets = db.prepare(
    'SELECT * FROM widgets WHERE role_id = ? ORDER BY sort_order'
  ).all(req.user.roleId);
  res.json(widgets.map(formatWidget));
});

// GET /api/roles/:roleId/widgets — admin only
router.get('/roles/:roleId/widgets', authenticate, requireRole('admin'), (req, res) => {
  const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(req.params.roleId);
  if (!role) return res.status(404).json({ error: 'Role not found' });

  const widgets = db.prepare(
    'SELECT * FROM widgets WHERE role_id = ? ORDER BY sort_order'
  ).all(req.params.roleId);
  res.json(widgets.map(formatWidget));
});

// POST /api/roles/:roleId/widgets — admin only
router.post('/roles/:roleId/widgets', authenticate, requireRole('admin'), (req, res) => {
  const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(req.params.roleId);
  if (!role) return res.status(404).json({ error: 'Role not found' });

  const { title, description, widgetType, config, sortOrder } = req.body;
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Widget title is required' });
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO widgets (id, role_id, title, description, widget_type, config, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    req.params.roleId,
    title.trim(),
    (description || '').trim(),
    widgetType || 'action',
    JSON.stringify(config || {}),
    sortOrder ?? 0
  );

  const widget = db.prepare('SELECT * FROM widgets WHERE id = ?').get(id);
  res.status(201).json(formatWidget(widget));
});

// PATCH /api/widgets/:id — admin only
router.patch('/widgets/:id', authenticate, requireRole('admin'), (req, res) => {
  const widget = db.prepare('SELECT * FROM widgets WHERE id = ?').get(req.params.id);
  if (!widget) return res.status(404).json({ error: 'Widget not found' });

  const { title, description, widgetType, config, sortOrder } = req.body;
  const updates = [];
  const values = [];

  if (title !== undefined) { updates.push('title = ?'); values.push(title.trim()); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description.trim()); }
  if (widgetType !== undefined) { updates.push('widget_type = ?'); values.push(widgetType); }
  if (config !== undefined) { updates.push('config = ?'); values.push(JSON.stringify(config)); }
  if (sortOrder !== undefined) { updates.push('sort_order = ?'); values.push(sortOrder); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE widgets SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM widgets WHERE id = ?').get(req.params.id);
  res.json(formatWidget(updated));
});

// DELETE /api/widgets/:id — admin only
router.delete('/widgets/:id', authenticate, requireRole('admin'), (req, res) => {
  const widget = db.prepare('SELECT * FROM widgets WHERE id = ?').get(req.params.id);
  if (!widget) return res.status(404).json({ error: 'Widget not found' });

  db.prepare('DELETE FROM widgets WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

function formatWidget(w) {
  return {
    id: w.id,
    roleId: w.role_id,
    title: w.title,
    description: w.description,
    widgetType: w.widget_type,
    config: JSON.parse(w.config || '{}'),
    sortOrder: w.sort_order,
    createdAt: w.created_at,
  };
}

module.exports = router;
