# AutoMatrix ERP - Automated Deployment Guide

## 🚀 Automated Deployment to Google Apps Script

This guide explains how to automatically deploy AutoMatrix ERP to Google Apps Script using Google's `clasp` CLI tool.

---

## 📋 Prerequisites

### 1. Install Node.js
If not already installed:
- Download from: https://nodejs.org/
- Or use package manager:
  ```bash
  # macOS
  brew install node
  
  # Ubuntu/Debian
  sudo apt install nodejs npm
  ```

### 2. Install clasp (Google Apps Script CLI)
```bash
npm install -g @google/clasp
```

### 3. Login to Google Account
```bash
clasp login
```
This will open a browser window for authentication.

---

## 🎯 One-Time Setup

### Option 1: Create New Apps Script Project

```bash
# Create new standalone Apps Script project
clasp create --type standalone --title "AutoMatrix ERP"

# This creates .clasp.json with your script ID
```

### Option 2: Connect to Existing Apps Script Project

```bash
# Get your script ID from the Apps Script URL
# URL format: https://script.google.com/d/SCRIPT_ID_HERE/edit

# Clone the project
clasp clone YOUR_SCRIPT_ID
```

### Option 3: Connect to Google Sheets Container

```bash
# If you want the script bound to a specific Google Sheet
# Get the sheet ID from the URL

clasp create --type sheets --title "AutoMatrix ERP" --parentId YOUR_SHEET_ID
```

After setup, you'll have a `.clasp.json` file:
```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "build"
}
```

---

## 🚀 Automated Deployment

### Quick Deploy
```bash
# Run the automated deployment script
./scripts/auto-deploy.sh
```

This script will:
1. ✅ Check if clasp is installed and you're logged in
2. ✅ Build the deployment package (combines all modules)
3. ✅ Copy frontend files
4. ✅ Create manifest file (appsscript.json)
5. ✅ Deploy to Google Apps Script
6. ✅ Optionally open in browser

---

## 📝 Manual Deployment Steps

If you prefer manual deployment:

### 1. Build the package
```bash
./scripts/deploy.sh
```

### 2. Push to Apps Script
```bash
# Copy files to build directory
mkdir -p build
cp script.gs build/Code.gs
cp src/client/Index.html build/Index.html
cp .clasp.json build/

# Create manifest
cat > build/appsscript.json << 'EOF'
{
  "timeZone": "Asia/Kolkata",
  "dependencies": {},
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_WITH_LINK"
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
EOF

# Deploy
cd build
clasp push --force
cd ..
```

### 3. Open in browser
```bash
cd build
clasp open
cd ..
```

---

## 🔧 Configuration Options

### Change Deployment Target

Edit `.clasp.json`:
```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "build",
  "fileExtension": "gs"
}
```

### Change Timezone

Edit `build/appsscript.json`:
```json
{
  "timeZone": "America/New_York",  // Change this
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_WITH_LINK"
  }
}
```

### Change Web App Access

Options for `access`:
- `MYSELF` - Only you can access
- `DOMAIN` - Anyone in your domain
- `ANYONE` - Anyone on the internet
- `ANYONE_WITH_LINK` - Anyone with the link (recommended)

---

## 📊 Deployment Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Source Files (src/server/*, src/client/*)               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Build Script (scripts/deploy.sh)                        │
│     - Combines all .gs modules                              │
│     - Validates syntax                                      │
│     - Creates script.gs                                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Auto-Deploy Script (scripts/auto-deploy.sh)            │
│     - Copies to build/ directory                            │
│     - Renames script.gs → Code.gs                          │
│     - Creates appsscript.json                               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. clasp push                                              │
│     - Uploads to Google Apps Script                         │
│     - Updates project files                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Google Apps Script (Online)                             │
│     - Code.gs (backend)                                     │
│     - Index.html (frontend)                                 │
│     - appsscript.json (manifest)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Useful clasp Commands

### Check Status
```bash
clasp login --status     # Check if logged in
clasp list               # List all your projects
clasp status             # Show files that will be pushed
```

### Deployment
```bash
clasp push              # Push files to Apps Script
clasp push --force      # Force push (overwrite conflicts)
clasp push --watch      # Watch for changes and auto-push
```

### Open & View
```bash
clasp open              # Open project in browser
clasp open --webapp     # Open web app URL
clasp logs              # View execution logs
```

### Version Control
```bash
clasp version           # List versions
clasp version "v1.0"    # Create new version
clasp versions          # Show all versions
```

### Pull from Apps Script
```bash
clasp pull              # Download latest from Apps Script
```

---

## 🔄 Continuous Deployment Setup

### Watch Mode (Auto-deploy on file changes)

Create `scripts/watch-deploy.sh`:
```bash
#!/bin/bash
echo "👀 Watching for changes..."
echo "Press Ctrl+C to stop"

# Build initially
./scripts/deploy.sh

# Watch for changes in src/
while true; do
    inotifywait -r -e modify src/
    echo "🔄 Changes detected, rebuilding..."
    ./scripts/deploy.sh
    ./scripts/auto-deploy.sh
done
```

Run:
```bash
chmod +x scripts/watch-deploy.sh
./scripts/watch-deploy.sh
```

### Git Hook for Auto-Deploy

Create `.git/hooks/pre-push`:
```bash
#!/bin/bash
echo "🚀 Auto-deploying before push..."
./scripts/auto-deploy.sh
```

Make executable:
```bash
chmod +x .git/hooks/pre-push
```

---

## 🐛 Troubleshooting

### Error: "clasp: command not found"
```bash
# Install clasp globally
npm install -g @google/clasp

# Or use npx
npx @google/clasp login
```

### Error: "User has not enabled the Apps Script API"
1. Go to: https://script.google.com/home/usersettings
2. Enable "Google Apps Script API"

### Error: "Cannot find .clasp.json"
```bash
# You need to initialize the project first
clasp create --type standalone --title "AutoMatrix ERP"
```

### Error: "Push failed"
```bash
# Force push to overwrite
clasp push --force
```

### Error: "Invalid credentials"
```bash
# Re-login
clasp logout
clasp login
```

---

## 📋 Deployment Checklist

Before deploying:
- [ ] All modules in `src/server/modules/` are complete
- [ ] Build script runs without errors (`./scripts/deploy.sh`)
- [ ] Frontend file exists (`src/client/Index.html`)
- [ ] `.clasp.json` configured with correct script ID
- [ ] Logged into clasp (`clasp login --status`)

After deploying:
- [ ] Run `initializeSystem()` in Apps Script editor (one time)
- [ ] Deploy as Web App (Deploy → New deployment)
- [ ] Test with different user roles
- [ ] Verify all features work
- [ ] Check audit logs

---

## 🎯 Best Practices

### 1. Version Control
```bash
# Create version before major deployments
clasp version "v6.0 - Phase 2 Complete"
```

### 2. Test Before Deploy
```bash
# Build and check for errors
./scripts/deploy.sh

# Review output
wc -l script.gs
grep "function doGet" script.gs
```

### 3. Backup Before Deploy
```bash
# Pull current version from Apps Script
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
clasp pull
mv Code.gs backups/$(date +%Y%m%d_%H%M%S)/
```

### 4. Use Different Projects for Dev/Prod
```json
// .clasp.dev.json
{
  "scriptId": "DEV_SCRIPT_ID",
  "rootDir": "build"
}

// .clasp.prod.json
{
  "scriptId": "PROD_SCRIPT_ID",
  "rootDir": "build"
}
```

Deploy to dev:
```bash
cp .clasp.dev.json build/.clasp.json
./scripts/auto-deploy.sh
```

---

## 📚 Additional Resources

- [clasp Documentation](https://github.com/google/clasp)
- [Apps Script API](https://developers.google.com/apps-script/api/quickstart/nodejs)
- [Apps Script Best Practices](https://developers.google.com/apps-script/guides/support/best-practices)

---

## 🎉 Quick Start Summary

```bash
# 1. Install clasp
npm install -g @google/clasp

# 2. Login
clasp login

# 3. Initialize project
clasp create --type standalone --title "AutoMatrix ERP"

# 4. Deploy automatically
./scripts/auto-deploy.sh

# 5. Done! Open in browser and deploy as Web App
```

---

**Last Updated:** January 27, 2026  
**Version:** 6.0  
**Status:** Automated Deployment Ready ✅
