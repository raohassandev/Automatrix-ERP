// ============================================================================
// DASHBOARD MODULE
// ============================================================================
// Enhanced dashboard with KPIs, trends, and activity feed
// ============================================================================

/**
 * Get comprehensive dashboard data
 * @param {string} dateRange - Date range period ('THIS_MONTH', 'LAST_MONTH', 'CUSTOM', etc.)
 * @param {Date} customStartDate - Custom start date (optional)
 * @param {Date} customEndDate - Custom end date (optional)
 * @returns {object} - Dashboard data with KPIs, trends, and activity
 */
function getDashboardDataEnhanced(dateRange = 'THIS_MONTH', customStartDate = null, customEndDate = null) {
  try {
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    const profile = getUserProfile(userEmail);
    
    // Get date range
    let dates;
    if (dateRange === 'CUSTOM' && customStartDate && customEndDate) {
      dates = { start: new Date(customStartDate), end: new Date(customEndDate) };
    } else {
      dates = getDateRangeForPeriod(dateRange);
    }
    
    // Calculate KPIs
    const kpis = calculateKPIs(dates, userEmail, role);
    
    // Calculate trends (compare with previous period)
    const trends = calculateTrends(dates, userEmail, role);
    
    // Get recent activity
    const recentActivity = getRecentActivityFormatted(10);
    
    // Get pending items count
    const pendingCounts = getPendingCounts(userEmail, role);
    
    // Get sparkline data (last 7 days)
const sparklines = getSparklineData(userEmail, role);

  return {
    success: true,
    data: {
        user: {
          email: userEmail,
          name: profile ? profile.name : userEmail.split('@')[0],
          role: role,
          walletBalance: profile ? profile.walletBalance : 0
        },
        dateRange: {
          period: dateRange,
          start: formatDate(dates.start),
          end: formatDate(dates.end),
          label: getDateRangeLabel(dateRange, dates)
        },
        kpis: kpis,
        trends: trends,
        recentActivity: recentActivity,
        pendingCounts: pendingCounts,
        sparklines: sparklines
      }
    };
    
  } catch (error) {
    console.error(`Error getting dashboard data: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get quick project summary for UI cards
 * @returns {array|object}
 */
function getSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pSheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);

    if (!pSheet) {
      return [];
    }

    const pRaw = pSheet.getDataRange().getValues().slice(1);
    const projects = pRaw.map(r => ({ name: r[PROJECTS_COLS.NAME], income: r[PROJECTS_COLS.INVOICED_AMOUNT] || 0 }));

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
      const totalIncome = parseFloat(p.income) || 0;
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
    console.error(`Error in getSummary: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Get all income records
 */
function getIncome(filters = {}) {
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

    if (filters && filters.project) {
      return incomeList.filter(i => i.project === filters.project);
    }

    return incomeList;

  } catch (error) {
    console.error(`Error getting income: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Calculate KPIs for date range
 * @param {object} dates - {start, end}
 * @param {string} userEmail - User email
 * @param {string} role - User role
 * @returns {object} - KPI values
 */
function calculateKPIs(dates, userEmail, role) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Initialize KPIs
  const kpis = {
    walletBalance: 0,
    totalExpenses: 0,
    totalIncome: 0,
    pendingRecovery: 0,
    pendingApprovals: 0,
    approvedExpenses: 0,
    rejectedExpenses: 0,
    netProfit: 0,
    expenseCount: 0,
    incomeCount: 0
  };
  
  // Get wallet balance (current)
  const profile = getUserProfile(userEmail);
  kpis.walletBalance = profile ? profile.walletBalance : 0;
  
  // Calculate expenses
  const expenseSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  if (expenseSheet) {
    const expenseData = expenseSheet.getDataRange().getValues();
    
    for (let i = 1; i < expenseData.length; i++) {
      const expenseDate = new Date(expenseData[i][EXPENSES_COLS.DATE]);
      const amount = parseFloat(expenseData[i][EXPENSES_COLS.AMOUNT]) || 0;
      const status = expenseData[i][EXPENSES_COLS.STATUS];
      const submittedBy = expenseData[i][EXPENSES_COLS.SUBMITTED_BY];
      
      // Filter by role
      if (role !== ROLES.CEO && role !== ROLES.OWNER && role !== ROLES.FINANCE_MANAGER) {
        if (submittedBy !== userEmail) continue;
      }
      
      // Filter by date range
      if (isDateInRange(expenseDate, dates.start, dates.end)) {
        kpis.expenseCount++;
        
        if (status === STATUS.APPROVED) {
          kpis.approvedExpenses += amount;
          kpis.totalExpenses += amount;
        } else if (status === STATUS.REJECTED) {
          kpis.rejectedExpenses += amount;
        } else if (status === STATUS.PENDING || status.startsWith('Pending')) {
          if (canApproveAmount(userEmail, 'EXPENSE', amount)) {
            kpis.pendingApprovals++;
          }
        }
      }
    }
  }
  
  // Calculate income
  const incomeSheet = ss.getSheetByName(SHEET_NAMES.INCOME);
  if (incomeSheet) {
    const incomeData = incomeSheet.getDataRange().getValues();
    
    for (let i = 1; i < incomeData.length; i++) {
      const incomeDate = new Date(incomeData[i][INCOME_COLS.DATE]);
      const amount = parseFloat(incomeData[i][INCOME_COLS.AMOUNT]) || 0;
      const status = incomeData[i][INCOME_COLS.STATUS];
      
      // Filter by date range
      if (isDateInRange(incomeDate, dates.start, dates.end)) {
        kpis.incomeCount++;
        
        if (status === STATUS.APPROVED) {
          kpis.totalIncome += amount;
        }
      }
    }
  }
  
  // Calculate pending recovery (from Projects sheet)
  const projectSheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
  if (projectSheet) {
    const projectData = projectSheet.getDataRange().getValues();
    
    for (let i = 1; i < projectData.length; i++) {
      const pendingRecovery = parseFloat(projectData[i][PROJECTS_COLS.PENDING_RECOVERY]) || 0;
      kpis.pendingRecovery += pendingRecovery;
    }
  }
  
  // Calculate net profit
  kpis.netProfit = kpis.totalIncome - kpis.totalExpenses;
  
  // Format all currency values
  return {
    walletBalance: kpis.walletBalance,
    totalExpenses: kpis.totalExpenses,
    totalIncome: kpis.totalIncome,
    pendingRecovery: kpis.pendingRecovery,
    pendingApprovals: kpis.pendingApprovals,
    approvedExpenses: kpis.approvedExpenses,
    rejectedExpenses: kpis.rejectedExpenses,
    netProfit: kpis.netProfit,
    expenseCount: kpis.expenseCount,
    incomeCount: kpis.incomeCount,
    profitMargin: kpis.totalIncome > 0 ? (kpis.netProfit / kpis.totalIncome) * 100 : 0
  };
}

/**
 * Calculate trends (compare current vs previous period)
 * @param {object} dates - Current period {start, end}
 * @param {string} userEmail - User email
 * @param {string} role - User role
 * @returns {object} - Trend data
 */
function calculateTrends(dates, userEmail, role) {
  // Calculate previous period
  const daysDiff = getDaysBetween(dates.start, dates.end);
  const prevEnd = new Date(dates.start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff);
  
  const previousDates = { start: prevStart, end: prevEnd };
  
  // Get KPIs for both periods
  const currentKPIs = calculateKPIs(dates, userEmail, role);
  const previousKPIs = calculateKPIs(previousDates, userEmail, role);
  
  // Calculate trends
  const trends = {
    expenses: formatTrend(currentKPIs.totalExpenses, previousKPIs.totalExpenses),
    income: formatTrend(currentKPIs.totalIncome, previousKPIs.totalIncome),
    profit: formatTrend(currentKPIs.netProfit, previousKPIs.netProfit),
    recovery: formatTrend(currentKPIs.pendingRecovery, previousKPIs.pendingRecovery)
  };
  
  return trends;
}

/**
 * Get sparkline data (daily values for last N days)
 * @param {string} userEmail - User email
 * @param {string} role - User role
 * @param {number} days - Number of days (default: 7)
 * @returns {object} - Sparkline data
 */
function getSparklineData(userEmail, role, days = 7) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  
  // Initialize arrays for each day
  const expensesByDay = [];
  const incomeByDay = [];
  const labels = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    labels.push(formatDate(date, 'MMM dd'));
    expensesByDay.push(0);
    incomeByDay.push(0);
  }
  
  // Get expenses
  const expenseSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  if (expenseSheet) {
    const expenseData = expenseSheet.getDataRange().getValues();
    
    for (let i = 1; i < expenseData.length; i++) {
      const expenseDate = new Date(expenseData[i][EXPENSES_COLS.DATE]);
      expenseDate.setHours(0, 0, 0, 0);
      const amount = parseFloat(expenseData[i][EXPENSES_COLS.AMOUNT]) || 0;
      const status = expenseData[i][EXPENSES_COLS.STATUS];
      const submittedBy = expenseData[i][EXPENSES_COLS.SUBMITTED_BY];
      
      // Filter by role
      if (role !== ROLES.CEO && role !== ROLES.OWNER && role !== ROLES.FINANCE_MANAGER) {
        if (submittedBy !== userEmail) continue;
      }
      
      // Only count approved expenses
      if (status === STATUS.APPROVED) {
        // Find day index
        const daysDiff = getDaysBetween(expenseDate, today);
        const dayIndex = days - 1 - daysDiff;
        
        if (dayIndex >= 0 && dayIndex < days) {
          expensesByDay[dayIndex] += amount;
        }
      }
    }
  }
  
  // Get income
  const incomeSheet = ss.getSheetByName(SHEET_NAMES.INCOME);
  if (incomeSheet) {
    const incomeData = incomeSheet.getDataRange().getValues();
    
    for (let i = 1; i < incomeData.length; i++) {
      const incomeDate = new Date(incomeData[i][INCOME_COLS.DATE]);
      incomeDate.setHours(0, 0, 0, 0);
      const amount = parseFloat(incomeData[i][INCOME_COLS.AMOUNT]) || 0;
      const status = incomeData[i][INCOME_COLS.STATUS];
      
      // Only count approved income
      if (status === STATUS.APPROVED) {
        // Find day index
        const daysDiff = getDaysBetween(incomeDate, today);
        const dayIndex = days - 1 - daysDiff;
        
        if (dayIndex >= 0 && dayIndex < days) {
          incomeByDay[dayIndex] += amount;
        }
      }
    }
  }
  
  return {
    labels: labels,
    expenses: expensesByDay,
    income: incomeByDay
  };
}

/**
 * Get recent activity formatted for display
 * @param {number} limit - Number of activities to return
 * @returns {array} - Formatted activity array
 */
function getRecentActivityFormatted(limit = 10) {
  const activities = getRecentActivity(limit);
  
  return activities.map(activity => {
    return {
      timestamp: activity.timestamp,
      relativeTime: getRelativeDateString(new Date(activity.timestamp)),
      description: activity.description,
      user: activity.user,
      userName: activity.user.split('@')[0],
      action: activity.action,
      icon: getActionIcon(activity.action)
    };
  });
}

/**
 * Get icon for action type
 * @param {string} action - Action type
 * @returns {string} - Icon emoji
 */
function getActionIcon(action) {
  const iconMap = {
    'SUBMIT_EXPENSE': '💰',
    'APPROVE_EXPENSE': '✅',
    'REJECT_EXPENSE': '❌',
    'ADD_INCOME': '💵',
    'ADJUST_INVENTORY': '📦',
    'UPDATE_PROJECT': '🎯',
    'CREATE_INVOICE': '📄',
    'WALLET_TRANSACTION': '💳',
    'UPDATE_EMPLOYEE': '👤'
  };
  
  return iconMap[action] || '📝';
}

/**
 * Get pending counts by type
 * @param {string} userEmail - User email
 * @param {string} role - User role
 * @returns {object} - Pending counts
 */
function getPendingCounts(userEmail, role) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const counts = {
    expenses: 0,
    income: 0,
    approvals: 0,
    lowStock: 0
  };
  
  // Count pending expenses
  const expenseSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  if (expenseSheet) {
    const data = expenseSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const status = data[i][EXPENSES_COLS.STATUS];
      const submittedBy = data[i][EXPENSES_COLS.SUBMITTED_BY];
      const amount = parseFloat(data[i][EXPENSES_COLS.AMOUNT]) || 0;
      
      if (status === STATUS.PENDING || status.startsWith('Pending')) {
        // Count as pending for submitter
        if (submittedBy === userEmail) {
          counts.expenses++;
        }
        
        // Count as approval if user can approve
        if (canApproveAmount(userEmail, 'EXPENSE', amount)) {
          counts.approvals++;
        }
      }
    }
  }
  
  // Count low stock items
  const inventorySheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
  if (inventorySheet) {
    const data = inventorySheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const quantity = parseFloat(data[i][INVENTORY_COLS.QUANTITY]) || 0;
      const minStock = parseFloat(data[i][INVENTORY_COLS.MIN_STOCK]) || 0;
      
      if (minStock > 0 && quantity <= minStock) {
        counts.lowStock++;
      }
    }
  }
  
  return counts;
}

/**
 * Get simplified dashboard payload for the frontend UI
 * @returns {object}
 */
function getERPData() {
  try {
    const email = getCurrentUser();
    const role = getUserRole(email);
    const profile = getUserProfile(email);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const dashSheet = ss.getSheetByName('Master_Dashboard');
    let profit = '0';
    if (dashSheet) {
      profit = dashSheet.getRange('I4').getDisplayValue() || '0';
    }

    const projects = getProjectNames();
    const categories = getSettingsCategories();
    const recoveryRaw = getPendingRecoveryDetails(email, role);
    const recoveryList = recoveryRaw.map(item => ({
      name: item.projectName,
      client: item.client,
      pending: Number(item.amount || 0).toLocaleString()
    }));

    const totalRecovery = recoveryList.reduce(
      (sum, item) => sum + (parseFloat(item.pending.replace(/,/g, '')) || 0),
      0
    );

    const pendingCounts = getPendingCounts(email, role);

    return {
      email: email,
      role: role,
      profit: profit,
      wallet: profile ? profile.walletBalance : 0,
      totalRecovery: totalRecovery.toLocaleString(),
      projects: projects,
      categories: categories,
      recoveryList: recoveryList,
      pendingApprovals: pendingCounts.approvals,
      lowStockAlerts: pendingCounts.lowStock
    };

  } catch (error) {
    console.error(`Error in getERPData: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Return list of project names
 * @returns {array}
 */
function getProjectNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectSheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
  if (!projectSheet) return [];
  const rows = projectSheet.getDataRange().getValues();
  return rows.slice(1).map(row => row[PROJECTS_COLS.NAME]).filter(name => !!name);
}

/**
 * Return list of categories from Settings sheet
 * @returns {array}
 */
function getSettingsCategories() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) return [];
  const headers = settingsSheet.getDataRange().getValues()[0] || [];
  return headers.filter(Boolean);
}

/**
 * Get date range label
 * @param {string} period - Period type
 * @param {object} dates - {start, end}
 * @returns {string} - Formatted label
 */
function getDateRangeLabel(period, dates) {
  switch (period) {
    case 'THIS_MONTH':
      return 'This Month';
    case 'LAST_MONTH':
      return 'Last Month';
    case 'THIS_QUARTER':
      return 'This Quarter';
    case 'THIS_YEAR':
      return 'This Year';
    case 'LAST_7_DAYS':
      return 'Last 7 Days';
    case 'LAST_30_DAYS':
      return 'Last 30 Days';
    case 'CUSTOM':
      return formatDateForDisplay(dates.start) + ' - ' + formatDateForDisplay(dates.end);
    default:
      return period;
  }
}

/**
 * Get KPI card data (for clickable cards)
 * @param {string} kpiType - Type of KPI ('expenses', 'income', 'recovery', 'approvals')
 * @param {string} dateRange - Date range
 * @returns {object} - Detailed KPI data
 */
function getKPICardData(kpiType, dateRange = 'THIS_MONTH') {
  try {
    const userEmail = getCurrentUser();
    const role = getUserRole(userEmail);
    const dates = getDateRangeForPeriod(dateRange);
    
    let data = [];
    let total = 0;
    
    switch (kpiType) {
      case 'expenses':
        data = getExpensesForPeriod(dates, userEmail, role);
        total = data.reduce((sum, exp) => sum + exp.amount, 0);
        break;
        
      case 'income':
        data = getIncomeForPeriod(dates, userEmail, role);
        total = data.reduce((sum, inc) => sum + inc.amount, 0);
        break;
        
      case 'recovery':
        data = getPendingRecoveryDetails(userEmail, role);
        total = data.reduce((sum, rec) => sum + rec.amount, 0);
        break;
        
      case 'approvals':
        data = getPendingApprovalsDetailed(userEmail);
        total = data.length;
        break;
    }
    
    return {
      success: true,
      data: {
        type: kpiType,
        total: total,
        items: data,
        count: data.length
      }
    };
    
  } catch (error) {
    console.error(`Error getting KPI card data: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get expenses for period
 * @private
 */
function getExpensesForPeriod(dates, userEmail, role) {
  const result = getExpenses({
    dateRange: 'CUSTOM',
    customStart: dates.start,
    customEnd: dates.end
  });
  
  return result.success ? result.data : [];
}

/**
 * Get income for period
 * @private
 */
function getIncomeForPeriod(dates, userEmail, role) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.INCOME);
  
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const income = [];
  
  for (let i = 1; i < data.length; i++) {
    const incomeDate = new Date(data[i][INCOME_COLS.DATE]);
    
    if (isDateInRange(incomeDate, dates.start, dates.end)) {
      income.push({
        date: incomeDate,
        source: data[i][INCOME_COLS.SOURCE],
        category: data[i][INCOME_COLS.CATEGORY],
        amount: parseFloat(data[i][INCOME_COLS.AMOUNT]) || 0,
        status: data[i][INCOME_COLS.STATUS]
      });
    }
  }
  
  return income;
}

/**
 * Get pending recovery details
 * @private
 */
function getPendingRecoveryDetails(userEmail, role) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
  
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const recovery = [];
  
  for (let i = 1; i < data.length; i++) {
    const pendingAmount = parseFloat(data[i][PROJECTS_COLS.PENDING_RECOVERY]) || 0;
    
    if (pendingAmount > 0) {
      recovery.push({
        projectId: data[i][PROJECTS_COLS.PROJECT_ID],
        projectName: data[i][PROJECTS_COLS.NAME],
        client: data[i][PROJECTS_COLS.CLIENT],
        amount: pendingAmount,
        status: data[i][PROJECTS_COLS.STATUS]
      });
    }
  }
  
  return recovery;
}

/**
 * Get detailed pending approvals
 * @private
 */
function getPendingApprovalsDetailed(userEmail) {
  const result = getPendingApprovals();
  return result.success ? result.data : [];
}
