// ============================================================================
// PROJECTS MODULE
// ============================================================================
// Project financial management with aging reports and invoice tracking
// ============================================================================

/**
 * Get projects with filtering
 * @param {object} filters - Filter options
 * @returns {object} - List of projects
 */
function getProjectsEnhanced(filters = {}) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
    
    if (!sheet) {
      return { success: true, data: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const projects = [];
    
    for (let i = 1; i < data.length; i++) {
      const project = {
        rowNum: i + 1,
        projectId: data[i][PROJECTS_COLS.PROJECT_ID],
        name: data[i][PROJECTS_COLS.NAME],
        client: data[i][PROJECTS_COLS.CLIENT],
        startDate: data[i][PROJECTS_COLS.START_DATE],
        endDate: data[i][PROJECTS_COLS.END_DATE],
        status: data[i][PROJECTS_COLS.STATUS],
        contractValue: parseFloat(data[i][PROJECTS_COLS.CONTRACT_VALUE]) || 0,
        invoicedAmount: parseFloat(data[i][PROJECTS_COLS.INVOICED_AMOUNT]) || 0,
        receivedAmount: parseFloat(data[i][PROJECTS_COLS.RECEIVED_AMOUNT]) || 0,
        pendingRecovery: parseFloat(data[i][PROJECTS_COLS.PENDING_RECOVERY]) || 0,
        costToDate: parseFloat(data[i][PROJECTS_COLS.COST_TO_DATE]) || 0,
        grossMargin: parseFloat(data[i][PROJECTS_COLS.GROSS_MARGIN]) || 0,
        marginPercent: parseFloat(data[i][PROJECTS_COLS.MARGIN_PERCENT]) || 0
      };
      
      // Apply filters
      if (filters.status && project.status !== filters.status) {
        continue;
      }
      
      if (filters.client && !project.client.toLowerCase().includes(filters.client.toLowerCase())) {
        continue;
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!project.name.toLowerCase().includes(searchLower) && 
            !project.projectId.toLowerCase().includes(searchLower)) {
          continue;
        }
      }
      
      // Add formatted fields
      project.formattedContractValue = formatCurrency(project.contractValue);
      project.formattedPendingRecovery = formatCurrency(project.pendingRecovery);
      project.formattedCostToDate = formatCurrency(project.costToDate);
      project.formattedMargin = formatCurrency(project.grossMargin);
      project.statusFormatted = formatStatus(project.status);
      project.agingBucket = project.pendingRecovery > 0 ? getAgingBucket(new Date(project.startDate)) : null;
      
      projects.push(project);
    }
    
    return {
      success: true,
      data: projects,
      total: projects.length
    };
    
  } catch (error) {
    console.error(`Error getting projects: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get project by ID with financial details
 * @param {string} projectId - Project ID
 * @returns {object} - Project details
 */
function getProjectById(projectId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Projects sheet not found'
      };
    }
    
    const rowNum = findRowByValue(SHEET_NAMES.PROJECTS, PROJECTS_COLS.PROJECT_ID, projectId);
    
    if (rowNum === -1) {
      return {
        success: false,
        error: 'Project not found'
      };
    }
    
    const data = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const project = {
      rowNum: rowNum,
      projectId: data[PROJECTS_COLS.PROJECT_ID],
      name: data[PROJECTS_COLS.NAME],
      client: data[PROJECTS_COLS.CLIENT],
      startDate: data[PROJECTS_COLS.START_DATE],
      endDate: data[PROJECTS_COLS.END_DATE],
      status: data[PROJECTS_COLS.STATUS],
      contractValue: parseFloat(data[PROJECTS_COLS.CONTRACT_VALUE]) || 0,
      invoicedAmount: parseFloat(data[PROJECTS_COLS.INVOICED_AMOUNT]) || 0,
      receivedAmount: parseFloat(data[PROJECTS_COLS.RECEIVED_AMOUNT]) || 0,
      pendingRecovery: parseFloat(data[PROJECTS_COLS.PENDING_RECOVERY]) || 0,
      costToDate: parseFloat(data[PROJECTS_COLS.COST_TO_DATE]) || 0,
      grossMargin: parseFloat(data[PROJECTS_COLS.GROSS_MARGIN]) || 0,
      marginPercent: parseFloat(data[PROJECTS_COLS.MARGIN_PERCENT]) || 0
    };
    
    // Get related data
    project.expenses = getProjectExpenses(projectId);
    project.income = getProjectIncome(projectId);
    project.invoices = getProjectInvoices(projectId);
    
    return {
      success: true,
      data: project
    };
    
  } catch (error) {
    console.error(`Error getting project: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get project expenses
 * @private
 */
function getProjectExpenses(projectId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const expenses = [];
  let total = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][EXPENSES_COLS.PROJECT] === projectId && data[i][EXPENSES_COLS.STATUS] === STATUS.APPROVED) {
      const amount = parseFloat(data[i][EXPENSES_COLS.AMOUNT]) || 0;
      total += amount;
      expenses.push({
        date: data[i][EXPENSES_COLS.DATE],
        description: data[i][EXPENSES_COLS.DESCRIPTION],
        amount: amount
      });
    }
  }
  
  return { items: expenses, total: total };
}

/**
 * Get project income
 * @private
 */
function getProjectIncome(projectId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.INCOME);
  
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const income = [];
  let total = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][INCOME_COLS.PROJECT] === projectId && data[i][INCOME_COLS.STATUS] === STATUS.APPROVED) {
      const amount = parseFloat(data[i][INCOME_COLS.AMOUNT]) || 0;
      total += amount;
      income.push({
        date: data[i][INCOME_COLS.DATE],
        source: data[i][INCOME_COLS.SOURCE],
        amount: amount
      });
    }
  }
  
  return { items: income, total: total };
}

/**
 * Get project invoices
 * @private
 */
function getProjectInvoices(projectId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.INVOICES);
  
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const invoices = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][INVOICES_COLS.PROJECT_ID] === projectId) {
      invoices.push({
        invoiceNo: data[i][INVOICES_COLS.INVOICE_NO],
        date: data[i][INVOICES_COLS.DATE],
        amount: parseFloat(data[i][INVOICES_COLS.AMOUNT]) || 0,
        dueDate: data[i][INVOICES_COLS.DUE_DATE],
        status: data[i][INVOICES_COLS.STATUS],
        paymentDate: data[i][INVOICES_COLS.PAYMENT_DATE]
      });
    }
  }
  
  return invoices;
}

/**
 * Add new project
 * @param {object} projectData - Project data
 * @returns {object} - Result
 */
function addProject(projectData) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'projects.add')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    // Validate
    const validation = validateProject(projectData);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Validation failed',
        details: validation.errors
      };
    }
    
    // Check if project ID already exists
    const existing = findRowByValue(SHEET_NAMES.PROJECTS, PROJECTS_COLS.PROJECT_ID, projectData.projectId);
    if (existing !== -1) {
      return {
        success: false,
        error: 'Project with this ID already exists'
      };
    }
    
    const rowData = [
      projectData.projectId,
      sanitizeInput(projectData.name),
      sanitizeInput(projectData.client),
      projectData.startDate,
      projectData.endDate || '',
      projectData.status || STATUS.PLANNING,
      parseFloat(projectData.contractValue) || 0,
      0, // Invoiced amount
      0, // Received amount
      0, // Pending recovery
      0, // Cost to date
      0, // Gross margin
      0  // Margin percent
    ];
    
    const rowNum = appendRowWithLock(SHEET_NAMES.PROJECTS, rowData);
    
    // Log audit
    logProjectUpdate(projectData.projectId, 'ALL', null, JSON.stringify(projectData));
    
    return {
      success: true,
      message: 'Project created successfully',
      rowNum: rowNum
    };
    
  } catch (error) {
    console.error(`Error adding project: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update project
 * @param {string} projectId - Project ID
 * @param {object} updates - Fields to update
 * @returns {object} - Result
 */
function updateProject(projectId, updates) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'projects.edit')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    const rowNum = findRowByValue(SHEET_NAMES.PROJECTS, PROJECTS_COLS.PROJECT_ID, projectId);
    
    if (rowNum === -1) {
      return {
        success: false,
        error: 'Project not found'
      };
    }
    
    return withLock(`project_${projectId}`, () => {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
      
      const updateMap = {};
      
      if (updates.name) {
        updateMap[PROJECTS_COLS.NAME] = sanitizeInput(updates.name);
      }
      if (updates.client) {
        updateMap[PROJECTS_COLS.CLIENT] = sanitizeInput(updates.client);
      }
      if (updates.startDate) {
        updateMap[PROJECTS_COLS.START_DATE] = new Date(updates.startDate);
      }
      if (updates.endDate !== undefined) {
        updateMap[PROJECTS_COLS.END_DATE] = updates.endDate ? new Date(updates.endDate) : '';
      }
      if (updates.status) {
        updateMap[PROJECTS_COLS.STATUS] = updates.status;
      }
      if (updates.contractValue !== undefined) {
        updateMap[PROJECTS_COLS.CONTRACT_VALUE] = parseFloat(updates.contractValue);
      }
      
      // Update sheet
      Object.keys(updateMap).forEach(colIndex => {
        const col = parseInt(colIndex) + 1;
        sheet.getRange(rowNum, col).setValue(updateMap[colIndex]);
      });
      
      // Recalculate financials
      recalculateProjectFinancials(projectId);
      
      // Log audit
      logProjectUpdate(projectId, 'Multiple', null, JSON.stringify(updates));
      
      return {
        success: true,
        message: 'Project updated successfully'
      };
    });
    
  } catch (error) {
    console.error(`Error updating project: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Recalculate project financials
 * @param {string} projectId - Project ID
 */
function recalculateProjectFinancials(projectId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
    
    const rowNum = findRowByValue(SHEET_NAMES.PROJECTS, PROJECTS_COLS.PROJECT_ID, projectId);
    if (rowNum === -1) return;
    
    // Get expenses and income
    const expenses = getProjectExpenses(projectId);
    const income = getProjectIncome(projectId);
    const invoices = getProjectInvoices(projectId);
    
    // Calculate totals
    const costToDate = expenses.total;
    const receivedAmount = income.total;
    
    // Calculate invoiced amount
    let invoicedAmount = 0;
    invoices.forEach(inv => {
      invoicedAmount += inv.amount;
    });
    
    // Calculate pending recovery
    const pendingRecovery = invoicedAmount - receivedAmount;
    
    // Calculate margin
    const grossMargin = receivedAmount - costToDate;
    const marginPercent = receivedAmount > 0 ? (grossMargin / receivedAmount) * 100 : 0;
    
    // Update project sheet
    projectSheet.getRange(rowNum, PROJECTS_COLS.INVOICED_AMOUNT + 1).setValue(invoicedAmount);
    projectSheet.getRange(rowNum, PROJECTS_COLS.RECEIVED_AMOUNT + 1).setValue(receivedAmount);
    projectSheet.getRange(rowNum, PROJECTS_COLS.PENDING_RECOVERY + 1).setValue(pendingRecovery);
    projectSheet.getRange(rowNum, PROJECTS_COLS.COST_TO_DATE + 1).setValue(costToDate);
    projectSheet.getRange(rowNum, PROJECTS_COLS.GROSS_MARGIN + 1).setValue(grossMargin);
    projectSheet.getRange(rowNum, PROJECTS_COLS.MARGIN_PERCENT + 1).setValue(marginPercent);
    
  } catch (error) {
    console.error(`Error recalculating financials: ${error.message}`);
  }
}

/**
 * Get aging report
 * @returns {object} - Aging report by bucket
 */
function getAgingReport() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
    
    if (!sheet) {
      return { success: true, data: {} };
    }
    
    const data = sheet.getDataRange().getValues();
    
    const aging = {
      '0-30': { projects: [], amount: 0 },
      '31-60': { projects: [], amount: 0 },
      '61-90': { projects: [], amount: 0 },
      '90+': { projects: [], amount: 0 }
    };
    
    let totalPending = 0;
    
    for (let i = 1; i < data.length; i++) {
      const pendingRecovery = parseFloat(data[i][PROJECTS_COLS.PENDING_RECOVERY]) || 0;
      
      if (pendingRecovery > 0) {
        const startDate = new Date(data[i][PROJECTS_COLS.START_DATE]);
        const bucket = getAgingBucket(startDate);
        
        const projectInfo = {
          projectId: data[i][PROJECTS_COLS.PROJECT_ID],
          name: data[i][PROJECTS_COLS.NAME],
          client: data[i][PROJECTS_COLS.CLIENT],
          amount: pendingRecovery,
          days: getDaysBetween(startDate, new Date())
        };
        
        aging[bucket].projects.push(projectInfo);
        aging[bucket].amount += pendingRecovery;
        totalPending += pendingRecovery;
      }
    }
    
    return {
      success: true,
      data: {
        aging: aging,
        totalPending: totalPending,
        formattedTotal: formatCurrency(totalPending)
      }
    };
    
  } catch (error) {
    console.error(`Error getting aging report: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Add invoice to project
 * @param {object} invoiceData - Invoice data
 * @returns {object} - Result
 */
function addInvoice(invoiceData) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'invoices.create')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    // Validate
    const validation = validateInvoice(invoiceData);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Validation failed',
        details: validation.errors
      };
    }
    
    // Check if invoice number already exists
    const invSheet = getOrCreateSheet(SHEET_NAMES.INVOICES);
    const existing = findRowByValue(SHEET_NAMES.INVOICES, INVOICES_COLS.INVOICE_NO, invoiceData.invoiceNo);
    
    if (existing !== -1) {
      return {
        success: false,
        error: 'Invoice with this number already exists'
      };
    }
    
    const rowData = [
      invoiceData.invoiceNo,
      invoiceData.projectId,
      invoiceData.date,
      parseFloat(invoiceData.amount),
      invoiceData.dueDate,
      STATUS.DRAFT,
      '', // Payment date
      invoiceData.notes || ''
    ];
    
    const rowNum = appendRowWithLock(SHEET_NAMES.INVOICES, rowData);
    
    // Recalculate project financials
    recalculateProjectFinancials(invoiceData.projectId);
    
    // Log audit
    logInvoiceCreation(invoiceData.invoiceNo, invoiceData);
    
    return {
      success: true,
      message: 'Invoice created successfully',
      rowNum: rowNum
    };
    
  } catch (error) {
    console.error(`Error adding invoice: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update invoice status
 * @param {string} invoiceNo - Invoice number
 * @param {string} status - New status
 * @param {Date} paymentDate - Payment date (if paid)
 * @returns {object} - Result
 */
function updateInvoiceStatus(invoiceNo, status, paymentDate = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INVOICES);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Invoices sheet not found'
      };
    }
    
    const rowNum = findRowByValue(SHEET_NAMES.INVOICES, INVOICES_COLS.INVOICE_NO, invoiceNo);
    
    if (rowNum === -1) {
      return {
        success: false,
        error: 'Invoice not found'
      };
    }
    
    const data = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    const oldStatus = data[INVOICES_COLS.STATUS];
    const projectId = data[INVOICES_COLS.PROJECT_ID];
    
    // Update status
    sheet.getRange(rowNum, INVOICES_COLS.STATUS + 1).setValue(status);
    
    // Update payment date if paid
    if (status === STATUS.PAID && paymentDate) {
      sheet.getRange(rowNum, INVOICES_COLS.PAYMENT_DATE + 1).setValue(paymentDate);
    }
    
    // Recalculate project financials
    recalculateProjectFinancials(projectId);
    
    // Log audit
    logInvoiceStatusChange(invoiceNo, oldStatus, status);
    
    return {
      success: true,
      message: `Invoice status updated to ${status}`
    };
    
  } catch (error) {
    console.error(`Error updating invoice status: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get project summary statistics
 * @returns {object} - Summary data
 */
function getProjectSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
    
    if (!sheet) {
      return { success: true, data: {} };
    }
    
    const data = sheet.getDataRange().getValues();
    
    const summary = {
      total: 0,
      active: 0,
      completed: 0,
      totalContractValue: 0,
      totalPendingRecovery: 0,
      totalCost: 0,
      totalMargin: 0,
      avgMarginPercent: 0
    };
    
    for (let i = 1; i < data.length; i++) {
      summary.total++;
      
      const status = data[i][PROJECTS_COLS.STATUS];
      if (status === STATUS.IN_PROGRESS) {
        summary.active++;
      } else if (status === STATUS.COMPLETED) {
        summary.completed++;
      }
      
      summary.totalContractValue += parseFloat(data[i][PROJECTS_COLS.CONTRACT_VALUE]) || 0;
      summary.totalPendingRecovery += parseFloat(data[i][PROJECTS_COLS.PENDING_RECOVERY]) || 0;
      summary.totalCost += parseFloat(data[i][PROJECTS_COLS.COST_TO_DATE]) || 0;
      summary.totalMargin += parseFloat(data[i][PROJECTS_COLS.GROSS_MARGIN]) || 0;
    }
    
    summary.avgMarginPercent = summary.totalContractValue > 0 ? 
      (summary.totalMargin / summary.totalContractValue) * 100 : 0;
    
    return {
      success: true,
      data: summary
    };
    
  } catch (error) {
    console.error(`Error getting project summary: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
