const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

// GET /api/roles
router.get('/', (req, res) => {
  const roles = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM users WHERE role_id = r.id) as user_count,
      (SELECT COUNT(*) FROM widgets WHERE role_id = r.id) as widget_count
    FROM roles r ORDER BY r.created_at
  `).all();
  res.json(roles);
});

// GET /api/roles/:id
router.get('/:id', (req, res) => {
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  res.json(role);
});

// POST /api/roles
router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Role name is required' });
  }

  const existing = db.prepare('SELECT id FROM roles WHERE name = ?').get(name.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'A role with that name already exists' });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)').run(
    id, name.trim().toLowerCase(), (description || '').trim()
  );

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  res.status(201).json(role);
});

// PATCH /api/roles/:id
router.patch('/:id', (req, res) => {
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Role not found' });

  const { name, description } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) {
    if (role.name === 'admin' && name.trim().toLowerCase() !== 'admin') {
      return res.status(400).json({ error: 'Cannot rename the admin role' });
    }
    const existing = db.prepare('SELECT id FROM roles WHERE name = ? AND id != ?').get(name.trim().toLowerCase(), req.params.id);
    if (existing) return res.status(409).json({ error: 'A role with that name already exists' });
    updates.push('name = ?');
    values.push(name.trim().toLowerCase());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description.trim());
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);
  db.prepare(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/roles/:id
router.delete('/:id', (req, res) => {
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  if (role.name === 'admin') return res.status(400).json({ error: 'Cannot delete the admin role' });

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ?').get(req.params.id);
  if (userCount.count > 0) {
    return res.status(400).json({ error: `Cannot delete role with ${userCount.count} assigned user(s). Reassign them first.` });
  }

  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
