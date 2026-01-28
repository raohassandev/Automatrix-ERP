// ============================================================================
// DATA MIGRATION SCRIPT
// ============================================================================
// Import data from old Expanse.xlsx to new AutoMatrix ERP sheets
// ============================================================================

/**
 * INSTRUCTIONS:
 * 1. Open your old Expanse.xlsx file
 * 2. Copy data from each sheet
 * 3. In your new AutoMatrix ERP Google Sheet:
 *    - Open script editor (Extensions → Apps Script)
 *    - Copy this file content
 *    - Run importOldData() function
 * 
 * OR use the helper functions below to import data sheet by sheet
 */

/**
 * Import expenses from old sheet
 * Assumes old data is in sheet named "OldExpenses"
 */
function importExpensesFromOld() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get old data sheet (rename your imported sheet to "OldExpenses")
    const oldSheet = ss.getSheetByName('OldExpenses');
    if (!oldSheet) {
      throw new Error('Sheet "OldExpenses" not found. Please import your old expense data and rename the sheet to "OldExpenses"');
    }
    
    // Get new expenses sheet
    const newSheet = ss.getSheetByName('Expenses');
    if (!newSheet) {
      throw new Error('Expenses sheet not found. Run initializeSystem() first.');
    }
    
    const oldData = oldSheet.getDataRange().getValues();
    
    // Skip header row, start from row 1 (assuming row 0 is header)
    for (let i = 1; i < oldData.length; i++) {
      const row = oldData[i];
      
      // Map your old columns to new format
      // Adjust indices based on your old sheet structure
      const newRow = [
        row[0] || new Date(),           // Date
        row[1] || '',                   // Description
        row[2] || 'Uncategorized',      // Category
        parseFloat(row[3]) || 0,        // Amount
        row[4] || 'Cash',               // Payment Mode
        row[5] || '',                   // Project
        row[6] || getCurrentUser(),     // Submitted By
        row[7] || 'Approved',           // Status
        row[8] || '',                   // Approved By
        row[9] || '',                   // Approved Date
        '',                             // Rejection Reason
        '',                             // Receipt File ID
        '',                             // Receipt URL
        '',                             // Approval Level
        parseFloat(row[3]) || 0,        // Approved Amount
        'Valid'                         // Validation Status
      ];
      
      newSheet.appendRow(newRow);
    }
    
    Logger.log(`Imported ${oldData.length - 1} expense records`);
    return `Successfully imported ${oldData.length - 1} expenses`;
    
  } catch (error) {
    Logger.log(`Error importing expenses: ${error.message}`);
    throw error;
  }
}

/**
 * Import income from old sheet
 * Assumes old data is in sheet named "OldIncome"
 */
function importIncomeFromOld() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const oldSheet = ss.getSheetByName('OldIncome');
    if (!oldSheet) {
      throw new Error('Sheet "OldIncome" not found');
    }
    
    const newSheet = ss.getSheetByName('Income');
    if (!newSheet) {
      throw new Error('Income sheet not found');
    }
    
    const oldData = oldSheet.getDataRange().getValues();
    
    for (let i = 1; i < oldData.length; i++) {
      const row = oldData[i];
      
      const newRow = [
        row[0] || new Date(),           // Date
        row[1] || '',                   // Source
        row[2] || 'Other',              // Category
        parseFloat(row[3]) || 0,        // Amount
        row[4] || 'Bank',               // Payment Mode
        row[5] || '',                   // Project
        row[6] || getCurrentUser(),     // Added By
        'Approved',                     // Status
        getCurrentUser(),               // Approved By
        new Date(),                     // Approved Date
        '',                             // Receipt File ID
        '',                             // Receipt URL
        '',                             // Invoice ID
        ''                              // Approval Level
      ];
      
      newSheet.appendRow(newRow);
    }
    
    Logger.log(`Imported ${oldData.length - 1} income records`);
    return `Successfully imported ${oldData.length - 1} income entries`;
    
  } catch (error) {
    Logger.log(`Error importing income: ${error.message}`);
    throw error;
  }
}

/**
 * Import employees from old sheet
 */
function importEmployeesFromOld() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const oldSheet = ss.getSheetByName('OldEmployees');
    if (!oldSheet) {
      throw new Error('Sheet "OldEmployees" not found');
    }
    
    const newSheet = ss.getSheetByName('Employees');
    if (!newSheet) {
      throw new Error('Employees sheet not found');
    }
    
    const oldData = oldSheet.getDataRange().getValues();
    
    for (let i = 1; i < oldData.length; i++) {
      const row = oldData[i];
      
      const newRow = [
        row[0] || '',                   // Email
        row[1] || '',                   // Name
        row[2] || '',                   // Phone
        row[3] || 'Staff',              // Role
        parseFloat(row[4]) || 0,        // Wallet Balance
        row[5] || 'Active'              // Status
      ];
      
      newSheet.appendRow(newRow);
    }
    
    Logger.log(`Imported ${oldData.length - 1} employee records`);
    return `Successfully imported ${oldData.length - 1} employees`;
    
  } catch (error) {
    Logger.log(`Error importing employees: ${error.message}`);
    throw error;
  }
}

/**
 * Import inventory from old sheet
 */
function importInventoryFromOld() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const oldSheet = ss.getSheetByName('OldInventory');
    if (!oldSheet) {
      throw new Error('Sheet "OldInventory" not found');
    }
    
    const newSheet = ss.getSheetByName('Inventory');
    if (!newSheet) {
      throw new Error('Inventory sheet not found');
    }
    
    const oldData = oldSheet.getDataRange().getValues();
    
    for (let i = 1; i < oldData.length; i++) {
      const row = oldData[i];
      
      const quantity = parseFloat(row[2]) || 0;
      const unitCost = parseFloat(row[4]) || 0;
      
      const newRow = [
        row[0] || '',                   // Item Name
        row[1] || '',                   // Category
        quantity,                       // Quantity
        row[3] || 'pcs',                // Unit
        unitCost,                       // Unit Cost
        quantity * unitCost,            // Total Value
        0,                              // Min Stock
        0,                              // Reorder Qty
        0,                              // Reserved Qty
        quantity,                       // Available Qty
        '',                             // Last Purchase Date
        0,                              // Avg Usage 30 Days
        new Date()                      // Last Updated
      ];
      
      newSheet.appendRow(newRow);
    }
    
    Logger.log(`Imported ${oldData.length - 1} inventory items`);
    return `Successfully imported ${oldData.length - 1} inventory items`;
    
  } catch (error) {
    Logger.log(`Error importing inventory: ${error.message}`);
    throw error;
  }
}

/**
 * Import projects from old sheet
 */
function importProjectsFromOld() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const oldSheet = ss.getSheetByName('OldProjects');
    if (!oldSheet) {
      throw new Error('Sheet "OldProjects" not found');
    }
    
    const newSheet = ss.getSheetByName('Projects');
    if (!newSheet) {
      throw new Error('Projects sheet not found');
    }
    
    const oldData = oldSheet.getDataRange().getValues();
    
    for (let i = 1; i < oldData.length; i++) {
      const row = oldData[i];
      
      const newRow = [
        row[0] || `PRJ-${i}`,           // Project ID
        row[1] || '',                   // Name
        row[2] || '',                   // Client
        row[3] || new Date(),           // Start Date
        row[4] || '',                   // End Date
        row[5] || 'In Progress',        // Status
        parseFloat(row[6]) || 0,        // Contract Value
        0,                              // Invoiced Amount
        0,                              // Received Amount
        0,                              // Pending Recovery
        0,                              // Cost to Date
        0,                              // Gross Margin
        0                               // Margin Percent
      ];
      
      newSheet.appendRow(newRow);
    }
    
    Logger.log(`Imported ${oldData.length - 1} projects`);
    return `Successfully imported ${oldData.length - 1} projects`;
    
  } catch (error) {
    Logger.log(`Error importing projects: ${error.message}`);
    throw error;
  }
}

/**
 * Main import function - runs all imports
 */
function importAllOldData() {
  try {
    const results = [];
    
    // Try to import each type
    try {
      results.push(importExpensesFromOld());
    } catch (e) {
      results.push(`Expenses: ${e.message}`);
    }
    
    try {
      results.push(importIncomeFromOld());
    } catch (e) {
      results.push(`Income: ${e.message}`);
    }
    
    try {
      results.push(importEmployeesFromOld());
    } catch (e) {
      results.push(`Employees: ${e.message}`);
    }
    
    try {
      results.push(importInventoryFromOld());
    } catch (e) {
      results.push(`Inventory: ${e.message}`);
    }
    
    try {
      results.push(importProjectsFromOld());
    } catch (e) {
      results.push(`Projects: ${e.message}`);
    }
    
    Logger.log('Import completed:');
    results.forEach(r => Logger.log(r));
    
    return results.join('\n');
    
  } catch (error) {
    Logger.log(`Error in main import: ${error.message}`);
    throw error;
  }
}

/**
 * Get current user email
 */
function getCurrentUser() {
  return Session.getActiveUser().getEmail();
}
