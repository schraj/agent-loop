module.exports = {
  apps: [{
    name: 'agent-loop',
    script: 'dist/src/index.js',
    cwd: __dirname,
    node_args: '--enable-source-maps',
    max_memory_restart: '500M',
    restart_delay: 3000,
    exp_backoff_restart_delay: 1000,
    autorestart: true,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
