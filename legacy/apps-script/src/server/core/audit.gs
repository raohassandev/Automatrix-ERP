// ============================================================================
// AUDIT TRAIL SYSTEM
// ============================================================================
// Comprehensive logging of all system actions for compliance and debugging
// ============================================================================

/**
 * Log an audit entry
 * @param {string} action - Action performed (CREATE, UPDATE, DELETE, APPROVE, REJECT)
 * @param {string} sheetName - Name of the sheet affected
 * @param {string} recordId - ID of the record (row number or unique ID)
 * @param {string} field - Field name that was changed
 * @param {*} oldValue - Previous value
 * @param {*} newValue - New value
 * @param {string} reason - Reason for the action (optional)
 */
function logAudit(action, sheetName, recordId, field, oldValue, newValue, reason) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let auditSheet = ss.getSheetByName(SHEET_NAMES.AUDIT_LOG);
    
    // Create audit log sheet if it doesn't exist
    if (!auditSheet) {
      auditSheet = ss.insertSheet(SHEET_NAMES.AUDIT_LOG);
      initializeSheetFromSchema(SHEET_NAMES.AUDIT_LOG);
    }
    
    const timestamp = new Date();
    const user = getCurrentUser();
    
    // Convert values to strings for logging
    const oldValueStr = oldValue !== null && oldValue !== undefined ? String(oldValue) : '';
    const newValueStr = newValue !== null && newValue !== undefined ? String(newValue) : '';
    
    const auditEntry = [
      timestamp,
      user,
      action,
      sheetName,
      String(recordId),
      field || '',
      oldValueStr,
      newValueStr,
      reason || ''
    ];
    
    // Append to audit log
    auditSheet.appendRow(auditEntry);
    
    console.log(`Audit logged: ${action} on ${sheetName} by ${user}`);
    
  } catch (error) {
    console.error(`Failed to log audit: ${error.message}`);
    // Don't throw error - audit logging should not break main functionality
  }
}

/**
 * Log expense submission
 * @param {number} rowNum - Row number of the expense
 * @param {object} expenseData - Expense data object
 */
function logExpenseSubmission(rowNum, expenseData) {
  logAudit(
    'SUBMIT_EXPENSE',
    SHEET_NAMES.EXPENSES,
    rowNum,
    'ALL',
    null,
    JSON.stringify(expenseData),
    'New expense submitted'
  );
}

/**
 * Log expense approval
 * @param {number} rowNum - Row number of the expense
 * @param {string} status - New status (APPROVED/REJECTED)
 * @param {number} originalAmount - Original expense amount
 * @param {number} approvedAmount - Approved amount (may differ for partial approval)
 * @param {string} reason - Approval/rejection reason
 */
function logExpenseApproval(rowNum, status, originalAmount, approvedAmount, reason) {
  const action = status === STATUS.APPROVED ? 'APPROVE_EXPENSE' : 'REJECT_EXPENSE';
  
  logAudit(
    action,
    SHEET_NAMES.EXPENSES,
    rowNum,
    'Status',
    STATUS.PENDING,
    status,
    reason
  );
  
  // Log amount change if partial approval
  if (status === STATUS.APPROVED && originalAmount !== approvedAmount) {
    logAudit(
      'PARTIAL_APPROVAL',
      SHEET_NAMES.EXPENSES,
      rowNum,
      'Amount',
      originalAmount,
      approvedAmount,
      `Partial approval: ${approvedAmount}/${originalAmount}`
    );
  }
}

/**
 * Log income entry
 * @param {number} rowNum - Row number of the income entry
 * @param {object} incomeData - Income data object
 */
function logIncomeEntry(rowNum, incomeData) {
  logAudit(
    'ADD_INCOME',
    SHEET_NAMES.INCOME,
    rowNum,
    'ALL',
    null,
    JSON.stringify(incomeData),
    'New income entry added'
  );
}

/**
 * Log inventory adjustment
 * @param {string} itemName - Name of the inventory item
 * @param {number} oldQty - Previous quantity
 * @param {number} newQty - New quantity
 * @param {string} reason - Reason for adjustment
 */
function logInventoryAdjustment(itemName, oldQty, newQty, reason) {
  logAudit(
    'ADJUST_INVENTORY',
    SHEET_NAMES.INVENTORY,
    itemName,
    'Quantity',
    oldQty,
    newQty,
    reason
  );
}

/**
 * Log inventory ledger entry
 * @param {string} itemName - Name of the inventory item
 * @param {string} type - Type of transaction (PURCHASE, SALE, etc.)
 * @param {number} quantity - Quantity
 * @param {string} reference - Reference (PO#, Invoice#, etc.)
 */
function logInventoryLedgerEntry(itemName, type, quantity, reference) {
  logAudit(
    'INVENTORY_LEDGER',
    SHEET_NAMES.INVENTORY_LEDGER,
    reference,
    type,
    null,
    quantity,
    `${type}: ${quantity} units of ${itemName}`
  );
}

/**
 * Log wallet transaction
 * @param {string} employeeEmail - Employee email
 * @param {string} type - Transaction type (CREDIT/DEBIT)
 * @param {number} amount - Amount
 * @param {number} oldBalance - Previous balance
 * @param {number} newBalance - New balance
 * @param {string} reference - Reference for the transaction
 */
function logWalletTransaction(employeeEmail, type, amount, oldBalance, newBalance, reference) {
  logAudit(
    'WALLET_TRANSACTION',
    SHEET_NAMES.WALLET,
    employeeEmail,
    'Balance',
    oldBalance,
    newBalance,
    `${type}: ${amount} (Ref: ${reference})`
  );
}

/**
 * Log project update
 * @param {string} projectId - Project ID
 * @param {string} field - Field that was updated
 * @param {*} oldValue - Old value
 * @param {*} newValue - New value
 */
function logProjectUpdate(projectId, field, oldValue, newValue) {
  logAudit(
    'UPDATE_PROJECT',
    SHEET_NAMES.PROJECTS,
    projectId,
    field,
    oldValue,
    newValue,
    `Project ${field} updated`
  );
}

/**
 * Log employee changes
 * @param {string} employeeEmail - Employee email
 * @param {string} field - Field that was changed
 * @param {*} oldValue - Old value
 * @param {*} newValue - New value
 */
function logEmployeeChange(employeeEmail, field, oldValue, newValue) {
  logAudit(
    'UPDATE_EMPLOYEE',
    SHEET_NAMES.EMPLOYEES,
    employeeEmail,
    field,
    oldValue,
    newValue,
    `Employee ${field} updated`
  );
}

/**
 * Log invoice creation
 * @param {string} invoiceNo - Invoice number
 * @param {object} invoiceData - Invoice data
 */
function logInvoiceCreation(invoiceNo, invoiceData) {
  logAudit(
    'CREATE_INVOICE',
    SHEET_NAMES.INVOICES,
    invoiceNo,
    'ALL',
    null,
    JSON.stringify(invoiceData),
    'New invoice created'
  );
}

/**
 * Log invoice status change
 * @param {string} invoiceNo - Invoice number
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 */
function logInvoiceStatusChange(invoiceNo, oldStatus, newStatus) {
  logAudit(
    'UPDATE_INVOICE_STATUS',
    SHEET_NAMES.INVOICES,
    invoiceNo,
    'Status',
    oldStatus,
    newStatus,
    `Invoice status changed from ${oldStatus} to ${newStatus}`
  );
}

/**
 * Get audit history for a specific record
 * @param {string} sheetName - Sheet name
 * @param {string} recordId - Record ID
 * @returns {array} - Array of audit entries
 */
function getAuditHistory(sheetName, recordId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const auditSheet = ss.getSheetByName(SHEET_NAMES.AUDIT_LOG);
    
    if (!auditSheet) {
      return [];
    }
    
    const data = auditSheet.getDataRange().getValues();
    const history = [];
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      if (data[i][AUDIT_LOG_COLS.SHEET] === sheetName && 
          String(data[i][AUDIT_LOG_COLS.RECORD_ID]) === String(recordId)) {
        history.push({
          timestamp: data[i][AUDIT_LOG_COLS.TIMESTAMP],
          user: data[i][AUDIT_LOG_COLS.USER],
          action: data[i][AUDIT_LOG_COLS.ACTION],
          field: data[i][AUDIT_LOG_COLS.FIELD],
          oldValue: data[i][AUDIT_LOG_COLS.OLD_VALUE],
          newValue: data[i][AUDIT_LOG_COLS.NEW_VALUE],
          reason: data[i][AUDIT_LOG_COLS.REASON]
        });
      }
    }
    
    return history;
    
  } catch (error) {
    console.error(`Error getting audit history: ${error.message}`);
    return [];
  }
}

/**
 * Get recent audit activity (for dashboard activity feed)
 * @param {number} limit - Number of entries to return (default: 10)
 * @returns {array} - Array of recent audit entries
 */
function getRecentActivity(limit = 10) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const auditSheet = ss.getSheetByName(SHEET_NAMES.AUDIT_LOG);
    
    if (!auditSheet) {
      return [];
    }
    
    const data = auditSheet.getDataRange().getValues();
    const activities = [];
    
    // Get last N entries (skip header)
    const startRow = Math.max(1, data.length - limit);
    
    for (let i = data.length - 1; i >= startRow; i--) {
      activities.push({
        timestamp: data[i][AUDIT_LOG_COLS.TIMESTAMP],
        user: data[i][AUDIT_LOG_COLS.USER],
        action: data[i][AUDIT_LOG_COLS.ACTION],
        sheet: data[i][AUDIT_LOG_COLS.SHEET],
        recordId: data[i][AUDIT_LOG_COLS.RECORD_ID],
        description: formatAuditDescription(data[i])
      });
    }
    
    return activities;
    
  } catch (error) {
    console.error(`Error getting recent activity: ${error.message}`);
    return [];
  }
}

/**
 * Format audit entry into human-readable description
 * @param {array} auditRow - Audit log row data
 * @returns {string} - Formatted description
 */
function formatAuditDescription(auditRow) {
  const action = auditRow[AUDIT_LOG_COLS.ACTION];
  const user = auditRow[AUDIT_LOG_COLS.USER];
  const sheet = auditRow[AUDIT_LOG_COLS.SHEET];
  const recordId = auditRow[AUDIT_LOG_COLS.RECORD_ID];
  const userName = user.split('@')[0]; // Simple name extraction
  
  switch (action) {
    case 'SUBMIT_EXPENSE':
      return `${userName} submitted expense #${recordId}`;
    case 'APPROVE_EXPENSE':
      return `${userName} approved expense #${recordId}`;
    case 'REJECT_EXPENSE':
      return `${userName} rejected expense #${recordId}`;
    case 'ADD_INCOME':
      return `${userName} added income entry #${recordId}`;
    case 'ADJUST_INVENTORY':
      return `${userName} adjusted inventory: ${recordId}`;
    case 'UPDATE_PROJECT':
      return `${userName} updated project ${recordId}`;
    case 'CREATE_INVOICE':
      return `${userName} created invoice ${recordId}`;
    default:
      return `${userName} performed ${action} on ${sheet}`;
  }
}
