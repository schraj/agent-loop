const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    // Fetch fresh user + role from DB
    const user = db.prepare(`
      SELECT u.id, u.username, u.display_name, r.id as role_id, r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(payload.sub);

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      roleId: user.role_id,
      roleName: user.role_name,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.roleName)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
