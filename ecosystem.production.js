module.exports = {
  apps: [{
    name: 'automatrix-erp-prod',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/automatrix-erp-prod',
    env: {
      NODE_ENV: 'production',
      PORT: 3030
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/pm2/automatrix-erp-prod-error.log',
    out_file: '/var/log/pm2/automatrix-erp-prod-out.log',
    log_file: '/var/log/pm2/automatrix-erp-prod.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}