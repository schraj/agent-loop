const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

// GET /api/users
router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.created_at, u.updated_at,
           r.id as role_id, r.name as role_name
    FROM users u JOIN roles r ON u.role_id = r.id
    ORDER BY u.created_at
  `).all();

  res.json(users.map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    role: { id: u.role_id, name: u.role_name },
  })));
});

// POST /api/users
router.post('/', (req, res) => {
  const { username, password, displayName, roleId } = req.body;
  if (!username || !password || !displayName || !roleId) {
    return res.status(400).json({ error: 'username, password, displayName, and roleId are required' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(roleId);
  if (!role) return res.status(400).json({ error: 'Role not found' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, password_hash, display_name, role_id) VALUES (?, ?, ?, ?, ?)').run(
    id, username.trim(), hash, displayName.trim(), roleId
  );

  const user = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.created_at, u.updated_at,
           r.id as role_id, r.name as role_name
    FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(id);

  res.status(201).json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    role: { id: user.role_id, name: user.role_name },
  });
});

// PATCH /api/users/:id
router.patch('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, password, displayName, roleId } = req.body;
  const updates = [];
  const values = [];

  if (username !== undefined) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username.trim(), req.params.id);
    if (existing) return res.status(409).json({ error: 'Username already taken' });
    updates.push('username = ?');
    values.push(username.trim());
  }
  if (password !== undefined) {
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    updates.push('password_hash = ?');
    values.push(bcrypt.hashSync(password, 10));
  }
  if (displayName !== undefined) {
    updates.push('display_name = ?');
    values.push(displayName.trim());
  }
  if (roleId !== undefined) {
    const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(roleId);
    if (!role) return res.status(400).json({ error: 'Role not found' });
    updates.push('role_id = ?');
    values.push(roleId);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.created_at, u.updated_at,
           r.id as role_id, r.name as role_name
    FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(req.params.id);

  res.json({
    id: updated.id,
    username: updated.username,
    displayName: updated.display_name,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
    role: { id: updated.role_id, name: updated.role_name },
  });
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
