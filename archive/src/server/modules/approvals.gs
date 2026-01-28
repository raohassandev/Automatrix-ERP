// ============================================================================
// APPROVALS MODULE
// ============================================================================
// Advanced multi-level approval workflow
// ============================================================================

/**
 * Get pending approvals for current user with detailed info
 * @param {object} filters - Filter options
 * @returns {object} - List of pending approvals
 */
function getPendingApprovalsEnhanced(filters = {}) {
  try {
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    
    const approvals = [];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get pending expenses
    const expenseSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    if (expenseSheet) {
      const data = expenseSheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        const status = data[i][EXPENSES_COLS.STATUS];
        const amount = parseFloat(data[i][EXPENSES_COLS.AMOUNT]) || 0;
        
        if (status === STATUS.PENDING || status.startsWith('Pending')) {
          // Check if user can approve this amount
          if (canApproveAmount(userEmail, 'EXPENSE', amount)) {
            approvals.push({
              type: 'EXPENSE',
              rowNum: i + 1,
              id: `EXP-${i + 1}`,
              date: data[i][EXPENSES_COLS.DATE],
              description: data[i][EXPENSES_COLS.DESCRIPTION],
              category: data[i][EXPENSES_COLS.CATEGORY],
              amount: amount,
              submittedBy: data[i][EXPENSES_COLS.SUBMITTED_BY],
              submitterName: data[i][EXPENSES_COLS.SUBMITTED_BY].split('@')[0],
              status: status,
              project: data[i][EXPENSES_COLS.PROJECT],
              approvalLevel: data[i][EXPENSES_COLS.APPROVAL_LEVEL],
              hasReceipt: !!(data[i][EXPENSES_COLS.RECEIPT_FILE_ID] || data[i][EXPENSES_COLS.RECEIPT_URL]),
              daysWaiting: getDaysBetween(new Date(data[i][EXPENSES_COLS.DATE]), new Date()),
              formattedAmount: formatCurrency(amount),
              formattedDate: formatDateForDisplay(new Date(data[i][EXPENSES_COLS.DATE]))
            });
          }
        }
      }
    }
    
    // Get pending income (if applicable)
    const incomeSheet = ss.getSheetByName(SHEET_NAMES.INCOME);
    if (incomeSheet) {
      const data = incomeSheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        const status = data[i][INCOME_COLS.STATUS];
        const amount = parseFloat(data[i][INCOME_COLS.AMOUNT]) || 0;
        
        if (status === STATUS.PENDING || status.startsWith('Pending')) {
          if (canApproveAmount(userEmail, 'INCOME', amount)) {
            approvals.push({
              type: 'INCOME',
              rowNum: i + 1,
              id: `INC-${i + 1}`,
              date: data[i][INCOME_COLS.DATE],
              description: data[i][INCOME_COLS.SOURCE],
              category: data[i][INCOME_COLS.CATEGORY],
              amount: amount,
              submittedBy: data[i][INCOME_COLS.ADDED_BY],
              submitterName: data[i][INCOME_COLS.ADDED_BY].split('@')[0],
              status: status,
              project: data[i][INCOME_COLS.PROJECT],
              approvalLevel: data[i][INCOME_COLS.APPROVAL_LEVEL],
              daysWaiting: getDaysBetween(new Date(data[i][INCOME_COLS.DATE]), new Date()),
              formattedAmount: formatCurrency(amount),
              formattedDate: formatDateForDisplay(new Date(data[i][INCOME_COLS.DATE]))
            });
          }
        }
      }
    }
    
    // Apply filters
    let filteredApprovals = approvals;
    
    if (filters.type && filters.type !== 'ALL') {
      filteredApprovals = filteredApprovals.filter(a => a.type === filters.type);
    }
    
    if (filters.minAmount) {
      filteredApprovals = filteredApprovals.filter(a => a.amount >= filters.minAmount);
    }
    
    if (filters.maxAmount) {
      filteredApprovals = filteredApprovals.filter(a => a.amount <= filters.maxAmount);
    }
    
    // Sort by amount (descending) or date (oldest first)
    filteredApprovals.sort((a, b) => {
      if (filters.sortBy === 'amount') {
        return b.amount - a.amount;
      }
      return new Date(a.date) - new Date(b.date); // Oldest first
    });
    
    return {
      success: true,
      data: filteredApprovals,
      total: filteredApprovals.length,
      summary: {
        totalAmount: filteredApprovals.reduce((sum, a) => sum + a.amount, 0),
        expenseCount: filteredApprovals.filter(a => a.type === 'EXPENSE').length,
        incomeCount: filteredApprovals.filter(a => a.type === 'INCOME').length
      }
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
 * Process approval (approve or reject) with enhanced features
 * @param {number} rowNum - Row number
 * @param {string} type - Type (EXPENSE or INCOME)
 * @param {string} action - Action (APPROVE or REJECT)
 * @param {object} data - Additional data {reason, approvedAmount, notes}
 * @returns {object} - Result
 */
function processApprovalEnhanced(rowNum, type, action, data = {}) {
  try {
    const userEmail = getCurrentUser();
    
    return preventDoubleApproval(type, rowNum, () => {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetName = type === 'EXPENSE' ? SHEET_NAMES.EXPENSES : SHEET_NAMES.INCOME;
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error(`${sheetName} sheet not found`);
      }
      
      const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
      const amount = type === 'EXPENSE' ? 
        rowData[EXPENSES_COLS.AMOUNT] : 
        rowData[INCOME_COLS.AMOUNT];
      const submittedBy = type === 'EXPENSE' ? 
        rowData[EXPENSES_COLS.SUBMITTED_BY] : 
        rowData[INCOME_COLS.ADDED_BY];
      const currentStatus = type === 'EXPENSE' ? 
        rowData[EXPENSES_COLS.STATUS] : 
        rowData[INCOME_COLS.STATUS];
      
      // Validate approval
      const validation = validateApproval(rowNum, type, action, data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        };
      }
      
      // Check permission
      if (!canApproveAmount(userEmail, type, amount)) {
        return {
          success: false,
          error: 'You do not have authority to approve this amount'
        };
      }
      
      // Check mandatory fields before approval
      if (action === 'APPROVE') {
        const mandatoryCheck = checkMandatoryFields(rowData, type);
        if (!mandatoryCheck.valid) {
          return {
            success: false,
            error: 'Mandatory fields missing',
            details: mandatoryCheck.missing
          };
        }
      }
      
      if (action === 'APPROVE') {
        const approvedAmount = data.approvedAmount || amount;
        const isPartialApproval = approvedAmount < amount;
        const finalStatus = isPartialApproval ? STATUS.PARTIALLY_APPROVED : STATUS.APPROVED;
        
        // Update status
        if (type === 'EXPENSE') {
          sheet.getRange(rowNum, EXPENSES_COLS.STATUS + 1).setValue(finalStatus);
          sheet.getRange(rowNum, EXPENSES_COLS.APPROVED_BY + 1).setValue(userEmail);
          sheet.getRange(rowNum, EXPENSES_COLS.APPROVED_DATE + 1).setValue(new Date());
          sheet.getRange(rowNum, EXPENSES_COLS.APPROVED_AMOUNT + 1).setValue(approvedAmount);
          
          if (data.notes) {
            sheet.getRange(rowNum, EXPENSES_COLS.REJECTION_REASON + 1).setValue(data.notes);
          }
          
          // Update wallet if approved
          if (!isPartialApproval) {
            updateWalletBalance(submittedBy, -amount, `Expense ${rowNum} approved`);
          } else {
            updateWalletBalance(submittedBy, -approvedAmount, `Expense ${rowNum} partially approved`);
          }
        } else {
          sheet.getRange(rowNum, INCOME_COLS.STATUS + 1).setValue(finalStatus);
          sheet.getRange(rowNum, INCOME_COLS.APPROVED_BY + 1).setValue(userEmail);
          sheet.getRange(rowNum, INCOME_COLS.APPROVED_DATE + 1).setValue(new Date());
        }
        
        // Log audit
        logExpenseApproval(rowNum, finalStatus, amount, approvedAmount, data.notes || '');
        
        return {
          success: true,
          message: isPartialApproval ? 
            `Partially approved: ${formatCurrency(approvedAmount)} of ${formatCurrency(amount)}` : 
            'Approved successfully',
          isPartialApproval: isPartialApproval
        };
        
      } else if (action === 'REJECT') {
        // Update status
        if (type === 'EXPENSE') {
          sheet.getRange(rowNum, EXPENSES_COLS.STATUS + 1).setValue(STATUS.REJECTED);
          sheet.getRange(rowNum, EXPENSES_COLS.APPROVED_BY + 1).setValue(userEmail);
          sheet.getRange(rowNum, EXPENSES_COLS.APPROVED_DATE + 1).setValue(new Date());
          sheet.getRange(rowNum, EXPENSES_COLS.REJECTION_REASON + 1).setValue(data.reason || '');
        } else {
          sheet.getRange(rowNum, INCOME_COLS.STATUS + 1).setValue(STATUS.REJECTED);
          sheet.getRange(rowNum, INCOME_COLS.APPROVED_BY + 1).setValue(userEmail);
          sheet.getRange(rowNum, INCOME_COLS.APPROVED_DATE + 1).setValue(new Date());
        }
        
        // Log audit
        logExpenseApproval(rowNum, STATUS.REJECTED, amount, 0, data.reason || '');
        
        return {
          success: true,
          message: 'Rejected'
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
 * Check mandatory fields before approval
 * @private
 */
function checkMandatoryFields(rowData, type) {
  const missing = [];
  
  if (type === 'EXPENSE') {
    // Check project
    if (!rowData[EXPENSES_COLS.PROJECT]) {
      missing.push('Project is required');
    }
    
    // Check category
    if (!rowData[EXPENSES_COLS.CATEGORY]) {
      missing.push('Category is required');
    }
    
    // Check payment mode
    if (!rowData[EXPENSES_COLS.PAYMENT_MODE]) {
      missing.push('Payment mode is required');
    }
    
    // Check receipt for high amounts
    const amount = parseFloat(rowData[EXPENSES_COLS.AMOUNT]) || 0;
    if (amount >= VALIDATION_RULES.RECEIPT_MANDATORY_THRESHOLD) {
      if (!rowData[EXPENSES_COLS.RECEIPT_FILE_ID] && !rowData[EXPENSES_COLS.RECEIPT_URL]) {
        missing.push(`Receipt is mandatory for amounts ≥ ${formatCurrency(VALIDATION_RULES.RECEIPT_MANDATORY_THRESHOLD)}`);
      }
    }
  }
  
  return {
    valid: missing.length === 0,
    missing: missing
  };
}

/**
 * Update wallet balance
 * @private
 */
function updateWalletBalance(employeeEmail, amount, reference) {
  try {
    const profile = getUserProfile(employeeEmail);
    if (!profile) {
      throw new Error('Employee not found');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    const walletSheet = ss.getSheetByName(SHEET_NAMES.WALLET);
    
    const oldBalance = profile.walletBalance;
    const newBalance = oldBalance + amount;
    
    // Update employee wallet balance
    empSheet.getRange(profile.rowIndex, EMPLOYEES_COLS.WALLET_BALANCE + 1).setValue(newBalance);
    
    // Add wallet transaction record
    if (walletSheet) {
      const walletEntry = [
        new Date(),
        employeeEmail,
        amount > 0 ? 'CREDIT' : 'DEBIT',
        Math.abs(amount),
        reference,
        newBalance
      ];
      walletSheet.appendRow(walletEntry);
    }
    
    // Log audit
    logWalletTransaction(employeeEmail, amount > 0 ? 'CREDIT' : 'DEBIT', Math.abs(amount), oldBalance, newBalance, reference);
    
    return true;
  } catch (error) {
    console.error(`Error updating wallet: ${error.message}`);
    return false;
  }
}

/**
 * Bulk approve multiple items
 * @param {array} items - Array of {rowNum, type, data}
 * @returns {object} - Result with success/failure counts
 */
function bulkApprove(items) {
  try {
    const userEmail = getCurrentUser();
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    items.forEach(item => {
      try {
        const result = processApprovalEnhanced(item.rowNum, item.type, 'APPROVE', item.data || {});
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            id: `${item.type}-${item.rowNum}`,
            error: result.error
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          id: `${item.type}-${item.rowNum}`,
          error: error.message
        });
      }
    });
    
    return {
      success: true,
      message: `Approved: ${results.success}, Failed: ${results.failed}`,
      results: results
    };
    
  } catch (error) {
    console.error(`Error in bulk approve: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get approval statistics
 * @param {string} dateRange - Date range
 * @returns {object} - Approval stats
 */
function getApprovalStats(dateRange = 'THIS_MONTH') {
  try {
    const userEmail = getCurrentUser();
    const dates = getDateRangeForPeriod(dateRange);
    
    const stats = {
      totalApproved: 0,
      totalRejected: 0,
      totalPending: 0,
      approvedAmount: 0,
      rejectedAmount: 0,
      avgApprovalTime: 0,
      approvalsByUser: {}
    };
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const expenseSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (expenseSheet) {
      const data = expenseSheet.getDataRange().getValues();
      const approvalTimes = [];
      
      for (let i = 1; i < data.length; i++) {
        const submitDate = new Date(data[i][EXPENSES_COLS.DATE]);
        const status = data[i][EXPENSES_COLS.STATUS];
        const amount = parseFloat(data[i][EXPENSES_COLS.AMOUNT]) || 0;
        const approvedBy = data[i][EXPENSES_COLS.APPROVED_BY];
        const approvedDate = data[i][EXPENSES_COLS.APPROVED_DATE];
        
        if (isDateInRange(submitDate, dates.start, dates.end)) {
          if (status === STATUS.APPROVED || status === STATUS.PARTIALLY_APPROVED) {
            stats.totalApproved++;
            stats.approvedAmount += amount;
            
            if (approvedBy) {
              stats.approvalsByUser[approvedBy] = (stats.approvalsByUser[approvedBy] || 0) + 1;
            }
            
            if (approvedDate) {
              const timeDiff = getDaysBetween(submitDate, new Date(approvedDate));
              approvalTimes.push(timeDiff);
            }
          } else if (status === STATUS.REJECTED) {
            stats.totalRejected++;
            stats.rejectedAmount += amount;
          } else if (status === STATUS.PENDING || status.startsWith('Pending')) {
            stats.totalPending++;
          }
        }
      }
      
      // Calculate average approval time
      if (approvalTimes.length > 0) {
        stats.avgApprovalTime = approvalTimes.reduce((sum, t) => sum + t, 0) / approvalTimes.length;
      }
    }
    
    return {
      success: true,
      data: stats
    };
    
  } catch (error) {
    console.error(`Error getting approval stats: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
