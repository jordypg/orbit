/**
 * PM2 Ecosystem Configuration
 * Manages both worker and Next.js server processes
 */

module.exports = {
  apps: [
    {
      name: "orbit-worker",
      script: "./dist/worker.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        POLL_INTERVAL: "5000",
      },
      env_development: {
        NODE_ENV: "development",
        POLL_INTERVAL: "5000",
      },
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Restart policy
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 3000,
    },
    {
      name: "orbit-server",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      env_development: {
        NODE_ENV: "development",
        PORT: "3000",
      },
      error_file: "./logs/server-error.log",
      out_file: "./logs/server-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Restart policy
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
