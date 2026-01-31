# 🚀 Quick Deployment Guide

## One-Time Setup (5 minutes)

### 1. Install Prerequisites
```bash
# Install Node.js (if not installed)
# Download from: https://nodejs.org/

# Run setup wizard
./scripts/setup-clasp.sh
```

The setup wizard will:
- ✅ Check Node.js installation
- ✅ Install clasp (Google Apps Script CLI)
- ✅ Login to your Google account
- ✅ Create or connect to Apps Script project
- ✅ Generate .clasp.json configuration

### 2. Enable Apps Script API
Visit: https://script.google.com/home/usersettings  
Enable: "Google Apps Script API"

---

## Deploy (1 command)

```bash
./scripts/auto-deploy.sh
```

This automatically:
1. Builds the deployment package
2. Combines all modules
3. Deploys to Google Apps Script
4. Opens in browser (optional)

---

## First Time After Deploy

1. **Initialize System** (one time only)
   - Open Apps Script editor
   - Run: `initializeSystem()`
   - This creates all required sheets

2. **Deploy as Web App**
   - Click "Deploy" → "New deployment"
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone with link
   - Click "Deploy"

3. **Copy Web App URL**
   - Use this URL to access your ERP system

---

## Regular Deployment Workflow

```bash
# Make changes to code in src/

# Deploy changes
./scripts/auto-deploy.sh

# Done! Changes are live
```

---

## Troubleshooting

### "clasp: command not found"
```bash
npm install -g @google/clasp
```

### "User has not enabled the Apps Script API"
Visit: https://script.google.com/home/usersettings  
Enable the API

### "Cannot find .clasp.json"
```bash
./scripts/setup-clasp.sh
```

---

## Manual Deployment (if needed)

```bash
# Build
./scripts/deploy.sh

# Copy to Apps Script manually
# 1. Open Apps Script editor
# 2. Replace Code.gs with script.gs content
# 3. Replace Index.html with src/client/Index.html
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./scripts/setup-clasp.sh` | One-time setup |
| `./scripts/auto-deploy.sh` | Deploy to Apps Script |
| `clasp open` | Open in browser |
| `clasp logs` | View execution logs |
| `clasp pull` | Pull latest from Apps Script |

---

**That's it!** You now have automated deployment. 🎉

For full details, see: [AUTOMATED_DEPLOYMENT.md](./AUTOMATED_DEPLOYMENT.md)
