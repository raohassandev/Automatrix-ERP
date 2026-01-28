// ============================================================================
// ROLE-BASED ACCESS CONTROL (RBAC)
// ============================================================================
// Defines permissions for different roles and checks access rights
// ============================================================================

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

const ROLES = {
  CEO: 'CEO',
  OWNER: 'Owner',
  FINANCE_MANAGER: 'Finance Manager',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  GUEST: 'Guest'
};

// ============================================================================
// PERMISSION MATRIX
// ============================================================================

/**
 * Define permissions for each role
 * Permissions are in format: module.action or * for all
 */
const PERMISSIONS = {
  'CEO': ['*'], // Full access to everything
  
  'Owner': ['*'], // Full access to everything
  
  'Finance Manager': [
    // Dashboard
    'dashboard.view',
    'dashboard.view_all_metrics',
    
    // Expenses
    'expenses.view_all',
    'expenses.approve_high',
    'expenses.approve_medium',
    'expenses.approve_low',
    'expenses.reject',
    'expenses.edit',
    
    // Income
    'income.view_all',
    'income.add',
    'income.edit',
    'income.approve_high',
    'income.approve_low',
    
    // Approvals
    'approvals.view_all',
    'approvals.approve_high',
    'approvals.partial_approve',
    
    // Inventory
    'inventory.view',
    'inventory.adjust',
    'inventory.approve_adjustment',
    
    // Projects
    'projects.view_all',
    'projects.edit',
    'projects.view_financials',
    
    // Invoices
    'invoices.view_all',
    'invoices.create',
    'invoices.edit',
    
    // Reports
    'reports.view_all',
    'reports.export',
    
    // Employees
    'employees.view_all',
    'employees.edit_wallet'
  ],
  
  'Manager': [
    // Dashboard
    'dashboard.view',
    'dashboard.view_team_metrics',
    
    // Expenses
    'expenses.view_all',
    'expenses.submit',
    'expenses.approve_low',
    'expenses.reject',
    
    // Income
    'income.view_all',
    'income.add',
    
    // Approvals
    'approvals.view_pending',
    'approvals.approve_low',
    
    // Inventory
    'inventory.view',
    'inventory.request',
    
    // Projects
    'projects.view_all',
    'projects.view_assigned',
    'projects.update_status',
    
    // Reports
    'reports.view_team',
    
    // Employees
    'employees.view_team'
  ],
  
  'Staff': [
    // Dashboard
    'dashboard.view',
    'dashboard.view_own_metrics',
    
    // Expenses
    'expenses.view_own',
    'expenses.submit',
    
    // Income
    'income.view_own',
    
    // Inventory
    'inventory.view',
    'inventory.request',
    
    // Projects
    'projects.view_assigned',
    
    // Reports
    'reports.view_own',
    
    // Employees
    'employees.view_own'
  ],
  
  'Guest': [
    'dashboard.view',
    'dashboard.view_limited'
  ]
};

// ============================================================================
// PERMISSION CHECK FUNCTIONS
// ============================================================================

/**
 * Check if user has a specific permission
 * @param {string} userEmail - User's email address
 * @param {string} permission - Permission to check (e.g., 'expenses.approve_high')
 * @returns {boolean} - True if user has permission
 */
function hasPermission(userEmail, permission) {
  try {
    const role = getUserRole(userEmail);
    
    if (!role || !PERMISSIONS[role]) {
      console.error(`Role not found for user: ${userEmail}`);
      return false;
    }
    
    const userPermissions = PERMISSIONS[role];
    
    // Check for wildcard permission
    if (userPermissions.includes('*')) {
      return true;
    }
    
    // Check for exact permission match
    if (userPermissions.includes(permission)) {
      return true;
    }
    
    // Check for module-level wildcard (e.g., 'expenses.*')
    const module = permission.split('.')[0];
    if (userPermissions.includes(`${module}.*`)) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking permission: ${error.message}`);
    return false;
  }
}

/**
 * Check if user can approve at a specific level
 * @param {string} userEmail - User's email address
 * @param {string} type - Type of approval ('EXPENSE' or 'INCOME')
 * @param {number} amount - Amount to be approved
 * @returns {boolean} - True if user can approve this amount
 */
function canApproveAmount(userEmail, type, amount) {
  try {
    const role = getUserRole(userEmail);
    const levels = APPROVAL_LEVELS[type];
    
    if (!levels) {
      console.error(`Invalid approval type: ${type}`);
      return false;
    }
    
    // Find the required approval level for this amount
    let requiredLevel = null;
    for (const level of levels) {
      if (amount <= level.max) {
        requiredLevel = level;
        break;
      }
    }
    
    if (!requiredLevel) {
      return false;
    }
    
    // Check if user's role matches the required role
    if (role === requiredLevel.role || role === 'CEO' || role === 'Owner') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking approval permission: ${error.message}`);
    return false;
  }
}

/**
 * Get required approval level for an amount
 * @param {string} type - Type of approval ('EXPENSE' or 'INCOME')
 * @param {number} amount - Amount to check
 * @returns {object} - Approval level object {level, role, max}
 */
function getRequiredApprovalLevel(type, amount) {
  const levels = APPROVAL_LEVELS[type];
  
  if (!levels) {
    return null;
  }
  
  for (const level of levels) {
    if (amount <= level.max) {
      return level;
    }
  }
  
  return levels[levels.length - 1]; // Return highest level as fallback
}

/**
 * Check if user can view resource
 * @param {string} userEmail - User's email address
 * @param {string} resourceType - Type of resource (expenses, income, etc.)
 * @param {object} resource - Resource object with owner/submitter info
 * @returns {boolean} - True if user can view
 */
function canViewResource(userEmail, resourceType, resource) {
  try {
    const role = getUserRole(userEmail);
    
    // CEO and Owner can view everything
    if (role === 'CEO' || role === 'Owner') {
      return true;
    }
    
    // Finance Manager can view all financial resources
    if (role === 'Finance Manager' && 
        ['expenses', 'income', 'projects', 'invoices'].includes(resourceType)) {
      return true;
    }
    
    // Manager can view team resources
    if (role === 'Manager') {
      // Check if resource belongs to team member
      // This would require team/department mapping - simplified for now
      return true;
    }
    
    // Staff can only view their own resources
    if (resource.submittedBy === userEmail || 
        resource.addedBy === userEmail ||
        resource.owner === userEmail) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking view permission: ${error.message}`);
    return false;
  }
}

/**
 * Check if user can edit resource
 * @param {string} userEmail - User's email address
 * @param {string} resourceType - Type of resource
 * @param {object} resource - Resource object
 * @returns {boolean} - True if user can edit
 */
function canEditResource(userEmail, resourceType, resource) {
  try {
    const role = getUserRole(userEmail);
    
    // CEO and Owner can edit everything
    if (role === 'CEO' || role === 'Owner') {
      return true;
    }
    
    // Finance Manager can edit financial resources
    if (role === 'Finance Manager' && 
        hasPermission(userEmail, `${resourceType}.edit`)) {
      return true;
    }
    
    // Owner can edit their own pending submissions
    if ((resource.submittedBy === userEmail || resource.addedBy === userEmail) &&
        resource.status === STATUS.PENDING) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking edit permission: ${error.message}`);
    return false;
  }
}

/**
 * Get accessible pages for user based on role
 * @param {string} userEmail - User's email address
 * @returns {array} - List of page IDs user can access
 */
function getAccessiblePages(userEmail) {
  const role = getUserRole(userEmail);
  
  const allPages = ['dashboard', 'expenses', 'income', 'approvals', 'inventory', 
                    'projects', 'reports', 'employees', 'settings'];
  
  if (role === 'CEO' || role === 'Owner') {
    return allPages;
  }
  
  if (role === 'Finance Manager') {
    return ['dashboard', 'expenses', 'income', 'approvals', 'inventory', 
            'projects', 'reports', 'employees'];
  }
  
  if (role === 'Manager') {
    return ['dashboard', 'expenses', 'income', 'approvals', 'inventory', 
            'projects', 'reports'];
  }
  
  if (role === 'Staff') {
    return ['dashboard', 'expenses', 'inventory', 'projects'];
  }
  
  return ['dashboard'];
}

/**
 * Require permission - throws error if user doesn't have permission
 * @param {string} userEmail - User's email address
 * @param {string} permission - Required permission
 * @throws {Error} - If user doesn't have permission
 */
function requirePermission(userEmail, permission) {
  if (!hasPermission(userEmail, permission)) {
    const role = getUserRole(userEmail);
    throw new Error(`Access denied: ${role} role does not have permission '${permission}'`);
  }
}
