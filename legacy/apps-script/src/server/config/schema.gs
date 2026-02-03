// ============================================================================
// SHEET SCHEMAS
// ============================================================================
// Defines the structure and validation rules for all sheets
// ============================================================================

/**
 * Get schema for a specific sheet
 * @param {string} sheetName - Name of the sheet
 * @returns {object} - Schema object with columns and validation rules
 */
function getSheetSchema(sheetName) {
  const schemas = {
    [SHEET_NAMES.EXPENSES]: EXPENSE_SCHEMA,
    [SHEET_NAMES.INCOME]: INCOME_SCHEMA,
    [SHEET_NAMES.EMPLOYEES]: EMPLOYEE_SCHEMA,
    [SHEET_NAMES.INVENTORY]: INVENTORY_SCHEMA,
    [SHEET_NAMES.PROJECTS]: PROJECT_SCHEMA,
    [SHEET_NAMES.WALLET]: WALLET_SCHEMA,
    [SHEET_NAMES.AUDIT_LOG]: AUDIT_LOG_SCHEMA,
    [SHEET_NAMES.INVENTORY_LEDGER]: INVENTORY_LEDGER_SCHEMA,
    [SHEET_NAMES.INVOICES]: INVOICE_SCHEMA
  };
  
  return schemas[sheetName] || null;
}

// ============================================================================
// EXPENSE SCHEMA
// ============================================================================

const EXPENSE_SCHEMA = {
  name: SHEET_NAMES.EXPENSES,
  columns: [
    { name: 'Date', type: 'date', required: true },
    { name: 'Description', type: 'string', required: true, maxLength: 500 },
    { name: 'Category', type: 'string', required: true },
    { name: 'Amount', type: 'number', required: true, min: 1 },
    { name: 'Payment Mode', type: 'string', required: true },
    { name: 'Project', type: 'string', required: false },
    { name: 'Submitted By', type: 'email', required: true },
    { name: 'Status', type: 'string', required: true, default: STATUS.PENDING },
    { name: 'Approved By', type: 'email', required: false },
    { name: 'Approved Date', type: 'date', required: false },
    { name: 'Rejection Reason', type: 'string', required: false },
    { name: 'Receipt File ID', type: 'string', required: false },
    { name: 'Receipt URL', type: 'url', required: false },
    { name: 'Approval Level', type: 'string', required: false },
    { name: 'Approved Amount', type: 'number', required: false },
    { name: 'Validation Status', type: 'string', required: false }
  ],
  headerRow: 1
};

// ============================================================================
// INCOME SCHEMA
// ============================================================================

const INCOME_SCHEMA = {
  name: SHEET_NAMES.INCOME,
  columns: [
    { name: 'Date', type: 'date', required: true },
    { name: 'Source', type: 'string', required: true },
    { name: 'Category', type: 'string', required: true },
    { name: 'Amount', type: 'number', required: true, min: 1 },
    { name: 'Payment Mode', type: 'string', required: true },
    { name: 'Project', type: 'string', required: false },
    { name: 'Added By', type: 'email', required: true },
    { name: 'Status', type: 'string', required: true, default: STATUS.PENDING },
    { name: 'Approved By', type: 'email', required: false },
    { name: 'Approved Date', type: 'date', required: false },
    { name: 'Receipt File ID', type: 'string', required: false },
    { name: 'Receipt URL', type: 'url', required: false },
    { name: 'Invoice ID', type: 'string', required: false },
    { name: 'Approval Level', type: 'string', required: false }
  ],
  headerRow: 1
};

// ============================================================================
// EMPLOYEE SCHEMA
// ============================================================================

const EMPLOYEE_SCHEMA = {
  name: SHEET_NAMES.EMPLOYEES,
  columns: [
    { name: 'Email', type: 'email', required: true, unique: true },
    { name: 'Name', type: 'string', required: true },
    { name: 'Phone', type: 'string', required: false },
    { name: 'Role', type: 'string', required: true },
    { name: 'Wallet Balance', type: 'number', required: true, default: 0 },
    { name: 'Status', type: 'string', required: true, default: STATUS.ACTIVE }
  ],
  headerRow: 1
};

// ============================================================================
// INVENTORY SCHEMA
// ============================================================================

const INVENTORY_SCHEMA = {
  name: SHEET_NAMES.INVENTORY,
  columns: [
    { name: 'Item Name', type: 'string', required: true },
    { name: 'Category', type: 'string', required: true },
    { name: 'Quantity', type: 'number', required: true, min: 0 },
    { name: 'Unit', type: 'string', required: true },
    { name: 'Unit Cost', type: 'number', required: true, min: 0 },
    { name: 'Total Value', type: 'number', required: true },
    { name: 'Min Stock', type: 'number', required: false, default: 0 },
    { name: 'Reorder Qty', type: 'number', required: false, default: 0 },
    { name: 'Reserved Qty', type: 'number', required: false, default: 0 },
    { name: 'Available Qty', type: 'number', required: false },
    { name: 'Last Purchase Date', type: 'date', required: false },
    { name: 'Avg Usage (30 days)', type: 'number', required: false },
    { name: 'Last Updated', type: 'date', required: true }
  ],
  headerRow: 1
};

// ============================================================================
// PROJECT SCHEMA
// ============================================================================

const PROJECT_SCHEMA = {
  name: SHEET_NAMES.PROJECTS,
  columns: [
    { name: 'Project ID', type: 'string', required: true, unique: true },
    { name: 'Name', type: 'string', required: true },
    { name: 'Client', type: 'string', required: true },
    { name: 'Start Date', type: 'date', required: true },
    { name: 'End Date', type: 'date', required: false },
    { name: 'Status', type: 'string', required: true, default: STATUS.PLANNING },
    { name: 'Contract Value', type: 'number', required: false, default: 0 },
    { name: 'Invoiced Amount', type: 'number', required: false, default: 0 },
    { name: 'Received Amount', type: 'number', required: false, default: 0 },
    { name: 'Pending Recovery', type: 'number', required: false, default: 0 },
    { name: 'Cost to Date', type: 'number', required: false, default: 0 },
    { name: 'Gross Margin', type: 'number', required: false, default: 0 },
    { name: 'Margin %', type: 'number', required: false, default: 0 }
  ],
  headerRow: 1
};

// ============================================================================
// WALLET SCHEMA
// ============================================================================

const WALLET_SCHEMA = {
  name: SHEET_NAMES.WALLET,
  columns: [
    { name: 'Date', type: 'date', required: true },
    { name: 'Employee', type: 'email', required: true },
    { name: 'Type', type: 'string', required: true },
    { name: 'Amount', type: 'number', required: true },
    { name: 'Reference', type: 'string', required: false },
    { name: 'Balance', type: 'number', required: true }
  ],
  headerRow: 1
};

// ============================================================================
// AUDIT LOG SCHEMA
// ============================================================================

const AUDIT_LOG_SCHEMA = {
  name: SHEET_NAMES.AUDIT_LOG,
  columns: [
    { name: 'Timestamp', type: 'datetime', required: true },
    { name: 'User', type: 'email', required: true },
    { name: 'Action', type: 'string', required: true },
    { name: 'Sheet', type: 'string', required: true },
    { name: 'Record ID', type: 'string', required: false },
    { name: 'Field', type: 'string', required: false },
    { name: 'Old Value', type: 'string', required: false },
    { name: 'New Value', type: 'string', required: false },
    { name: 'Reason', type: 'string', required: false }
  ],
  headerRow: 1
};

// ============================================================================
// INVENTORY LEDGER SCHEMA
// ============================================================================

const INVENTORY_LEDGER_SCHEMA = {
  name: SHEET_NAMES.INVENTORY_LEDGER,
  columns: [
    { name: 'Date', type: 'date', required: true },
    { name: 'Item', type: 'string', required: true },
    { name: 'Type', type: 'string', required: true },
    { name: 'Quantity', type: 'number', required: true },
    { name: 'Unit Cost', type: 'number', required: true },
    { name: 'Total', type: 'number', required: true },
    { name: 'Reference', type: 'string', required: false },
    { name: 'Project', type: 'string', required: false },
    { name: 'User', type: 'email', required: true },
    { name: 'Running Balance', type: 'number', required: true }
  ],
  headerRow: 1
};

// ============================================================================
// INVOICE SCHEMA
// ============================================================================

const INVOICE_SCHEMA = {
  name: SHEET_NAMES.INVOICES,
  columns: [
    { name: 'Invoice No', type: 'string', required: true, unique: true },
    { name: 'Project ID', type: 'string', required: true },
    { name: 'Date', type: 'date', required: true },
    { name: 'Amount', type: 'number', required: true, min: 0 },
    { name: 'Due Date', type: 'date', required: true },
    { name: 'Status', type: 'string', required: true, default: STATUS.DRAFT },
    { name: 'Payment Date', type: 'date', required: false },
    { name: 'Notes', type: 'string', required: false }
  ],
  headerRow: 1
};

// ============================================================================
// SCHEMA VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate data against schema
 * @param {string} sheetName - Name of the sheet
 * @param {object} data - Data object to validate
 * @returns {object} - {valid: boolean, errors: array}
 */
function validateAgainstSchema(sheetName, data) {
  const schema = getSheetSchema(sheetName);
  
  if (!schema) {
    return { valid: false, errors: [`Schema not found for sheet: ${sheetName}`] };
  }
  
  const errors = [];
  
  schema.columns.forEach((column, index) => {
    const value = data[column.name] || data[index];
    
    // Check required fields
    if (column.required && (value === null || value === undefined || value === '')) {
      errors.push(`${column.name} is required`);
    }
    
    // Type validation
    if (value !== null && value !== undefined && value !== '') {
      if (!validateType(value, column.type)) {
        errors.push(`${column.name} must be of type ${column.type}`);
      }
      
      // Additional validations
      if (column.type === 'number') {
        if (column.min !== undefined && value < column.min) {
          errors.push(`${column.name} must be at least ${column.min}`);
        }
        if (column.max !== undefined && value > column.max) {
          errors.push(`${column.name} must be at most ${column.max}`);
        }
      }
      
      if (column.type === 'string' && column.maxLength) {
        if (value.length > column.maxLength) {
          errors.push(`${column.name} must be at most ${column.maxLength} characters`);
        }
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate value type
 * @param {*} value - Value to validate
 * @param {string} type - Expected type
 * @returns {boolean} - True if valid
 */
function validateType(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'date':
    case 'datetime':
      return value instanceof Date || !isNaN(Date.parse(value));
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'url':
      return typeof value === 'string' && /^https?:\/\/.+/.test(value);
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return true;
  }
}

/**
 * Initialize sheet with schema headers
 * @param {string} sheetName - Name of the sheet to initialize
 */
function initializeSheetFromSchema(sheetName) {
  const schema = getSheetSchema(sheetName);
  
  if (!schema) {
    throw new Error(`Schema not found for sheet: ${sheetName}`);
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Set headers
  const headers = schema.columns.map(col => col.name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format header row
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  console.log(`Initialized sheet: ${sheetName}`);
}
