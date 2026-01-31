// ============================================================================
// EXPENSES MODULE
// ============================================================================
// Complete expense management with advanced features
// ============================================================================

/**
 * Submit expense with validation and duplicate check
 * @param {object} expenseData - Expense data object
 * @param {boolean} ignoreDuplicate - Skip duplicate check if true
 * @returns {object} - Result with success status
 */
function submitExpenseEnhanced(expenseData, ignoreDuplicate = false) {
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
    
    // Check for duplicates unless ignored
    if (!ignoreDuplicate) {
      const duplicateCheck = checkDuplicateExpense(expenseData);
      if (duplicateCheck.isDuplicate) {
        return {
          success: false,
          error: 'Possible duplicate expense detected',
          duplicates: duplicateCheck.matches,
          warning: true,
          requiresConfirmation: true
        };
      }
    }
    
    // Add metadata
    const userEmail = getCurrentUser();
    expenseData.submittedBy = userEmail;
    expenseData.status = STATUS.PENDING;
    
    // Determine approval level
    const approvalLevel = getRequiredApprovalLevel('EXPENSE', expenseData.amount);
    expenseData.approvalLevel = approvalLevel ? approvalLevel.level : 'L1';
    
    // Prepare row data
    const rowData = [
      expenseData.date,
      sanitizeInput(expenseData.description),
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
    
    // Submit with lock
    const rowNum = appendRowWithLock(SHEET_NAMES.EXPENSES, rowData);
    
    // Log audit
    logExpenseSubmission(rowNum, expenseData);
    
    return {
      success: true,
      message: 'Expense submitted successfully',
      rowNum: rowNum,
      expenseId: `EXP-${rowNum}`
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
 * Get expenses with advanced filtering
 * @param {object} filters - Filter options
 * @returns {object} - List of expenses
 */
function getExpensesEnhanced(filters = {}) {
  try {
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (!sheet) {
      return { success: true, data: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const expenses = [];
    
    // Get date range if specified
    let dateRange = null;
    if (filters.dateRange && filters.dateRange !== 'ALL') {
      if (filters.dateRange === 'CUSTOM' && filters.customStart && filters.customEnd) {
        dateRange = { 
          start: new Date(filters.customStart), 
          end: new Date(filters.customEnd) 
        };
      } else {
        dateRange = getDateRangeForPeriod(filters.dateRange);
      }
    }
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const expense = {
        rowNum: i + 1,
        expenseId: `EXP-${i + 1}`,
        date: data[i][EXPENSES_COLS.DATE],
        description: data[i][EXPENSES_COLS.DESCRIPTION],
        category: data[i][EXPENSES_COLS.CATEGORY],
        amount: parseFloat(data[i][EXPENSES_COLS.AMOUNT]) || 0,
        paymentMode: data[i][EXPENSES_COLS.PAYMENT_MODE],
        project: data[i][EXPENSES_COLS.PROJECT],
        submittedBy: data[i][EXPENSES_COLS.SUBMITTED_BY],
        submitterName: data[i][EXPENSES_COLS.SUBMITTED_BY].split('@')[0],
        status: data[i][EXPENSES_COLS.STATUS],
        approvedBy: data[i][EXPENSES_COLS.APPROVED_BY],
        approvedDate: data[i][EXPENSES_COLS.APPROVED_DATE],
        rejectionReason: data[i][EXPENSES_COLS.REJECTION_REASON],
        receiptFileId: data[i][EXPENSES_COLS.RECEIPT_FILE_ID],
        receiptURL: data[i][EXPENSES_COLS.RECEIPT_URL],
        approvalLevel: data[i][EXPENSES_COLS.APPROVAL_LEVEL],
        approvedAmount: parseFloat(data[i][EXPENSES_COLS.APPROVED_AMOUNT]) || 0,
        hasReceipt: !!(data[i][EXPENSES_COLS.RECEIPT_FILE_ID] || data[i][EXPENSES_COLS.RECEIPT_URL])
      };
      
      // Apply filters
      if (!applyExpenseFilters(expense, filters, userEmail, role)) {
        continue;
      }
      
      // Check date range
      if (dateRange && !isDateInRange(new Date(expense.date), dateRange.start, dateRange.end)) {
        continue;
      }
      
      // Add formatted fields
      expense.formattedAmount = formatCurrency(expense.amount);
      expense.formattedDate = formatDateForDisplay(new Date(expense.date));
      expense.statusFormatted = formatStatus(expense.status);
      
      expenses.push(expense);
    }
    
    // Sort if specified
    if (filters.sortBy) {
      expenses.sort((a, b) => {
        const aVal = a[filters.sortBy];
        const bVal = b[filters.sortBy];
        const direction = filters.sortOrder === 'desc' ? -1 : 1;
        
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    }
    
    // Apply pagination if specified
    let paginatedExpenses = expenses;
    if (filters.page && filters.pageSize) {
      const start = (filters.page - 1) * filters.pageSize;
      const end = start + filters.pageSize;
      paginatedExpenses = expenses.slice(start, end);
    }
    
    return {
      success: true,
      data: paginatedExpenses,
      total: expenses.length,
      page: filters.page || 1,
      pageSize: filters.pageSize || expenses.length,
      totalPages: filters.pageSize ? Math.ceil(expenses.length / filters.pageSize) : 1
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
 * Apply filters to expense
 * @private
 */
function applyExpenseFilters(expense, filters, userEmail, role) {
  // Permission filter
  if (role !== ROLES.CEO && role !== ROLES.OWNER && role !== ROLES.FINANCE_MANAGER) {
    if (expense.submittedBy !== userEmail) {
      return false;
    }
  }
  
  // Status filter
  if (filters.status && filters.status !== 'ALL' && expense.status !== filters.status) {
    return false;
  }
  
  // Category filter
  if (filters.category && expense.category !== filters.category) {
    return false;
  }
  
  // Project filter
  if (filters.project && expense.project !== filters.project) {
    return false;
  }
  
  // Submitter filter
  if (filters.submittedBy && expense.submittedBy !== filters.submittedBy) {
    return false;
  }
  
  // Amount range filter
  if (filters.minAmount && expense.amount < filters.minAmount) {
    return false;
  }
  if (filters.maxAmount && expense.amount > filters.maxAmount) {
    return false;
  }
  
  // Search filter (in description)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    if (!expense.description.toLowerCase().includes(searchLower)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get expense by ID
 * @param {number} rowNum - Row number (expense ID)
 * @returns {object} - Expense details with history
 */
function getExpenseById(rowNum) {
  try {
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (!sheet || rowNum < 2 || rowNum > sheet.getLastRow()) {
      return {
        success: false,
        error: 'Expense not found'
      };
    }
    
    const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const expense = {
      rowNum: rowNum,
      expenseId: `EXP-${rowNum}`,
      date: rowData[EXPENSES_COLS.DATE],
      description: rowData[EXPENSES_COLS.DESCRIPTION],
      category: rowData[EXPENSES_COLS.CATEGORY],
      amount: parseFloat(rowData[EXPENSES_COLS.AMOUNT]) || 0,
      paymentMode: rowData[EXPENSES_COLS.PAYMENT_MODE],
      project: rowData[EXPENSES_COLS.PROJECT],
      submittedBy: rowData[EXPENSES_COLS.SUBMITTED_BY],
      status: rowData[EXPENSES_COLS.STATUS],
      approvedBy: rowData[EXPENSES_COLS.APPROVED_BY],
      approvedDate: rowData[EXPENSES_COLS.APPROVED_DATE],
      rejectionReason: rowData[EXPENSES_COLS.REJECTION_REASON],
      receiptFileId: rowData[EXPENSES_COLS.RECEIPT_FILE_ID],
      receiptURL: rowData[EXPENSES_COLS.RECEIPT_URL],
      approvalLevel: rowData[EXPENSES_COLS.APPROVAL_LEVEL],
      approvedAmount: parseFloat(rowData[EXPENSES_COLS.APPROVED_AMOUNT]) || 0
    };
    
    // Check permission
    if (!canViewResource(userEmail, 'expenses', expense)) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    // Get audit history
    const history = getAuditHistory(SHEET_NAMES.EXPENSES, rowNum);
    
    // Check if user can edit
    const canEdit = canEditResource(userEmail, 'expenses', expense);
    
    // Check if user can approve
    const canApprove = canApproveAmount(userEmail, 'EXPENSE', expense.amount) && 
                       (expense.status === STATUS.PENDING || expense.status.startsWith('Pending'));
    
    return {
      success: true,
      data: {
        ...expense,
        formattedAmount: formatCurrency(expense.amount),
        formattedDate: formatDateForDisplay(new Date(expense.date)),
        statusFormatted: formatStatus(expense.status),
        history: history,
        permissions: {
          canEdit: canEdit,
          canApprove: canApprove,
          canDelete: canEdit && expense.status === STATUS.PENDING
        }
      }
    };
    
  } catch (error) {
    console.error(`Error getting expense: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update expense (only pending expenses)
 * @param {number} rowNum - Row number
 * @param {object} updates - Fields to update
 * @returns {object} - Result
 */
function updateExpense(rowNum, updates) {
  try {
    const userEmail = getCurrentUser();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Expenses sheet not found'
      };
    }
    
    // Get current expense
    const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    const expense = {
      submittedBy: rowData[EXPENSES_COLS.SUBMITTED_BY],
      status: rowData[EXPENSES_COLS.STATUS]
    };
    
    // Check permission
    if (!canEditResource(userEmail, 'expenses', expense)) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    // Can only edit pending expenses
    if (expense.status !== STATUS.PENDING) {
      return {
        success: false,
        error: 'Can only edit pending expenses'
      };
    }
    
    // Validate updates
    if (updates.amount) {
      const validation = validateExpense({ ...expense, amount: updates.amount });
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        };
      }
    }
    
    // Apply updates with lock
    return withLock(`update_expense_${rowNum}`, () => {
      const updateMap = {};
      
      if (updates.date) {
        updateMap[EXPENSES_COLS.DATE] = new Date(updates.date);
      }
      if (updates.description) {
        updateMap[EXPENSES_COLS.DESCRIPTION] = sanitizeInput(updates.description);
      }
      if (updates.category) {
        updateMap[EXPENSES_COLS.CATEGORY] = updates.category;
      }
      if (updates.amount) {
        updateMap[EXPENSES_COLS.AMOUNT] = parseFloat(updates.amount);
        
        // Recalculate approval level
        const approvalLevel = getRequiredApprovalLevel('EXPENSE', updates.amount);
        updateMap[EXPENSES_COLS.APPROVAL_LEVEL] = approvalLevel ? approvalLevel.level : 'L1';
      }
      if (updates.paymentMode) {
        updateMap[EXPENSES_COLS.PAYMENT_MODE] = updates.paymentMode;
      }
      if (updates.project !== undefined) {
        updateMap[EXPENSES_COLS.PROJECT] = updates.project;
      }
      if (updates.receiptFileId) {
        updateMap[EXPENSES_COLS.RECEIPT_FILE_ID] = updates.receiptFileId;
      }
      if (updates.receiptURL) {
        updateMap[EXPENSES_COLS.RECEIPT_URL] = updates.receiptURL;
      }
      
      // Update sheet
      Object.keys(updateMap).forEach(colIndex => {
        const col = parseInt(colIndex) + 1;
        sheet.getRange(rowNum, col).setValue(updateMap[colIndex]);
      });
      
      // Log audit
      Object.keys(updateMap).forEach(colIndex => {
        logAudit(
          'UPDATE_EXPENSE',
          SHEET_NAMES.EXPENSES,
          rowNum,
          Object.keys(EXPENSES_COLS)[colIndex],
          rowData[colIndex],
          updateMap[colIndex],
          'Expense updated by submitter'
        );
      });
      
      return {
        success: true,
        message: 'Expense updated successfully'
      };
    });
    
  } catch (error) {
    console.error(`Error updating expense: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete expense (only pending expenses)
 * @param {number} rowNum - Row number
 * @returns {object} - Result
 */
function deleteExpense(rowNum) {
  try {
    const userEmail = getCurrentUser();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Expenses sheet not found'
      };
    }
    
    // Get current expense
    const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    const expense = {
      submittedBy: rowData[EXPENSES_COLS.SUBMITTED_BY],
      status: rowData[EXPENSES_COLS.STATUS],
      amount: rowData[EXPENSES_COLS.AMOUNT],
      description: rowData[EXPENSES_COLS.DESCRIPTION]
    };
    
    // Check permission
    if (!canEditResource(userEmail, 'expenses', expense)) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    // Can only delete pending expenses
    if (expense.status !== STATUS.PENDING) {
      return {
        success: false,
        error: 'Can only delete pending expenses'
      };
    }
    
    // Delete with lock
    return withLock(`delete_expense_${rowNum}`, () => {
      // Log audit before deleting
      logAudit(
        'DELETE_EXPENSE',
        SHEET_NAMES.EXPENSES,
        rowNum,
        'ALL',
        JSON.stringify(expense),
        null,
        'Expense deleted by submitter'
      );
      
      // Delete row
      sheet.deleteRow(rowNum);
      
      return {
        success: true,
        message: 'Expense deleted successfully'
      };
    });
    
  } catch (error) {
    console.error(`Error deleting expense: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get expense categories
 * @returns {object} - List of categories with usage count
 */
function getExpenseCategories() {
  try {
    const categories = getUniqueValues(SHEET_NAMES.EXPENSES, EXPENSES_COLS.CATEGORY);
    
    // Count usage for each category
    const categoriesWithCount = categories.map(cat => {
      const count = countRowsByValue(SHEET_NAMES.EXPENSES, EXPENSES_COLS.CATEGORY, cat);
      return {
        name: cat,
        count: count
      };
    }).filter(cat => cat.name); // Remove empty
    
    return {
      success: true,
      data: categoriesWithCount
    };
    
  } catch (error) {
    console.error(`Error getting categories: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get expense summary by category
 * @param {string} dateRange - Date range
 * @returns {object} - Summary data
 */
function getExpenseSummaryByCategory(dateRange = 'THIS_MONTH') {
  try {
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    const dates = getDateRangeForPeriod(dateRange);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (!sheet) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const summary = {};
    
    for (let i = 1; i < data.length; i++) {
      const expenseDate = new Date(data[i][EXPENSES_COLS.DATE]);
      const category = data[i][EXPENSES_COLS.CATEGORY];
      const amount = parseFloat(data[i][EXPENSES_COLS.AMOUNT]) || 0;
      const status = data[i][EXPENSES_COLS.STATUS];
      const submittedBy = data[i][EXPENSES_COLS.SUBMITTED_BY];
      
      // Filter by role
      if (role !== ROLES.CEO && role !== ROLES.OWNER && role !== ROLES.FINANCE_MANAGER) {
        if (submittedBy !== userEmail) continue;
      }
      
      // Filter by date and status
      if (isDateInRange(expenseDate, dates.start, dates.end) && status === STATUS.APPROVED) {
        if (!summary[category]) {
          summary[category] = { total: 0, count: 0 };
        }
        summary[category].total += amount;
        summary[category].count++;
      }
    }
    
    // Convert to array and sort by total
    const summaryArray = Object.keys(summary).map(cat => ({
      category: cat,
      total: summary[cat].total,
      count: summary[cat].count,
      average: summary[cat].total / summary[cat].count,
      formattedTotal: formatCurrency(summary[cat].total)
    })).sort((a, b) => b.total - a.total);
    
    return {
      success: true,
      data: summaryArray
    };
    
  } catch (error) {
    console.error(`Error getting expense summary: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Export expenses to CSV format
 * @param {object} filters - Same filters as getExpensesEnhanced
 * @returns {object} - CSV data
 */
function exportExpensesToCSV(filters = {}) {
  try {
    const result = getExpensesEnhanced(filters);
    
    if (!result.success) {
      return result;
    }
    
    const expenses = result.data;
    
    // Create CSV header
    const headers = [
      'Expense ID', 'Date', 'Description', 'Category', 'Amount', 
      'Payment Mode', 'Project', 'Submitted By', 'Status', 
      'Approved By', 'Approved Date'
    ];
    
    // Create CSV rows
    const rows = expenses.map(exp => [
      exp.expenseId,
      formatDate(new Date(exp.date)),
      exp.description,
      exp.category,
      exp.amount,
      exp.paymentMode,
      exp.project,
      exp.submittedBy,
      exp.status,
      exp.approvedBy,
      exp.approvedDate ? formatDate(new Date(exp.approvedDate)) : ''
    ]);
    
    // Combine headers and rows
    const csvData = [headers, ...rows];
    
    return {
      success: true,
      data: csvData,
      filename: `expenses_${formatDate(new Date(), 'yyyyMMdd')}.csv`
    };
    
  } catch (error) {
    console.error(`Error exporting expenses: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
