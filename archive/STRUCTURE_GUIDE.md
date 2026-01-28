# AutoMatrix ERP - Project Structure Guide

## 📁 Directory Structure Overview

```
automatrix-erp/
├── src/
│   ├── server/                     # Backend (Google Apps Script)
│   │   ├── main.gs                 # Entry point & routing
│   │   ├── config/                 # Configuration files
│   │   │   ├── constants.gs        # System constants & mappings
│   │   │   ├── permissions.gs      # RBAC permissions
│   │   │   └── schema.gs           # Sheet schemas
│   │   ├── core/                   # Core functionality
│   │   │   ├── auth.gs             # Authentication
│   │   │   ├── validation.gs       # Data validation
│   │   │   ├── audit.gs            # Audit logging
│   │   │   └── locks.gs            # Concurrency control
│   │   ├── modules/                # Business logic modules
│   │   │   ├── dashboard.gs        # Dashboard & KPIs
│   │   │   ├── expenses.gs         # Expense management
│   │   │   ├── income.gs           # Income tracking
│   │   │   ├── approvals.gs        # Approval workflow
│   │   │   ├── inventory.gs        # Inventory system
│   │   │   ├── projects.gs         # Project management
│   │   │   ├── employees.gs        # Employee management
│   │   │   ├── attachments.gs      # File attachments
│   │   │   └── notifications.gs    # Notifications
│   │   └── utils/                  # Utility functions
│   │       ├── sheets.gs           # Sheet operations
│   │       ├── date.gs             # Date utilities
│   │       └── formatting.gs       # Data formatting
│   │
│   └── client/                     # Frontend (HTML/CSS/JS)
│       ├── Index.html              # Main application
│       ├── styles/                 # CSS modules (embedded)
│       └── scripts/                # JavaScript modules (embedded)
│
├── docs/                           # Documentation
│   ├── README.md                   # Main documentation
│   ├── DEPLOYMENT_GUIDE.md         # Deployment instructions
│   ├── API_REFERENCE.md            # API documentation
│   └── USER_GUIDE.md               # User manual
│
├── config/                         # Configuration files
│   └── sheet-templates/            # Sheet templates
│
├── tests/                          # Test files
│   ├── unit/                       # Unit tests
│   └── integration/                # Integration tests
│
├── scripts/                        # Utility scripts
│   └── deploy.sh                   # Deployment automation
│
├── MASTER_PLAN.md                  # Implementation roadmap
├── STRUCTURE_GUIDE.md              # This file
└── PROJECT_STATUS.txt              # Project status
```

---

## 🔧 Module Descriptions

### **Server Modules**

#### **Config Modules**

##### `constants.gs`
- **Purpose**: Central configuration for all system constants
- **Contents**:
  - Sheet names mapping
  - Column index mappings for all sheets
  - Status constants (PENDING, APPROVED, etc.)
  - Approval thresholds
  - Validation rules
  - System settings
  - Notification settings
- **Used by**: All modules
- **Dependencies**: None

##### `permissions.gs`
- **Purpose**: Role-based access control (RBAC)
- **Contents**:
  - Role definitions (CEO, Finance Manager, Manager, Staff)
  - Permission matrix mapping roles to actions
  - Permission check functions
  - Approval authority checks
- **Used by**: All modules requiring authorization
- **Dependencies**: `constants.gs`

##### `schema.gs`
- **Purpose**: Define sheet structures and validation rules
- **Contents**:
  - Schema definitions for all sheets
  - Column metadata (type, required, validation)
  - Schema initialization functions
  - Schema-based validation
- **Used by**: Sheet operations, validation
- **Dependencies**: `constants.gs`

---

#### **Core Modules**

##### `auth.gs`
- **Purpose**: User authentication and session management
- **Key Functions**:
  - `getCurrentUser()` - Get current user email
  - `getUserRole(email)` - Get user role
  - `getUserProfile(email)` - Get user details
  - `isAuthenticated()` - Check authentication
  - `isAdmin(email)` - Check admin privileges
  - `initializeSession()` - Initialize frontend session
- **Dependencies**: `permissions.gs`, `constants.gs`

##### `validation.gs`
- **Purpose**: Data validation before operations
- **Key Functions**:
  - `validateExpense(expense)` - Validate expense data
  - `validateIncome(income)` - Validate income data
  - `checkDuplicateExpense(expense)` - Duplicate detection
  - `validateApproval(...)` - Validate approval action
  - `validateInventoryAdjustment(...)` - Validate stock changes
  - `validateProject(project)` - Validate project data
  - `validateInvoice(invoice)` - Validate invoice data
  - `sanitizeInput(input)` - Sanitize user input
- **Dependencies**: `constants.gs`, `schema.gs`

##### `audit.gs`
- **Purpose**: Comprehensive audit trail for compliance
- **Key Functions**:
  - `logAudit(...)` - Generic audit logging
  - `logExpenseSubmission(...)` - Log expense creation
  - `logExpenseApproval(...)` - Log approval/rejection
  - `logInventoryAdjustment(...)` - Log stock changes
  - `logWalletTransaction(...)` - Log wallet changes
  - `getAuditHistory(sheetName, recordId)` - Retrieve audit trail
  - `getRecentActivity(limit)` - Get recent actions for dashboard
- **Dependencies**: `auth.gs`, `constants.gs`

##### `locks.gs`
- **Purpose**: Prevent concurrent access issues
- **Key Functions**:
  - `acquireLock(lockName, timeout)` - Acquire lock
  - `releaseLock(lock, lockName)` - Release lock
  - `withLock(lockName, fn)` - Execute function with lock
  - `batchWriteWithLock(...)` - Batch write with protection
  - `appendRowWithLock(...)` - Append row safely
  - `preventDoubleApproval(...)` - Prevent duplicate approvals
- **Dependencies**: None

---

#### **Utility Modules**

##### `sheets.gs`
- **Purpose**: Common sheet operations
- **Key Functions**:
  - `getOrCreateSheet(sheetName)` - Get or create sheet
  - `getSheetDataAsObjects(sheetName)` - Get data as objects
  - `findRowByValue(...)` - Find row by column value
  - `updateRow(...)` - Update specific row
  - `getFilteredData(...)` - Filter sheet data
  - `sumColumnByValue(...)` - Sum with criteria
  - `getUniqueValues(...)` - Get unique column values
  - `archiveOldData(...)` - Archive old records
- **Dependencies**: `locks.gs`

##### `date.gs`
- **Purpose**: Date manipulation and formatting
- **Key Functions**:
  - `formatDate(date, format)` - Format date to string
  - `parseDate(dateStr)` - Parse date from string
  - `getStartOfMonth()`, `getEndOfMonth()` - Month boundaries
  - `getDateRangeForPeriod(period)` - Get date range for period
  - `getDaysBetween(date1, date2)` - Calculate days difference
  - `getAgingBucket(date)` - Get aging category
  - `getFinancialYearDates()` - FY start/end dates
- **Dependencies**: None

##### `formatting.gs`
- **Purpose**: Display formatting utilities
- **Key Functions**:
  - `formatCurrency(amount)` - Format as currency
  - `formatNumber(num)` - Format with commas
  - `formatPercentage(value)` - Format as percentage
  - `formatStatus(status)` - Format status with icon/color
  - `formatRole(role)` - Format role with badge
  - `formatTrend(current, previous)` - Calculate trend
  - `truncateText(text, maxLength)` - Truncate text
  - `getInitials(name)` - Get name initials
- **Dependencies**: None

---

### **Business Logic Modules** (To be created)

These modules will be created in upcoming iterations:

##### `dashboard.gs`
- Get KPIs (wallet, expenses, income, approvals)
- Calculate trends and sparklines
- Get recent activity feed
- Date range filtering

##### `expenses.gs`
- Submit expense
- Get user expenses
- Get all expenses (filtered)
- Update expense status

##### `income.gs`
- Add income entry
- Get income records
- Calculate income totals

##### `approvals.gs`
- Get pending approvals for user
- Approve/reject with multi-level routing
- Partial approval support
- Bulk approval

##### `inventory.gs`
- Get inventory items
- Add/update items
- Record ledger entry (IN/OUT)
- Calculate stock from ledger
- Get reorder list

##### `projects.gs`
- Get projects list
- Create/update project
- Calculate project financials
- Get aging report
- Link expenses/invoices

##### `employees.gs`
- Get employees list
- Add/update employee
- Update wallet balance

##### `attachments.gs`
- Upload file to Drive
- Get file metadata
- Generate public URL
- Link attachment to record

##### `notifications.gs`
- Send email notification
- Queue notifications
- Daily digest email
- Reminder emails

---

## 🔄 Data Flow

### Expense Submission Flow
```
User submits expense (Index.html)
  ↓
validation.gs → validateExpense()
  ↓
expenses.gs → submitExpense()
  ↓
locks.gs → appendRowWithLock()
  ↓
audit.gs → logExpenseSubmission()
  ↓
notifications.gs → notifyApprovers()
```

### Approval Flow
```
User clicks approve (Index.html)
  ↓
permissions.gs → canApproveAmount()
  ↓
validation.gs → validateApproval()
  ↓
locks.gs → preventDoubleApproval()
  ↓
approvals.gs → approveExpense()
  ↓
audit.gs → logExpenseApproval()
  ↓
employees.gs → updateWalletBalance()
  ↓
notifications.gs → notifySubmitter()
```

### Inventory Transaction Flow
```
User records stock IN/OUT (Index.html)
  ↓
validation.gs → validateInventoryAdjustment()
  ↓
inventory.gs → recordLedgerEntry()
  ↓
locks.gs → withLock('inventory')
  ↓
audit.gs → logInventoryLedgerEntry()
  ↓
inventory.gs → updateStockBalance()
```

---

## 📝 Naming Conventions

### Files
- **Server files**: `lowercase.gs` (e.g., `expenses.gs`)
- **Config files**: `lowercase.gs` (e.g., `constants.gs`)
- **Documentation**: `UPPERCASE.md` (e.g., `README.md`)

### Functions
- **Public functions**: `camelCase` (e.g., `getUserRole()`)
- **Private helpers**: `_camelCaseWithUnderscore` (e.g., `_calculateTotal()`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `SHEET_NAMES`)

### Variables
- **Constants**: `UPPER_SNAKE_CASE`
- **Objects**: `camelCase` (e.g., `expenseData`)
- **Arrays**: `camelCasePlural` (e.g., `expenseItems`)

### Sheet Columns
- Use constants from `constants.gs`
- Format: `SHEETNAME_COLS.COLUMN_NAME`
- Example: `EXPENSES_COLS.AMOUNT`

---

## 🚀 Deployment Process

### For Google Apps Script (Monolithic Deployment)

Since Google Apps Script doesn't support module imports, all `.gs` files must be combined into a single script project.

**Deployment Order** (matters due to dependencies):

1. **Config Layer**
   ```
   constants.gs
   schema.gs
   permissions.gs
   ```

2. **Utils Layer**
   ```
   date.gs
   formatting.gs
   sheets.gs
   ```

3. **Core Layer**
   ```
   locks.gs
   auth.gs
   validation.gs
   audit.gs
   ```

4. **Modules Layer**
   ```
   employees.gs
   attachments.gs
   notifications.gs
   dashboard.gs
   expenses.gs
   income.gs
   approvals.gs
   inventory.gs
   projects.gs
   ```

5. **Entry Point**
   ```
   main.gs (with doGet() function)
   ```

6. **Frontend**
   ```
   Index.html
   ```

### Automated Deployment Script

```bash
#!/bin/bash
# deploy.sh - Combine all .gs files in order

cat src/server/config/constants.gs \
    src/server/config/schema.gs \
    src/server/config/permissions.gs \
    src/server/utils/date.gs \
    src/server/utils/formatting.gs \
    src/server/utils/sheets.gs \
    src/server/core/locks.gs \
    src/server/core/auth.gs \
    src/server/core/validation.gs \
    src/server/core/audit.gs \
    src/server/modules/*.gs \
    src/server/main.gs > script.gs

echo "✅ Deployment package created: script.gs"
```

---

## 🧪 Testing Strategy

### Unit Tests
- Test each function in isolation
- Mock dependencies
- Test edge cases and error conditions

### Integration Tests
- Test complete workflows
- Test with real sheet data
- Test concurrent operations

### Manual Testing Checklist
- [ ] User authentication and roles
- [ ] Expense submission and validation
- [ ] Approval workflow (all levels)
- [ ] Inventory ledger accuracy
- [ ] Project financials calculation
- [ ] Audit trail completeness
- [ ] Permission enforcement
- [ ] Concurrent access handling

---

## 📋 Development Workflow

### Adding a New Feature

1. **Update Schema** (if new fields needed)
   - Modify `schema.gs`
   - Update `constants.gs` column mappings

2. **Add Validation Rules**
   - Add validation function in `validation.gs`
   - Add validation rules in `constants.gs`

3. **Create Module Function**
   - Add function in appropriate module file
   - Use existing utilities
   - Add audit logging
   - Add permission checks

4. **Update Frontend**
   - Add UI in `Index.html`
   - Call backend function
   - Handle responses

5. **Add to Audit Trail**
   - Log action in `audit.gs`

6. **Test**
   - Unit test the function
   - Integration test the workflow
   - Manual UI testing

7. **Document**
   - Update API reference
   - Update user guide
   - Add code comments

---

## 🔒 Security Best Practices

1. **Always validate input** - Use `validation.gs` functions
2. **Check permissions** - Use `permissions.gs` before actions
3. **Log everything** - Use `audit.gs` for audit trail
4. **Use locks** - Use `locks.gs` for concurrent operations
5. **Sanitize data** - Use `sanitizeInput()` for user input
6. **Never expose sensitive data** - Filter data by permissions

---

## 💡 Best Practices

### Code Organization
- One responsibility per function
- Keep functions small and focused
- Use meaningful names
- Add JSDoc comments

### Error Handling
```javascript
try {
  // Operation
} catch (error) {
  console.error(`Error in functionName: ${error.message}`);
  // Log to audit trail if needed
  return { success: false, error: error.message };
}
```

### Function Return Format
```javascript
// Success
return {
  success: true,
  data: result,
  message: 'Operation completed'
};

// Error
return {
  success: false,
  error: 'Error message',
  details: validationErrors
};
```

### Logging
```javascript
// Info
console.log('Operation completed successfully');

// Warning
console.warn('Potential issue detected');

// Error
console.error('Operation failed: error message');
```

---

## 📚 Additional Resources

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Spreadsheet Service Reference](https://developers.google.com/apps-script/reference/spreadsheet)
- [Lock Service Guide](https://developers.google.com/apps-script/reference/lock)
- [MASTER_PLAN.md](./MASTER_PLAN.md) - Implementation roadmap
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment instructions

---

**Last Updated**: January 27, 2026  
**Version**: 6.0  
**Status**: Structure Created, Modules In Progress
