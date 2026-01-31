// ============================================================================
// SHEET UTILITIES
// ============================================================================
// Helper functions for sheet operations
// ============================================================================

/**
 * Get sheet or create if doesn't exist
 * @param {string} sheetName - Name of the sheet
 * @returns {Sheet} - Sheet object
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Initialize with schema if available
    const schema = getSheetSchema(sheetName);
    if (schema) {
      initializeSheetFromSchema(sheetName);
    }
  }
  
  return sheet;
}

/**
 * Get all data from sheet as objects
 * @param {string} sheetName - Name of the sheet
 * @param {number} headerRow - Header row number (default: 1)
 * @returns {array} - Array of objects
 */
function getSheetDataAsObjects(sheetName, headerRow = 1) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= headerRow) {
    return [];
  }
  
  const headers = data[headerRow - 1];
  const objects = [];
  
  for (let i = headerRow; i < data.length; i++) {
    const obj = { rowIndex: i + 1 };
    
    headers.forEach((header, index) => {
      obj[header] = data[i][index];
    });
    
    objects.push(obj);
  }
  
  return objects;
}

/**
 * Find row by column value
 * @param {string} sheetName - Sheet name
 * @param {number} columnIndex - Column index (0-based)
 * @param {*} value - Value to search for
 * @returns {number} - Row number (1-based) or -1 if not found
 */
function findRowByValue(sheetName, columnIndex, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return -1;
  }
  
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][columnIndex] === value) {
      return i + 1;
    }
  }
  
  return -1;
}

/**
 * Update row by index
 * @param {string} sheetName - Sheet name
 * @param {number} rowNum - Row number (1-based)
 * @param {object} updates - Object with column indices as keys
 */
function updateRow(sheetName, rowNum, updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  
  Object.keys(updates).forEach(colIndex => {
    const col = parseInt(colIndex) + 1; // Convert to 1-based
    sheet.getRange(rowNum, col).setValue(updates[colIndex]);
  });
}

/**
 * Delete row by index
 * @param {string} sheetName - Sheet name
 * @param {number} rowNum - Row number (1-based)
 */
function deleteRow(sheetName, rowNum) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  
  sheet.deleteRow(rowNum);
}

/**
 * Get filtered data from sheet
 * @param {string} sheetName - Sheet name
 * @param {function} filterFn - Filter function (receives row object)
 * @returns {array} - Filtered array of objects
 */
function getFilteredData(sheetName, filterFn) {
  const data = getSheetDataAsObjects(sheetName);
  return data.filter(filterFn);
}

/**
 * Count rows matching criteria
 * @param {string} sheetName - Sheet name
 * @param {number} columnIndex - Column index (0-based)
 * @param {*} value - Value to match
 * @returns {number} - Count of matching rows
 */
function countRowsByValue(sheetName, columnIndex, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return 0;
  }
  
  const data = sheet.getDataRange().getValues();
  let count = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][columnIndex] === value) {
      count++;
    }
  }
  
  return count;
}

/**
 * Sum column values matching criteria
 * @param {string} sheetName - Sheet name
 * @param {number} sumColumnIndex - Column to sum (0-based)
 * @param {number} filterColumnIndex - Column to filter (0-based)
 * @param {*} filterValue - Value to match
 * @returns {number} - Sum of matching values
 */
function sumColumnByValue(sheetName, sumColumnIndex, filterColumnIndex, filterValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return 0;
  }
  
  const data = sheet.getDataRange().getValues();
  let sum = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][filterColumnIndex] === filterValue) {
      const value = parseFloat(data[i][sumColumnIndex]) || 0;
      sum += value;
    }
  }
  
  return sum;
}

/**
 * Get unique values from column
 * @param {string} sheetName - Sheet name
 * @param {number} columnIndex - Column index (0-based)
 * @returns {array} - Array of unique values
 */
function getUniqueValues(sheetName, columnIndex) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const uniqueSet = new Set();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][columnIndex]) {
      uniqueSet.add(data[i][columnIndex]);
    }
  }
  
  return Array.from(uniqueSet);
}

/**
 * Sort sheet by column
 * @param {string} sheetName - Sheet name
 * @param {number} columnIndex - Column index (1-based for sort)
 * @param {boolean} ascending - Sort order (default: true)
 */
function sortSheetByColumn(sheetName, columnIndex, ascending = true) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  
  const range = sheet.getDataRange();
  range.sort({ column: columnIndex, ascending: ascending });
}

/**
 * Archive old data to separate sheet
 * @param {string} sourceSheet - Source sheet name
 * @param {string} archiveSheet - Archive sheet name
 * @param {number} dateColumnIndex - Date column index (0-based)
 * @param {number} daysOld - Number of days to consider old
 */
function archiveOldData(sourceSheet, archiveSheet, dateColumnIndex, daysOld) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName(sourceSheet);
  const archive = getOrCreateSheet(archiveSheet);
  
  if (!source) {
    throw new Error(`Source sheet not found: ${sourceSheet}`);
  }
  
  const data = source.getDataRange().getValues();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const rowsToArchive = [];
  const rowsToDelete = [];
  
  for (let i = data.length - 1; i >= 1; i--) {
    const rowDate = new Date(data[i][dateColumnIndex]);
    
    if (rowDate < cutoffDate) {
      rowsToArchive.unshift(data[i]);
      rowsToDelete.push(i + 1);
    }
  }
  
  // Append to archive
  if (rowsToArchive.length > 0) {
    archive.getRange(archive.getLastRow() + 1, 1, rowsToArchive.length, rowsToArchive[0].length)
      .setValues(rowsToArchive);
    
    // Delete from source (in reverse order)
    rowsToDelete.forEach(rowNum => {
      source.deleteRow(rowNum);
    });
    
    console.log(`Archived ${rowsToArchive.length} rows from ${sourceSheet} to ${archiveSheet}`);
  }
}
