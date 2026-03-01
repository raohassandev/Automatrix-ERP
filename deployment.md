# AutoMatrix ERP - Deployment Plan

## Server Environment Overview

### **Infrastructure Details**
- **Server**: Hostinger VPS (Ubuntu 22.04.5 LTS)
- **IP**: 178.16.137.85
- **User**: root
- **Resources**: 3.8GB RAM, 49GB Storage (21GB available)
- **Architecture**: x86_64

### **Existing Services**
```
Port  Service              Domain/Purpose
22    SSH                  Server access
80    Nginx HTTP           Web server (redirects to HTTPS)
443   Nginx HTTPS          Web server with SSL
1883  Mosquitto MQTT       IoT messaging
3000  Reserved             (automatrix-prod - inactive)
3001  Reserved             (staging.automatrix.pk)
5050  PV-Backend API       api-staging.pvdg.automatrix.pk (PM2)
5051  PV-Backend Docker    api.pvdg.automatrix.pk (Docker)
5432  PostgreSQL           Database server
27017 MongoDB              Database server
```

---

## AutoMatrix ERP Deployment Plan

### **Target Configuration**

#### **Production Environment**
- **Domain**: `erp.automatrix.pk`
- **Port**: `3030`
- **Directory**: `/var/www/automatrix-erp-prod/`
- **Database**: `automatrix_erp_prod`
- **Process Manager**: PM2
- **SSL**: Let's Encrypt

#### **Staging Environment**
- **Domain**: `erp-staging.automatrix.pk`
- **Port**: `3001`
- **Directory**: `/var/www/automatrix-erp-staging/`
- **Database**: `automatrix_erp_staging`
- **Process Manager**: PM2
- **SSL**: Let's Encrypt

---

## Deployment Steps

### **1. Server Preparation**

```bash
# Create directories
mkdir -p /var/www/automatrix-erp-prod
mkdir -p /var/www/automatrix-erp-staging

# Create PostgreSQL databases
sudo -u postgres createdb automatrix_erp_prod
sudo -u postgres createdb automatrix_erp_staging

# Install Node.js dependencies (if needed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs
```

### **2. Environment Configuration**

#### **Production .env**
```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@localhost:5432/automatrix_erp_prod
NEXTAUTH_URL=https://erp.automatrix.pk
NEXTAUTH_SECRET=your-production-secret
PORT=3030
```

#### **Staging .env**
```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/automatrix_erp_staging
NEXTAUTH_URL=https://erp-staging.automatrix.pk
NEXTAUTH_SECRET=your-staging-secret
PORT=3001
```

### **3. Nginx Configuration**

#### **Production Site** (`/etc/nginx/sites-available/automatrix-erp-prod`)
```nginx
server {
    listen 80;
    server_name erp.automatrix.pk;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name erp.automatrix.pk;

    # SSL configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/erp.automatrix.pk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.automatrix.pk/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    access_log /var/log/nginx/automatrix-erp-prod-access.log;
    error_log /var/log/nginx/automatrix-erp-prod-error.log;

    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### **Staging Site** (`/etc/nginx/sites-available/automatrix-erp-staging`)
```nginx
server {
    listen 80;
    server_name erp-staging.automatrix.pk;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name erp-staging.automatrix.pk;

    # SSL configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/erp-staging.automatrix.pk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp-staging.automatrix.pk/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    access_log /var/log/nginx/automatrix-erp-staging-access.log;
    error_log /var/log/nginx/automatrix-erp-staging-error.log;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### **4. PM2 Configuration**

#### **Production Ecosystem** (`ecosystem.prod.js`)
```javascript
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
    max_memory_restart: '1G'
  }]
}
```

#### **Staging Ecosystem** (`ecosystem.staging.js`)
```javascript
module.exports = {
  apps: [{
    name: 'automatrix-erp-staging',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/automatrix-erp-staging',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M'
  }]
}
```

---

## CI/CD with GitHub Actions

### **Recommendation: YES, Use GitHub Actions**

**Pros:**
✅ **Free for public repos** (2000 minutes/month for private)
✅ **Native Git integration** - triggers on push/PR
✅ **Existing server infrastructure** - can SSH deploy directly
✅ **Automated testing** before deployment
✅ **Environment separation** - different workflows for staging/prod
✅ **Secret management** - secure env vars and SSH keys

**Cons:**
❌ **SSH key management** required for server access
❌ **Build time** - runs in GitHub's infrastructure then deploys

### **Proposed GitHub Actions Workflow**

#### **Staging Deployment** (`.github/workflows/deploy-staging.yml`)
```yaml
name: Deploy to Staging

on:
  push:
    branches: [ dev ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test
    
    - name: Run TypeScript check
      run: npm run typecheck
    
    - name: Build application
      run: npm run build
    
    - name: Deploy to staging
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/automatrix-erp-staging
          git pull origin dev
          npm ci --production
          npm run build
          npx prisma migrate deploy
          pm2 restart automatrix-erp-staging
```

#### **Production Deployment** (`.github/workflows/deploy-prod.yml`)
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test
    
    - name: Run TypeScript check
      run: npm run typecheck
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Build application
      run: npm run build
    
    - name: Deploy to production
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/automatrix-erp-prod
          git pull origin main
          npm ci --production
          npm run build
          npx prisma migrate deploy
          pm2 restart automatrix-erp-prod
```

---

## Security Considerations

### **Environment Variables**
- Store sensitive values in GitHub Secrets
- Use different secrets for staging/production
- Never commit `.env` files to repository

### **SSH Access**
- Generate dedicated SSH key for deployments
- Add public key to server's `authorized_keys`
- Store private key in GitHub Secrets

### **Database Security**
- Use strong PostgreSQL passwords
- Consider connection pooling for production
- Regular backups and monitoring

---

## Monitoring & Maintenance

### **Health Checks**
- PM2 automatic restarts
- Nginx error log monitoring
- Database connection monitoring
- SSL certificate auto-renewal

### **Backup Strategy**
- Daily PostgreSQL dumps
- Code repository on GitHub
- Environment configuration backups

---

## Rollback Plan

### **Quick Rollback**
```bash
# If issues occur, rollback to previous PM2 deployment
pm2 restart automatrix-erp-[env] --update-env
```

### **Database Rollback**
```bash
# Restore from backup if needed
pg_restore -d automatrix_erp_[env] backup_file.dump
```

---

**Deployment Status**: Ready for implementation
**Recommended Approach**: GitHub Actions with SSH deployment
**Risk Level**: Low (proven infrastructure, established patterns)