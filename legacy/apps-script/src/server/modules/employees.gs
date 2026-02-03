// ============================================================================
// EMPLOYEES MODULE
// ============================================================================
// Employee management and wallet operations
// ============================================================================

/**
 * Get all employees with filtering
 * @param {object} filters - Filter options
 * @returns {object} - List of employees
 */
function getEmployeesEnhanced(filters = {}) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'employees.view_all') && !hasPermission(userEmail, 'employees.view_team')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    
    if (!sheet) {
      return { success: true, data: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const employees = [];
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const employee = {
        rowNum: i + 1,
        email: data[i][EMPLOYEES_COLS.EMAIL],
        name: data[i][EMPLOYEES_COLS.NAME],
        phone: data[i][EMPLOYEES_COLS.PHONE],
        role: data[i][EMPLOYEES_COLS.ROLE],
        walletBalance: parseFloat(data[i][EMPLOYEES_COLS.WALLET_BALANCE]) || 0,
        status: data[i][EMPLOYEES_COLS.STATUS]
      };
      
      // Apply filters
      if (filters.status && employee.status !== filters.status) {
        continue;
      }
      
      if (filters.role && employee.role !== filters.role) {
        continue;
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!employee.name.toLowerCase().includes(searchLower) && 
            !employee.email.toLowerCase().includes(searchLower)) {
          continue;
        }
      }
      
      // Add formatted fields
      employee.formattedWallet = formatCurrency(employee.walletBalance);
      employee.statusFormatted = formatStatus(employee.status);
      employee.roleFormatted = formatRole(employee.role);
      employee.initials = getInitials(employee.name);
      
      employees.push(employee);
    }
    
    // Sort by name
    employees.sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      success: true,
      data: employees,
      total: employees.length
    };
    
  } catch (error) {
    console.error(`Error getting employees: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get employee by email
 * @param {string} email - Employee email
 * @returns {object} - Employee details
 */
function getEmployeeByEmail(email) {
  try {
    const profile = getUserProfile(email);
    
    if (!profile) {
      return {
        success: false,
        error: 'Employee not found'
      };
    }
    
    // Get wallet transactions
    const walletTransactions = getEmployeeWalletTransactions(email);
    
    // Get expense statistics
    const expenseStats = getEmployeeExpenseStats(email);
    
    return {
      success: true,
      data: {
        ...profile,
        formattedWallet: formatCurrency(profile.walletBalance),
        statusFormatted: formatStatus(profile.status),
        roleFormatted: formatRole(profile.role),
        initials: getInitials(profile.name),
        walletTransactions: walletTransactions,
        expenseStats: expenseStats
      }
    };
    
  } catch (error) {
    console.error(`Error getting employee: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Add new employee
 * @param {object} employeeData - Employee data
 * @returns {object} - Result
 */
function addEmployee(employeeData) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'employees.add')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    // Validate input
    const validation = validateEmployee(employeeData);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Validation failed',
        details: validation.errors
      };
    }
    
    // Check if employee already exists
    const existing = getUserProfile(employeeData.email);
    if (existing) {
      return {
        success: false,
        error: 'Employee with this email already exists'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Employees sheet not found'
      };
    }
    
    // Prepare row data
    const rowData = [
      employeeData.email,
      sanitizeInput(employeeData.name),
      employeeData.phone || '',
      employeeData.role,
      0, // Initial wallet balance
      STATUS.ACTIVE
    ];
    
    // Add with lock
    const rowNum = appendRowWithLock(SHEET_NAMES.EMPLOYEES, rowData);
    
    // Log audit
    logEmployeeChange(employeeData.email, 'ALL', null, JSON.stringify(employeeData));
    
    return {
      success: true,
      message: 'Employee added successfully',
      rowNum: rowNum
    };
    
  } catch (error) {
    console.error(`Error adding employee: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate employee data
 * @private
 */
function validateEmployee(employee) {
  const errors = [];
  
  if (!employee.email || !employee.email.includes('@')) {
    errors.push('Valid email is required');
  }
  
  if (!employee.name || employee.name.trim() === '') {
    errors.push('Name is required');
  }
  
  if (!employee.role) {
    errors.push('Role is required');
  }
  
  // Validate role is one of defined roles
  const validRoles = Object.values(ROLES);
  if (employee.role && !validRoles.includes(employee.role)) {
    errors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Update employee
 * @param {string} email - Employee email
 * @param {object} updates - Fields to update
 * @returns {object} - Result
 */
function updateEmployee(email, updates) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'employees.edit')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    const profile = getUserProfile(email);
    if (!profile) {
      return {
        success: false,
        error: 'Employee not found'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Employees sheet not found'
      };
    }
    
    // Apply updates with lock
    return withLock(`update_employee_${email}`, () => {
      const updateMap = {};
      
      if (updates.name) {
        updateMap[EMPLOYEES_COLS.NAME] = sanitizeInput(updates.name);
      }
      if (updates.phone !== undefined) {
        updateMap[EMPLOYEES_COLS.PHONE] = updates.phone;
      }
      if (updates.role) {
        // Validate role
        const validRoles = Object.values(ROLES);
        if (!validRoles.includes(updates.role)) {
          throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
        }
        updateMap[EMPLOYEES_COLS.ROLE] = updates.role;
      }
      if (updates.status) {
        updateMap[EMPLOYEES_COLS.STATUS] = updates.status;
      }
      
      // Update sheet
      Object.keys(updateMap).forEach(colIndex => {
        const col = parseInt(colIndex) + 1;
        sheet.getRange(profile.rowIndex, col).setValue(updateMap[colIndex]);
      });
      
      // Log audit
      Object.keys(updateMap).forEach(colIndex => {
        const fieldName = Object.keys(EMPLOYEES_COLS)[colIndex];
        logEmployeeChange(email, fieldName, null, updateMap[colIndex]);
      });
      
      return {
        success: true,
        message: 'Employee updated successfully'
      };
    });
    
  } catch (error) {
    console.error(`Error updating employee: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Deactivate employee (soft delete)
 * @param {string} email - Employee email
 * @returns {object} - Result
 */
function deactivateEmployee(email) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'employees.edit')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    return updateEmployee(email, { status: STATUS.INACTIVE });
    
  } catch (error) {
    console.error(`Error deactivating employee: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get employee wallet transactions
 * @param {string} email - Employee email
 * @param {number} limit - Number of transactions (default: 50)
 * @returns {array} - Wallet transactions
 */
function getEmployeeWalletTransactions(email, limit = 50) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const walletSheet = ss.getSheetByName(SHEET_NAMES.WALLET);
    
    if (!walletSheet) {
      return [];
    }
    
    const data = walletSheet.getDataRange().getValues();
    const transactions = [];
    
    // Get transactions for this employee (reverse order - newest first)
    for (let i = data.length - 1; i >= 1 && transactions.length < limit; i--) {
      if (data[i][WALLET_COLS.EMPLOYEE] === email) {
        transactions.push({
          date: data[i][WALLET_COLS.DATE],
          type: data[i][WALLET_COLS.TYPE],
          amount: parseFloat(data[i][WALLET_COLS.AMOUNT]) || 0,
          reference: data[i][WALLET_COLS.REFERENCE],
          balance: parseFloat(data[i][WALLET_COLS.BALANCE]) || 0,
          formattedAmount: formatCurrency(parseFloat(data[i][WALLET_COLS.AMOUNT]) || 0),
          formattedBalance: formatCurrency(parseFloat(data[i][WALLET_COLS.BALANCE]) || 0),
          formattedDate: formatDateForDisplay(new Date(data[i][WALLET_COLS.DATE]))
        });
      }
    }
    
    return transactions;
    
  } catch (error) {
    console.error(`Error getting wallet transactions: ${error.message}`);
    return [];
  }
}

/**
 * Get employee expense statistics
 * @param {string} email - Employee email
 * @returns {object} - Expense stats
 */
function getEmployeeExpenseStats(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const expenseSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (!expenseSheet) {
      return {
        totalSubmitted: 0,
        totalApproved: 0,
        totalRejected: 0,
        totalPending: 0,
        approvedAmount: 0,
        rejectedAmount: 0,
        pendingAmount: 0
      };
    }
    
    const data = expenseSheet.getDataRange().getValues();
    const stats = {
      totalSubmitted: 0,
      totalApproved: 0,
      totalRejected: 0,
      totalPending: 0,
      approvedAmount: 0,
      rejectedAmount: 0,
      pendingAmount: 0
    };
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][EXPENSES_COLS.SUBMITTED_BY] === email) {
        const amount = parseFloat(data[i][EXPENSES_COLS.AMOUNT]) || 0;
        const status = data[i][EXPENSES_COLS.STATUS];
        
        stats.totalSubmitted++;
        
        if (status === STATUS.APPROVED || status === STATUS.PARTIALLY_APPROVED) {
          stats.totalApproved++;
          stats.approvedAmount += amount;
        } else if (status === STATUS.REJECTED) {
          stats.totalRejected++;
          stats.rejectedAmount += amount;
        } else if (status === STATUS.PENDING || status.startsWith('Pending')) {
          stats.totalPending++;
          stats.pendingAmount += amount;
        }
      }
    }
    
    return stats;
    
  } catch (error) {
    console.error(`Error getting expense stats: ${error.message}`);
    return {};
  }
}

/**
 * Credit employee wallet
 * @param {string} email - Employee email
 * @param {number} amount - Amount to credit
 * @param {string} reference - Reference/reason
 * @returns {object} - Result
 */
function creditEmployeeWallet(email, amount, reference) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'employees.edit_wallet')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    if (amount <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0'
      };
    }
    
    const profile = getUserProfile(email);
    if (!profile) {
      return {
        success: false,
        error: 'Employee not found'
      };
    }
    
    return withLock(`wallet_${email}`, () => {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
      const walletSheet = ss.getSheetByName(SHEET_NAMES.WALLET);
      
      const oldBalance = profile.walletBalance;
      const newBalance = oldBalance + amount;
      
      // Update employee balance
      empSheet.getRange(profile.rowIndex, EMPLOYEES_COLS.WALLET_BALANCE + 1).setValue(newBalance);
      
      // Add wallet transaction
      if (walletSheet) {
        walletSheet.appendRow([
          new Date(),
          email,
          'CREDIT',
          amount,
          reference,
          newBalance
        ]);
      }
      
      // Log audit
      logWalletTransaction(email, 'CREDIT', amount, oldBalance, newBalance, reference);
      
      return {
        success: true,
        message: `Credited ${formatCurrency(amount)} to wallet`,
        newBalance: newBalance
      };
    });
    
  } catch (error) {
    console.error(`Error crediting wallet: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Debit employee wallet
 * @param {string} email - Employee email
 * @param {number} amount - Amount to debit
 * @param {string} reference - Reference/reason
 * @returns {object} - Result
 */
function debitEmployeeWallet(email, amount, reference) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'employees.edit_wallet')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    if (amount <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0'
      };
    }
    
    const profile = getUserProfile(email);
    if (!profile) {
      return {
        success: false,
        error: 'Employee not found'
      };
    }
    
    if (profile.walletBalance < amount) {
      return {
        success: false,
        error: 'Insufficient wallet balance'
      };
    }
    
    return withLock(`wallet_${email}`, () => {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
      const walletSheet = ss.getSheetByName(SHEET_NAMES.WALLET);
      
      const oldBalance = profile.walletBalance;
      const newBalance = oldBalance - amount;
      
      // Update employee balance
      empSheet.getRange(profile.rowIndex, EMPLOYEES_COLS.WALLET_BALANCE + 1).setValue(newBalance);
      
      // Add wallet transaction
      if (walletSheet) {
        walletSheet.appendRow([
          new Date(),
          email,
          'DEBIT',
          amount,
          reference,
          newBalance
        ]);
      }
      
      // Log audit
      logWalletTransaction(email, 'DEBIT', amount, oldBalance, newBalance, reference);
      
      return {
        success: true,
        message: `Debited ${formatCurrency(amount)} from wallet`,
        newBalance: newBalance
      };
    });
    
  } catch (error) {
    console.error(`Error debiting wallet: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get employee roles list
 * @returns {object} - List of roles
 */
function getEmployeeRoles() {
  return {
    success: true,
    data: Object.values(ROLES).map(role => ({
      value: role,
      label: role,
      ...formatRole(role)
    }))
  };
}

/**
 * Get team summary (count by role)
 * @returns {object} - Summary data
 */
function getTeamSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    
    if (!sheet) {
      return { success: true, data: {} };
    }
    
    const data = sheet.getDataRange().getValues();
    const summary = {
      total: 0,
      active: 0,
      inactive: 0,
      byRole: {}
    };
    
    for (let i = 1; i < data.length; i++) {
      const role = data[i][EMPLOYEES_COLS.ROLE];
      const status = data[i][EMPLOYEES_COLS.STATUS];
      
      summary.total++;
      
      if (status === STATUS.ACTIVE) {
        summary.active++;
      } else {
        summary.inactive++;
      }
      
      if (!summary.byRole[role]) {
        summary.byRole[role] = 0;
      }
      summary.byRole[role]++;
    }
    
    return {
      success: true,
      data: summary
    };
    
  } catch (error) {
    console.error(`Error getting team summary: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
