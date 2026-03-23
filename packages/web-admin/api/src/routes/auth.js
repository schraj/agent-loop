const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare(`
    SELECT u.id, u.username, u.password_hash, u.display_name,
           r.id as role_id, r.name as role_name, r.description as role_description
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.username = ?
  `).get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: {
        id: user.role_id,
        name: user.role_name,
        description: user.role_description,
      },
    },
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.username, u.display_name,
           r.id as role_id, r.name as role_name, r.description as role_description
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(req.user.id);

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: {
      id: user.role_id,
      name: user.role_name,
      description: user.role_description,
    },
  });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.user.id);

  res.json({ message: 'Password changed successfully' });
});

module.exports = router;
