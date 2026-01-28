// ============================================================================
// OLD EXPANSE.XLSX DATA MIGRATION SCRIPT
// ============================================================================
// This script copies data from your old Expanse.xlsx (uploaded to Google Sheets)
// and marks it as "OBSOLETE [MIGRATED]" to distinguish old vs new data
// ============================================================================

/**
 * INSTRUCTIONS:
 * 
 * 1. Upload Expanse.xlsx to Google Drive
 * 2. Open it with Google Sheets
 * 3. In your NEW AutoMatrix ERP sheet:
 *    - Extensions → Apps Script
 *    - Create new file: MigrateOldData
 *    - Paste this code
 * 4. Update OLD_SHEET_ID below with your old sheet ID
 * 5. Run: migrateAllOldData()
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Get this from your old Expanse sheet URL:
// https://docs.google.com/spreadsheets/d/1Zj_LRy_2zNikIr3YAvd03N-481x1ohkmgimKiM21fCI/edit
const OLD_SHEET_ID = '1Zj_LRy_2zNikIr3YAvd03N-481x1ohkmgimKiM21fCI';

// Your email to use as default user
const DEFAULT_USER_EMAIL = 'israrulhaq5@gmail.com';

// ============================================================================
// MAIN MIGRATION FUNCTION
// ============================================================================

/**
 * Migrate all data from old Expanse.xlsx
 * Marks old data with special prefix to identify it
 */
function migrateAllOldData() {
  try {
    Logger.log('='.repeat(80));
    Logger.log('STARTING MIGRATION FROM OLD EXPANSE.XLSX');
    Logger.log('='.repeat(80));
    
    const results = {
      employees: 0,
      expenses: 0,
      income: 0,
      inventory: 0,
      projects: 0,
      wallet: 0
    };
    
    // Open old spreadsheet
    const oldSS = SpreadsheetApp.openById(OLD_SHEET_ID);
    const newSS = SpreadsheetApp.getActiveSpreadsheet();
    
    Logger.log(`Old sheet: ${oldSS.getName()}`);
    Logger.log(`New sheet: ${newSS.getName()}`);
    Logger.log('');
    
    // Migrate each sheet
    results.employees = migrateEmployees(oldSS, newSS);
    results.expenses = migrateExpenses(oldSS, newSS);
    results.income = migrateIncome(oldSS, newSS);
    results.inventory = migrateInventory(oldSS, newSS);
    results.projects = migrateProjects(oldSS, newSS);
    results.wallet = migrateWallet(oldSS, newSS);
    
    // Print summary
    Logger.log('');
    Logger.log('='.repeat(80));
    Logger.log('MIGRATION COMPLETED');
    Logger.log('='.repeat(80));
    Logger.log(`Employees:  ${results.employees} records`);
    Logger.log(`Expenses:   ${results.expenses} records`);
    Logger.log(`Income:     ${results.income} records`);
    Logger.log(`Inventory:  ${results.inventory} records`);
    Logger.log(`Projects:   ${results.projects} records`);
    Logger.log(`Wallet:     ${results.wallet} records`);
    Logger.log('='.repeat(80));
    
    return `Migration completed!\n${JSON.stringify(results, null, 2)}`;
    
  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// MIGRATE EMPLOYEES
// ============================================================================

function migrateEmployees(oldSS, newSS) {
  try {
    Logger.log('Migrating Employees...');
    
    const oldSheet = oldSS.getSheetByName('Employees');
    if (!oldSheet) {
      Logger.log('  ⚠️  No Employees sheet found in old file');
      return 0;
    }
    
    const newSheet = newSS.getSheetByName('Employees');
    if (!newSheet) {
      Logger.log('  ❌ Employees sheet not found in new file. Run initializeSystem() first.');
      return 0;
    }
    
    const data = oldSheet.getDataRange().getValues();
    let count = 0;
    
    // Skip header (row 0), start from row 1
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows
      if (!row[0]) continue;
      
      // Map old data to new format
      const newRow = [
        row[0] || DEFAULT_USER_EMAIL,   // Email
        row[1] || 'Unknown',             // Name
        row[2] || '',                    // Phone
        row[3] || 'Staff',               // Role
        parseFloat(row[4]) || 0,         // Wallet Balance
        'Active'                         // Status
      ];
      
      newSheet.appendRow(newRow);
      count++;
    }
    
    Logger.log(`  ✅ Migrated ${count} employees`);
    return count;
    
  } catch (error) {
    Logger.log(`  ❌ Error migrating employees: ${error.message}`);
    return 0;
  }
}

// ============================================================================
// MIGRATE EXPENSES
// ============================================================================

function migrateExpenses(oldSS, newSS) {
  try {
    Logger.log('Migrating Expenses...');
    
    const oldSheet = oldSS.getSheetByName('Expenses');
    if (!oldSheet) {
      Logger.log('  ⚠️  No Expenses sheet found in old file');
      return 0;
    }
    
    const newSheet = newSS.getSheetByName('Expenses');
    if (!newSheet) {
      Logger.log('  ❌ Expenses sheet not found in new file');
      return 0;
    }
    
    const data = oldSheet.getDataRange().getValues();
    let count = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (!row[0]) continue;
      
      // Mark as obsolete in description
      const description = row[1] ? `[MIGRATED] ${row[1]}` : '[MIGRATED] Old expense';
      
      const newRow = [
        row[0] || new Date(),                    // Date
        description,                              // Description (marked)
        row[2] || 'Uncategorized',               // Category
        parseFloat(row[3]) || 0,                 // Amount
        row[4] || 'Cash',                        // Payment Mode
        row[5] || '',                            // Project
        row[6] || DEFAULT_USER_EMAIL,            // Submitted By
        'Approved',                              // Status (mark old as approved)
        DEFAULT_USER_EMAIL,                      // Approved By
        row[0] || new Date(),                    // Approved Date
        '',                                      // Rejection Reason
        '',                                      // Receipt File ID
        '',                                      // Receipt URL
        'L1',                                    // Approval Level
        parseFloat(row[3]) || 0,                 // Approved Amount
        'Migrated'                               // Validation Status
      ];
      
      newSheet.appendRow(newRow);
      count++;
    }
    
    Logger.log(`  ✅ Migrated ${count} expenses (marked as [MIGRATED])`);
    return count;
    
  } catch (error) {
    Logger.log(`  ❌ Error migrating expenses: ${error.message}`);
    return 0;
  }
}

// ============================================================================
// MIGRATE INCOME
// ============================================================================

function migrateIncome(oldSS, newSS) {
  try {
    Logger.log('Migrating Income...');
    
    const oldSheet = oldSS.getSheetByName('Income');
    if (!oldSheet) {
      Logger.log('  ⚠️  No Income sheet found in old file');
      return 0;
    }
    
    const newSheet = newSS.getSheetByName('Income');
    if (!newSheet) {
      Logger.log('  ❌ Income sheet not found in new file');
      return 0;
    }
    
    const data = oldSheet.getDataRange().getValues();
    let count = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (!row[0]) continue;
      
      const source = row[1] ? `[MIGRATED] ${row[1]}` : '[MIGRATED] Old income';
      
      const newRow = [
        row[0] || new Date(),                    // Date
        source,                                   // Source (marked)
        row[2] || 'Other',                       // Category
        parseFloat(row[3]) || 0,                 // Amount
        row[4] || 'Bank',                        // Payment Mode
        row[5] || '',                            // Project
        row[6] || DEFAULT_USER_EMAIL,            // Added By
        'Approved',                              // Status
        DEFAULT_USER_EMAIL,                      // Approved By
        row[0] || new Date(),                    // Approved Date
        '',                                      // Receipt File ID
        '',                                      // Receipt URL
        '',                                      // Invoice ID
        'L1'                                     // Approval Level
      ];
      
      newSheet.appendRow(newRow);
      count++;
    }
    
    Logger.log(`  ✅ Migrated ${count} income entries (marked as [MIGRATED])`);
    return count;
    
  } catch (error) {
    Logger.log(`  ❌ Error migrating income: ${error.message}`);
    return 0;
  }
}

// ============================================================================
// MIGRATE INVENTORY
// ============================================================================

function migrateInventory(oldSS, newSS) {
  try {
    Logger.log('Migrating Inventory...');
    
    const oldSheet = oldSS.getSheetByName('Inventory') || oldSS.getSheetByName('Stock');
    if (!oldSheet) {
      Logger.log('  ⚠️  No Inventory/Stock sheet found in old file');
      return 0;
    }
    
    const newSheet = newSS.getSheetByName('Inventory');
    if (!newSheet) {
      Logger.log('  ❌ Inventory sheet not found in new file');
      return 0;
    }
    
    const data = oldSheet.getDataRange().getValues();
    let count = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (!row[0]) continue;
      
      const quantity = parseFloat(row[2]) || 0;
      const unitCost = parseFloat(row[4]) || parseFloat(row[3]) || 0;
      
      const newRow = [
        row[0] || '',                            // Item Name
        row[1] || 'General',                     // Category
        quantity,                                // Quantity
        row[3] || 'pcs',                         // Unit
        unitCost,                                // Unit Cost
        quantity * unitCost,                     // Total Value
        0,                                       // Min Stock
        0,                                       // Reorder Qty
        0,                                       // Reserved Qty
        quantity,                                // Available Qty
        '',                                      // Last Purchase Date
        0,                                       // Avg Usage 30 Days
        new Date()                               // Last Updated
      ];
      
      newSheet.appendRow(newRow);
      count++;
    }
    
    Logger.log(`  ✅ Migrated ${count} inventory items`);
    return count;
    
  } catch (error) {
    Logger.log(`  ❌ Error migrating inventory: ${error.message}`);
    return 0;
  }
}

// ============================================================================
// MIGRATE PROJECTS
// ============================================================================

function migrateProjects(oldSS, newSS) {
  try {
    Logger.log('Migrating Projects...');
    
    const oldSheet = oldSS.getSheetByName('Projects');
    if (!oldSheet) {
      Logger.log('  ⚠️  No Projects sheet found in old file');
      return 0;
    }
    
    const newSheet = newSS.getSheetByName('Projects');
    if (!newSheet) {
      Logger.log('  ❌ Projects sheet not found in new file');
      return 0;
    }
    
    const data = oldSheet.getDataRange().getValues();
    let count = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (!row[0] && !row[1]) continue;
      
      const newRow = [
        row[0] || `PRJ-OLD-${i}`,               // Project ID
        row[1] || 'Unnamed Project',            // Name
        row[2] || '',                           // Client
        row[3] || new Date(),                   // Start Date
        row[4] || '',                           // End Date
        row[5] || 'Completed',                  // Status (mark old as completed)
        parseFloat(row[6]) || 0,                // Contract Value
        0,                                      // Invoiced Amount
        0,                                      // Received Amount
        0,                                      // Pending Recovery
        0,                                      // Cost to Date
        0,                                      // Gross Margin
        0                                       // Margin Percent
      ];
      
      newSheet.appendRow(newRow);
      count++;
    }
    
    Logger.log(`  ✅ Migrated ${count} projects`);
    return count;
    
  } catch (error) {
    Logger.log(`  ❌ Error migrating projects: ${error.message}`);
    return 0;
  }
}

// ============================================================================
// MIGRATE WALLET
// ============================================================================

function migrateWallet(oldSS, newSS) {
  try {
    Logger.log('Migrating Wallet...');
    
    const oldSheet = oldSS.getSheetByName('Wallet');
    if (!oldSheet) {
      Logger.log('  ⚠️  No Wallet sheet found in old file');
      return 0;
    }
    
    const newSheet = newSS.getSheetByName('Wallet');
    if (!newSheet) {
      Logger.log('  ❌ Wallet sheet not found in new file');
      return 0;
    }
    
    const data = oldSheet.getDataRange().getValues();
    let count = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (!row[0]) continue;
      
      const newRow = [
        row[0] || new Date(),                   // Date
        row[1] || DEFAULT_USER_EMAIL,           // Employee
        row[2] || 'CREDIT',                     // Type
        parseFloat(row[3]) || 0,                // Amount
        `[MIGRATED] ${row[4] || 'Old entry'}`,  // Reference (marked)
        parseFloat(row[5]) || 0                 // Balance
      ];
      
      newSheet.appendRow(newRow);
      count++;
    }
    
    Logger.log(`  ✅ Migrated ${count} wallet transactions`);
    return count;
    
  } catch (error) {
    Logger.log(`  ❌ Error migrating wallet: ${error.message}`);
    return 0;
  }
}

// ============================================================================
// HELPER: Test connection to old sheet
// ============================================================================

function testOldSheetConnection() {
  try {
    const oldSS = SpreadsheetApp.openById(OLD_SHEET_ID);
    Logger.log(`✅ Connected to: ${oldSS.getName()}`);
    Logger.log(`Sheets available: ${oldSS.getSheets().map(s => s.getName()).join(', ')}`);
    return true;
  } catch (error) {
    Logger.log(`❌ Cannot connect: ${error.message}`);
    Logger.log('Please check OLD_SHEET_ID in the script configuration');
    return false;
  }
}
