# AutoMatrix ERP v6.0 - Quick Reference Guide

## 📂 Project Structure

```
automatrix-erp/
├── src/
│   ├── server/                          # Backend (Google Apps Script)
│   │   ├── config/
│   │   │   ├── constants.gs             # System constants
│   │   │   ├── permissions.gs           # RBAC permissions
│   │   │   └── schema.gs                # Sheet schemas
│   │   ├── core/
│   │   │   ├── auth.gs                  # Authentication
│   │   │   ├── validation.gs            # Data validation
│   │   │   ├── audit.gs                 # Audit logging
│   │   │   └── locks.gs                 # Concurrency control
│   │   ├── modules/                     # [Phase 2]
│   │   ├── utils/
│   │   │   ├── sheets.gs                # Sheet helpers
│   │   │   ├── date.gs                  # Date utilities
│   │   │   └── formatting.gs            # Formatting
│   │   └── main.gs                      # Entry point
│   └── client/
│       └── Index.html                   # Frontend UI
├── docs/                                # Documentation
├── scripts/
│   └── deploy.sh                        # Deployment script
├── MASTER_PLAN.md                       # 14-phase roadmap
├── STRUCTURE_GUIDE.md                   # Architecture guide
├── IMPLEMENTATION_STATUS.md             # Current status
└── README.md                            # Overview
```

## 🚀 Quick Start

### Deploy

```bash
./scripts/deploy.sh
```

### Initialize

```javascript
initializeSystem(); // Run once in Apps Script
```

## 🔑 Key Constants

### Sheet Names

```javascript
SHEET_NAMES.EXPENSES;
SHEET_NAMES.INCOME;
SHEET_NAMES.EMPLOYEES;
SHEET_NAMES.INVENTORY;
SHEET_NAMES.PROJECTS;
SHEET_NAMES.WALLET;
SHEET_NAMES.AUDIT_LOG;
```

### Column Access

```javascript
EXPENSES_COLS.AMOUNT;
EXPENSES_COLS.STATUS;
EXPENSES_COLS.SUBMITTED_BY;
```

### Status Values

```javascript
STATUS.PENDING;
STATUS.APPROVED;
STATUS.REJECTED;
```

### Roles

```javascript
ROLES.CEO;
ROLES.FINANCE_MANAGER;
ROLES.MANAGER;
ROLES.STAFF;
```

## 📞 Main API Functions

### Authentication

```javascript
getCurrentUser(); // Get current user
getUserRole(email); // Get user role
getUserProfile(email); // Get user profile
hasPermission(user, perm); // Check permission
```

### Expenses

```javascript
submitExpense(data)          // Submit expense
getExpenses(filters)         // Get expenses
processExpenseApproval(...)  // Approve/reject
```

### Validation

```javascript
validateExpense(expense)     // Validate expense
validateIncome(income)       // Validate income
checkDuplicateExpense(...)   // Check duplicates
```

### Audit

```javascript
logAudit(...)                // Log action
getAuditHistory(sheet, id)   // Get history
getRecentActivity(limit)     // Recent actions
```

### Utilities

```javascript
formatCurrency(amount); // PKR 1,234.56
formatDate(date); // 2026-01-27
formatStatus(status); // With icon/color
```

## 🔐 Permission Checks

```javascript
// Check permission
if (hasPermission(user, 'expenses.approve_high')) {
  // Allow action
}

// Check approval authority
if (canApproveAmount(user, 'EXPENSE', amount)) {
  // Can approve
}
```

## 🔒 Concurrent Access

```javascript
// Use lock for critical operations
withLock('operation_name', () => {
  // Critical section
});

// Batch write
batchWriteWithLock(sheetName, startRow, startCol, values);
```

## 📊 Data Access

```javascript
// Get data as objects
const expenses = getSheetDataAsObjects(SHEET_NAMES.EXPENSES);

// Filter data
const filtered = getFilteredData(
  SHEET_NAMES.EXPENSES,
  (row) => row.Status === STATUS.PENDING,
);

// Find row
const rowNum = findRowByValue(
  SHEET_NAMES.EXPENSES,
  EXPENSES_COLS.SUBMITTED_BY,
  'user@example.com',
);
```

## 📝 Logging

```javascript
// Info
console.log('Operation completed');

// Warning
console.warn('Potential issue');

// Error
console.error('Operation failed: ' + error.message);
```

## 🎯 Common Patterns

### Submit with Validation

```javascript
function submitExpense(data) {
  // 1. Validate
  const validation = validateExpense(data);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  // 2. Check duplicates
  const duplicates = checkDuplicateExpense(data);

  // 3. Submit with lock
  const rowNum = appendRowWithLock(SHEET_NAMES.EXPENSES, rowData);

  // 4. Log audit
  logExpenseSubmission(rowNum, data);

  return { success: true, rowNum };
}
```

### Approval with Lock

```javascript
function approveExpense(rowNum) {
  return preventDoubleApproval('EXPENSE', rowNum, () => {
    // Check permission
    if (!canApproveAmount(user, 'EXPENSE', amount)) {
      throw new Error('Insufficient authority');
    }

    // Update status
    sheet.getRange(rowNum, STATUS_COL).setValue(STATUS.APPROVED);

    // Log audit
    logExpenseApproval(rowNum, STATUS.APPROVED, amount);

    return { success: true };
  });
}
```

## 📋 Approval Thresholds

| Amount                 | Approver        |
| ---------------------- | --------------- |
| ≤ PKR 5,000            | Manager         |
| PKR 5,001 - PKR 50,000 | Finance Manager |
| > PKR 50,000           | CEO             |

## 🔧 Troubleshooting

### Common Issues

**Lock timeout:**

```javascript
// Increase timeout
withLock('operation', fn, 60000); // 60 seconds
```

**Permission denied:**

```javascript
// Check user role
const role = getUserRole(email);
console.log('User role:', role);
```

**Validation failed:**

```javascript
// Get detailed errors
const result = validateExpense(data);
console.log('Errors:', result.errors);
```

## 📚 Documentation

- **MASTER_PLAN.md** - Complete roadmap
- **STRUCTURE_GUIDE.md** - Architecture details
- **IMPLEMENTATION_STATUS.md** - Current progress
- **README.md** - Project overview

## ⚡ Performance Tips

1. Use batch operations for multiple writes
2. Minimize sheet reads - cache data
3. Use locks only when necessary
4. Filter data before processing
5. Archive old data regularly

## 🎓 Best Practices

1. **Always validate input** on server side
2. **Check permissions** before actions
3. **Log all operations** for audit
4. **Use locks** for critical sections
5. **Handle errors gracefully**
6. **Return consistent format**:
   ```javascript
   {
     success: (true / false, data / error, message);
   }
   ```

---

**Version**: 6.0  
**Status**: Foundation Complete  
**Next Phase**: Business Modules
