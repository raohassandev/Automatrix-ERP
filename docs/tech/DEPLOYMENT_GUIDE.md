# 🚀 Automatrix ERP v5.0 - Deployment Guide

## 📦 What's Been Enhanced

### ✅ New Features Added:
1. **Income Logging Form** - Complete UI to record payments received
2. **Transaction Approval System** - CEO/Owner can approve/reject expenses
3. **Error Handling** - All functions wrapped in try-catch
4. **Input Validation** - Server-side validation for all forms
5. **Better UX** - Loading indicators, success/error messages, animations
6. **Unique Transaction IDs** - Timestamp-based (no collisions)
7. **Permission Checks** - Role-based function access
8. **Low Stock Alerts** - Dashboard warnings
9. **Pending Approvals Counter** - Dashboard badge for CEO/Owner
10. **Enhanced UI** - Better styling, badges, status indicators

---

## 🔧 DEPLOYMENT STEPS

### Step 1: Open Your Apps Script Project

1. Go to: https://script.google.com
2. Open your "Auto Matrix ERP" project
3. You should see:
   - `Code.gs` (or `script.gs`)
   - `Index.html`

### Step 2: Backup Current Version

**IMPORTANT:** Before making changes, create a backup!

1. In Apps Script editor, click: **File > Make a copy**
2. Name it: "Auto Matrix ERP - Backup v4.0"
3. Now you have a safety backup

### Step 3: Update script.gs

1. Open `Code.gs` (or whatever your main .gs file is called)
2. **Select ALL the existing code** (Ctrl+A / Cmd+A)
3. **Delete it**
4. Open the file `script_enhanced.gs` I created
5. **Copy ALL the code** from that file
6. **Paste** into your Apps Script editor
7. Click **Save** (Ctrl+S / Cmd+S)

### Step 4: Update Index.html

1. Open `Index.html` in Apps Script editor
2. **Select ALL the existing code** (Ctrl+A / Cmd+A)
3. **Delete it**
4. Open the file `Index_enhanced.html` I created
5. **Copy ALL the code** from that file
6. **Paste** into your Apps Script editor
7. Click **Save** (Ctrl+S / Cmd+S)

### Step 5: Test the Project

1. Click the **▶ Run** button at the top
2. Select function: `doGet`
3. Click **Run**
4. If there are any errors, check the **Execution log** at bottom

### Step 6: Deploy New Version

1. Click **Deploy** > **Manage Deployments**
2. Click the **⚙️** (gear icon) next to your current deployment
3. Under "Version", select **New version**
4. Description: `v5.0 - Added income logging, approvals, error handling`
5. Click **Deploy**
6. Copy the new **Web App URL** (should be the same as before)

### Step 7: Test in Browser

1. Open the Web App URL in your browser
2. You should see "AUTOMATRIX ERP v5.0 Enhanced" at the top
3. Test the following:
   - ✅ Dashboard loads
   - ✅ Navigate to all pages using bottom nav
   - ✅ **NEW:** Income page ($ icon in nav)
   - ✅ Submit a test expense
   - ✅ Submit a test income

### Step 8: Verify New Features

**Test Income Logging:**
1. Click the **$ Income** button in bottom nav
2. Fill out the form:
   - Select a project
   - Enter milestone: "Test Payment"
   - Amount: 10000
   - Payment mode: Bank Transfer
   - Date: Today
3. Click **Record Income**
4. Should see success message
5. Check your Income_Log sheet - new row should appear

**Test Approvals (CEO/Owner only):**
1. Submit an expense (any project, any amount)
2. Dashboard should show "Pending Approvals" card
3. Click "View Pending Approvals"
4. You'll see the transaction
5. Click "Approve" or "Reject"
6. Check Transactions sheet - status should update

---

## 📋 NEW SHEETS REQUIRED

Your `Expanse.xlsx` should already have these sheets. If any are missing, create them:

### Income_Log Sheet (Should Already Exist)
Columns:
1. Income_ID
2. Date
3. Project_Name
4. Milestone
5. Amount
6. Payment_Mode
7. Invoice_Number
8. Recorded_By
9. Timestamp
10. Notes

### Inventory_Logs Sheet (If Missing)
Columns:
1. Log_ID
2. Timestamp
3. Item_ID
4. Action
5. Quantity
6. Project_ID
7. User_ID
8. Unit_Cost
9. Total_Cost
10. Notes

---

## 🎯 NAVIGATION CHANGES

### Old Navigation (7 buttons):
1. Home
2. Log (Expense)
3. Sales
4. Projects
5. Inventory
6. Expenses
7. Summary

### New Navigation (8 buttons):
1. Home
2. Expense
3. **Income** ⭐ NEW!
4. Sales
5. Projects
6. Inventory
7. Expenses
8. Summary

---

## 🔐 NEW PERMISSIONS & ROLES

### What Each Role Can Do:

**CEO / Owner:**
- ✅ View company profit
- ✅ View all transactions
- ✅ Approve/reject transactions
- ✅ Log income
- ✅ Log expenses
- ✅ View all pages
- ✅ See pending approvals

**Staff / Engineering / Other:**
- ✅ View own wallet balance
- ✅ Log expenses
- ✅ View projects
- ✅ View inventory
- ❌ Cannot see company profit (shows "Confidential")
- ❌ Cannot approve transactions
- ✅ Can log income (optional - can restrict if needed)

---

## 🐛 TROUBLESHOOTING

### Issue: "Authorization Required"

**Solution:**
1. Click **Deploy** > **Test Deployments**
2. Click the **test web app** link
3. Authorize the script
4. Now try the main deployment

### Issue: "Function not found"

**Solution:**
- Make sure you copied ALL the code from `script_enhanced.gs`
- Check for any syntax errors in the code
- Click **Run** to test functions

### Issue: "Income_Log sheet not found"

**Solution:**
1. Open your Expanse.xlsx
2. Check if sheet is named exactly "Income_Log" (case-sensitive)
3. If missing, create it with columns listed above

### Issue: "Can't log income"

**Solution:**
1. Check console for errors (F12 in browser)
2. Verify Income_Log sheet exists
3. Check that project dropdown is populated
4. Ensure amount is positive

### Issue: "Approvals not showing"

**Solution:**
1. Verify your email is in Employees sheet
2. Check that your role is "CEO" or "Owner" (case-sensitive)
3. Make sure there are transactions with status "Pending"

---

## 📊 DATA VERIFICATION

After deployment, verify data is being saved correctly:

### Check Transactions Sheet:
- New expense should appear with status "Pending"
- Transaction ID should start with "TXN-" followed by timestamp
- All fields populated correctly

### Check Income_Log Sheet:
- New income should appear with ID starting with "INC-"
- Project name, amount, date correct
- Recorded_By shows your email

### Check Employee_Balances Sheet:
- Your email appears in the sheet
- Wallet balance is accurate

---

## 🎨 UI CHANGES

### Visual Improvements:
- ✅ Better colors and contrast
- ✅ Smooth animations on page transitions
- ✅ Loading spinners during API calls
- ✅ Success/error toast messages
- ✅ Status badges (Pending, Approved, Rejected)
- ✅ Empty state messages
- ✅ Touch-friendly buttons (44px minimum)

### New Dashboard Cards:
- ✅ Pending Approvals card (CEO/Owner only)
- ✅ Low Stock Alerts card (all users)

---

## 🔄 ROLLBACK PROCEDURE

If something goes wrong:

1. Go to: **Deploy > Manage Deployments**
2. Click **⚙️** (gear) on current deployment
3. Change "Version" to previous version (v4)
4. Click **Deploy**

Or use your backup:
1. Open the backup copy you made
2. Deploy it as new deployment
3. Share new URL with team

---

## ✅ POST-DEPLOYMENT CHECKLIST

After deploying, verify:

- [ ] Dashboard loads without errors
- [ ] All 8 navigation buttons work
- [ ] Can submit expense
- [ ] **NEW:** Can submit income
- [ ] Income appears in Income_Log sheet
- [ ] Expense appears in Transactions sheet
- [ ] Projects dropdown populated
- [ ] Categories dropdown populated
- [ ] Wallet balance displays
- [ ] Role-based access working (test with different users)
- [ ] **CEO/Owner:** Can see pending approvals
- [ ] **CEO/Owner:** Can approve/reject transactions
- [ ] Mobile view responsive (test on phone)

---

## 📱 TESTING ON MOBILE

1. Open Web App URL on your phone
2. Test all navigation buttons
3. Try submitting expense from mobile
4. Try submitting income from mobile
5. Check that forms are easy to fill
6. Verify dropdowns work properly

---

## 📞 USER TRAINING

### What to Tell Your Team:

**For All Users:**
> "We've upgraded to v5.0. New income logging feature added! Click the $ icon to record payments received."

**For CEO/Owner:**
> "You'll now see pending approvals on dashboard. Click to view and approve/reject expenses."

**Key Changes:**
1. Income logging is now available ($ icon)
2. Better error messages
3. Approval system for expenses
4. Improved mobile experience

---

## 🚨 IMPORTANT NOTES

1. **Backup First:** Always backup before deploying
2. **Test with Sample Data:** Create test transactions first
3. **Check Permissions:** Ensure Employees sheet has correct roles
4. **Mobile Testing:** Most users will access from mobile
5. **Sheet Names:** Case-sensitive! "Income_Log" not "income_log"
6. **Authorization:** Users may need to re-authorize on first use

---

## 📈 WHAT'S NEXT?

After this deployment is stable, next enhancements:

### Phase 2 (Week 2):
- Inventory stock management (add/issue functionality)
- Receipt image upload to Google Drive
- Enhanced wallet system with ledger
- Project detail view (drill-down)

### Phase 3 (Week 3):
- Payroll module
- Client management
- Advanced reporting
- Email notifications

---

## 💬 NEED HELP?

If you encounter any issues:

1. **Check Execution Log:**
   - Apps Script Editor > View > Execution Log
   - Look for error messages

2. **Browser Console:**
   - Open web app
   - Press F12
   - Check Console tab for errors

3. **Test Individual Functions:**
   - In Apps Script, select function from dropdown
   - Click Run
   - Check output

---

## 🎉 DEPLOYMENT COMPLETE!

Once deployed successfully:

✅ Your system now has income logging  
✅ Approval workflow is active  
✅ Better error handling  
✅ Improved user experience  
✅ Ready for production use  

**Congratulations! Your ERP is now v5.0! 🚀**

---

**Version:** 5.0  
**Date:** January 26, 2026  
**Files Updated:** script_enhanced.gs, Index_enhanced.html  
**Breaking Changes:** None  
**Migration Required:** No

