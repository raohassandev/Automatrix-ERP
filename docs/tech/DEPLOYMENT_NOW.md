# 🚀 Deploy AutoMatrix ERP - Step by Step

You're almost there! Let's get clasp installed and deploy your ERP.

---

## Step 1: Install clasp

```bash
# Install clasp globally
npm install -g @google/clasp

# Verify installation
clasp --version
```

---

## Step 2: Run Setup Wizard

```bash
# This will guide you through setup
./scripts/setup-clasp.sh
```

The wizard will:
- ✅ Check if clasp is installed
- ✅ Login to your Google account
- ✅ Create or connect to Apps Script project
- ✅ Generate `.clasp.json` configuration

---

## Step 3: Enable Apps Script API

1. Visit: https://script.google.com/home/usersettings
2. Toggle ON: **Google Apps Script API**

---

## Step 4: Deploy

```bash
# Automated deployment (30 seconds)
./scripts/auto-deploy.sh
```

---

## Step 5: Initialize System

1. Open Apps Script editor (opens automatically or manually visit the URL)
2. Click on `initializeSystem` function
3. Click **Run**
4. Authorize the script when prompted

This creates all required sheets.

---

## Step 6: Deploy as Web App

1. In Apps Script editor, click **Deploy** → **New deployment**
2. Choose type: **Web app**
3. Configuration:
   - **Execute as**: Me
   - **Who has access**: Anyone with link (or your preference)
4. Click **Deploy**
5. Copy the **Web App URL**

---

## Step 7: Configure

1. Open the Google Sheet (it's automatically created)
2. Go to **Employees** sheet
3. Add employees with roles:
   - Your email | Your Name | Phone | CEO | 0 | Active
   - Add more employees as needed

---

## 🎉 Done!

Visit your Web App URL and start using AutoMatrix ERP!

---

## Alternative: Manual Deployment (if clasp doesn't work)

```bash
# Build the deployment package
./scripts/deploy.sh

# This creates script.gs (254KB, 8,947 lines)
```

Then manually:
1. Go to: https://script.google.com
2. Create new project or open existing
3. Replace `Code.gs` with content of `script.gs`
4. Add new file `Index.html` with content from `src/client/Index.html`
5. Run `initializeSystem()` once
6. Deploy as Web App

---

## Troubleshooting

### "npm: command not found"
Install Node.js from: https://nodejs.org/

### "clasp login failed"
Make sure you're using a Google account with access to Apps Script

### "User has not enabled the Apps Script API"
Visit: https://script.google.com/home/usersettings and enable it

---

## Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `npm install -g @google/clasp` | Install clasp |
| `clasp login` | Login to Google |
| `./scripts/setup-clasp.sh` | Setup wizard |
| `./scripts/auto-deploy.sh` | Deploy automatically |
| `clasp open` | Open in browser |
| `clasp logs` | View execution logs |

---

**Need help?** Check the full guides:
- [AUTOMATED_DEPLOYMENT.md](./AUTOMATED_DEPLOYMENT.md)
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)

---

**Your ERP is ready to deploy! Just install clasp and run the scripts above.** 🚀
