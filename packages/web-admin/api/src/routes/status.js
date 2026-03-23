const express = require('express');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

// GET /api/status
router.get('/', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get().count;
  const widgetCount = db.prepare('SELECT COUNT(*) as count FROM widgets').get().count;

  let dbSize = 0;
  try {
    const stat = fs.statSync(config.dbPath);
    dbSize = stat.size;
  } catch (_) {}

  res.json({
    uptime: process.uptime(),
    dbSizeBytes: dbSize,
    userCount,
    roleCount,
    widgetCount,
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    platform: process.platform,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
