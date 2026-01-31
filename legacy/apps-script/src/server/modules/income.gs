// ============================================================================
// INCOME MODULE
// ============================================================================
// Income tracking and management
// ============================================================================

/**
 * Add income entry with validation
 * @param {object} incomeData - Income data object
 * @returns {object} - Result with success status
 */
function addIncomeEnhanced(incomeData) {
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
    
    // Check permission
    if (!hasPermission(userEmail, 'income.add')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    // Add metadata
    incomeData.addedBy = userEmail;
    incomeData.status = STATUS.APPROVED; // Auto-approve for authorized users
    
    // Determine if approval needed for high amounts
    const approvalLevel = getRequiredApprovalLevel('INCOME', incomeData.amount);
    if (approvalLevel && approvalLevel.level !== 'L1') {
      incomeData.status = STATUS.PENDING;
      incomeData.approvalLevel = approvalLevel.level;
    }
    
    // Prepare row data
    const rowData = [
      incomeData.date,
      sanitizeInput(incomeData.source),
      incomeData.category,
      incomeData.amount,
      incomeData.paymentMode,
      incomeData.project || '',
      incomeData.addedBy,
      incomeData.status,
      incomeData.status === STATUS.APPROVED ? userEmail : '', // Approved by
      incomeData.status === STATUS.APPROVED ? new Date() : '', // Approved date
      incomeData.receiptFileId || '',
      incomeData.receiptURL || '',
      incomeData.invoiceId || '',
      incomeData.approvalLevel || ''
    ];
    
    // Submit with lock
    const rowNum = appendRowWithLock(SHEET_NAMES.INCOME, rowData);
    
    // Log audit
    logIncomeEntry(rowNum, incomeData);
    
    return {
      success: true,
      message: 'Income added successfully',
      rowNum: rowNum,
      incomeId: `INC-${rowNum}`,
      requiresApproval: incomeData.status === STATUS.PENDING
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
 * Get income entries with filtering
 * @param {object} filters - Filter options
 * @returns {object} - List of income entries
 */
function getIncomeEnhanced(filters = {}) {
  try {
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    
    // Check permission
    if (!hasPermission(userEmail, 'income.view_all') && !hasPermission(userEmail, 'income.view_own')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INCOME);
    
    if (!sheet) {
      return { success: true, data: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const incomeEntries = [];
    
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
      const income = {
        rowNum: i + 1,
        incomeId: `INC-${i + 1}`,
        date: data[i][INCOME_COLS.DATE],
        source: data[i][INCOME_COLS.SOURCE],
        category: data[i][INCOME_COLS.CATEGORY],
        amount: parseFloat(data[i][INCOME_COLS.AMOUNT]) || 0,
        paymentMode: data[i][INCOME_COLS.PAYMENT_MODE],
        project: data[i][INCOME_COLS.PROJECT],
        addedBy: data[i][INCOME_COLS.ADDED_BY],
        status: data[i][INCOME_COLS.STATUS],
        approvedBy: data[i][INCOME_COLS.APPROVED_BY],
        approvedDate: data[i][INCOME_COLS.APPROVED_DATE],
        receiptFileId: data[i][INCOME_COLS.RECEIPT_FILE_ID],
        receiptURL: data[i][INCOME_COLS.RECEIPT_URL],
        invoiceId: data[i][INCOME_COLS.INVOICE_ID],
        approvalLevel: data[i][INCOME_COLS.APPROVAL_LEVEL]
      };
      
      // Apply filters
      if (!applyIncomeFilters(income, filters, userEmail, role)) {
        continue;
      }
      
      // Check date range
      if (dateRange && !isDateInRange(new Date(income.date), dateRange.start, dateRange.end)) {
        continue;
      }
      
      // Add formatted fields
      income.formattedAmount = formatCurrency(income.amount);
      income.formattedDate = formatDateForDisplay(new Date(income.date));
      income.statusFormatted = formatStatus(income.status);
      
      incomeEntries.push(income);
    }
    
    // Sort if specified
    if (filters.sortBy) {
      incomeEntries.sort((a, b) => {
        const aVal = a[filters.sortBy];
        const bVal = b[filters.sortBy];
        const direction = filters.sortOrder === 'desc' ? -1 : 1;
        
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    }
    
    return {
      success: true,
      data: incomeEntries,
      total: incomeEntries.length
    };
    
  } catch (error) {
    console.error(`Error getting income: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Apply filters to income entry
 * @private
 */
function applyIncomeFilters(income, filters, userEmail, role) {
  // Permission filter
  const canViewAll = hasPermission(userEmail, 'income.view_all');
  if (!canViewAll && income.addedBy !== userEmail) {
    return false;
  }
  
  // Status filter
  if (filters.status && filters.status !== 'ALL' && income.status !== filters.status) {
    return false;
  }
  
  // Category filter
  if (filters.category && income.category !== filters.category) {
    return false;
  }
  
  // Project filter
  if (filters.project && income.project !== filters.project) {
    return false;
  }
  
  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    if (!income.source.toLowerCase().includes(searchLower)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get income summary by category
 * @param {string} dateRange - Date range
 * @returns {object} - Summary data
 */
function getIncomeSummaryByCategory(dateRange = 'THIS_MONTH') {
  try {
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    const dates = getDateRangeForPeriod(dateRange);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INCOME);
    
    if (!sheet) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const summary = {};
    
    for (let i = 1; i < data.length; i++) {
      const incomeDate = new Date(data[i][INCOME_COLS.DATE]);
      const category = data[i][INCOME_COLS.CATEGORY];
      const amount = parseFloat(data[i][INCOME_COLS.AMOUNT]) || 0;
      const status = data[i][INCOME_COLS.STATUS];
      
      // Filter by date and status
      if (isDateInRange(incomeDate, dates.start, dates.end) && status === STATUS.APPROVED) {
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
    console.error(`Error getting income summary: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get income summary by project
 * @param {string} dateRange - Date range
 * @returns {object} - Summary data
 */
function getIncomeSummaryByProject(dateRange = 'THIS_MONTH') {
  try {
    const dates = getDateRangeForPeriod(dateRange);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INCOME);
    
    if (!sheet) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const summary = {};
    
    for (let i = 1; i < data.length; i++) {
      const incomeDate = new Date(data[i][INCOME_COLS.DATE]);
      const project = data[i][INCOME_COLS.PROJECT] || 'No Project';
      const amount = parseFloat(data[i][INCOME_COLS.AMOUNT]) || 0;
      const status = data[i][INCOME_COLS.STATUS];
      
      // Filter by date and status
      if (isDateInRange(incomeDate, dates.start, dates.end) && status === STATUS.APPROVED) {
        if (!summary[project]) {
          summary[project] = { total: 0, count: 0 };
        }
        summary[project].total += amount;
        summary[project].count++;
      }
    }
    
    // Convert to array and sort by total
    const summaryArray = Object.keys(summary).map(proj => ({
      project: proj,
      total: summary[proj].total,
      count: summary[proj].count,
      formattedTotal: formatCurrency(summary[proj].total)
    })).sort((a, b) => b.total - a.total);
    
    return {
      success: true,
      data: summaryArray
    };
    
  } catch (error) {
    console.error(`Error getting income by project: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get income categories
 * @returns {object} - List of categories
 */
function getIncomeCategories() {
  try {
    const categories = getUniqueValues(SHEET_NAMES.INCOME, INCOME_COLS.CATEGORY);
    
    const categoriesWithCount = categories.map(cat => {
      const count = countRowsByValue(SHEET_NAMES.INCOME, INCOME_COLS.CATEGORY, cat);
      return {
        name: cat,
        count: count
      };
    }).filter(cat => cat.name);
    
    return {
      success: true,
      data: categoriesWithCount
    };
    
  } catch (error) {
    console.error(`Error getting income categories: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update income entry
 * @param {number} rowNum - Row number
 * @param {object} updates - Fields to update
 * @returns {object} - Result
 */
function updateIncome(rowNum, updates) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'income.edit')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INCOME);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Income sheet not found'
      };
    }
    
    const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    const income = {
      addedBy: rowData[INCOME_COLS.ADDED_BY],
      status: rowData[INCOME_COLS.STATUS]
    };
    
    // Can only edit own pending income (or any if admin)
    const isAdmin = hasPermission(userEmail, 'income.edit');
    if (!isAdmin && (income.addedBy !== userEmail || income.status !== STATUS.PENDING)) {
      return {
        success: false,
        error: 'Access denied or income already processed'
      };
    }
    
    // Apply updates with lock
    return withLock(`update_income_${rowNum}`, () => {
      const updateMap = {};
      
      if (updates.date) {
        updateMap[INCOME_COLS.DATE] = new Date(updates.date);
      }
      if (updates.source) {
        updateMap[INCOME_COLS.SOURCE] = sanitizeInput(updates.source);
      }
      if (updates.category) {
        updateMap[INCOME_COLS.CATEGORY] = updates.category;
      }
      if (updates.amount) {
        updateMap[INCOME_COLS.AMOUNT] = parseFloat(updates.amount);
      }
      if (updates.paymentMode) {
        updateMap[INCOME_COLS.PAYMENT_MODE] = updates.paymentMode;
      }
      if (updates.project !== undefined) {
        updateMap[INCOME_COLS.PROJECT] = updates.project;
      }
      if (updates.invoiceId) {
        updateMap[INCOME_COLS.INVOICE_ID] = updates.invoiceId;
      }
      
      // Update sheet
      Object.keys(updateMap).forEach(colIndex => {
        const col = parseInt(colIndex) + 1;
        sheet.getRange(rowNum, col).setValue(updateMap[colIndex]);
      });
      
      // Log audit
      logAudit(
        'UPDATE_INCOME',
        SHEET_NAMES.INCOME,
        rowNum,
        'Multiple Fields',
        null,
        JSON.stringify(updates),
        'Income updated'
      );
      
      return {
        success: true,
        message: 'Income updated successfully'
      };
    });
    
  } catch (error) {
    console.error(`Error updating income: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete income entry
 * @param {number} rowNum - Row number
 * @returns {object} - Result
 */
function deleteIncome(rowNum) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'income.edit')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INCOME);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Income sheet not found'
      };
    }
    
    const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Log before deleting
    logAudit(
      'DELETE_INCOME',
      SHEET_NAMES.INCOME,
      rowNum,
      'ALL',
      JSON.stringify(rowData),
      null,
      'Income deleted'
    );
    
    // Delete with lock
    return withLock(`delete_income_${rowNum}`, () => {
      sheet.deleteRow(rowNum);
      
      return {
        success: true,
        message: 'Income deleted successfully'
      };
    });
    
  } catch (error) {
    console.error(`Error deleting income: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
