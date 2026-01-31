# 📊 Data Migration Guide - Import Old Data

## Quick Guide: Import Your Old Expanse.xlsx Data

---

## 📋 **Step-by-Step Migration Process**

### **Method 1: Manual Import (Recommended - Easiest)**

#### **Step 1: Open Both Sheets**
1. Open your **old Expanse.xlsx** in Excel or Google Sheets
2. Open your **new AutoMatrix ERP Google Sheet**

#### **Step 2: Import Employees First (Important!)**
1. In old sheet, copy employee data
2. In new sheet, go to **Employees** tab
3. Paste data starting from Row 2 (below headers)
4. Make sure columns match:
   ```
   Email | Name | Phone | Role | Wallet Balance | Status
   ```
5. Set roles: CEO, Finance Manager, Manager, or Staff
6. Set status: Active

#### **Step 3: Import Expenses**
1. In old sheet, copy expense data
2. In new sheet, go to **Expenses** tab
3. Paste starting from Row 2
4. Required columns:
   ```
   Date | Description | Category | Amount | Payment Mode | Project | 
   Submitted By | Status | Approved By | Approved Date
   ```
5. Fill missing columns:
   - Submitted By: email addresses
   - Status: "Approved" for old approved expenses
   - Leave new columns empty (Receipt File ID, etc.)

#### **Step 4: Import Income**
1. Copy from old sheet
2. Paste to **Income** tab in new sheet
3. Columns:
   ```
   Date | Source | Category | Amount | Payment Mode | Project | 
   Added By | Status | Approved By | Approved Date
   ```

#### **Step 5: Import Inventory (if applicable)**
1. Copy inventory items
2. Paste to **Inventory** tab
3. Columns:
   ```
   Item Name | Category | Quantity | Unit | Unit Cost | Total Value
   ```
4. Leave new columns (Min Stock, Reorder Qty, etc.) empty or fill later

#### **Step 6: Import Projects (if applicable)**
1. Copy projects
2. Paste to **Projects** tab
3. Columns:
   ```
   Project ID | Name | Client | Start Date | End Date | Status | Contract Value
   ```

---

### **Method 2: Automated Import with Script**

#### **Step 1: Upload Old Data to Google Sheet**
1. Open Google Drive
2. Upload `Expanse.xlsx`
3. Open it in Google Sheets
4. Copy each sheet to your new AutoMatrix ERP sheet:
   - Copy expenses → New sheet → Rename to "OldExpenses"
   - Copy income → New sheet → Rename to "OldIncome"
   - Copy employees → New sheet → Rename to "OldEmployees"
   - etc.

#### **Step 2: Add Import Script**
1. In new AutoMatrix ERP sheet, go to **Extensions → Apps Script**
2. Click **+** to add new file
3. Name it: `ImportOldData`
4. Copy content from `scripts/import-old-data.gs`
5. **Adjust column mappings** in the script to match your old data structure
6. Save

#### **Step 3: Run Import**
1. Select function: `importAllOldData`
2. Click **Run** ▶️
3. Authorize if needed
4. Check logs: View → Logs

#### **Step 4: Verify Data**
1. Check each sheet for imported data
2. Verify totals match
3. Delete old temporary sheets (OldExpenses, OldIncome, etc.)

---

## 🔍 **Column Mapping Reference**

### **Expenses**
| Old Column | New Column | Notes |
|------------|------------|-------|
| Date | Date | Keep as is |
| Description | Description | Keep as is |
| Category | Category | Keep as is |
| Amount | Amount | Keep as is |
| Payment | Payment Mode | Keep as is |
| Project | Project | Keep as is |
| Person | Submitted By | Use email address |
| - | Status | Set to "Approved" for old data |
| - | Approved By | Use manager/CEO email |

### **Income**
| Old Column | New Column | Notes |
|------------|------------|-------|
| Date | Date | Keep as is |
| Source | Source | Keep as is |
| Category | Category | Keep as is |
| Amount | Amount | Keep as is |
| Payment | Payment Mode | Keep as is |
| Project | Project | Keep as is |

### **Employees**
| Old Column | New Column | Notes |
|------------|------------|-------|
| Email | Email | Keep as is |
| Name | Name | Keep as is |
| Phone | Phone | Keep as is |
| Position | Role | Map to: CEO, Finance Manager, Manager, Staff |
| Balance | Wallet Balance | Keep as is |
| - | Status | Set to "Active" |

---

## ⚠️ **Important Notes**

### **Before Importing:**
1. ✅ Run `initializeSystem()` first to create all sheets
2. ✅ Backup your old Expanse.xlsx file
3. ✅ Verify column headers match

### **Data Validation:**
- Dates must be in valid date format
- Amounts must be numbers (no currency symbols)
- Email addresses must be valid (for Submitted By, Approved By)
- Roles must be: CEO, Owner, Finance Manager, Manager, or Staff
- Status must be: Pending, Approved, or Rejected

### **After Importing:**
1. ✅ Verify record counts match
2. ✅ Check totals (sum of amounts)
3. ✅ Test a few transactions
4. ✅ Add yourself as CEO if not already present
5. ✅ Update project financials by running recalculation

---

## 🛠️ **Troubleshooting**

### **"Headers don't match"**
- Add missing columns manually
- Or adjust the import script column mappings

### **"Invalid email"**
- Update Submitted By and Approved By columns with valid email addresses
- Use the employee emails from your Employees sheet

### **"Date format error"**
- Convert dates to proper format: YYYY-MM-DD or use Google Sheets date format

### **"Missing required field"**
- Fill in Status column: "Approved" for old approved expenses
- Fill in Submitted By column with employee emails

---

## 📞 **Need Custom Migration Script?**

If your old data structure is very different, you can:

1. **Share the old structure** with me (column names)
2. I'll create a **custom import script** for your specific needs
3. **Or** use the template in `scripts/import-old-data.gs` and modify the column indices

---

## ✅ **Post-Migration Checklist**

After importing:
- [ ] All employees imported with correct roles
- [ ] All expenses imported with proper status
- [ ] All income entries present
- [ ] Projects imported (if applicable)
- [ ] Inventory items imported (if applicable)
- [ ] Totals verified
- [ ] Old temporary sheets deleted
- [ ] Test creating new expense
- [ ] Test approval workflow
- [ ] Celebrate! 🎉

---

**Most Common Approach:** Just copy-paste from old Excel to new Google Sheets tabs. It's the fastest and easiest!

**Questions?** Let me know your old data structure and I'll help create a custom import script.
