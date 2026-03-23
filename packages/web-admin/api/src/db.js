const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.dbPath);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  );

  CREATE TABLE IF NOT EXISTS widgets (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    widget_type TEXT NOT NULL DEFAULT 'action',
    config TEXT NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  );
`);

// Seed admin role and user if no roles exist
const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get();
if (roleCount.count === 0) {
  const adminRoleId = uuidv4();
  const adminUserId = uuidv4();
  const passwordHash = bcrypt.hashSync('admin', 10);

  db.prepare('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)').run(
    adminRoleId, 'admin', 'Full system administrator'
  );

  db.prepare('INSERT INTO users (id, username, password_hash, display_name, role_id) VALUES (?, ?, ?, ?, ?)').run(
    adminUserId, 'admin', passwordHash, 'Administrator', adminRoleId
  );

  // Seed some default admin widgets
  const widgets = [
    { title: 'Manage Users', description: 'Create, edit, and delete user accounts', type: 'link', config: JSON.stringify({ route: '/admin/users' }) },
    { title: 'Manage Roles', description: 'Create and configure roles', type: 'link', config: JSON.stringify({ route: '/admin/roles' }) },
    { title: 'System Status', description: 'View system health and metrics', type: 'link', config: JSON.stringify({ route: '/admin/status' }) },
  ];

  const insertWidget = db.prepare(
    'INSERT INTO widgets (id, role_id, title, description, widget_type, config, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  widgets.forEach((w, i) => {
    insertWidget.run(uuidv4(), adminRoleId, w.title, w.description, w.type, w.config, i);
  });

  console.log('Seeded admin role, admin user (password: admin), and default widgets');
}

module.exports = db;
