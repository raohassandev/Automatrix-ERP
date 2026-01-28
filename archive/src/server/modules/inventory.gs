// ============================================================================
// INVENTORY MODULE
// ============================================================================
// Inventory ledger system with IN/OUT transactions and stock tracking
// ============================================================================

/**
 * Get inventory items with filtering
 * @param {object} filters - Filter options
 * @returns {object} - List of inventory items
 */
function getInventoryEnhanced(filters = {}) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
    
    if (!sheet) {
      return { success: true, data: [], total: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const items = [];
    
    for (let i = 1; i < data.length; i++) {
      const item = {
        rowNum: i + 1,
        itemName: data[i][INVENTORY_COLS.ITEM_NAME],
        category: data[i][INVENTORY_COLS.CATEGORY],
        quantity: parseFloat(data[i][INVENTORY_COLS.QUANTITY]) || 0,
        unit: data[i][INVENTORY_COLS.UNIT],
        unitCost: parseFloat(data[i][INVENTORY_COLS.UNIT_COST]) || 0,
        totalValue: parseFloat(data[i][INVENTORY_COLS.TOTAL_VALUE]) || 0,
        minStock: parseFloat(data[i][INVENTORY_COLS.MIN_STOCK]) || 0,
        reorderQty: parseFloat(data[i][INVENTORY_COLS.REORDER_QTY]) || 0,
        reservedQty: parseFloat(data[i][INVENTORY_COLS.RESERVED_QTY]) || 0,
        availableQty: parseFloat(data[i][INVENTORY_COLS.AVAILABLE_QTY]) || 0,
        lastPurchaseDate: data[i][INVENTORY_COLS.LAST_PURCHASE_DATE],
        avgUsage30Days: parseFloat(data[i][INVENTORY_COLS.AVG_USAGE_30_DAYS]) || 0,
        lastUpdated: data[i][INVENTORY_COLS.LAST_UPDATED]
      };
      
      // Apply filters
      if (filters.category && item.category !== filters.category) {
        continue;
      }
      
      if (filters.lowStock && item.quantity > item.minStock) {
        continue;
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!item.itemName.toLowerCase().includes(searchLower)) {
          continue;
        }
      }
      
      // Add formatted and calculated fields
      item.formattedUnitCost = formatCurrency(item.unitCost);
      item.formattedTotalValue = formatCurrency(item.totalValue);
      item.stockStatus = getStockStatus(item.quantity, item.minStock);
      item.needsReorder = item.quantity <= item.minStock;
      
      items.push(item);
    }
    
    return {
      success: true,
      data: items,
      total: items.length
    };
    
  } catch (error) {
    console.error(`Error getting inventory: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get stock status indicator
 * @private
 */
function getStockStatus(quantity, minStock) {
  if (minStock === 0) {
    return { status: 'Unknown', color: '#6c757d', icon: '❓' };
  }
  
  const ratio = quantity / minStock;
  
  if (ratio <= 0.5) {
    return { status: 'Critical', color: '#dc3545', icon: '🔴' };
  } else if (ratio <= 1) {
    return { status: 'Low', color: '#ffc107', icon: '🟡' };
  } else if (ratio <= 2) {
    return { status: 'Normal', color: '#28a745', icon: '🟢' };
  } else {
    return { status: 'High', color: '#17a2b8', icon: '🔵' };
  }
}

/**
 * Record inventory ledger entry (IN/OUT transaction)
 * @param {object} transaction - Transaction data
 * @returns {object} - Result
 */
function recordInventoryTransaction(transaction) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'inventory.adjust')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    // Validate transaction
    const validation = validateInventoryTransaction(transaction);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Validation failed',
        details: validation.errors
      };
    }
    
    return withLock(`inventory_${transaction.itemName}`, () => {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const invSheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
      const ledgerSheet = getOrCreateSheet(SHEET_NAMES.INVENTORY_LEDGER);
      
      // Find item in inventory
      const itemRow = findInventoryItem(transaction.itemName);
      
      if (itemRow === -1) {
        throw new Error(`Item not found: ${transaction.itemName}`);
      }
      
      const itemData = invSheet.getRange(itemRow, 1, 1, invSheet.getLastColumn()).getValues()[0];
      const currentQty = parseFloat(itemData[INVENTORY_COLS.QUANTITY]) || 0;
      
      // Calculate new quantity
      let quantityChange = parseFloat(transaction.quantity);
      if (transaction.type === STATUS.SALE || 
          transaction.type === STATUS.PROJECT_ALLOCATION ||
          transaction.type === 'OUT') {
        quantityChange = -Math.abs(quantityChange);
      }
      
      const newQty = currentQty + quantityChange;
      
      // Check if sufficient stock for OUT transactions
      if (quantityChange < 0 && newQty < 0) {
        throw new Error(`Insufficient stock. Available: ${currentQty}, Required: ${Math.abs(quantityChange)}`);
      }
      
      // Record ledger entry
      const unitCost = transaction.unitCost || parseFloat(itemData[INVENTORY_COLS.UNIT_COST]) || 0;
      const total = Math.abs(quantityChange) * unitCost;
      
      const ledgerRow = [
        new Date(),
        transaction.itemName,
        transaction.type,
        quantityChange,
        unitCost,
        total,
        transaction.reference || '',
        transaction.project || '',
        userEmail,
        newQty
      ];
      
      ledgerSheet.appendRow(ledgerRow);
      
      // Update inventory quantity
      invSheet.getRange(itemRow, INVENTORY_COLS.QUANTITY + 1).setValue(newQty);
      
      // Update total value
      const newTotalValue = newQty * unitCost;
      invSheet.getRange(itemRow, INVENTORY_COLS.TOTAL_VALUE + 1).setValue(newTotalValue);
      
      // Update available quantity (quantity - reserved)
      const reservedQty = parseFloat(itemData[INVENTORY_COLS.RESERVED_QTY]) || 0;
      const availableQty = newQty - reservedQty;
      invSheet.getRange(itemRow, INVENTORY_COLS.AVAILABLE_QTY + 1).setValue(availableQty);
      
      // Update last updated
      invSheet.getRange(itemRow, INVENTORY_COLS.LAST_UPDATED + 1).setValue(new Date());
      
      // Update last purchase date if this is a purchase
      if (transaction.type === STATUS.PURCHASE) {
        invSheet.getRange(itemRow, INVENTORY_COLS.LAST_PURCHASE_DATE + 1).setValue(new Date());
      }
      
      // Log audit
      logInventoryLedgerEntry(transaction.itemName, transaction.type, quantityChange, transaction.reference);
      
      return {
        success: true,
        message: `Transaction recorded: ${quantityChange > 0 ? '+' : ''}${quantityChange} ${itemData[INVENTORY_COLS.UNIT]}`,
        newQuantity: newQty
      };
    });
    
  } catch (error) {
    console.error(`Error recording transaction: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate inventory transaction
 * @private
 */
function validateInventoryTransaction(transaction) {
  const errors = [];
  
  if (!transaction.itemName || transaction.itemName.trim() === '') {
    errors.push('Item name is required');
  }
  
  if (!transaction.type) {
    errors.push('Transaction type is required');
  }
  
  const validTypes = [STATUS.PURCHASE, STATUS.SALE, STATUS.ADJUSTMENT, STATUS.TRANSFER, STATUS.RETURN, STATUS.PROJECT_ALLOCATION];
  if (transaction.type && !validTypes.includes(transaction.type)) {
    errors.push(`Invalid transaction type. Must be one of: ${validTypes.join(', ')}`);
  }
  
  if (!transaction.quantity || transaction.quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Find inventory item row number
 * @private
 */
function findInventoryItem(itemName) {
  return findRowByValue(SHEET_NAMES.INVENTORY, INVENTORY_COLS.ITEM_NAME, itemName);
}

/**
 * Get inventory ledger for item
 * @param {string} itemName - Item name
 * @param {number} limit - Number of entries (default: 50)
 * @returns {object} - Ledger entries
 */
function getInventoryLedger(itemName, limit = 50) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ledgerSheet = ss.getSheetByName(SHEET_NAMES.INVENTORY_LEDGER);
    
    if (!ledgerSheet) {
      return { success: true, data: [] };
    }
    
    const data = ledgerSheet.getDataRange().getValues();
    const entries = [];
    
    // Get entries for this item (reverse order - newest first)
    for (let i = data.length - 1; i >= 1 && entries.length < limit; i--) {
      if (data[i][INVENTORY_LEDGER_COLS.ITEM] === itemName) {
        entries.push({
          date: data[i][INVENTORY_LEDGER_COLS.DATE],
          type: data[i][INVENTORY_LEDGER_COLS.TYPE],
          quantity: parseFloat(data[i][INVENTORY_LEDGER_COLS.QUANTITY]) || 0,
          unitCost: parseFloat(data[i][INVENTORY_LEDGER_COLS.UNIT_COST]) || 0,
          total: parseFloat(data[i][INVENTORY_LEDGER_COLS.TOTAL]) || 0,
          reference: data[i][INVENTORY_LEDGER_COLS.REFERENCE],
          project: data[i][INVENTORY_LEDGER_COLS.PROJECT],
          user: data[i][INVENTORY_LEDGER_COLS.USER],
          runningBalance: parseFloat(data[i][INVENTORY_LEDGER_COLS.RUNNING_BALANCE]) || 0,
          formattedDate: formatDateForDisplay(new Date(data[i][INVENTORY_LEDGER_COLS.DATE])),
          formattedTotal: formatCurrency(parseFloat(data[i][INVENTORY_LEDGER_COLS.TOTAL]) || 0)
        });
      }
    }
    
    return {
      success: true,
      data: entries
    };
    
  } catch (error) {
    console.error(`Error getting ledger: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Add new inventory item
 * @param {object} itemData - Item data
 * @returns {object} - Result
 */
function addInventoryItem(itemData) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'inventory.add')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    // Check if item already exists
    const existing = findInventoryItem(itemData.itemName);
    if (existing !== -1) {
      return {
        success: false,
        error: 'Item with this name already exists'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Inventory sheet not found'
      };
    }
    
    const rowData = [
      sanitizeInput(itemData.itemName),
      itemData.category || '',
      0, // Initial quantity
      itemData.unit || 'pcs',
      parseFloat(itemData.unitCost) || 0,
      0, // Total value
      parseFloat(itemData.minStock) || 0,
      parseFloat(itemData.reorderQty) || 0,
      0, // Reserved quantity
      0, // Available quantity
      '', // Last purchase date
      0, // Avg usage
      new Date() // Last updated
    ];
    
    const rowNum = appendRowWithLock(SHEET_NAMES.INVENTORY, rowData);
    
    // Log audit
    logAudit('ADD_INVENTORY_ITEM', SHEET_NAMES.INVENTORY, itemData.itemName, 'ALL', null, JSON.stringify(itemData), 'New item added');
    
    return {
      success: true,
      message: 'Item added successfully',
      rowNum: rowNum
    };
    
  } catch (error) {
    console.error(`Error adding item: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update inventory item details (not quantity)
 * @param {string} itemName - Item name
 * @param {object} updates - Fields to update
 * @returns {object} - Result
 */
function updateInventoryItem(itemName, updates) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission
    if (!hasPermission(userEmail, 'inventory.edit')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    const rowNum = findInventoryItem(itemName);
    if (rowNum === -1) {
      return {
        success: false,
        error: 'Item not found'
      };
    }
    
    return withLock(`inventory_${itemName}`, () => {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
      
      const updateMap = {};
      
      if (updates.category) {
        updateMap[INVENTORY_COLS.CATEGORY] = updates.category;
      }
      if (updates.unit) {
        updateMap[INVENTORY_COLS.UNIT] = updates.unit;
      }
      if (updates.unitCost !== undefined) {
        updateMap[INVENTORY_COLS.UNIT_COST] = parseFloat(updates.unitCost);
      }
      if (updates.minStock !== undefined) {
        updateMap[INVENTORY_COLS.MIN_STOCK] = parseFloat(updates.minStock);
      }
      if (updates.reorderQty !== undefined) {
        updateMap[INVENTORY_COLS.REORDER_QTY] = parseFloat(updates.reorderQty);
      }
      
      // Update sheet
      Object.keys(updateMap).forEach(colIndex => {
        const col = parseInt(colIndex) + 1;
        sheet.getRange(rowNum, col).setValue(updateMap[colIndex]);
      });
      
      // Update last updated
      sheet.getRange(rowNum, INVENTORY_COLS.LAST_UPDATED + 1).setValue(new Date());
      
      // Log audit
      logAudit('UPDATE_INVENTORY_ITEM', SHEET_NAMES.INVENTORY, itemName, 'Multiple', null, JSON.stringify(updates), 'Item updated');
      
      return {
        success: true,
        message: 'Item updated successfully'
      };
    });
    
  } catch (error) {
    console.error(`Error updating item: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get reorder list (items below min stock)
 * @returns {object} - List of items needing reorder
 */
function getReorderList() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
    
    if (!sheet) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const reorderItems = [];
    
    for (let i = 1; i < data.length; i++) {
      const quantity = parseFloat(data[i][INVENTORY_COLS.QUANTITY]) || 0;
      const minStock = parseFloat(data[i][INVENTORY_COLS.MIN_STOCK]) || 0;
      const reorderQty = parseFloat(data[i][INVENTORY_COLS.REORDER_QTY]) || 0;
      
      if (minStock > 0 && quantity <= minStock) {
        reorderItems.push({
          itemName: data[i][INVENTORY_COLS.ITEM_NAME],
          category: data[i][INVENTORY_COLS.CATEGORY],
          currentStock: quantity,
          minStock: minStock,
          reorderQty: reorderQty,
          suggestedOrder: reorderQty || (minStock * 2),
          unit: data[i][INVENTORY_COLS.UNIT],
          unitCost: parseFloat(data[i][INVENTORY_COLS.UNIT_COST]) || 0,
          estimatedCost: (reorderQty || (minStock * 2)) * (parseFloat(data[i][INVENTORY_COLS.UNIT_COST]) || 0),
          stockStatus: getStockStatus(quantity, minStock)
        });
      }
    }
    
    // Sort by urgency (lowest ratio first)
    reorderItems.sort((a, b) => {
      const ratioA = a.currentStock / a.minStock;
      const ratioB = b.currentStock / b.minStock;
      return ratioA - ratioB;
    });
    
    return {
      success: true,
      data: reorderItems,
      total: reorderItems.length
    };
    
  } catch (error) {
    console.error(`Error getting reorder list: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Reserve stock for project
 * @param {string} itemName - Item name
 * @param {number} quantity - Quantity to reserve
 * @param {string} projectId - Project ID
 * @returns {object} - Result
 */
function reserveStock(itemName, quantity, projectId) {
  try {
    return withLock(`inventory_${itemName}`, () => {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
      
      const rowNum = findInventoryItem(itemName);
      if (rowNum === -1) {
        throw new Error('Item not found');
      }
      
      const itemData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
      const currentQty = parseFloat(itemData[INVENTORY_COLS.QUANTITY]) || 0;
      const reservedQty = parseFloat(itemData[INVENTORY_COLS.RESERVED_QTY]) || 0;
      const availableQty = currentQty - reservedQty;
      
      if (availableQty < quantity) {
        throw new Error(`Insufficient available stock. Available: ${availableQty}, Requested: ${quantity}`);
      }
      
      // Update reserved quantity
      const newReservedQty = reservedQty + quantity;
      sheet.getRange(rowNum, INVENTORY_COLS.RESERVED_QTY + 1).setValue(newReservedQty);
      
      // Update available quantity
      const newAvailableQty = currentQty - newReservedQty;
      sheet.getRange(rowNum, INVENTORY_COLS.AVAILABLE_QTY + 1).setValue(newAvailableQty);
      
      // Log audit
      logAudit('RESERVE_STOCK', SHEET_NAMES.INVENTORY, itemName, 'Reserved', reservedQty, newReservedQty, `Reserved for project: ${projectId}`);
      
      return {
        success: true,
        message: `Reserved ${quantity} ${itemData[INVENTORY_COLS.UNIT]} for ${projectId}`
      };
    });
    
  } catch (error) {
    console.error(`Error reserving stock: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Release reserved stock
 * @param {string} itemName - Item name
 * @param {number} quantity - Quantity to release
 * @param {string} projectId - Project ID
 * @returns {object} - Result
 */
function releaseStock(itemName, quantity, projectId) {
  try {
    return withLock(`inventory_${itemName}`, () => {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
      
      const rowNum = findInventoryItem(itemName);
      if (rowNum === -1) {
        throw new Error('Item not found');
      }
      
      const itemData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
      const currentQty = parseFloat(itemData[INVENTORY_COLS.QUANTITY]) || 0;
      const reservedQty = parseFloat(itemData[INVENTORY_COLS.RESERVED_QTY]) || 0;
      
      if (reservedQty < quantity) {
        throw new Error(`Cannot release ${quantity}. Only ${reservedQty} reserved.`);
      }
      
      // Update reserved quantity
      const newReservedQty = reservedQty - quantity;
      sheet.getRange(rowNum, INVENTORY_COLS.RESERVED_QTY + 1).setValue(newReservedQty);
      
      // Update available quantity
      const newAvailableQty = currentQty - newReservedQty;
      sheet.getRange(rowNum, INVENTORY_COLS.AVAILABLE_QTY + 1).setValue(newAvailableQty);
      
      // Log audit
      logAudit('RELEASE_STOCK', SHEET_NAMES.INVENTORY, itemName, 'Reserved', reservedQty, newReservedQty, `Released from project: ${projectId}`);
      
      return {
        success: true,
        message: `Released ${quantity} ${itemData[INVENTORY_COLS.UNIT]} from ${projectId}`
      };
    });
    
  } catch (error) {
    console.error(`Error releasing stock: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get inventory valuation
 * @returns {object} - Valuation summary
 */
function getInventoryValuation() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
    
    if (!sheet) {
      return { success: true, data: { totalValue: 0, items: 0 } };
    }
    
    const data = sheet.getDataRange().getValues();
    let totalValue = 0;
    let itemCount = 0;
    const byCategory = {};
    
    for (let i = 1; i < data.length; i++) {
      const category = data[i][INVENTORY_COLS.CATEGORY] || 'Uncategorized';
      const value = parseFloat(data[i][INVENTORY_COLS.TOTAL_VALUE]) || 0;
      
      totalValue += value;
      itemCount++;
      
      if (!byCategory[category]) {
        byCategory[category] = { value: 0, items: 0 };
      }
      byCategory[category].value += value;
      byCategory[category].items++;
    }
    
    return {
      success: true,
      data: {
        totalValue: totalValue,
        itemCount: itemCount,
        byCategory: byCategory,
        formattedTotal: formatCurrency(totalValue)
      }
    };
    
  } catch (error) {
    console.error(`Error getting valuation: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
