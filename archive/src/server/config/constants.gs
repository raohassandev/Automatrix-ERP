// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================
// Central configuration for sheet names, column mappings, and system constants
// ============================================================================

// ============================================================================
// SHEET NAMES
// ============================================================================

const SHEET_NAMES = {
  EXPENSES: 'Expenses',
  INCOME: 'Income',
  EMPLOYEES: 'Employees',
  INVENTORY: 'Inventory',
  PROJECTS: 'Projects',
  WALLET: 'Wallet',
  AUDIT_LOG: 'AuditLog',
  INVENTORY_LEDGER: 'InventoryLedger',
  INVOICES: 'Invoices',
  CHART_OF_ACCOUNTS: 'ChartOfAccounts',
  NOTIFICATIONS: 'Notifications'
};

// ============================================================================
// COLUMN MAPPINGS
// ============================================================================

/**
 * Expenses sheet column indices (0-based)
 */
const EXPENSES_COLS = {
  DATE: 0,
  DESCRIPTION: 1,
  CATEGORY: 2,
  AMOUNT: 3,
  PAYMENT_MODE: 4,
  PROJECT: 5,
  SUBMITTED_BY: 6,
  STATUS: 7,
  APPROVED_BY: 8,
  APPROVED_DATE: 9,
  REJECTION_REASON: 10,
  RECEIPT_FILE_ID: 11,
  RECEIPT_URL: 12,
  APPROVAL_LEVEL: 13,
  APPROVED_AMOUNT: 14,
  VALIDATION_STATUS: 15
};

/**
 * Income sheet column indices (0-based)
 */
const INCOME_COLS = {
  DATE: 0,
  SOURCE: 1,
  CATEGORY: 2,
  AMOUNT: 3,
  PAYMENT_MODE: 4,
  PROJECT: 5,
  ADDED_BY: 6,
  STATUS: 7,
  APPROVED_BY: 8,
  APPROVED_DATE: 9,
  RECEIPT_FILE_ID: 10,
  RECEIPT_URL: 11,
  INVOICE_ID: 12,
  APPROVAL_LEVEL: 13
};

/**
 * Employees sheet column indices (0-based)
 */
const EMPLOYEES_COLS = {
  EMAIL: 0,
  NAME: 1,
  PHONE: 2,
  ROLE: 3,
  WALLET_BALANCE: 4,
  STATUS: 5
};

/**
 * Inventory sheet column indices (0-based)
 */
const INVENTORY_COLS = {
  ITEM_NAME: 0,
  CATEGORY: 1,
  QUANTITY: 2,
  UNIT: 3,
  UNIT_COST: 4,
  TOTAL_VALUE: 5,
  MIN_STOCK: 6,
  REORDER_QTY: 7,
  RESERVED_QTY: 8,
  AVAILABLE_QTY: 9,
  LAST_PURCHASE_DATE: 10,
  AVG_USAGE_30_DAYS: 11,
  LAST_UPDATED: 12
};

/**
 * Projects sheet column indices (0-based)
 */
const PROJECTS_COLS = {
  PROJECT_ID: 0,
  NAME: 1,
  CLIENT: 2,
  START_DATE: 3,
  END_DATE: 4,
  STATUS: 5,
  CONTRACT_VALUE: 6,
  INVOICED_AMOUNT: 7,
  RECEIVED_AMOUNT: 8,
  PENDING_RECOVERY: 9,
  COST_TO_DATE: 10,
  GROSS_MARGIN: 11,
  MARGIN_PERCENT: 12
};

/**
 * Wallet sheet column indices (0-based)
 */
const WALLET_COLS = {
  DATE: 0,
  EMPLOYEE: 1,
  TYPE: 2,
  AMOUNT: 3,
  REFERENCE: 4,
  BALANCE: 5
};

/**
 * AuditLog sheet column indices (0-based)
 */
const AUDIT_LOG_COLS = {
  TIMESTAMP: 0,
  USER: 1,
  ACTION: 2,
  SHEET: 3,
  RECORD_ID: 4,
  FIELD: 5,
  OLD_VALUE: 6,
  NEW_VALUE: 7,
  REASON: 8
};

/**
 * InventoryLedger sheet column indices (0-based)
 */
const INVENTORY_LEDGER_COLS = {
  DATE: 0,
  ITEM: 1,
  TYPE: 2,
  QUANTITY: 3,
  UNIT_COST: 4,
  TOTAL: 5,
  REFERENCE: 6,
  PROJECT: 7,
  USER: 8,
  RUNNING_BALANCE: 9
};

/**
 * Invoices sheet column indices (0-based)
 */
const INVOICES_COLS = {
  INVOICE_NO: 0,
  PROJECT_ID: 1,
  DATE: 2,
  AMOUNT: 3,
  DUE_DATE: 4,
  STATUS: 5,
  PAYMENT_DATE: 6,
  NOTES: 7
};

// ============================================================================
// STATUS CONSTANTS
// ============================================================================

const STATUS = {
  // Approval statuses
  PENDING: 'Pending',
  PENDING_L1: 'Pending L1',
  PENDING_L2: 'Pending L2',
  PENDING_L3: 'Pending L3',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PARTIALLY_APPROVED: 'Partially Approved',
  
  // Employee statuses
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  
  // Project statuses
  PLANNING: 'Planning',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  
  // Invoice statuses
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
  
  // Inventory ledger types
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER: 'TRANSFER',
  RETURN: 'RETURN',
  PROJECT_ALLOCATION: 'PROJECT_ALLOCATION'
};

// ============================================================================
// APPROVAL THRESHOLDS
// ============================================================================

/**
 * Approval amount thresholds by type and role
 */
const APPROVAL_LEVELS = {
  EXPENSE: [
    { max: 5000, level: 'L1', role: 'Manager' },
    { max: 50000, level: 'L2', role: 'Finance Manager' },
    { max: Infinity, level: 'L3', role: 'CEO' }
  ],
  INCOME: [
    { max: 100000, level: 'L1', role: 'Finance Manager' },
    { max: Infinity, level: 'L2', role: 'CEO' }
  ]
};

// ============================================================================
// CATEGORY MAPPINGS
// ============================================================================

/**
 * Chart of Accounts - mapping categories to account groups
 */
const ACCOUNT_GROUPS = {
  COGS: 'Cost of Goods Sold',
  OPEX: 'Operating Expenses',
  CAPEX: 'Capital Expenses',
  TRAVEL: 'Travel & Entertainment',
  ADMIN: 'Administrative'
};

// ============================================================================
// VALIDATION RULES
// ============================================================================

const VALIDATION_RULES = {
  AMOUNT_MIN: 1,
  AMOUNT_MAX: 10000000,
  RECEIPT_MANDATORY_THRESHOLD: 5000,
  DUPLICATE_CHECK_DAYS: 3,
  MAX_DESCRIPTION_LENGTH: 500
};

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

const SYSTEM_SETTINGS = {
  APP_NAME: 'AutoMatrix ERP',
  VERSION: '6.0',
  DATE_FORMAT: 'yyyy-MM-dd',
  CURRENCY: '₹',
  TIMEZONE: 'Asia/Kolkata',
  ITEMS_PER_PAGE: 50,
  MAX_SEARCH_RESULTS: 100
};

// ============================================================================
// NOTIFICATION SETTINGS
// ============================================================================

const NOTIFICATION_SETTINGS = {
  DAILY_DIGEST_HOUR: 9, // 9 AM
  URGENT_THRESHOLD: 50000, // Amounts above this trigger immediate notification
  REMINDER_DAYS: [7, 14, 30] // Follow-up reminder intervals
};
