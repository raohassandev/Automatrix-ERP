# Agent SOP - Google Apps Script Development

## Standard Operating Procedures for AI Agent - Automatrix ERP (Apps Script)

**Project:** Automatrix Enterprise ERP Enhancement  
**Platform:** Google Sheets + Apps Script  
**Purpose:** Guide AI agents in developing the Apps Script ERP system  
**Last Updated:** January 26, 2026

---

## TABLE OF CONTENTS

1. [Apps Script Fundamentals](#1-apps-script-fundamentals)
2. [Development Environment Setup](#2-development-environment-setup)
3. [Code Organization](#3-code-organization)
4. [Apps Script Best Practices](#4-apps-script-best-practices)
5. [Sheet Operations](#5-sheet-operations)
6. [HTML Service & UI](#6-html-service--ui)
7. [Business Logic Implementation](#7-business-logic-implementation)
8. [Security & Permissions](#8-security--permissions)
9. [Testing & Debugging](#9-testing--debugging)
10. [Deployment Procedures](#10-deployment-procedures)
11. [Common Patterns](#11-common-patterns)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. APPS SCRIPT FUNDAMENTALS

### 1.1 Core Concepts

**Apps Script is JavaScript** with Google services:
- Runs on Google servers (not client-side)
- 6-minute execution timeout per function
- Integrated with Google Workspace (Sheets, Drive, Gmail)
- Free hosting and scaling

**Key Services:**
- `SpreadsheetApp` - Access Google Sheets
- `DriveApp` - Access Google Drive
- `Session` - Get current user info
- `HtmlService` - Serve web pages
- `Utilities` - Helper functions (base64, crypto, etc.)

### 1.2 Execution Model

```javascript
// Server-side function (runs on Google servers)
function getData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = ss.getSheetByName('Projects').getDataRange().getValues();
  return data; // Can return to client
}

// Client-side call (from HTML)
<script>
  google.script.run
    .withSuccessHandler(function(data) {
      console.log(data); // Data returned from server
    })
    .withFailureHandler(function(error) {
      console.error(error);
    })
    .getData(); // Calls server function
</script>
```

### 1.3 Project Structure

```
Apps Script Project
├── Code.gs (server-side JavaScript)
├── Index.html (client-side HTML)
├── Stylesheet.html (CSS)
├── JavaScript.html (client-side JS)
└── appsscript.json (manifest)
```

---

## 2. DEVELOPMENT ENVIRONMENT SETUP

### 2.1 clasp Setup (RECOMMENDED)

```bash
# Install clasp globally
npm install -g @google/clasp

# Login to Google
clasp login

# Clone existing project
# Get SCRIPT_ID from: Script Editor > Project Settings > Script ID
clasp clone YOUR_SCRIPT_ID

# Project files will be downloaded to current directory
```

### 2.2 Local Project Structure

```
/automatrix-appscript
├── .clasp.json              # clasp configuration
├── appsscript.json          # Apps Script manifest
├── .gitignore
├── README.md
├── src/
│   ├── server/
│   │   ├── main.gs
│   │   ├── projects.gs
│   │   ├── transactions.gs
│   │   ├── income.gs
│   │   ├── inventory.gs
│   │   ├── payroll.gs
│   │   └── utils.gs
│   └── client/
│       ├── Index.html
│       ├── Styles.html
│       └── Scripts.html
└── package.json
```

### 2.3 Git Setup

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

**`.gitignore`:**
```
.clasp.json
node_modules/
.DS_Store
*.log
```

### 2.4 Development Workflow

```bash
# Make changes locally in VS Code
# Push to Apps Script
clasp push

# Or enable auto-push on save
clasp push --watch

# Open in browser to test
clasp open

# View execution logs
clasp logs
```

---

## 3. CODE ORGANIZATION

### 3.1 File Naming Conventions

```
Server-side (*.gs):
- main.gs          - Entry points (doGet, include)
- projects.gs      - Project-related functions
- transactions.gs  - Transaction operations
- income.gs        - Income logging
- inventory.gs     - Inventory management
- payroll.gs       - Payroll processing
- clients.gs       - Client management
- reports.gs       - Report generation
- utils.gs         - Helper functions

Client-side (*.html):
- Index.html       - Main HTML structure
- Styles.html      - CSS styles
- Scripts.html     - JavaScript code
```

### 3.2 Function Organization

```javascript
// main.gs - Entry point
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Automatrix ERP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// projects.gs - All project functions
function getProjects(filters) { }
function getProjectById(id) { }
function createProject(data) { }
function updateProject(id, data) { }
function deleteProject(id) { }
function getProjectFinancials(id) { }
function updateProjectFinancials(id) { }

// transactions.gs - All transaction functions
function submitTransaction(data) { }
function getTransactions(filters) { }
function approveTransaction(id) { }
function rejectTransaction(id, reason) { }
function getPendingTransactions() { }

// utils.gs - Helper functions
function getCurrentUser() { }
function getUserRole(email) { }
function formatCurrency(amount) { }
function formatDate(date) { }
function generateId(prefix) { }
function validateRequired(data, fields) { }
```

---

## 4. APPS SCRIPT BEST PRACTICES

### 4.1 Performance Optimization

**❌ BAD: Multiple sheet reads**
```javascript
function slowFunction() {
  const sheet = SpreadsheetApp.getActiveSheet();
  for (let i = 1; i <= 100; i++) {
    const value = sheet.getRange(i, 1).getValue(); // 100 API calls!
  }
}
```

**✅ GOOD: Single batch read**
```javascript
function fastFunction() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const values = sheet.getRange(1, 1, 100, 1).getValues(); // 1 API call
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i][0];
    // Process value
  }
}
```

**✅ BETTER: Batch write**
```javascript
function batchUpdate() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const updates = [];
  
  // Prepare all updates in memory
  for (let i = 0; i < 100; i++) {
    updates.push([i * 2, 'Updated']);
  }
  
  // Single write operation
  sheet.getRange(1, 1, updates.length, 2).setValues(updates);
}
```

### 4.2 Error Handling Pattern

```javascript
function robustFunction(data) {
  try {
    // 1. Input validation
    if (!data || !data.requiredField) {
      throw new Error('Missing required field: requiredField');
    }
    
    // 2. Type validation
    if (typeof data.amount !== 'number' || data.amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    
    // 3. Business logic
    const result = processData(data);
    
    // 4. Success response
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    // 5. Error logging
    console.error('Error in robustFunction:', error);
    Logger.log(`Error: ${error.message}\nStack: ${error.stack}`);
    
    // 6. User-friendly error
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 4.3 Caching Strategy

```javascript
// Use cache for frequently accessed data
const cache = CacheService.getScriptCache();

function getProjectsCached() {
  // Try cache first
  const cached = cache.get('projects_list');
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from sheet
  const projects = getProjectsFromSheet();
  
  // Cache for 10 minutes (600 seconds)
  cache.put('projects_list', JSON.stringify(projects), 600);
  
  return projects;
}

// Clear cache when data changes
function createProject(data) {
  // ... create project
  
  // Invalidate cache
  cache.remove('projects_list');
  cache.remove('dashboard_data');
}
```

### 4.4 Transaction Safety

```javascript
// Use Lock Service for concurrent operations
function safeCriticalOperation(data) {
  const lock = LockService.getScriptLock();
  
  try {
    // Wait up to 30 seconds for lock
    lock.waitLock(30000);
    
    // Critical operation (e.g., updating wallet balance)
    const result = updateWalletBalance(data);
    
    return result;
    
  } catch (error) {
    console.error('Lock error:', error);
    throw new Error('System busy, please try again');
    
  } finally {
    // Always release lock
    lock.releaseLock();
  }
}
```

---

## 5. SHEET OPERATIONS

### 5.1 Reading Data

```javascript
// Read all data
function getAllProjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Projects');
  const data = sheet.getDataRange().getValues();
  
  // Skip header row, convert to objects
  const projects = [];
  for (let i = 1; i < data.length; i++) {
    projects.push({
      id: data[i][0],
      name: data[i][1],
      client: data[i][2],
      status: data[i][3]
      // ... more fields
    });
  }
  
  return projects;
}

// Read specific range
function getRecentTransactions() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Transactions');
  
  const lastRow = sheet.getLastRow();
  const startRow = Math.max(2, lastRow - 99); // Last 100 rows
  
  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 10)
    .getValues();
  
  return data;
}

// Find specific row
function findProjectById(projectId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Projects');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === projectId) {
      return {
        row: i + 1, // Sheet row number (1-indexed)
        data: data[i]
      };
    }
  }
  
  return null;
}
```

### 5.2 Writing Data

```javascript
// Append new row
function addTransaction(txnData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Transactions');
  
  const row = [
    generateId('TXN'),
    txnData.userId,
    new Date(),
    txnData.type,
    txnData.category,
    txnData.amount,
    txnData.projectId || '',
    txnData.description,
    txnData.receiptUrl || '',
    'Pending'
  ];
  
  sheet.appendRow(row);
}

// Update specific cell
function updateTransactionStatus(txnId, status) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Transactions');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === txnId) {
      const row = i + 1;
      sheet.getRange(row, 10).setValue(status); // Column 10 = Status
      sheet.getRange(row, 11).setValue(Session.getActiveUser().getEmail());
      sheet.getRange(row, 12).setValue(new Date());
      break;
    }
  }
}

// Batch update
function updateMultipleProjects(updates) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Projects');
  
  updates.forEach(update => {
    sheet.getRange(update.row, update.col).setValue(update.value);
  });
}
```

### 5.3 Data Validation

```javascript
function validateSheetData(sheetName, requiredColumns) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  
  const headers = sheet.getRange(1, 1, 1, requiredColumns.length)
    .getValues()[0];
  
  for (let i = 0; i < requiredColumns.length; i++) {
    if (headers[i] !== requiredColumns[i]) {
      throw new Error(`Invalid sheet structure. Expected column ${i}: ${requiredColumns[i]}, found: ${headers[i]}`);
    }
  }
  
  return true;
}
```

---

## 6. HTML SERVICE & UI

### 6.1 Template System

**Index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Automatrix ERP</title>
  
  <!-- Include CSS -->
  <?!= include('Styles'); ?>
</head>
<body>
  <div id="app">
    <h1>Automatrix ERP</h1>
    <!-- Content here -->
  </div>
  
  <!-- Include JavaScript -->
  <?!= include('Scripts'); ?>
</body>
</html>
```

**Styles.html:**
```html
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 16px;
    line-height: 1.6;
  }
  
  /* More styles... */
</style>
```

**Scripts.html:**
```html
<script>
  // Client-side JavaScript
  function loadData() {
    google.script.run
      .withSuccessHandler(displayData)
      .withFailureHandler(handleError)
      .getData();
  }
  
  function displayData(data) {
    // Update UI with data
  }
  
  function handleError(error) {
    alert('Error: ' + error.message);
  }
</script>
```

### 6.2 Client-Server Communication

```javascript
// Server function (main.gs)
function getERPData() {
  const user = Session.getActiveUser().getEmail();
  const role = getUserRole(user);
  
  return {
    projects: getProjects(),
    transactions: getTransactions({ userId: user }),
    wallet: getWalletBalance(user),
    role: role
  };
}

// Client call (Scripts.html)
<script>
  function loadDashboard() {
    showLoading();
    
    google.script.run
      .withSuccessHandler(function(data) {
        hideLoading();
        renderDashboard(data);
      })
      .withFailureHandler(function(error) {
        hideLoading();
        showError(error.message);
      })
      .getERPData();
  }
  
  // Call on page load
  document.addEventListener('DOMContentLoaded', loadDashboard);
</script>
```

### 6.3 Form Submission Pattern

```html
<form id="transaction-form">
  <input type="text" id="description" required>
  <input type="number" id="amount" required>
  <button type="submit">Submit</button>
</form>

<script>
  document.getElementById('transaction-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const data = {
      description: document.getElementById('description').value,
      amount: parseFloat(document.getElementById('amount').value)
    };
    
    // Validate
    if (data.amount <= 0) {
      alert('Amount must be positive');
      return;
    }
    
    // Submit
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        hideLoading();
        if (result.success) {
          alert('Transaction submitted!');
          document.getElementById('transaction-form').reset();
        } else {
          alert('Error: ' + result.error);
        }
      })
      .withFailureHandler(function(error) {
        hideLoading();
        alert('Error: ' + error.message);
      })
      .submitTransaction(data);
  });
</script>
```

---


## 7. BUSINESS LOGIC IMPLEMENTATION

### 7.1 Wallet System

```javascript
// utils.gs
function updateWalletBalance(employeeId, amount, type) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ledgerSheet = ss.getSheetByName('Wallet_Ledger');
    const balanceSheet = ss.getSheetByName('Employee_Balances');
    
    // Get current balance
    const currentBalance = getEmployeeWalletBalance(employeeId);
    const newBalance = currentBalance + amount;
    
    // Add to ledger
    ledgerSheet.appendRow([
      'WL' + new Date().getTime(),
      employeeId,
      type,
      amount,
      newBalance,
      new Date()
    ]);
    
    // Update balance
    updateOrCreateBalance(balanceSheet, employeeId, newBalance);
    
    lock.releaseLock();
    
    return { success: true, newBalance: newBalance };
    
  } catch (error) {
    console.error('Wallet update error:', error);
    throw error;
  }
}

function getEmployeeWalletBalance(employeeId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Employee_Balances');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === employeeId) {
      return parseFloat(data[i][1]) || 0;
    }
  }
  
  return 0;
}

function updateOrCreateBalance(sheet, employeeId, newBalance) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === employeeId) {
      sheet.getRange(i + 1, 2).setValue(newBalance);
      sheet.getRange(i + 1, 3).setValue(new Date());
      return;
    }
  }
  
  // If not found, create new
  sheet.appendRow([employeeId, newBalance, new Date()]);
}
```

### 7.2 Transaction Approval

```javascript
// transactions.gs
function approveTransaction(transactionId) {
  try {
    // Check permission
    const user = Session.getActiveUser().getEmail();
    const role = getUserRole(user);
    
    if (role !== 'CEO' && role !== 'Owner') {
      throw new Error('Insufficient permissions');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Transactions');
    const data = sheet.getDataRange().getValues();
    
    // Find transaction
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === transactionId) {
        const row = i + 1;
        const txnType = data[i][3];
        const amount = parseFloat(data[i][5]);
        const employeeId = data[i][1];
        const projectId = data[i][6];
        
        // Check if already approved
        if (data[i][9] === 'Approved') {
          throw new Error('Transaction already approved');
        }
        
        // Update status
        sheet.getRange(row, 10).setValue('Approved');
        sheet.getRange(row, 11).setValue(user);
        sheet.getRange(row, 12).setValue(new Date());
        
        // Update wallet based on type
        if (txnType === 'Cash_Advance') {
          updateWalletBalance(employeeId, amount, 'ADVANCE');
        } else if (txnType === 'Expense_Claim') {
          updateWalletBalance(employeeId, -amount, 'SETTLEMENT');
        }
        
        // Update project financials if linked
        if (projectId) {
          updateProjectFinancials(projectId);
        }
        
        // Clear cache
        CacheService.getScriptCache().remove('pending_approvals');
        
        return { success: true };
      }
    }
    
    throw new Error('Transaction not found');
    
  } catch (error) {
    console.error('Approval error:', error);
    return { success: false, error: error.message };
  }
}

function getPendingTransactions() {
  // Check cache
  const cache = CacheService.getScriptCache();
  const cached = cache.get('pending_approvals');
  if (cached) {
    return JSON.parse(cached);
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const txnSheet = ss.getSheetByName('Transactions');
  const empSheet = ss.getSheetByName('Employees');
  
  const txnData = txnSheet.getDataRange().getValues();
  const empData = empSheet.getDataRange().getValues();
  
  // Create employee lookup
  const empMap = {};
  for (let i = 1; i < empData.length; i++) {
    empMap[empData[i][0]] = empData[i][2]; // ID -> Name
  }
  
  // Find pending transactions
  const pending = [];
  for (let i = 1; i < txnData.length; i++) {
    if (txnData[i][9] === 'Pending') {
      pending.push({
        id: txnData[i][0],
        employeeId: txnData[i][1],
        employeeName: empMap[txnData[i][1]] || 'Unknown',
        date: txnData[i][2],
        type: txnData[i][3],
        category: txnData[i][4],
        amount: txnData[i][5],
        projectId: txnData[i][6],
        description: txnData[i][7],
        receiptUrl: txnData[i][8]
      });
    }
  }
  
  // Cache for 2 minutes
  cache.put('pending_approvals', JSON.stringify(pending), 120);
  
  return pending;
}
```

### 7.3 Project Financials

```javascript
// projects.gs
function updateProjectFinancials(projectId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Calculate total income
    const totalIncome = calculateProjectIncome(projectId);
    
    // Calculate total expenses (cash)
    const totalCashExpense = calculateProjectCashExpense(projectId);
    
    // Calculate material costs
    const totalMaterialCost = calculateProjectMaterialCost(projectId);
    
    // Calculate totals
    const totalExpense = totalCashExpense + totalMaterialCost;
    const netProfit = totalIncome - totalExpense;
    const marginPercent = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    
    // Update project sheet
    const projectSheet = ss.getSheetByName('Projects');
    const data = projectSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === projectId) {
        const row = i + 1;
        projectSheet.getRange(row, 8).setValue(totalIncome);
        projectSheet.getRange(row, 9).setValue(totalExpense);
        projectSheet.getRange(row, 10).setValue(netProfit);
        projectSheet.getRange(row, 11).setValue(marginPercent.toFixed(2));
        break;
      }
    }
    
    // Clear cache
    CacheService.getScriptCache().remove('projects_list');
    
    return {
      totalIncome,
      totalExpense,
      netProfit,
      marginPercent
    };
    
  } catch (error) {
    console.error('Error updating project financials:', error);
    throw error;
  }
}

function calculateProjectIncome(projectId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Income');
  const data = sheet.getDataRange().getValues();
  
  let total = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === projectId) {
      total += parseFloat(data[i][4]) || 0;
    }
  }
  
  return total;
}

function calculateProjectCashExpense(projectId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Transactions');
  const data = sheet.getDataRange().getValues();
  
  let total = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][6] === projectId && data[i][9] === 'Approved') {
      total += parseFloat(data[i][5]) || 0;
    }
  }
  
  return total;
}

function calculateProjectMaterialCost(projectId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Inventory_Logs');
  const data = sheet.getDataRange().getValues();
  
  let total = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][5] === projectId && data[i][3] === 'Project_Issue_Out') {
      total += parseFloat(data[i][8]) || 0; // total_cost column
    }
  }
  
  return total;
}
```

### 7.4 Inventory Management

```javascript
// inventory.gs
function issueInventoryToProject(data) {
  try {
    // Validate
    if (!data.itemId || !data.projectId || !data.quantity || data.quantity <= 0) {
      throw new Error('Invalid inventory data');
    }
    
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const itemSheet = ss.getSheetByName('Inventory');
    const logSheet = ss.getSheetByName('Inventory_Logs');
    
    // Find item
    const itemData = itemSheet.getDataRange().getValues();
    let itemRow = -1;
    let currentStock = 0;
    let purchasePrice = 0;
    let itemName = '';
    
    for (let i = 1; i < itemData.length; i++) {
      if (itemData[i][0] === data.itemId) {
        itemRow = i + 1;
        itemName = itemData[i][1];
        currentStock = parseFloat(itemData[i][4]) || 0;
        purchasePrice = parseFloat(itemData[i][5]) || 0;
        break;
      }
    }
    
    if (itemRow === -1) {
      throw new Error('Item not found');
    }
    
    // Check stock
    if (currentStock < data.quantity) {
      throw new Error(`Insufficient stock. Available: ${currentStock} ${itemData[itemRow-1][3]}`);
    }
    
    // Calculate cost
    const totalCost = data.quantity * purchasePrice;
    
    // Deduct stock
    const newStock = currentStock - data.quantity;
    itemSheet.getRange(itemRow, 5).setValue(newStock);
    
    // Log transaction
    logSheet.appendRow([
      'IL' + new Date().getTime(),
      new Date(),
      data.itemId,
      'Project_Issue_Out',
      data.quantity,
      data.projectId,
      Session.getActiveUser().getEmail(),
      purchasePrice,
      totalCost,
      data.notes || `Issued to project: ${data.projectId}`
    ]);
    
    // Update project financials
    updateProjectFinancials(data.projectId);
    
    lock.releaseLock();
    
    // Clear cache
    CacheService.getScriptCache().remove('inventory_list');
    CacheService.getScriptCache().remove('low_stock_items');
    
    return {
      success: true,
      itemName: itemName,
      newStock: newStock,
      cost: totalCost
    };
    
  } catch (error) {
    console.error('Inventory issue error:', error);
    return { success: false, error: error.message };
  }
}

function getLowStockItems() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('low_stock_items');
  if (cached) {
    return JSON.parse(cached);
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Inventory');
  const data = sheet.getDataRange().getValues();
  
  const lowStockItems = [];
  
  for (let i = 1; i < data.length; i++) {
    const itemId = data[i][0];
    const name = data[i][1];
    const currentStock = parseFloat(data[i][4]) || 0;
    const minStock = parseFloat(data[i][8]) || 5;
    
    if (currentStock < minStock) {
      lowStockItems.push({
        itemId: itemId,
        name: name,
        currentStock: currentStock,
        minStock: minStock,
        shortage: minStock - currentStock
      });
    }
  }
  
  // Cache for 5 minutes
  cache.put('low_stock_items', JSON.stringify(lowStockItems), 300);
  
  return lowStockItems;
}
```

---

## 8. SECURITY & PERMISSIONS

### 8.1 User Authentication

```javascript
// utils.gs
function getCurrentUser() {
  const user = Session.getActiveUser();
  return {
    email: user.getEmail(),
    role: getUserRole(user.getEmail())
  };
}

function getUserRole(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Employees');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === email) { // Column 1 = email
      return data[i][3]; // Column 3 = role
    }
  }
  
  return 'Staff'; // Default role
}

function isAuthorized(email, requiredRoles) {
  const role = getUserRole(email);
  return requiredRoles.includes(role);
}
```

### 8.2 Permission Checks

```javascript
function checkPermission(requiredRoles) {
  const user = Session.getActiveUser().getEmail();
  const role = getUserRole(user);
  
  if (!requiredRoles.includes(role)) {
    throw new Error('Insufficient permissions. Required: ' + requiredRoles.join(' or '));
  }
  
  return true;
}

// Usage
function approveTransaction(id) {
  checkPermission(['CEO', 'Owner']); // Throws error if not authorized
  
  // Proceed with approval
  // ...
}

function viewSalaryData() {
  checkPermission(['CEO', 'Owner']); // Only CEO/Owner can view
  
  // Return salary data
  // ...
}
```

### 8.3 Data Sanitization

```javascript
function sanitizeInput(input) {
  if (typeof input === 'string') {
    // Remove potentially harmful characters
    return input.trim()
      .replace(/[<>]/g, '') // Remove < and >
      .substring(0, 500); // Limit length
  }
  return input;
}

function validateTransactionData(data) {
  // Required fields
  if (!data.type || !data.amount || !data.description) {
    throw new Error('Missing required fields');
  }
  
  // Type validation
  const validTypes = ['Cash_Advance', 'Expense_Claim', 'Direct_Vendor_Payment'];
  if (!validTypes.includes(data.type)) {
    throw new Error('Invalid transaction type');
  }
  
  // Amount validation
  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount <= 0 || amount > 10000000) {
    throw new Error('Invalid amount');
  }
  
  // Sanitize strings
  return {
    type: data.type,
    amount: amount,
    description: sanitizeInput(data.description),
    projectId: data.projectId || '',
    category: sanitizeInput(data.category || 'Miscellaneous')
  };
}
```

### 8.4 Audit Logging

```javascript
function logAuditEvent(action, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let auditSheet = ss.getSheetByName('Audit_Log');
    
    // Create sheet if doesn't exist
    if (!auditSheet) {
      auditSheet = ss.insertSheet('Audit_Log');
      auditSheet.appendRow(['Timestamp', 'User', 'Action', 'Details', 'IP']);
    }
    
    auditSheet.appendRow([
      new Date(),
      Session.getActiveUser().getEmail(),
      action,
      JSON.stringify(details),
      Session.getActiveUser().getEmail() // Can't get real IP in Apps Script
    ]);
    
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't throw - audit failure shouldn't break functionality
  }
}

// Usage
function approveTransaction(id) {
  // ... approval logic
  
  logAuditEvent('TRANSACTION_APPROVED', {
    transactionId: id,
    action: 'Approved transaction'
  });
}

function deleteProject(id) {
  checkPermission(['CEO', 'Owner']);
  
  // ... delete logic
  
  logAuditEvent('PROJECT_DELETED', {
    projectId: id,
    action: 'Deleted project'
  });
}
```

---

## 9. TESTING & DEBUGGING

### 9.1 Logging Techniques

```javascript
// Console logging (view in Apps Script editor)
function debugFunction() {
  console.log('Starting function');
  console.log('Data:', { value: 123 });
  console.error('Error occurred:', new Error('Test'));
}

// Logger (persistent logs)
function persistentLogging() {
  Logger.log('This will be saved');
  Logger.log('Variables: %s, %s', var1, var2);
  
  // View logs with: clasp logs
}

// Custom logging to sheet
function logToSheet(message, level) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName('Debug_Logs');
  
  if (!logSheet) {
    logSheet = ss.insertSheet('Debug_Logs');
    logSheet.appendRow(['Timestamp', 'Level', 'Message']);
  }
  
  logSheet.appendRow([new Date(), level, message]);
}

// Usage
function myFunction() {
  try {
    logToSheet('Starting myFunction', 'INFO');
    
    // ... logic
    
    logToSheet('Function completed', 'INFO');
  } catch (error) {
    logToSheet('Error: ' + error.message, 'ERROR');
  }
}
```

### 9.2 Testing Functions

```javascript
// Test data generators
function generateTestTransaction() {
  return {
    type: 'Expense_Claim',
    amount: Math.floor(Math.random() * 10000) + 1000,
    description: 'Test expense ' + new Date().getTime(),
    category: 'Material',
    projectId: 'PROJ001'
  };
}

// Unit test pattern
function testWalletBalance() {
  const employeeId = 'EMP001';
  
  // Get initial balance
  const initialBalance = getEmployeeWalletBalance(employeeId);
  console.log('Initial balance:', initialBalance);
  
  // Add advance
  updateWalletBalance(employeeId, 5000, 'ADVANCE');
  const balanceAfterAdvance = getEmployeeWalletBalance(employeeId);
  console.log('After advance:', balanceAfterAdvance);
  
  // Assert
  if (balanceAfterAdvance !== initialBalance + 5000) {
    throw new Error('Balance calculation incorrect');
  }
  
  console.log('✓ Test passed');
}

// Integration test
function testFullTransactionFlow() {
  console.log('Starting integration test...');
  
  // 1. Create transaction
  const txnData = generateTestTransaction();
  const result = submitTransaction(txnData);
  console.log('Transaction created:', result);
  
  // 2. Approve transaction
  if (result.success) {
    const approval = approveTransaction(result.transactionId);
    console.log('Approval result:', approval);
  }
  
  // 3. Verify wallet updated
  // ... verification logic
  
  console.log('✓ Integration test passed');
}
```

### 9.3 Debugging in Browser

```javascript
// Client-side debugging (Scripts.html)
<script>
  // Enable console logs
  function debugCall() {
    console.log('Calling server function...');
    
    google.script.run
      .withSuccessHandler(function(result) {
        console.log('Success:', result);
        console.table(result.data); // Nice table view
      })
      .withFailureHandler(function(error) {
        console.error('Failure:', error);
        debugger; // Breakpoint in browser
      })
      .getData();
  }
  
  // Log all google.script.run calls
  const originalRun = google.script.run;
  google.script.run = new Proxy(originalRun, {
    get(target, prop) {
      if (typeof target[prop] === 'function') {
        return function(...args) {
          console.log(`Calling: ${prop}`, args);
          return target[prop].apply(target, args);
        };
      }
      return target[prop];
    }
  });
</script>
```

### 9.4 Error Simulation

```javascript
// Simulate common errors for testing
function simulateErrors() {
  // Test timeout
  function testTimeout() {
    Utilities.sleep(300000); // 5 minutes - will timeout
  }
  
  // Test lock contention
  function testLockContention() {
    const lock = LockService.getScriptLock();
    lock.waitLock(1); // Very short timeout
    // Do work
    lock.releaseLock();
  }
  
  // Test invalid data
  function testInvalidData() {
    submitTransaction({
      type: 'Invalid',
      amount: -100
    });
  }
}
```

---

## 10. DEPLOYMENT PROCEDURES

### 10.1 Pre-Deployment Checklist

```
Before deploying:
- [ ] All tests pass
- [ ] No console.log statements (use Logger)
- [ ] Error handling in place
- [ ] Input validation added
- [ ] Permission checks implemented
- [ ] Cache keys updated if needed
- [ ] Documentation updated
- [ ] Backup current version
```

### 10.2 Deployment Steps

```bash
# 1. Test locally
clasp push
# Test in browser

# 2. Create new version
clasp deploy --description "v2.1 - Added income logging"

# 3. Get deployment ID
clasp deployments

# 4. Update web app (in Apps Script editor)
# Deploy > Manage Deployments > Edit > Version: New > Deploy
```

### 10.3 Rollback Procedure

```bash
# List all deployments
clasp deployments

# Remove failed deployment
clasp undeploy <DEPLOYMENT_ID>

# Redeploy previous version
# In Apps Script editor:
# Deploy > Manage Deployments > Select previous version > Deploy
```

### 10.4 Version Management

```javascript
// Add version info to code
const APP_VERSION = '2.1.0';

function getAppVersion() {
  return {
    version: APP_VERSION,
    lastUpdated: '2026-01-26'
  };
}

// Display in UI
<script>
  google.script.run
    .withSuccessHandler(function(info) {
      console.log('App version:', info.version);
    })
    .getAppVersion();
</script>
```

---


## 11. COMMON PATTERNS

### 11.1 Data Fetching Pattern

```javascript
// Standard pattern for fetching data
function getEntityData(entityName, filters = {}) {
  try {
    // 1. Check cache
    const cacheKey = `${entityName}_${JSON.stringify(filters)}`;
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 2. Get sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(entityName);
    
    if (!sheet) {
      throw new Error(`Sheet not found: ${entityName}`);
    }
    
    // 3. Read data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // 4. Convert to objects
    const records = [];
    for (let i = 1; i < data.length; i++) {
      const record = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = data[i][j];
      }
      
      // Apply filters
      let matches = true;
      for (const key in filters) {
        if (record[key] !== filters[key]) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        records.push(record);
      }
    }
    
    // 5. Cache result
    cache.put(cacheKey, JSON.stringify(records), 300); // 5 minutes
    
    return records;
    
  } catch (error) {
    console.error(`Error fetching ${entityName}:`, error);
    throw error;
  }
}

// Usage
const projects = getEntityData('Projects', { status: 'Active' });
const transactions = getEntityData('Transactions', { userId: 'EMP001' });
```

### 11.2 CRUD Operations Pattern

```javascript
// Generic CRUD operations
function createEntity(sheetName, data, idPrefix) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  // Generate ID
  const id = idPrefix + new Date().getTime();
  
  // Get headers to know column order
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Build row based on headers
  const row = headers.map(header => {
    if (header === 'id' || header.endsWith('_ID')) {
      return id;
    }
    if (header === 'created_at' || header === 'timestamp') {
      return new Date();
    }
    if (header === 'created_by') {
      return Session.getActiveUser().getEmail();
    }
    return data[header] || '';
  });
  
  // Append row
  sheet.appendRow(row);
  
  // Clear cache
  CacheService.getScriptCache().remove(sheetName.toLowerCase() + '_list');
  
  return { success: true, id: id };
}

function updateEntity(sheetName, id, updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find row
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const row = i + 1;
      
      // Update each field
      for (const field in updates) {
        const colIndex = headers.indexOf(field);
        if (colIndex !== -1) {
          sheet.getRange(row, colIndex + 1).setValue(updates[field]);
        }
      }
      
      // Update timestamp
      const updatedAtCol = headers.indexOf('updated_at');
      if (updatedAtCol !== -1) {
        sheet.getRange(row, updatedAtCol + 1).setValue(new Date());
      }
      
      // Clear cache
      CacheService.getScriptCache().remove(sheetName.toLowerCase() + '_list');
      
      return { success: true };
    }
  }
  
  throw new Error('Entity not found');
}

function deleteEntity(sheetName, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      
      // Clear cache
      CacheService.getScriptCache().remove(sheetName.toLowerCase() + '_list');
      
      return { success: true };
    }
  }
  
  throw new Error('Entity not found');
}

// Usage
createEntity('Projects', { name: 'New Project', client: 'ABC Corp' }, 'PROJ');
updateEntity('Projects', 'PROJ123', { status: 'Completed' });
deleteEntity('Projects', 'PROJ123');
```

### 11.3 Dropdown Population Pattern

```javascript
// Server function
function getDropdownOptions(type) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  switch(type) {
    case 'projects':
      const projects = ss.getSheetByName('Projects').getDataRange().getValues();
      return projects.slice(1).map(row => ({
        value: row[0],
        label: row[1]
      }));
      
    case 'employees':
      const employees = ss.getSheetByName('Employees').getDataRange().getValues();
      return employees.slice(1).map(row => ({
        value: row[0],
        label: row[2] // Name
      }));
      
    case 'categories':
      const settings = ss.getSheetByName('Settings').getDataRange().getValues();
      return settings.filter(row => row[0] === 'CATEGORY')
        .map(row => ({ value: row[1], label: row[1] }));
      
    default:
      return [];
  }
}

// Client usage
<select id="project-select">
  <option value="">Select Project</option>
</select>

<script>
  function populateDropdown(selectId, type) {
    google.script.run
      .withSuccessHandler(function(options) {
        const select = document.getElementById(selectId);
        options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          select.appendChild(option);
        });
      })
      .getDropdownOptions(type);
  }
  
  // Populate on page load
  populateDropdown('project-select', 'projects');
</script>
```

### 11.4 Pagination Pattern

```javascript
// Server function with pagination
function getTransactionsPaginated(page = 1, limit = 50, filters = {}) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Transactions');
  const data = sheet.getDataRange().getValues();
  
  // Apply filters
  const filtered = [];
  for (let i = 1; i < data.length; i++) {
    // Filter logic
    let matches = true;
    if (filters.userId && data[i][1] !== filters.userId) {
      matches = false;
    }
    if (matches) {
      filtered.push(data[i]);
    }
  }
  
  // Sort by date (newest first)
  filtered.sort((a, b) => new Date(b[2]) - new Date(a[2]));
  
  // Paginate
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const pageData = filtered.slice(startIndex, endIndex);
  
  return {
    data: pageData,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

// Client usage
<script>
  let currentPage = 1;
  
  function loadTransactions() {
    google.script.run
      .withSuccessHandler(function(result) {
        renderTransactions(result.data);
        renderPagination(result.pagination);
      })
      .getTransactionsPaginated(currentPage, 20);
  }
  
  function nextPage() {
    currentPage++;
    loadTransactions();
  }
  
  function prevPage() {
    currentPage--;
    loadTransactions();
  }
</script>
```

### 11.5 File Upload Pattern

```javascript
// Server function
function uploadFile(fileData, folder = 'Automatrix_Files') {
  try {
    // Get or create folder
    const folders = DriveApp.getFoldersByName(folder);
    let targetFolder;
    
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = DriveApp.createFolder(folder);
    }
    
    // Decode base64 and create file
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileData.data),
      fileData.mimeType,
      fileData.name
    );
    
    const file = targetFolder.createFile(blob);
    
    // Set sharing
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      success: true,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileName: file.getName()
    };
    
  } catch (error) {
    console.error('File upload error:', error);
    return { success: false, error: error.message };
  }
}

// Client usage
<input type="file" id="file-input" accept="image/*,application/pdf">

<script>
  document.getElementById('file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Check size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Max 10MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64Data = e.target.result.split(',')[1];
      
      showLoading();
      google.script.run
        .withSuccessHandler(function(result) {
          hideLoading();
          if (result.success) {
            console.log('File uploaded:', result.fileUrl);
            // Use result.fileUrl in your form
          } else {
            alert('Upload failed: ' + result.error);
          }
        })
        .uploadFile({
          data: base64Data,
          name: file.name,
          mimeType: file.type
        }, 'Receipts');
    };
    reader.readAsDataURL(file);
  });
</script>
```

---

## 12. TROUBLESHOOTING

### 12.1 Common Issues

#### Issue: "Service invoked too many times in a short time"
**Cause:** Hitting quota limits  
**Solution:**
```javascript
// Add exponential backoff
function callWithRetry(func, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return func();
    } catch (error) {
      if (error.message.includes('too many times') && i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        Utilities.sleep(waitTime);
      } else {
        throw error;
      }
    }
  }
}

// Usage
const data = callWithRetry(() => sheet.getDataRange().getValues());
```

#### Issue: "Execution time limit exceeded (6 minutes)"
**Cause:** Function taking too long  
**Solution:**
```javascript
// Break into smaller chunks
function processLargeDataset() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Data');
  const data = sheet.getDataRange().getValues();
  
  const BATCH_SIZE = 100;
  const processed = [];
  
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    
    // Process batch
    const batchResult = processBatch(batch);
    processed.push(...batchResult);
    
    // Check time - if close to 5 minutes, stop
    if (i > 0 && i % 500 === 0) {
      const elapsed = (new Date() - startTime) / 1000;
      if (elapsed > 300) { // 5 minutes
        Logger.log('Time limit approaching, stopping');
        break;
      }
    }
  }
  
  return processed;
}
```

#### Issue: "Lock wait time exceeded"
**Cause:** Multiple users/processes trying to access same resource  
**Solution:**
```javascript
function safeUpdate(data) {
  const lock = LockService.getScriptLock();
  
  try {
    // Try to get lock, wait max 30 seconds
    if (lock.tryLock(30000)) {
      // Do update
      updateData(data);
      return { success: true };
    } else {
      return { 
        success: false, 
        error: 'System busy, please try again' 
      };
    }
  } finally {
    lock.releaseLock();
  }
}
```

#### Issue: "Authorization required"
**Cause:** Script needs permission to access user data  
**Solution:**
```javascript
// In appsscript.json, add required scopes
{
  "timeZone": "Asia/Kolkata",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

#### Issue: "Cannot read property 'getSheetByName' of null"
**Cause:** Spreadsheet not found  
**Solution:**
```javascript
function safeGetSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!ss) {
    throw new Error('No active spreadsheet found');
  }
  
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}. Please check sheet name.`);
  }
  
  return sheet;
}
```

### 12.2 Debugging Checklist

When something doesn't work:

```
1. Check Logs
   - clasp logs
   - View > Execution log (in Apps Script editor)
   
2. Check Permissions
   - Are OAuth scopes correct?
   - Does user have sheet access?
   - Is user in Employees sheet?
   
3. Check Data
   - Are sheet names correct (case-sensitive)?
   - Are column indices correct?
   - Is data in expected format?
   
4. Check Quotas
   - Daily API calls limit
   - Execution time (6 min max)
   - Script size (<50MB)
   
5. Test Incrementally
   - Comment out complex logic
   - Test with simple data
   - Add console.log statements
   
6. Check Client-Side
   - Open browser console (F12)
   - Look for JavaScript errors
   - Check network tab for failures
```

### 12.3 Performance Debugging

```javascript
// Measure execution time
function timedFunction() {
  const startTime = new Date().getTime();
  
  // Your code here
  const result = expensiveOperation();
  
  const endTime = new Date().getTime();
  const duration = (endTime - startTime) / 1000;
  
  console.log(`Execution time: ${duration} seconds`);
  
  return result;
}

// Profile sheet operations
function profileSheetOperations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Transactions');
  
  console.time('Read operation');
  const data = sheet.getDataRange().getValues();
  console.timeEnd('Read operation');
  
  console.time('Processing');
  const processed = processData(data);
  console.timeEnd('Processing');
  
  console.time('Write operation');
  sheet.getRange(1, 1, processed.length, processed[0].length)
    .setValues(processed);
  console.timeEnd('Write operation');
}
```

---

## 13. OPTIMIZATION TIPS

### 13.1 Reduce API Calls

```javascript
// ❌ BAD: Multiple calls
function badExample() {
  const sheet = SpreadsheetApp.getActiveSheet();
  
  for (let i = 0; i < 100; i++) {
    sheet.getRange(i + 1, 1).setValue(i); // 100 calls!
  }
}

// ✅ GOOD: Single call
function goodExample() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const values = [];
  
  for (let i = 0; i < 100; i++) {
    values.push([i]);
  }
  
  sheet.getRange(1, 1, values.length, 1).setValues(values); // 1 call
}
```

### 13.2 Use Caching Effectively

```javascript
// Cache expensive calculations
function getCachedDashboardData() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'dashboard_' + Session.getActiveUser().getEmail();
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Expensive calculation
  const data = calculateDashboardData();
  
  // Cache for 5 minutes
  cache.put(cacheKey, JSON.stringify(data), 300);
  
  return data;
}

// Invalidate cache when data changes
function submitTransaction(data) {
  // ... submit logic
  
  // Clear relevant caches
  const cache = CacheService.getScriptCache();
  cache.remove('dashboard_' + data.userId);
  cache.remove('transactions_list');
}
```

### 13.3 Minimize Data Transfer

```javascript
// ❌ BAD: Return all data
function getAllTransactions() {
  const data = sheet.getDataRange().getValues();
  return data; // Could be huge!
}

// ✅ GOOD: Return only needed fields
function getTransactionsSummary() {
  const data = sheet.getDataRange().getValues();
  
  return data.slice(1).map(row => ({
    id: row[0],
    date: row[2],
    amount: row[5],
    description: row[7]
    // Only essential fields
  }));
}

// ✅ BETTER: Paginate
function getTransactionsPaginated(page, limit) {
  const data = sheet.getDataRange().getValues();
  const start = (page - 1) * limit;
  const end = start + limit;
  
  return data.slice(start + 1, end + 1); // +1 to skip header
}
```

### 13.4 Lazy Load Data

```javascript
// Client-side: Load data only when needed
<script>
  let projectsCache = null;
  
  function getProjects() {
    if (projectsCache) {
      return Promise.resolve(projectsCache);
    }
    
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(function(data) {
          projectsCache = data;
          resolve(data);
        })
        .withFailureHandler(reject)
        .getProjects();
    });
  }
  
  // Only load when dropdown is opened
  document.getElementById('project-select').addEventListener('focus', function() {
    if (this.options.length === 1) { // Only placeholder
      getProjects().then(projects => {
        projects.forEach(p => {
          const opt = new Option(p.name, p.id);
          this.add(opt);
        });
      });
    }
  });
</script>
```

---

## 14. FINAL CHECKLIST FOR AGENTS

### 14.1 Before Starting Implementation

```
- [ ] Read the business requirements
- [ ] Understand the data model (sheet structure)
- [ ] Check existing code patterns
- [ ] Identify which sheets need to be created/modified
- [ ] Plan the function structure
- [ ] Consider error cases
- [ ] Think about performance
```

### 14.2 During Implementation

```
- [ ] Follow naming conventions
- [ ] Add input validation
- [ ] Implement error handling
- [ ] Add permission checks
- [ ] Cache where appropriate
- [ ] Use batch operations
- [ ] Add logging for critical operations
- [ ] Write clear comments
- [ ] Test incrementally
```

### 14.3 Before Deployment

```
- [ ] Test all happy paths
- [ ] Test error scenarios
- [ ] Test with different user roles
- [ ] Check mobile responsiveness
- [ ] Verify calculations are correct
- [ ] Remove debug logs
- [ ] Update documentation
- [ ] Backup current version
- [ ] Clear test data
```

### 14.4 After Deployment

```
- [ ] Monitor execution logs
- [ ] Check for errors in first hour
- [ ] Verify user feedback
- [ ] Monitor performance
- [ ] Document any issues
- [ ] Plan next iteration
```

---

## 15. QUICK REFERENCE

### 15.1 Common Commands

```bash
# clasp commands
clasp login                    # Authenticate
clasp clone <SCRIPT_ID>        # Download project
clasp push                     # Upload changes
clasp push --watch             # Auto-upload on save
clasp open                     # Open in browser
clasp logs                     # View execution logs
clasp deploy                   # Create deployment
clasp deployments              # List deployments
clasp undeploy <ID>            # Remove deployment

# Git commands
git status                     # Check changes
git add .                      # Stage all changes
git commit -m "message"        # Commit
git push                       # Upload to GitHub
```

### 15.2 Useful Code Snippets

```javascript
// Get current user
const user = Session.getActiveUser().getEmail();

// Get active spreadsheet
const ss = SpreadsheetApp.getActiveSpreadsheet();

// Get sheet by name
const sheet = ss.getSheetByName('Transactions');

// Read all data
const data = sheet.getDataRange().getValues();

// Append row
sheet.appendRow([val1, val2, val3]);

// Update cell
sheet.getRange(row, col).setValue(value);

// Generate unique ID
const id = 'PREFIX' + new Date().getTime();

// Format date
const formatted = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');

// Sleep (for rate limiting)
Utilities.sleep(1000); // 1 second

// Lock service
const lock = LockService.getScriptLock();
lock.waitLock(30000);
// ... critical section
lock.releaseLock();

// Cache service
const cache = CacheService.getScriptCache();
cache.put('key', 'value', 600); // 10 minutes
const value = cache.get('key');
```

### 15.3 Sheet Operations Cheat Sheet

```javascript
// Get last row
const lastRow = sheet.getLastRow();

// Get last column
const lastCol = sheet.getLastColumn();

// Get range
const range = sheet.getRange(row, col, numRows, numCols);

// Get values
const values = range.getValues(); // 2D array

// Set values
range.setValues(values);

// Clear range
range.clear();

// Delete row
sheet.deleteRow(rowNumber);

// Insert row
sheet.insertRowAfter(afterRow);

// Sort sheet
range.sort({column: 1, ascending: true});

// Apply formula
range.setFormula('=SUM(A1:A10)');
```

---

## 16. CONCLUSION

This SOP provides comprehensive guidelines for developing the Automatrix ERP system using Google Apps Script. Key principles:

1. **Performance First** - Batch operations, use caching, minimize API calls
2. **Security Always** - Validate inputs, check permissions, sanitize data
3. **Error Handling** - Try-catch blocks, user-friendly messages, logging
4. **Code Quality** - Consistent naming, modular functions, clear comments
5. **Testing** - Test before deploying, verify calculations, check edge cases

**Remember:**
- Apps Script has limitations (6-minute timeout, quota limits)
- Always think about concurrent users
- Cache aggressively for read-heavy operations
- Use Lock Service for critical operations
- Test on mobile devices - field engineers are primary users

**When in doubt:**
- Check the execution logs
- Test with simple data first
- Break complex operations into smaller functions
- Ask for clarification rather than assuming

---

**Document Version:** 1.0  
**Last Updated:** January 26, 2026  
**Platform:** Google Apps Script  
**Project:** Automatrix ERP Enhancement

**Good luck building! 🚀**


---

## 🆕 Phase 2 Development Patterns (January 27, 2026)

### Module Development Pattern

When creating business logic modules in `src/server/modules/`:

1. **Module Structure**
```javascript
// ============================================================================
// MODULE NAME
// ============================================================================
// Module description and purpose
// ============================================================================

/**
 * Primary function with enhanced features
 * @param {object} data - Input data
 * @returns {object} - {success, data/error, message}
 */
function primaryFunctionEnhanced(data) {
  try {
    // 1. Validate input
    const validation = validateData(data);
    if (!validation.valid) {
      return { success: false, error: 'Validation failed', details: validation.errors };
    }
    
    // 2. Check permissions
    const userEmail = getCurrentUser();
    if (!hasPermission(userEmail, 'module.action')) {
      return { success: false, error: 'Access denied' };
    }
    
    // 3. Business logic with lock if needed
    return withLock('operation_name', () => {
      // Perform operation
      // Log audit
      logAudit('ACTION', SHEET_NAMES.SHEET, recordId, field, oldVal, newVal, reason);
      
      return { success: true, message: 'Operation completed' };
    });
    
  } catch (error) {
    console.error(`Error in function: ${error.message}`);
    return { success: false, error: error.message };
  }
}
```

2. **Consistent Return Format**
```javascript
// Success
return {
  success: true,
  data: result,
  message: 'Operation completed',
  // Optional metadata
  total: count,
  page: pageNum
};

// Error
return {
  success: false,
  error: 'Error message',
  details: validationErrors  // Optional
};
```

3. **Enhanced Function Naming**
- Base functions in `main.gs`: `submitExpense()`, `getExpenses()`
- Enhanced in modules: `submitExpenseEnhanced()`, `getExpensesEnhanced()`
- Private helpers: `applyExpenseFilters()`, `checkMandatoryFields()`

### Advanced Filtering Pattern

```javascript
function getDataEnhanced(filters = {}) {
  const data = [];
  
  // Get date range
  let dateRange = null;
  if (filters.dateRange && filters.dateRange !== 'ALL') {
    if (filters.dateRange === 'CUSTOM') {
      dateRange = { start: new Date(filters.customStart), end: new Date(filters.customEnd) };
    } else {
      dateRange = getDateRangeForPeriod(filters.dateRange);
    }
  }
  
  // Filter loop
  for (let i = 1; i < rawData.length; i++) {
    const item = parseRowData(rawData[i]);
    
    // Apply filters
    if (!applyFilters(item, filters, userEmail, role)) continue;
    
    // Check date range
    if (dateRange && !isDateInRange(new Date(item.date), dateRange.start, dateRange.end)) {
      continue;
    }
    
    // Add formatted fields
    item.formattedAmount = formatCurrency(item.amount);
    item.formattedDate = formatDateForDisplay(new Date(item.date));
    
    data.push(item);
  }
  
  // Sort if specified
  if (filters.sortBy) {
    data.sort((a, b) => {
      const direction = filters.sortOrder === 'desc' ? -1 : 1;
      return (a[filters.sortBy] < b[filters.sortBy] ? -1 : 1) * direction;
    });
  }
  
  return { success: true, data: data, total: data.length };
}
```

### KPI Calculation Pattern

```javascript
function calculateKPIs(dates, userEmail, role) {
  const kpis = {
    total: 0,
    count: 0,
    average: 0
  };
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.DATA);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const date = new Date(data[i][COLS.DATE]);
    const amount = parseFloat(data[i][COLS.AMOUNT]) || 0;
    
    // Filter by role permissions
    if (!hasViewPermission(data[i], userEmail, role)) continue;
    
    // Filter by date range
    if (isDateInRange(date, dates.start, dates.end)) {
      kpis.total += amount;
      kpis.count++;
    }
  }
  
  kpis.average = kpis.count > 0 ? kpis.total / kpis.count : 0;
  
  return kpis;
}
```

### Trend Calculation Pattern

```javascript
function calculateTrends(dates, userEmail, role) {
  // Calculate previous period (same duration)
  const daysDiff = getDaysBetween(dates.start, dates.end);
  const prevEnd = new Date(dates.start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff);
  
  // Get KPIs for both periods
  const current = calculateKPIs(dates, userEmail, role);
  const previous = calculateKPIs({ start: prevStart, end: prevEnd }, userEmail, role);
  
  // Format trends
  return {
    metric1: formatTrend(current.total, previous.total),
    metric2: formatTrend(current.count, previous.count)
  };
}
```

### Approval Workflow Pattern

```javascript
function processApprovalEnhanced(rowNum, type, action, data = {}) {
  const userEmail = getCurrentUser();
  
  return preventDoubleApproval(type, rowNum, () => {
    // 1. Get current data
    const sheet = getSheet(type);
    const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    const amount = rowData[COLS.AMOUNT];
    
    // 2. Validate approval
    const validation = validateApproval(rowNum, type, action, data);
    if (!validation.valid) {
      return { success: false, error: 'Validation failed', details: validation.errors };
    }
    
    // 3. Check permission
    if (!canApproveAmount(userEmail, type, amount)) {
      return { success: false, error: 'Insufficient authority' };
    }
    
    // 4. Check mandatory fields (only for approval)
    if (action === 'APPROVE') {
      const mandatoryCheck = checkMandatoryFields(rowData, type);
      if (!mandatoryCheck.valid) {
        return { success: false, error: 'Mandatory fields missing', details: mandatoryCheck.missing };
      }
    }
    
    // 5. Process action
    if (action === 'APPROVE') {
      const approvedAmount = data.approvedAmount || amount;
      const isPartial = approvedAmount < amount;
      
      // Update status
      sheet.getRange(rowNum, COLS.STATUS + 1).setValue(isPartial ? STATUS.PARTIALLY_APPROVED : STATUS.APPROVED);
      sheet.getRange(rowNum, COLS.APPROVED_BY + 1).setValue(userEmail);
      sheet.getRange(rowNum, COLS.APPROVED_DATE + 1).setValue(new Date());
      
      // Update wallet if expense
      if (type === 'EXPENSE') {
        updateWalletBalance(rowData[COLS.SUBMITTED_BY], -approvedAmount, `Expense ${rowNum} approved`);
      }
      
      // Log audit
      logExpenseApproval(rowNum, STATUS.APPROVED, amount, approvedAmount, data.notes || '');
      
      return { success: true, message: 'Approved', isPartialApproval: isPartial };
    }
    
    // Similar for REJECT
  });
}
```

### Bulk Operations Pattern

```javascript
function bulkOperation(items) {
  const results = { success: 0, failed: 0, errors: [] };
  
  items.forEach(item => {
    try {
      const result = performOperation(item);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({ id: item.id, error: result.error });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ id: item.id, error: error.message });
    }
  });
  
  return {
    success: true,
    message: `Success: ${results.success}, Failed: ${results.failed}`,
    results: results
  };
}
```

### Summary/Aggregation Pattern

```javascript
function getSummaryByCategory(dateRange = 'THIS_MONTH') {
  const dates = getDateRangeForPeriod(dateRange);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.DATA);
  const data = sheet.getDataRange().getValues();
  const summary = {};
  
  for (let i = 1; i < data.length; i++) {
    const date = new Date(data[i][COLS.DATE]);
    const category = data[i][COLS.CATEGORY];
    const amount = parseFloat(data[i][COLS.AMOUNT]) || 0;
    const status = data[i][COLS.STATUS];
    
    if (isDateInRange(date, dates.start, dates.end) && status === STATUS.APPROVED) {
      if (!summary[category]) {
        summary[category] = { total: 0, count: 0 };
      }
      summary[category].total += amount;
      summary[category].count++;
    }
  }
  
  // Convert to array and sort
  const summaryArray = Object.keys(summary).map(cat => ({
    category: cat,
    total: summary[cat].total,
    count: summary[cat].count,
    average: summary[cat].total / summary[cat].count,
    formattedTotal: formatCurrency(summary[cat].total)
  })).sort((a, b) => b.total - a.total);
  
  return { success: true, data: summaryArray };
}
```

### Export Pattern

```javascript
function exportToCSV(filters = {}) {
  const result = getData(filters);
  if (!result.success) return result;
  
  const items = result.data;
  
  // Create CSV header
  const headers = ['ID', 'Date', 'Description', 'Amount', 'Status'];
  
  // Create CSV rows
  const rows = items.map(item => [
    item.id,
    formatDate(new Date(item.date)),
    item.description,
    item.amount,
    item.status
  ]);
  
  const csvData = [headers, ...rows];
  
  return {
    success: true,
    data: csvData,
    filename: `export_${formatDate(new Date(), 'yyyyMMdd')}.csv`
  };
}
```

## 🎯 Module Checklist

When creating a new business module:

- [ ] Create file in `src/server/modules/`
- [ ] Use consistent naming: `<module>Enhanced()` for main functions
- [ ] Implement error handling (try-catch)
- [ ] Add input validation
- [ ] Check permissions before operations
- [ ] Use locks for critical operations
- [ ] Log all actions to audit trail
- [ ] Return consistent format `{success, data/error, message}`
- [ ] Add JSDoc comments
- [ ] Handle role-based filtering
- [ ] Support date range filtering
- [ ] Add formatted fields for display
- [ ] Support sorting and pagination where appropriate
- [ ] Test with different roles

## 📦 Deployment After Phase 2 Updates

After creating new modules:

1. **Run deployment script**
   ```bash
   ./scripts/deploy.sh
   ```

2. **Verify in output**
   - Check all new modules are included
   - Verify `doGet()` function present
   - Check file size is reasonable

3. **Deploy to Apps Script**
   - Copy generated `script.gs`
   - Ensure `Index.html` is current
   - Test functions in script editor
   - Deploy as web app

4. **Test new features**
   - Test with different user roles
   - Verify permissions work
   - Check audit logging
   - Test filtering and sorting
   - Verify data accuracy

