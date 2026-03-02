module.exports = {
  apps: [{
    name: 'automatrix-erp-staging',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/automatrix-erp-staging',
    env: {
      NODE_ENV: 'production',
      PORT: 3031
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    error_file: '/var/log/pm2/automatrix-erp-staging-error.log',
    out_file: '/var/log/pm2/automatrix-erp-staging-out.log',
    log_file: '/var/log/pm2/automatrix-erp-staging.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
