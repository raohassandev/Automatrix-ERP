# 📊 Data Migration - Step-by-Step Guide

## Import Your Old Expanse.xlsx Data to AutoMatrix ERP

---

## 🎯 **Quick Migration Process** (10 minutes)

### **Step 1: Upload Old File to Google Drive** (1 minute)

1. Go to Google Drive: https://drive.google.com
2. Click **+ New** → **File upload**
3. Select your `Expanse.xlsx` file
4. After upload, **right-click** → **Open with** → **Google Sheets**
5. **Copy the Sheet ID** from URL:
   ```
   https://docs.google.com/spreadsheets/d/OLD_SHEET_ID_HERE/edit
   ```
   Example: `1ABC123xyz...`

---

### **Step 2: Add Migration Script** (2 minutes)

1. Open your **NEW AutoMatrix ERP Google Sheet**
2. Go to **Extensions** → **Apps Script**
3. Click **+** (Add a file)
4. Name it: `MigrateOldData`
5. Copy content from `scripts/migrate-old-expanse.gs`
6. **Update line 21** with your old sheet ID:
   ```javascript
   const OLD_SHEET_ID = 'YOUR_OLD_SHEET_ID_HERE';
   ```
7. **Update line 24** with your email:
   ```javascript
   const DEFAULT_USER_EMAIL = 'israrulhaq5@gmail.com';
   ```
8. **Save** (Ctrl+S or Cmd+S)

---

### **Step 3: Test Connection** (30 seconds)

1. Select function: `testOldSheetConnection`
2. Click **Run** ▶️
3. Check logs: **View** → **Logs**
4. Should show: ✅ Connected to your old sheet

---

### **Step 4: Run Migration** (1 minute)

1. Select function: `migrateAllOldData`
2. Click **Run** ▶️
3. Wait for completion (may take 1-2 minutes for large datasets)
4. Check logs to see results:
   ```
   ✅ Migrated X employees
   ✅ Migrated Y expenses (marked as [MIGRATED])
   ✅ Migrated Z income entries
   ```

---

### **Step 5: Verify Data** (2 minutes)

1. Check each sheet in your new AutoMatrix ERP:
   - **Employees** - Should have your team
   - **Expenses** - Should show [MIGRATED] prefix on descriptions
   - **Income** - Should show [MIGRATED] prefix on sources
   - **Inventory** - Should have items
   - **Projects** - Should have projects
   - **Wallet** - Should have transactions

2. Verify totals match your old sheet

---

### **Step 6: Mark as Migrated** (30 seconds)

The script automatically marks old data:
- ✅ Expense descriptions: `[MIGRATED] Original description`
- ✅ Income sources: `[MIGRATED] Original source`
- ✅ Wallet references: `[MIGRATED] Old entry`
- ✅ Status: Old expenses/income marked as "Approved"
- ✅ Validation Status: Set to "Migrated"

This helps you distinguish:
- **Old data** (migrated from Expanse.xlsx)
- **New data** (created after migration)

---

## 📋 **What Gets Migrated**

### ✅ **Employees Sheet**
```
Old: Email | Name | Phone | Role | Wallet Balance
New: Email | Name | Phone | Role | Wallet Balance | Status (Active)
```

### ✅ **Expenses Sheet**
```
Old: Date | Description | Category | Amount | Payment | Project | Person | Status
New: Date | [MIGRATED] Description | Category | Amount | Payment Mode | 
     Project | Submitted By | Status (Approved) | ... (new columns)
```
**Note:** Old data marked with `[MIGRATED]` prefix

### ✅ **Income Sheet**
```
Old: Date | Source | Category | Amount | Payment | Project
New: Date | [MIGRATED] Source | Category | Amount | Payment Mode | 
     Project | Added By | Status (Approved) | ... (new columns)
```

### ✅ **Inventory Sheet**
```
Old: Item | Category | Quantity | Unit | Cost
New: Item | Category | Quantity | Unit | Unit Cost | Total Value | 
     Min Stock | Reorder Qty | ... (new columns)
```

### ✅ **Projects Sheet**
```
Old: Project ID | Name | Client | Start | End | Status | Value
New: Same + new columns (Invoiced, Received, Pending, Cost, Margin)
```

### ✅ **Wallet Sheet**
```
Old: Date | Employee | Type | Amount | Reference | Balance
New: Date | Employee | Type | Amount | [MIGRATED] Reference | Balance
```

---

## ⚠️ **Important Notes**

### **Before Migration:**
- ✅ Deploy AutoMatrix ERP to Apps Script
- ✅ Run `initializeSystem()` to create all sheets
- ✅ Upload old Expanse.xlsx to Google Drive
- ✅ Open it in Google Sheets
- ✅ Get the Sheet ID

### **Data Adjustments:**
- Old data status set to **"Approved"** (since it's historical)
- Descriptions/sources marked with **[MIGRATED]** prefix
- Missing emails use your default email
- New columns (receipts, approval levels) left empty

### **After Migration:**
- You can filter by description/source to see old vs new data
- Old data marked as "Migrated" in validation status
- Easily identify and separate historical data

---

## 🔧 **Troubleshooting**

### **"OLD_SHEET_ID not found"**
- Make sure you updated the OLD_SHEET_ID in line 21
- Check the Sheet ID is correct (from the URL)
- Make sure you have access to the old sheet

### **"Sheet not found in old file"**
- Check if your old Excel has sheets named: Employees, Expenses, Income, etc.
- The script looks for these exact names
- If different, rename them in Google Sheets or modify the script

### **"Headers don't match"**
- The script assumes common column order
- If your old structure is different, you may need to adjust column indices
- Tell me your old structure and I'll customize the script

### **"Some data missing"**
- Check for empty rows in old sheet
- The script skips rows where first column is empty
- Review logs to see what was skipped

---

## 🎨 **Custom Migration**

If your old Expanse.xlsx has a different structure, tell me:

1. **What sheets** are in the Excel file?
2. **What columns** does each sheet have?
3. I'll create a **custom migration script** for you!

---

## ✅ **Post-Migration Checklist**

After migration complete:
- [ ] All employees imported
- [ ] All expenses imported (check count)
- [ ] All income imported (check count)
- [ ] Inventory items present
- [ ] Projects present
- [ ] Wallet balances correct
- [ ] Verify totals match old sheet
- [ ] Test creating NEW expense (should not have [MIGRATED] prefix)
- [ ] Old Expanse.xlsx backed up
- [ ] Delete old sheet from Google Drive (after verification)

---

## 🎉 **Ready to Migrate!**

**Follow Steps 1-6 above** and your old data will be safely migrated to the new AutoMatrix ERP system with clear marking to distinguish old vs new data.

**Questions or need custom script?** Just tell me your old data structure!

---

**Script Location:** `scripts/migrate-old-expanse.gs`  
**This Guide:** `MIGRATION_INSTRUCTIONS.md`
