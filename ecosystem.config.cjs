module.exports = {
  apps: [
    {
      name: 'bunterm',
      script: 'src/index.ts',
      interpreter: 'bun',
      args: 'start -f',
      cwd: __dirname,

      // Auto-restart settings
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 1000,

      // Watch for crashes
      watch: false,

      // Environment
      env: {
        NODE_ENV: 'production'
      },

      // Logging
      error_file: '~/.local/state/ttyd-mux/pm2-error.log',
      out_file: '~/.local/state/ttyd-mux/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Resource limits
      max_memory_restart: '500M'
    }
  ]
};
