const path = require('path');

const config = {
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'admin.db'),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
};

module.exports = config;
