// ============================================================================
// ATTACHMENTS MODULE
// ============================================================================
// Google Drive integration for file attachments and receipts
// ============================================================================

/**
 * Upload file to Google Drive
 * @param {string} fileName - File name
 * @param {string} mimeType - MIME type
 * @param {string} base64Data - Base64 encoded file data
 * @param {string} folderId - Optional folder ID
 * @returns {object} - Result with file ID and URL
 */
function uploadFileToDrive(fileName, mimeType, base64Data, folderId = null) {
  try {
    // Decode base64 data
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mimeType,
      fileName
    );
    
    // Get or create folder
    const folder = folderId ? DriveApp.getFolderById(folderId) : getOrCreateAttachmentsFolder();
    
    // Create file
    const file = folder.createFile(blob);
    
    // Make file accessible
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      thumbnailUrl: file.getThumbnailLink(),
      size: file.getSize(),
      mimeType: file.getMimeType()
    };
    
  } catch (error) {
    console.error(`Error uploading file: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload file from Drive picker
 * @param {string} fileId - File ID from Drive picker
 * @param {string} targetFolder - Target folder ('expenses', 'income', 'invoices')
 * @returns {object} - File details
 */
function linkDriveFile(fileId, targetFolder = 'expenses') {
  try {
    const file = DriveApp.getFileById(fileId);
    
    // Get or create target folder
    const folder = getOrCreateAttachmentsFolder(targetFolder);
    
    // Create a copy in our folder (optional - or just link to existing)
    // For now, we'll just return the file details
    
    return {
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      thumbnailUrl: file.getThumbnailLink(),
      size: file.getSize(),
      mimeType: file.getMimeType(),
      lastUpdated: file.getLastUpdated()
    };
    
  } catch (error) {
    console.error(`Error linking Drive file: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get or create attachments folder
 * @param {string} subfolder - Optional subfolder name
 * @returns {Folder} - Folder object
 */
function getOrCreateAttachmentsFolder(subfolder = null) {
  try {
    const rootFolderName = 'AutoMatrix ERP Attachments';
    
    // Check if root folder exists
    const folders = DriveApp.getFoldersByName(rootFolderName);
    let rootFolder;
    
    if (folders.hasNext()) {
      rootFolder = folders.next();
    } else {
      rootFolder = DriveApp.createFolder(rootFolderName);
    }
    
    // If subfolder requested, get or create it
    if (subfolder) {
      const subfolders = rootFolder.getFoldersByName(subfolder);
      if (subfolders.hasNext()) {
        return subfolders.next();
      } else {
        return rootFolder.createFolder(subfolder);
      }
    }
    
    return rootFolder;
    
  } catch (error) {
    console.error(`Error getting/creating folder: ${error.message}`);
    // Fallback to root Drive folder
    return DriveApp.getRootFolder();
  }
}

/**
 * Get file metadata
 * @param {string} fileId - File ID
 * @returns {object} - File metadata
 */
function getFileMetadata(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    
    return {
      success: true,
      data: {
        fileId: file.getId(),
        fileName: file.getName(),
        fileUrl: file.getUrl(),
        downloadUrl: file.getDownloadUrl(),
        thumbnailUrl: file.getThumbnailLink(),
        size: file.getSize(),
        formattedSize: formatFileSize(file.getSize()),
        mimeType: file.getMimeType(),
        created: file.getDateCreated(),
        lastUpdated: file.getLastUpdated(),
        owner: file.getOwner().getEmail()
      }
    };
    
  } catch (error) {
    console.error(`Error getting file metadata: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete file from Drive
 * @param {string} fileId - File ID
 * @returns {object} - Result
 */
function deleteFile(fileId) {
  try {
    const userEmail = getCurrentUser();
    
    // Check permission (only admins can delete)
    if (!hasPermission(userEmail, 'attachments.delete')) {
      return {
        success: false,
        error: 'Access denied'
      };
    }
    
    const file = DriveApp.getFileById(fileId);
    const fileName = file.getName();
    
    // Move to trash instead of permanent delete
    file.setTrashed(true);
    
    // Log audit
    logAudit(
      'DELETE_ATTACHMENT',
      'Attachments',
      fileId,
      'File',
      fileName,
      'TRASHED',
      'File moved to trash'
    );
    
    return {
      success: true,
      message: 'File moved to trash'
    };
    
  } catch (error) {
    console.error(`Error deleting file: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Attach file to expense
 * @param {number} expenseRowNum - Expense row number
 * @param {string} fileId - File ID
 * @param {string} fileUrl - File URL
 * @returns {object} - Result
 */
function attachFileToExpense(expenseRowNum, fileId, fileUrl) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Expenses sheet not found'
      };
    }
    
    // Update receipt fields
    sheet.getRange(expenseRowNum, EXPENSES_COLS.RECEIPT_FILE_ID + 1).setValue(fileId);
    sheet.getRange(expenseRowNum, EXPENSES_COLS.RECEIPT_URL + 1).setValue(fileUrl);
    
    // Log audit
    logAudit(
      'ATTACH_FILE',
      SHEET_NAMES.EXPENSES,
      expenseRowNum,
      'Receipt',
      null,
      fileId,
      'Receipt attached'
    );
    
    return {
      success: true,
      message: 'Receipt attached successfully'
    };
    
  } catch (error) {
    console.error(`Error attaching file to expense: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Attach file to income
 * @param {number} incomeRowNum - Income row number
 * @param {string} fileId - File ID
 * @param {string} fileUrl - File URL
 * @returns {object} - Result
 */
function attachFileToIncome(incomeRowNum, fileId, fileUrl) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INCOME);
    
    if (!sheet) {
      return {
        success: false,
        error: 'Income sheet not found'
      };
    }
    
    // Update receipt fields
    sheet.getRange(incomeRowNum, INCOME_COLS.RECEIPT_FILE_ID + 1).setValue(fileId);
    sheet.getRange(incomeRowNum, INCOME_COLS.RECEIPT_URL + 1).setValue(fileUrl);
    
    // Log audit
    logAudit(
      'ATTACH_FILE',
      SHEET_NAMES.INCOME,
      incomeRowNum,
      'Receipt',
      null,
      fileId,
      'Receipt attached'
    );
    
    return {
      success: true,
      message: 'Receipt attached successfully'
    };
    
  } catch (error) {
    console.error(`Error attaching file to income: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get attachments for record
 * @param {string} type - Record type ('EXPENSE', 'INCOME')
 * @param {number} rowNum - Row number
 * @returns {object} - Attachments list
 */
function getAttachmentsForRecord(type, rowNum) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = type === 'EXPENSE' ? SHEET_NAMES.EXPENSES : SHEET_NAMES.INCOME;
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const attachments = [];
    
    if (type === 'EXPENSE') {
      const fileId = data[EXPENSES_COLS.RECEIPT_FILE_ID];
      const fileUrl = data[EXPENSES_COLS.RECEIPT_URL];
      
      if (fileId) {
        const metadata = getFileMetadata(fileId);
        if (metadata.success) {
          attachments.push(metadata.data);
        }
      } else if (fileUrl) {
        // External URL (not in Drive)
        attachments.push({
          fileUrl: fileUrl,
          fileName: 'External Receipt',
          isExternal: true
        });
      }
    } else {
      const fileId = data[INCOME_COLS.RECEIPT_FILE_ID];
      const fileUrl = data[INCOME_COLS.RECEIPT_URL];
      
      if (fileId) {
        const metadata = getFileMetadata(fileId);
        if (metadata.success) {
          attachments.push(metadata.data);
        }
      } else if (fileUrl) {
        attachments.push({
          fileUrl: fileUrl,
          fileName: 'External Receipt',
          isExternal: true
        });
      }
    }
    
    return {
      success: true,
      data: attachments
    };
    
  } catch (error) {
    console.error(`Error getting attachments: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate public download URL for file
 * @param {string} fileId - File ID
 * @returns {object} - Download URL
 */
function getDownloadUrl(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    
    // Make sure file is accessible
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      success: true,
      downloadUrl: file.getDownloadUrl(),
      viewUrl: file.getUrl(),
      thumbnailUrl: file.getThumbnailLink()
    };
    
  } catch (error) {
    console.error(`Error getting download URL: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get folder ID for attachments
 * @returns {object} - Folder ID and URL
 */
function getAttachmentsFolderId() {
  try {
    const folder = getOrCreateAttachmentsFolder();
    
    return {
      success: true,
      folderId: folder.getId(),
      folderUrl: folder.getUrl(),
      folderName: folder.getName()
    };
    
  } catch (error) {
    console.error(`Error getting folder ID: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List files in attachments folder
 * @param {string} subfolder - Optional subfolder
 * @param {number} limit - Max number of files
 * @returns {object} - List of files
 */
function listAttachments(subfolder = null, limit = 100) {
  try {
    const folder = getOrCreateAttachmentsFolder(subfolder);
    const files = folder.getFiles();
    
    const fileList = [];
    let count = 0;
    
    while (files.hasNext() && count < limit) {
      const file = files.next();
      
      fileList.push({
        fileId: file.getId(),
        fileName: file.getName(),
        fileUrl: file.getUrl(),
        size: file.getSize(),
        formattedSize: formatFileSize(file.getSize()),
        mimeType: file.getMimeType(),
        created: file.getDateCreated(),
        lastUpdated: file.getLastUpdated()
      });
      
      count++;
    }
    
    return {
      success: true,
      data: fileList,
      total: fileList.length
    };
    
  } catch (error) {
    console.error(`Error listing attachments: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if file exists and is accessible
 * @param {string} fileId - File ID
 * @returns {object} - Result
 */
function checkFileAccess(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    
    return {
      success: true,
      exists: true,
      accessible: true,
      fileName: file.getName()
    };
    
  } catch (error) {
    return {
      success: true,
      exists: false,
      accessible: false,
      error: error.message
    };
  }
}

/**
 * Validate receipt before approval
 * @param {string} type - Type ('EXPENSE' or 'INCOME')
 * @param {number} rowNum - Row number
 * @param {number} amount - Transaction amount
 * @returns {object} - Validation result
 */
function validateReceiptRequirement(type, rowNum, amount) {
  try {
    // Check if receipt is required based on amount
    if (amount < VALIDATION_RULES.RECEIPT_MANDATORY_THRESHOLD) {
      return {
        success: true,
        required: false,
        hasReceipt: false,
        message: 'Receipt not required for this amount'
      };
    }
    
    // Get attachments
    const attachments = getAttachmentsForRecord(type, rowNum);
    
    const hasReceipt = attachments.success && attachments.data.length > 0;
    
    return {
      success: true,
      required: true,
      hasReceipt: hasReceipt,
      message: hasReceipt ? 
        'Receipt attached' : 
        `Receipt is required for amounts ≥ ${formatCurrency(VALIDATION_RULES.RECEIPT_MANDATORY_THRESHOLD)}`
    };
    
  } catch (error) {
    console.error(`Error validating receipt: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Bulk upload files
 * @param {array} files - Array of file objects {fileName, mimeType, base64Data}
 * @param {string} folderId - Optional folder ID
 * @returns {object} - Upload results
 */
function bulkUploadFiles(files, folderId = null) {
  try {
    const results = {
      success: 0,
      failed: 0,
      files: []
    };
    
    files.forEach(file => {
      try {
        const result = uploadFileToDrive(file.fileName, file.mimeType, file.base64Data, folderId);
        
        if (result.success) {
          results.success++;
          results.files.push(result);
        } else {
          results.failed++;
          results.files.push({ fileName: file.fileName, error: result.error });
        }
      } catch (error) {
        results.failed++;
        results.files.push({ fileName: file.fileName, error: error.message });
      }
    });
    
    return {
      success: true,
      message: `Uploaded ${results.success} of ${files.length} files`,
      results: results
    };
    
  } catch (error) {
    console.error(`Error bulk uploading: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
