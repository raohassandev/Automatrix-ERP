# MANUAL SERVER SETUP - What YOU Need to Do

**I've automated everything possible. You only need to do these 7 manual steps:**

---

## 🔑 Step 1: Generate SSH Key (Local Machine)

```bash
# Run this on your local machine
ssh-keygen -t rsa -b 4096 -f ~/.ssh/automatrix-deploy -C "automatrix-deploy"

# This creates two files:
# ~/.ssh/automatrix-deploy (private key) 
# ~/.ssh/automatrix-deploy.pub (public key)
```

---

## 🌐 Step 2: Set DNS Records

**Point these domains to your server IP: `178.16.137.85`**

In your domain provider (where automatrix.pk is registered):
- `erp.automatrix.pk` → A record → `178.16.137.85`
- `erp-staging.automatrix.pk` → A record → `178.16.137.85`

---

## 🔧 Step 3: GitHub Secrets Setup

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add these 3 secrets:

| Secret Name | Value |
|-------------|--------|
| `SSH_KEY` | Content of `~/.ssh/automatrix-deploy` (private key file) |
| `HOST` | `178.16.137.85` |
| `USERNAME` | `root` |

---

## 🖥️ Step 4: Server Directory Setup

```bash
# SSH to your server
ssh hostinger-vps

# Create directories
mkdir -p /var/www/automatrix-erp-staging
mkdir -p /var/www/automatrix-erp-prod

# Create log directory
mkdir -p /var/log/pm2

# Clone repository to both locations
cd /var/www/automatrix-erp-staging
git clone -b dev https://github.com/raohassandev/Automatrix-ERP.git .

cd /var/www/automatrix-erp-prod  
git clone -b main https://github.com/raohassandev/Automatrix-ERP.git .
```

---

## 🗄️ Step 5: Database Setup

```bash
# Still on server - create databases
sudo -u postgres createdb automatrix_erp_staging
sudo -u postgres createdb automatrix_erp_prod

# Get/set PostgreSQL password
sudo -u postgres psql
\password postgres
# Enter a strong password - remember this for next step
\q
```

---

## 🔐 Step 6: Environment Files

```bash
# Create staging environment file
cat > /var/www/automatrix-erp-staging/.env.local << EOF
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/automatrix_erp_staging
NEXTAUTH_URL=https://erp-staging.automatrix.pk
NEXTAUTH_SECRET=$(openssl rand -base64 32)
PORT=3031
EOF

# Create production environment file
cat > /var/www/automatrix-erp-prod/.env.production << EOF
NODE_ENV=production
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/automatrix_erp_prod
NEXTAUTH_URL=https://erp.automatrix.pk
NEXTAUTH_SECRET=$(openssl rand -base64 32)
PORT=3030
EOF
```

**Replace `YOUR_PASSWORD_HERE` with the PostgreSQL password you set above.**

---

## 🌍 Step 7: Nginx & SSL Setup

```bash
# Create nginx config for staging
sudo tee /etc/nginx/sites-available/automatrix-erp-staging << EOF
server {
    listen 80;
    server_name erp-staging.automatrix.pk;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name erp-staging.automatrix.pk;

    access_log /var/log/nginx/automatrix-erp-staging-access.log;
    error_log /var/log/nginx/automatrix-erp-staging-error.log;

    location / {
        proxy_pass http://127.0.0.1:3031;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

# Create nginx config for production
sudo tee /etc/nginx/sites-available/automatrix-erp-prod << EOF
server {
    listen 80;
    server_name erp.automatrix.pk;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name erp.automatrix.pk;

    access_log /var/log/nginx/automatrix-erp-prod-access.log;
    error_log /var/log/nginx/automatrix-erp-prod-error.log;

    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

# Enable sites
sudo ln -s /etc/nginx/sites-available/automatrix-erp-staging /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/automatrix-erp-prod /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Get SSL certificates (AFTER DNS is pointing to server)
sudo certbot --nginx -d erp-staging.automatrix.pk
sudo certbot --nginx -d erp.automatrix.pk

# Reload nginx
sudo systemctl reload nginx
```

---

## 🚀 Step 8: Add SSH Key to Server

```bash
# Copy your public key to server
ssh-copy-id -i ~/.ssh/automatrix-deploy.pub root@hostinger-vps

# Test the connection
ssh -i ~/.ssh/automatrix-deploy root@hostinger-vps "echo 'SSH key works!'"
```

---

## ✅ Final Test

After completing all steps:

1. **Push to `dev` branch** → Should auto-deploy to staging
2. **Check**: `https://erp-staging.automatrix.pk` should load
3. **Push to `main` branch** → Should auto-deploy to production  
4. **Check**: `https://erp.automatrix.pk` should load

---

## 📋 Summary

**You manually do 8 steps above, I've automated:**
✅ GitHub Actions workflows  
✅ PM2 ecosystem files  
✅ Package.json scripts  
✅ Environment example file  
✅ Deployment documentation  

**After your manual setup, deployments are 100% automatic!**