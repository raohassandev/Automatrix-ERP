// ============================================================================
// AUTHENTICATION & AUTHORIZATION
// ============================================================================
// User authentication and session management
// ============================================================================

/**
 * Get current user email
 * @returns {string} - Current user's email
 */
function getCurrentUser() {
  return Session.getActiveUser().getEmail();
}

/**
 * Get user role from Employees sheet
 * @param {string} email - User email (optional, defaults to current user)
 * @returns {string} - User role
 */
function getUserRole(email) {
  try {
    if (!email) {
      email = getCurrentUser();
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    
    if (!empSheet) {
      console.error('Employees sheet not found');
      return ROLES.STAFF;
    }
    
    const empData = empSheet.getDataRange().getValues();
    
    for (let i = 1; i < empData.length; i++) {
      if (empData[i][EMPLOYEES_COLS.EMAIL] === email) {
        return empData[i][EMPLOYEES_COLS.ROLE] || ROLES.STAFF;
      }
    }
    
    console.warn(`User not found in Employees sheet: ${email}`);
    return ROLES.GUEST;
    
  } catch (error) {
    console.error(`Error getting user role: ${error.message}`);
    return ROLES.STAFF;
  }
}

/**
 * Get user profile information
 * @param {string} email - User email (optional, defaults to current user)
 * @returns {object} - User profile object
 */
function getUserProfile(email) {
  try {
    if (!email) {
      email = getCurrentUser();
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    
    if (!empSheet) {
      return null;
    }
    
    const empData = empSheet.getDataRange().getValues();
    
    for (let i = 1; i < empData.length; i++) {
      if (empData[i][EMPLOYEES_COLS.EMAIL] === email) {
        return {
          email: empData[i][EMPLOYEES_COLS.EMAIL],
          name: empData[i][EMPLOYEES_COLS.NAME],
          phone: empData[i][EMPLOYEES_COLS.PHONE],
          role: empData[i][EMPLOYEES_COLS.ROLE],
          walletBalance: empData[i][EMPLOYEES_COLS.WALLET_BALANCE] || 0,
          status: empData[i][EMPLOYEES_COLS.STATUS],
          rowIndex: i + 1
        };
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`Error getting user profile: ${error.message}`);
    return null;
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean} - True if user is authenticated
 */
function isAuthenticated() {
  try {
    const email = getCurrentUser();
    return email && email.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Check if user is admin (CEO or Owner)
 * @param {string} email - User email (optional)
 * @returns {boolean} - True if user is admin
 */
function isAdmin(email) {
  const role = getUserRole(email);
  return role === ROLES.CEO || role === ROLES.OWNER;
}

/**
 * Get user's accessible menu items based on role
 * @returns {array} - Array of menu items user can access
 */
function getUserMenu() {
  const email = getCurrentUser();
  const role = getUserRole(email);
  const pages = getAccessiblePages(email);
  
  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'expenses', label: 'Expenses', icon: '💰' },
    { id: 'income', label: 'Income', icon: '💵' },
    { id: 'approvals', label: 'Approvals', icon: '✅' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'projects', label: 'Projects', icon: '🎯' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'employees', label: 'Employees', icon: '👥' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];
  
  return allMenuItems.filter(item => pages.includes(item.id));
}

/**
 * Initialize session data for frontend
 * @returns {object} - Session data object
 */
function initializeSession() {
  try {
    const email = getCurrentUser();
    const profile = getUserProfile(email);
    const role = getUserRole(email);
    const menu = getUserMenu();
    
    return {
      authenticated: true,
      user: {
        email: email,
        name: profile ? profile.name : email.split('@')[0],
        role: role,
        walletBalance: profile ? profile.walletBalance : 0
      },
      menu: menu,
      permissions: PERMISSIONS[role] || [],
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error initializing session: ${error.message}`);
    return {
      authenticated: false,
      error: error.message
    };
  }
}
