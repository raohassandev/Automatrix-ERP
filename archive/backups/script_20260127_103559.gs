// ============================================================================
// AUTOMATRIX ERP - ENHANCED VERSION v5.0
// ============================================================================
// Author: AI Agent + Israr Ul Haq
// Date: January 26, 2026
// Changes: Added income logging, error handling, validation, approval system
// ============================================================================

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Auto Matrix ERP v5.0')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current user email
 */
function getCurrentUser() {
  return Session.getActiveUser().getEmail();
}

/**
 * Get user role from Employees sheet
 */
function getUserRole(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const empSheet = ss.getSheetByName('Employees');
    
    if (!empSheet) {
      console.error('Employees sheet not found');
      return 'Staff';
    }
    
    const empData = empSheet.getDataRange().getValues();
    
    for (let i = 1; i < empData.length; i++) {
      if (empData[i][0] === email) {
        return empData[i][3] || 'Staff';
      }
    }
    
    return 'Staff'; // Default role
    
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'Staff';
  }
}

/**
 * Generate unique ID with timestamp
 */
function generateId(prefix) {
  return prefix + '-' + new Date().getTime();
}

/**
 * Validate required fields
 */
function validateRequired(data, fields) {
  const missing = [];
  
  for (const field of fields) {
    if (!data[field] || data[field] === '') {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    throw new Error('Missing required fields: ' + missing.join(', '));
  }
}

/**
 * Check if user has required role
 */
function checkPermission(requiredRoles) {
  const userEmail = getCurrentUser();
  const userRole = getUserRole(userEmail);
  
  if (!requiredRoles.includes(userRole)) {
    throw new Error('Insufficient permissions. Required: ' + requiredRoles.join(' or '));
  }
  
  return true;
}

// ============================================================================
// PROJECT FUNCTIONS
// ============================================================================

/**
 * Get all projects
 */
function getProjects() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pSheet = ss.getSheetByName('Projects');
    
    if (!pSheet) {
      throw new Error('Projects sheet not found');
    }
    
    const data = pSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    return data.slice(1).map(r => ({
      id: r[0] || '',
      name: r[1] || 'Unnamed Project',
      client: r[2] || 'No Client',
      status: r[9] || 'Unknown',
      income: r[7] || 0,
      pending: r[8] || 0
    }));
    
  } catch (error) {
    console.error('Error in getProjects:', error);
    return { error: error.message };
  }
}

/**
 * Get project financials
 */
function getProjectFinancials(projectName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get income for project
    const incomeSheet = ss.getSheetByName('Income_Log');
    let totalIncome = 0;
    
    if (incomeSheet) {
      const incomeData = incomeSheet.getDataRange().getValues();
      for (let i = 1; i < incomeData.length; i++) {
        if (incomeData[i][2] === projectName) {
          totalIncome += parseFloat(incomeData[i][4]) || 0;
        }
      }
    }
    
    // Get expenses for project
    const txnSheet = ss.getSheetByName('Transactions');
    let totalExpense = 0;
    
    if (txnSheet) {
      const txnData = txnSheet.getDataRange().getValues();
      for (let i = 1; i < txnData.length; i++) {
        if (txnData[i][6] === projectName && txnData[i][10] === 'Approved') {
          totalExpense += parseFloat(txnData[i][5]) || 0;
        }
      }
    }
    
    // Get material costs
    const invLogSheet = ss.getSheetByName('Inventory_Logs');
    let materialCost = 0;
    
    if (invLogSheet) {
      const invLogData = invLogSheet.getDataRange().getValues();
      for (let i = 1; i < invLogData.length; i++) {
        if (invLogData[i][5] === projectName) {
          materialCost += parseFloat(invLogData[i][8]) || 0;
        }
      }
    }
    
    const totalExpenseWithMaterial = totalExpense + materialCost;
    const netProfit = totalIncome - totalExpenseWithMaterial;
    const marginPercent = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    
    return {
      projectName: projectName,
      totalIncome: totalIncome,
      cashExpense: totalExpense,
      materialCost: materialCost,
      totalExpense: totalExpenseWithMaterial,
      netProfit: netProfit,
      marginPercent: marginPercent.toFixed(2)
    };
    
  } catch (error) {
    console.error('Error getting project financials:', error);
    return { error: error.message };
  }
}

// ============================================================================
// INVENTORY FUNCTIONS
// ============================================================================

/**
 * Get all inventory items
 */
function getInventory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const iSheet = ss.getSheetByName('Inventory_Items');
    
    if (!iSheet) {
      // Try old name
      const iSheetOld = ss.getSheetByName('Inventory');
      if (!iSheetOld) {
        throw new Error('Inventory sheet not found');
      }
      
      const data = iSheetOld.getDataRange().getValues();
      
      if (data.length <= 1) {
        return [];
      }
      
      return data.slice(1).map(r => ({
        name: r[0] || 'Unnamed Item',
        category: r[1] || 'Uncategorized',
        quantity: r[2] || 0
      }));
    }
    
    const data = iSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    return data.slice(1).map(r => ({
      id: r[0] || '',
      name: r[1] || 'Unnamed Item',
      category: r[2] || 'Uncategorized',
      quantity: r[4] || 0,
      unit: r[3] || 'pcs'
    }));
    
  } catch (error) {
    console.error('Error in getInventory:', error);
    return { error: error.message };
  }
}

/**
 * Get low stock items
 */
function getLowStockItems() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const iSheet = ss.getSheetByName('Inventory_Items');
    
    if (!iSheet) {
      return [];
    }
    
    const data = iSheet.getDataRange().getValues();
    const lowStock = [];
    
    for (let i = 1; i < data.length; i++) {
      const currentStock = parseFloat(data[i][4]) || 0;
      const minStock = parseFloat(data[i][8]) || 5;
      
      if (currentStock < minStock) {
        lowStock.push({
          name: data[i][1],
          currentStock: currentStock,
          minStock: minStock,
          shortage: minStock - currentStock
        });
      }
    }
    
    return lowStock;
    
  } catch (error) {
    console.error('Error getting low stock items:', error);
    return [];
  }
}

// ============================================================================
// TRANSACTION FUNCTIONS
// ============================================================================

/**
 * Get all expenses/transactions
 */
function getExpenses(filters) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eSheet = ss.getSheetByName('Transactions');
    
    if (!eSheet) {
      throw new Error('Transactions sheet not found');
    }
    
    const data = eSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    const transactions = data.slice(1).map(r => ({
      id: r[0] || '',
      date: r[1] ? new Date(r[1]).toLocaleDateString() : '',
      employee: r[2] || '',
      type: r[3] || '',
      category: r[4] || '',
      amount: r[5] || 0,
      project: r[6] || '',
      description: r[8] || '',
      status: r[10] || 'Pending',
      payment: r[12] || ''
    }));
    
    // Apply filters if provided
    if (filters) {
      return transactions.filter(t => {
        if (filters.status && t.status !== filters.status) return false;
        if (filters.project && t.project !== filters.project) return false;
        return true;
      });
    }
    
    return transactions;
    
  } catch (error) {
    console.error('Error in getExpenses:', error);
    return { error: error.message };
  }
}

/**
 * Submit new transaction
 */
function submitERPTransaction(d) {
  try {
    // Validate
    if (!d.proj || !d.amt) {
      return { error: 'Project and Amount are required' };
    }
    
    if (parseFloat(d.amt) <= 0) {
      return { error: 'Amount must be positive' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Transactions');
    
    if (!sheet) {
      return { error: 'Transactions sheet not found' };
    }
    
    const txnId = generateId('TXN');
    const userEmail = getCurrentUser();
    
    sheet.appendRow([
      txnId,
      new Date(d.date || new Date()),
      userEmail,
      "Expense (Employee Paid)",
      d.cat || 'Miscellaneous',
      parseFloat(d.amt),
      d.proj,
      "",
      d.desc || '',
      "",
      "Pending",
      "Web Entry",
      d.payment || 'Cash'
    ]);
    
    return { success: true, transactionId: txnId };
    
  } catch (error) {
    console.error('Error submitting transaction:', error);
    return { error: error.message };
  }
}

/**
 * Get pending transactions (for approval)
 */
function getPendingTransactions() {
  try {
    checkPermission(['CEO', 'Owner']);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const txnSheet = ss.getSheetByName('Transactions');
    const empSheet = ss.getSheetByName('Employees');
    
    if (!txnSheet) {
      return { error: 'Transactions sheet not found' };
    }
    
    const txnData = txnSheet.getDataRange().getValues();
    const empData = empSheet ? empSheet.getDataRange().getValues() : [];
    
    // Create employee email to name mapping
    const empMap = {};
    for (let i = 1; i < empData.length; i++) {
      empMap[empData[i][1]] = empData[i][2]; // email -> name
    }
    
    // Get pending transactions
    const pending = [];
    for (let i = 1; i < txnData.length; i++) {
      if (txnData[i][10] === 'Pending') {
        const employeeEmail = txnData[i][2];
        pending.push({
          id: txnData[i][0],
          date: txnData[i][1] ? new Date(txnData[i][1]).toLocaleDateString() : '',
          employee: empMap[employeeEmail] || employeeEmail, // Use name, fallback to email
          employeeEmail: employeeEmail,
          type: txnData[i][3],
          category: txnData[i][4],
          amount: txnData[i][5],
          project: txnData[i][6],
          description: txnData[i][8],
          payment: txnData[i][12] || 'Cash'
        });
      }
    }
    
    return pending;
    
  } catch (error) {
    console.error('Error getting pending transactions:', error);
    return { error: error.message };
  }
}

/**
 * Approve transaction
 */
function approveTransaction(transactionId) {
  try {
    checkPermission(['CEO', 'Owner']);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const txnSheet = ss.getSheetByName('Transactions');
    
    if (!txnSheet) {
      return { error: 'Transactions sheet not found' };
    }
    
    const data = txnSheet.getDataRange().getValues();
    const userEmail = getCurrentUser();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === transactionId) {
        const row = i + 1;
        
        // Check if already approved
        if (data[i][10] === 'Approved') {
          return { error: 'Transaction already approved' };
        }
        
        // Update status
        txnSheet.getRange(row, 11).setValue('Approved');
        txnSheet.getRange(row, 12).setValue(userEmail); // Reuse column 12
        
        // TODO: Update wallet balance (requires Employee_Balances logic)
        
        return { success: true, message: 'Transaction approved' };
      }
    }
    
    return { error: 'Transaction not found' };
    
  } catch (error) {
    console.error('Error approving transaction:', error);
    return { error: error.message };
  }
}

/**
 * Reject transaction
 */
function rejectTransaction(transactionId, reason) {
  try {
    checkPermission(['CEO', 'Owner']);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const txnSheet = ss.getSheetByName('Transactions');
    
    if (!txnSheet) {
      return { error: 'Transactions sheet not found' };
    }
    
    const data = txnSheet.getDataRange().getValues();
    const userEmail = getCurrentUser();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === transactionId) {
        const row = i + 1;
        
        // Update status
        txnSheet.getRange(row, 11).setValue('Rejected');
        txnSheet.getRange(row, 9).setValue(reason || 'Rejected by ' + userEmail);
        
        return { success: true, message: 'Transaction rejected' };
      }
    }
    
    return { error: 'Transaction not found' };
    
  } catch (error) {
    console.error('Error rejecting transaction:', error);
    return { error: error.message };
  }
}

// ============================================================================
// INCOME FUNCTIONS (NEW!)
// ============================================================================

/**
 * Submit income/payment received
 */
function submitIncome(data) {
  try {
    // Validate
    validateRequired(data, ['project', 'amount', 'date']);
    
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return { error: 'Invalid amount' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const incomeSheet = ss.getSheetByName('Income_Log');
    
    if (!incomeSheet) {
      return { error: 'Income_Log sheet not found' };
    }
    
    const incomeId = generateId('INC');
    const userEmail = getCurrentUser();
    
    incomeSheet.appendRow([
      incomeId,
      new Date(data.date),
      data.project,
      data.milestone || 'Payment Received',
      amount,
      data.paymentMode || 'Bank Transfer',
      data.invoiceNumber || '',
      userEmail,
      new Date(),
      data.notes || ''
    ]);
    
    return { 
      success: true, 
      incomeId: incomeId,
      message: 'Income recorded successfully'
    };
    
  } catch (error) {
    console.error('Error submitting income:', error);
    return { error: error.message };
  }
}

/**
 * Get all income records
 */
function getIncome(filters) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const incomeSheet = ss.getSheetByName('Income_Log');
    
    if (!incomeSheet) {
      return [];
    }
    
    const data = incomeSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    const incomeList = data.slice(1).map(r => ({
      id: r[0] || '',
      date: r[1] ? new Date(r[1]).toLocaleDateString() : '',
      project: r[2] || '',
      milestone: r[3] || '',
      amount: r[4] || 0,
      paymentMode: r[5] || '',
      invoiceNumber: r[6] || '',
      recordedBy: r[7] || '',
      notes: r[9] || ''
    }));
    
    // Apply filters
    if (filters && filters.project) {
      return incomeList.filter(i => i.project === filters.project);
    }
    
    return incomeList;
    
  } catch (error) {
    console.error('Error getting income:', error);
    return { error: error.message };
  }
}

// ============================================================================
// SUMMARY & DASHBOARD FUNCTIONS
// ============================================================================

/**
 * Get project-wise summary
 */
function getSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pSheet = ss.getSheetByName('Projects');
    
    if (!pSheet) {
      return [];
    }
    
    const pRaw = pSheet.getDataRange().getValues().slice(1);
    const projects = pRaw.map(r => ({ name: r[1], income: r[7] || 0 }));

    const tSheet = ss.getSheetByName('Transactions');
    const tRaw = tSheet ? tSheet.getDataRange().getValues().slice(1) : [];
    const expenses = tRaw.map(r => ({ 
      project: r[6], 
      amount: r[5] || 0,
      status: r[10] || 'Pending'
    }));

    return projects.map(p => {
      const projectExpenses = expenses.filter(e => 
        e.project === p.name && e.status === 'Approved'
      );
      const totalExpense = projectExpenses.reduce((acc, curr) => 
        acc + parseFloat(curr.amount), 0
      );
      const totalIncome = parseFloat(p.income);
      const profit = totalIncome - totalExpense;
      
      return {
        project: p.name,
        income: totalIncome.toLocaleString(),
        expense: totalExpense.toLocaleString(),
        profit: profit.toLocaleString(),
        profitRaw: profit
      };
    });
    
  } catch (error) {
    console.error('Error in getSummary:', error);
    return { error: error.message };
  }
}

/**
 * Get dashboard data (main function)
 */
function getERPData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const email = getCurrentUser();
    const role = getUserRole(email);

    // Get Financials (CEO/Owner can see Profit)
    let profit = "Confidential";
    
    if (role === "CEO" || role === "Owner") {
      const dash = ss.getSheetByName('Master_Dashboard');
      if (dash) {
        profit = dash.getRange("I4").getDisplayValue() || "0";
      }
    }

    // Get Personal Wallet Balance
    const wSheet = ss.getSheetByName('Employee_Balances');
    let wallet = "0";
    
    if (wSheet) {
      const wData = wSheet.getDataRange().getValues();
      for (let i = 1; i < wData.length; i++) {
        if (wData[i][0] === email) {
          wallet = wData[i][3] || "0";
          break;
        }
      }
    }

    // Get Project Recovery
    const pSheet = ss.getSheetByName('Projects');
    let totalPending = 0;
    let recoveryList = [];
    
    if (pSheet) {
      const pRaw = pSheet.getDataRange().getValues().slice(1);
      recoveryList = pRaw.map(r => {
        let pending = parseFloat(String(r[8]).replace(/,/g, '')) || 0;
        totalPending += pending;
        return { name: r[1], client: r[2], pending: pending.toLocaleString() };
      }).filter(x => parseFloat(x.pending.replace(/,/g, '')) > 0);
    }

    // Get Categories from Settings
    const settingsSheet = ss.getSheetByName('Settings');
    let categories = [];
    
    if (settingsSheet) {
      categories = settingsSheet.getRange("A2:A20")
        .getValues()
        .flat()
        .filter(String);
    }
    
    const projects = getProjects();
    const projectNames = Array.isArray(projects) ? 
      projects.map(p => p.name) : [];
    
    // Get pending approvals count (CEO/Owner only)
    let pendingCount = 0;
    if (role === 'CEO' || role === 'Owner') {
      const pending = getPendingTransactions();
      pendingCount = Array.isArray(pending) ? pending.length : 0;
    }
    
    // Get low stock alerts
    const lowStock = getLowStockItems();

    return {
      email: email,
      role: role,
      profit: profit,
      wallet: wallet,
      totalRecovery: totalPending.toLocaleString(),
      projects: projectNames,
      categories: categories,
      recoveryList: recoveryList,
      pendingApprovals: pendingCount,
      lowStockAlerts: lowStock.length
    };
    
  } catch (error) {
    console.error('Error in getERPData:', error);
    return { error: error.message };
  }
}

// ============================================================================
// END OF FILE
// ============================================================================
