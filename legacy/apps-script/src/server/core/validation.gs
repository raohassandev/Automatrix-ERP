// ============================================================================
// DATA VALIDATION
// ============================================================================
// Validation rules and helper functions
// ============================================================================

/**
 * Validate expense data before submission
 * @param {object} expense - Expense object
 * @returns {object} - {valid: boolean, errors: array}
 */
function validateExpense(expense) {
  const errors = [];
  
  // Required fields
  if (!expense.date) {
    errors.push('Date is required');
  }
  
  if (!expense.description || expense.description.trim() === '') {
    errors.push('Description is required');
  }
  
  if (expense.description && expense.description.length > VALIDATION_RULES.MAX_DESCRIPTION_LENGTH) {
    errors.push(`Description must be less than ${VALIDATION_RULES.MAX_DESCRIPTION_LENGTH} characters`);
  }
  
  if (!expense.category) {
    errors.push('Category is required');
  }
  
  if (!expense.amount || expense.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }
  
  if (expense.amount && expense.amount < VALIDATION_RULES.AMOUNT_MIN) {
    errors.push(`Amount must be at least ${VALIDATION_RULES.AMOUNT_MIN}`);
  }
  
  if (expense.amount && expense.amount > VALIDATION_RULES.AMOUNT_MAX) {
    errors.push(`Amount cannot exceed ${VALIDATION_RULES.AMOUNT_MAX}`);
  }
  
  if (!expense.paymentMode) {
    errors.push('Payment mode is required');
  }
  
  // Date validation - not in future
  if (expense.date && new Date(expense.date) > new Date()) {
    errors.push('Expense date cannot be in the future');
  }
  
  // Receipt validation for high amounts
  if (expense.amount >= VALIDATION_RULES.RECEIPT_MANDATORY_THRESHOLD) {
    if (!expense.receiptFileId && !expense.receiptURL) {
      errors.push(`Receipt is mandatory for expenses above ${SYSTEM_SETTINGS.CURRENCY}${VALIDATION_RULES.RECEIPT_MANDATORY_THRESHOLD}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate income data before submission
 * @param {object} income - Income object
 * @returns {object} - {valid: boolean, errors: array}
 */
function validateIncome(income) {
  const errors = [];
  
  // Required fields
  if (!income.date) {
    errors.push('Date is required');
  }
  
  if (!income.source || income.source.trim() === '') {
    errors.push('Source is required');
  }
  
  if (!income.category) {
    errors.push('Category is required');
  }
  
  if (!income.amount || income.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }
  
  if (income.amount && income.amount < VALIDATION_RULES.AMOUNT_MIN) {
    errors.push(`Amount must be at least ${VALIDATION_RULES.AMOUNT_MIN}`);
  }
  
  if (!income.paymentMode) {
    errors.push('Payment mode is required');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Check for duplicate expenses
 * @param {object} expense - Expense to check
 * @returns {object} - {isDuplicate: boolean, matches: array}
 */
function checkDuplicateExpense(expense) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const expenseSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (!expenseSheet) {
      return { isDuplicate: false, matches: [] };
    }
    
    const data = expenseSheet.getDataRange().getValues();
    const matches = [];
    
    const expenseDate = new Date(expense.date);
    const checkDays = VALIDATION_RULES.DUPLICATE_CHECK_DAYS;
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const rowDate = new Date(data[i][EXPENSES_COLS.DATE]);
      const rowAmount = data[i][EXPENSES_COLS.AMOUNT];
      const rowDescription = data[i][EXPENSES_COLS.DESCRIPTION];
      
      // Check if same amount and similar date (within N days)
      const daysDiff = Math.abs((expenseDate - rowDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= checkDays && Math.abs(rowAmount - expense.amount) < 0.01) {
        // Check for similar description (simple matching)
        if (rowDescription && expense.description &&
            rowDescription.toLowerCase().includes(expense.description.toLowerCase().substring(0, 20))) {
          matches.push({
            rowNum: i + 1,
            date: rowDate,
            description: rowDescription,
            amount: rowAmount,
            status: data[i][EXPENSES_COLS.STATUS]
          });
        }
      }
    }
    
    return {
      isDuplicate: matches.length > 0,
      matches: matches
    };
    
  } catch (error) {
    console.error(`Error checking duplicate expense: ${error.message}`);
    return { isDuplicate: false, matches: [] };
  }
}

/**
 * Validate approval action
 * @param {number} rowNum - Row number of expense/income
 * @param {string} type - Type (EXPENSE or INCOME)
 * @param {string} action - Action (APPROVE or REJECT)
 * @param {object} data - Additional data (approvedAmount, reason, etc.)
 * @returns {object} - {valid: boolean, errors: array}
 */
function validateApproval(rowNum, type, action, data) {
  const errors = [];
  
  // Check if user has permission to approve
  const userEmail = getCurrentUser();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = type === 'EXPENSE' ? SHEET_NAMES.EXPENSES : SHEET_NAMES.INCOME;
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    errors.push('Sheet not found');
    return { valid: false, errors: errors };
  }
  
  const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  const amount = rowData[type === 'EXPENSE' ? EXPENSES_COLS.AMOUNT : INCOME_COLS.AMOUNT];
  const currentStatus = rowData[type === 'EXPENSE' ? EXPENSES_COLS.STATUS : INCOME_COLS.STATUS];
  
  // Check if already approved/rejected
  if (currentStatus !== STATUS.PENDING && !currentStatus.startsWith('Pending')) {
    errors.push('This item has already been processed');
  }
  
  // Check approval authority
  if (!canApproveAmount(userEmail, type, amount)) {
    errors.push('You do not have authority to approve this amount');
  }
  
  // Validate rejection reason
  if (action === 'REJECT' && (!data.reason || data.reason.trim() === '')) {
    errors.push('Rejection reason is required');
  }
  
  // Validate partial approval
  if (action === 'APPROVE' && data.approvedAmount) {
    if (data.approvedAmount > amount) {
      errors.push('Approved amount cannot exceed requested amount');
    }
    if (data.approvedAmount <= 0) {
      errors.push('Approved amount must be greater than 0');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate inventory adjustment
 * @param {string} itemName - Item name
 * @param {number} newQuantity - New quantity
 * @param {string} reason - Reason for adjustment
 * @returns {object} - {valid: boolean, errors: array}
 */
function validateInventoryAdjustment(itemName, newQuantity, reason) {
  const errors = [];
  
  if (!itemName || itemName.trim() === '') {
    errors.push('Item name is required');
  }
  
  if (newQuantity < 0) {
    errors.push('Quantity cannot be negative');
  }
  
  if (!reason || reason.trim() === '') {
    errors.push('Reason for adjustment is required');
  }
  
  // Check if item exists
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
  
  if (invSheet) {
    const data = invSheet.getDataRange().getValues();
    let itemExists = false;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][INVENTORY_COLS.ITEM_NAME] === itemName) {
        itemExists = true;
        break;
      }
    }
    
    if (!itemExists) {
      errors.push('Item not found in inventory');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate project data
 * @param {object} project - Project object
 * @returns {object} - {valid: boolean, errors: array}
 */
function validateProject(project) {
  const errors = [];
  
  if (!project.projectId || project.projectId.trim() === '') {
    errors.push('Project ID is required');
  }
  
  if (!project.name || project.name.trim() === '') {
    errors.push('Project name is required');
  }
  
  if (!project.client || project.client.trim() === '') {
    errors.push('Client name is required');
  }
  
  if (!project.startDate) {
    errors.push('Start date is required');
  }
  
  if (project.endDate && project.startDate) {
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    
    if (end < start) {
      errors.push('End date must be after start date');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate invoice data
 * @param {object} invoice - Invoice object
 * @returns {object} - {valid: boolean, errors: array}
 */
function validateInvoice(invoice) {
  const errors = [];
  
  if (!invoice.invoiceNo || invoice.invoiceNo.trim() === '') {
    errors.push('Invoice number is required');
  }
  
  if (!invoice.projectId || invoice.projectId.trim() === '') {
    errors.push('Project ID is required');
  }
  
  if (!invoice.date) {
    errors.push('Invoice date is required');
  }
  
  if (!invoice.amount || invoice.amount <= 0) {
    errors.push('Invoice amount must be greater than 0');
  }
  
  if (!invoice.dueDate) {
    errors.push('Due date is required');
  }
  
  if (invoice.dueDate && invoice.date) {
    const invDate = new Date(invoice.date);
    const dueDate = new Date(invoice.dueDate);
    
    if (dueDate < invDate) {
      errors.push('Due date must be after invoice date');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Sanitize user input to prevent injection attacks
 * @param {string} input - User input string
 * @returns {string} - Sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}
