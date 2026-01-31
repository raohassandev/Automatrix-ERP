// ============================================================================
// LOCK SERVICE - CONCURRENT ACCESS CONTROL
// ============================================================================
// Prevent race conditions and data corruption from simultaneous operations
// ============================================================================

/**
 * Acquire a lock with timeout
 * @param {string} lockName - Unique name for the lock
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns {Lock} - Lock object or null if failed
 */
function acquireLock(lockName, timeoutMs = 30000) {
  try {
    const lock = LockService.getScriptLock();
    const acquired = lock.tryLock(timeoutMs);
    
    if (acquired) {
      console.log(`Lock acquired: ${lockName}`);
      return lock;
    } else {
      console.warn(`Failed to acquire lock: ${lockName}`);
      return null;
    }
  } catch (error) {
    console.error(`Error acquiring lock ${lockName}: ${error.message}`);
    return null;
  }
}

/**
 * Release a lock
 * @param {Lock} lock - Lock object to release
 * @param {string} lockName - Name of the lock (for logging)
 */
function releaseLock(lock, lockName) {
  try {
    if (lock) {
      lock.releaseLock();
      console.log(`Lock released: ${lockName}`);
    }
  } catch (error) {
    console.error(`Error releasing lock ${lockName}: ${error.message}`);
  }
}

/**
 * Execute function with lock protection
 * @param {string} lockName - Lock identifier
 * @param {function} fn - Function to execute
 * @param {number} timeoutMs - Lock timeout in milliseconds
 * @returns {*} - Result of the function
 */
function withLock(lockName, fn, timeoutMs = 30000) {
  const lock = acquireLock(lockName, timeoutMs);
  
  if (!lock) {
    throw new Error(`Could not acquire lock: ${lockName}. Please try again.`);
  }
  
  try {
    return fn();
  } finally {
    releaseLock(lock, lockName);
  }
}

/**
 * Batch write to sheet with lock protection
 * @param {string} sheetName - Name of the sheet
 * @param {number} startRow - Starting row number
 * @param {number} startCol - Starting column number
 * @param {array} values - 2D array of values to write
 */
function batchWriteWithLock(sheetName, startRow, startCol, values) {
  return withLock(`write_${sheetName}`, () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }
    
    const numRows = values.length;
    const numCols = values[0].length;
    
    sheet.getRange(startRow, startCol, numRows, numCols).setValues(values);
    
    console.log(`Batch write completed: ${sheetName} (${numRows} rows)`);
  });
}

/**
 * Append row with lock protection
 * @param {string} sheetName - Name of the sheet
 * @param {array} rowData - Array of values to append
 * @returns {number} - Row number where data was appended
 */
function appendRowWithLock(sheetName, rowData) {
  return withLock(`append_${sheetName}`, () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }
    
    sheet.appendRow(rowData);
    const lastRow = sheet.getLastRow();
    
    console.log(`Row appended: ${sheetName} at row ${lastRow}`);
    return lastRow;
  });
}

/**
 * Update cell with optimistic locking
 * @param {string} sheetName - Sheet name
 * @param {number} row - Row number
 * @param {number} col - Column number
 * @param {*} newValue - New value to set
 * @param {*} expectedOldValue - Expected current value (for optimistic locking)
 * @returns {boolean} - True if update succeeded
 */
function updateCellWithOptimisticLock(sheetName, row, col, newValue, expectedOldValue) {
  return withLock(`update_${sheetName}_${row}_${col}`, () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }
    
    const cell = sheet.getRange(row, col);
    const currentValue = cell.getValue();
    
    // Check if value hasn't changed (optimistic lock)
    if (currentValue !== expectedOldValue) {
      console.warn(`Optimistic lock failed: expected ${expectedOldValue}, found ${currentValue}`);
      return false;
    }
    
    cell.setValue(newValue);
    return true;
  });
}

/**
 * Prevent double approval using lock
 * @param {string} type - Type (EXPENSE or INCOME)
 * @param {number} rowNum - Row number
 * @param {function} approvalFn - Function to execute approval
 * @returns {*} - Result of approval function
 */
function preventDoubleApproval(type, rowNum, approvalFn) {
  const lockName = `approval_${type}_${rowNum}`;
  
  return withLock(lockName, () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = type === 'EXPENSE' ? SHEET_NAMES.EXPENSES : SHEET_NAMES.INCOME;
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }
    
    const statusCol = type === 'EXPENSE' ? EXPENSES_COLS.STATUS + 1 : INCOME_COLS.STATUS + 1;
    const currentStatus = sheet.getRange(rowNum, statusCol).getValue();
    
    // Check if already processed
    if (currentStatus !== STATUS.PENDING && !currentStatus.startsWith('Pending')) {
      throw new Error('This item has already been approved or rejected');
    }
    
    // Execute approval
    return approvalFn();
  });
}
