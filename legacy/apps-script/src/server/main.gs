// ============================================================================
// AUTOMATRIX ERP - MAIN ENTRY POINT
// ============================================================================
// Version: 6.0
// Main entry point and API routing for the application
// ============================================================================

/**
 * Main entry point for web app
 * Serves the HTML interface
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('AutoMatrix ERP v6.0')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================================
// API FUNCTIONS - Called from frontend
// ============================================================================

/**
 * Initialize user session
 * Called when app loads
 */
function initSession() {
  try {
    return initializeSession();
  } catch (error) {
    console.error(`Error initializing session: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get dashboard data
 * @param {string} dateRange - Date range ('THIS_MONTH', 'LAST_MONTH', etc.)
 * @returns {object} - Dashboard data with KPIs
 */
function getDashboardData(dateRange = 'THIS_MONTH') {
  try {
    // This will be implemented in dashboard.gs module
    // For now, return basic structure
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    const profile = getUserProfile(userEmail);
    
    return {
      success: true,
      data: {
        user: {
          email: userEmail,
          name: profile ? profile.name : userEmail.split('@')[0],
          role: role,
          walletBalance: profile ? profile.walletBalance : 0
        },
        kpis: {
          walletBalance: profile ? profile.walletBalance : 0,
          pendingApprovals: 0, // To be calculated
          totalExpenses: 0,    // To be calculated
          totalIncome: 0,      // To be calculated
          pendingRecovery: 0   // To be calculated
        },
        recentActivity: getRecentActivity(10)
      }
    };
  } catch (error) {
    console.error(`Error getting dashboard data: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Submit expense
 * @param {object} expenseData - Expense data object
 * @returns {object} - Result with success status
 */
function submitExpense(expenseData) {
  try {
    // Validate input
    const validation = validateExpense(expenseData);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Validation failed',
        details: validation.errors
      };
    }
    
    // Check for duplicates
    const duplicateCheck = checkDuplicateExpense(expenseData);
    if (duplicateCheck.isDuplicate) {
      return {
        success: false,
        error: 'Possible duplicate expense detected',
        duplicates: duplicateCheck.matches,
        warning: true
      };
    }
    
    // Add submitted by and status
    const userEmail = getCurrentUser();
    expenseData.submittedBy = userEmail;
    expenseData.status = STATUS.PENDING;
    
    // Determine approval level
    const approvalLevel = getRequiredApprovalLevel('EXPENSE', expenseData.amount);
    expenseData.approvalLevel = approvalLevel ? approvalLevel.level : 'L1';
    
    // Submit expense
    const rowData = [
      expenseData.date,
      expenseData.description,
      expenseData.category,
      expenseData.amount,
      expenseData.paymentMode,
      expenseData.project || '',
      expenseData.submittedBy,
      expenseData.status,
      '', // Approved By
      '', // Approved Date
      '', // Rejection Reason
      expenseData.receiptFileId || '',
      expenseData.receiptURL || '',
      expenseData.approvalLevel,
      '', // Approved Amount
      'Valid' // Validation Status
    ];
    
    const rowNum = appendRowWithLock(SHEET_NAMES.EXPENSES, rowData);
    
    // Log audit
    logExpenseSubmission(rowNum, expenseData);
    
    return {
      success: true,
      message: 'Expense submitted successfully',
      rowNum: rowNum
    };
    
  } catch (error) {
    console.error(`Error submitting expense: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get expenses for user
 * @param {object} filters - Filter options {status, dateRange, project}
 * @returns {object} - List of expenses
 */
function getExpenses(filters = {}) {
  try {
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (!sheet) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const expenses = [];
    
    // Get date range if specified
    let dateRange = null;
    if (filters.dateRange) {
      dateRange = getDateRangeForPeriod(filters.dateRange);
    }
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const expense = {
        rowNum: i + 1,
        date: data[i][EXPENSES_COLS.DATE],
        description: data[i][EXPENSES_COLS.DESCRIPTION],
        category: data[i][EXPENSES_COLS.CATEGORY],
        amount: data[i][EXPENSES_COLS.AMOUNT],
        paymentMode: data[i][EXPENSES_COLS.PAYMENT_MODE],
        project: data[i][EXPENSES_COLS.PROJECT],
        submittedBy: data[i][EXPENSES_COLS.SUBMITTED_BY],
        status: data[i][EXPENSES_COLS.STATUS],
        approvedBy: data[i][EXPENSES_COLS.APPROVED_BY],
        approvedDate: data[i][EXPENSES_COLS.APPROVED_DATE],
        rejectionReason: data[i][EXPENSES_COLS.REJECTION_REASON]
      };
      
      // Filter by permission
      if (role !== ROLES.CEO && role !== ROLES.OWNER && role !== ROLES.FINANCE_MANAGER) {
        if (expense.submittedBy !== userEmail) {
          continue;
        }
      }
      
      // Filter by status
      if (filters.status && expense.status !== filters.status) {
        continue;
      }
      
      // Filter by date range
      if (dateRange && !isDateInRange(new Date(expense.date), dateRange.start, dateRange.end)) {
        continue;
      }
      
      // Filter by project
      if (filters.project && expense.project !== filters.project) {
        continue;
      }
      
      expenses.push(expense);
    }
    
    return {
      success: true,
      data: expenses
    };
    
  } catch (error) {
    console.error(`Error getting expenses: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Approve or reject expense
 * @param {number} rowNum - Row number of expense
 * @param {string} action - 'APPROVE' or 'REJECT'
 * @param {object} data - Additional data {reason, approvedAmount}
 * @returns {object} - Result
 */
function processExpenseApproval(rowNum, action, data = {}) {
  try {
    const userEmail = getCurrentUser();
    
    return preventDoubleApproval('EXPENSE', rowNum, () => {
      // Get expense data
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
      const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      const amount = rowData[EXPENSES_COLS.AMOUNT];
      const submittedBy = rowData[EXPENSES_COLS.SUBMITTED_BY];
      
      // Validate approval
      const validation = validateApproval(rowNum, 'EXPENSE', action, data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        };
      }
      
      // Check permission
      if (!canApproveAmount(userEmail, 'EXPENSE', amount)) {
        return {
          success: false,
          error: 'You do not have authority to approve this amount'
        };
      }
      
      if (action === 'APPROVE') {
        const approvedAmount = data.approvedAmount || amount;
        
        // Update expense status
        sheet.getRange(rowNum, EXPENSES_COLS.STATUS + 1).setValue(STATUS.APPROVED);
        sheet.getRange(rowNum, EXPENSES_COLS.APPROVED_BY + 1).setValue(userEmail);
        sheet.getRange(rowNum, EXPENSES_COLS.APPROVED_DATE + 1).setValue(new Date());
        sheet.getRange(rowNum, EXPENSES_COLS.APPROVED_AMOUNT + 1).setValue(approvedAmount);
        
        // Log audit
        logExpenseApproval(rowNum, STATUS.APPROVED, amount, approvedAmount, data.reason || '');
        
        return {
          success: true,
          message: 'Expense approved successfully'
        };
        
      } else if (action === 'REJECT') {
        // Update expense status
        sheet.getRange(rowNum, EXPENSES_COLS.STATUS + 1).setValue(STATUS.REJECTED);
        sheet.getRange(rowNum, EXPENSES_COLS.APPROVED_BY + 1).setValue(userEmail);
        sheet.getRange(rowNum, EXPENSES_COLS.APPROVED_DATE + 1).setValue(new Date());
        sheet.getRange(rowNum, EXPENSES_COLS.REJECTION_REASON + 1).setValue(data.reason || '');
        
        // Log audit
        logExpenseApproval(rowNum, STATUS.REJECTED, amount, 0, data.reason || '');
        
        return {
          success: true,
          message: 'Expense rejected'
        };
      }
      
      return {
        success: false,
        error: 'Invalid action'
      };
    });
    
  } catch (error) {
    console.error(`Error processing approval: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Add income entry
 * @param {object} incomeData - Income data object
 * @returns {object} - Result
 */
function addIncome(incomeData) {
  try {
    // Validate input
    const validation = validateIncome(incomeData);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Validation failed',
        details: validation.errors
      };
    }
    
    const userEmail = getCurrentUser();
    incomeData.addedBy = userEmail;
    incomeData.status = STATUS.APPROVED; // Income auto-approved for now
    
    const rowData = [
      incomeData.date,
      incomeData.source,
      incomeData.category,
      incomeData.amount,
      incomeData.paymentMode,
      incomeData.project || '',
      incomeData.addedBy,
      incomeData.status,
      userEmail, // Approved by (same user)
      new Date(), // Approved date
      incomeData.receiptFileId || '',
      incomeData.receiptURL || '',
      incomeData.invoiceId || '',
      '' // Approval level
    ];
    
    const rowNum = appendRowWithLock(SHEET_NAMES.INCOME, rowData);
    
    // Log audit
    logIncomeEntry(rowNum, incomeData);
    
    return {
      success: true,
      message: 'Income added successfully',
      rowNum: rowNum
    };
    
  } catch (error) {
    console.error(`Error adding income: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get pending approvals for current user
 * @returns {object} - List of pending approvals
 */
function getPendingApprovals() {
  try {
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    
    const approvals = [];
    
    // Get pending expenses
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const expenseSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (expenseSheet) {
      const data = expenseSheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        const status = data[i][EXPENSES_COLS.STATUS];
        const amount = data[i][EXPENSES_COLS.AMOUNT];
        
        if (status === STATUS.PENDING || status.startsWith('Pending')) {
          // Check if user can approve this amount
          if (canApproveAmount(userEmail, 'EXPENSE', amount)) {
            approvals.push({
              type: 'EXPENSE',
              rowNum: i + 1,
              date: data[i][EXPENSES_COLS.DATE],
              description: data[i][EXPENSES_COLS.DESCRIPTION],
              category: data[i][EXPENSES_COLS.CATEGORY],
              amount: amount,
              submittedBy: data[i][EXPENSES_COLS.SUBMITTED_BY],
              status: status,
              project: data[i][EXPENSES_COLS.PROJECT]
            });
          }
        }
      }
    }
    
    return {
      success: true,
      data: approvals
    };
    
  } catch (error) {
    console.error(`Error getting pending approvals: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get inventory items
 * @returns {object} - List of inventory items
 */
function getInventory() {
  try {
    const items = getSheetDataAsObjects(SHEET_NAMES.INVENTORY);
    
    return {
      success: true,
      data: items
    };
    
  } catch (error) {
    console.error(`Error getting inventory: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get projects list
 * @returns {object} - List of projects
 */
function getProjects() {
  try {
    const projects = getSheetDataAsObjects(SHEET_NAMES.PROJECTS);
    
    return {
      success: true,
      data: projects
    };
    
  } catch (error) {
    console.error(`Error getting projects: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get employees list
 * @returns {object} - List of employees
 */
function getEmployees() {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'employees.view_all')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    const employees = getSheetDataAsObjects(SHEET_NAMES.EMPLOYEES);
    
    return {
      success: true,
      data: employees
    };
    
  } catch (error) {
    console.error(`Error getting employees: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// SYSTEM FUNCTIONS
// ============================================================================

/**
 * Initialize all required sheets
 * Run this once to set up the system
 */
function initializeSystem() {
  try {
    const sheets = [
      SHEET_NAMES.EXPENSES,
      SHEET_NAMES.INCOME,
      SHEET_NAMES.EMPLOYEES,
      SHEET_NAMES.INVENTORY,
      SHEET_NAMES.PROJECTS,
      SHEET_NAMES.WALLET,
      SHEET_NAMES.AUDIT_LOG,
      SHEET_NAMES.INVENTORY_LEDGER,
      SHEET_NAMES.INVOICES
    ];
    
    sheets.forEach(sheetName => {
      initializeSheetFromSchema(sheetName);
    });
    
    console.log('System initialized successfully');
    return {
      success: true,
      message: 'All sheets initialized'
    };
    
  } catch (error) {
    console.error(`Error initializing system: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get system version
 */
function getVersion() {
  return {
    version: SYSTEM_SETTINGS.VERSION,
    appName: SYSTEM_SETTINGS.APP_NAME
  };
}
