// ============================================================================
// NOTIFICATIONS MODULE
// ============================================================================
// Email notifications and alerts for approvals and updates
// ============================================================================

/**
 * Send approval notification to approvers
 * @param {object} item - Item needing approval {type, rowNum, amount, submittedBy, description}
 * @returns {object} - Result
 */
function sendApprovalNotification(item) {
  try {
    const approvers = getApproversForAmount(item.type, item.amount);
    
    approvers.forEach(approverEmail => {
      const subject = `[AutoMatrix ERP] New ${item.type} Approval Required`;
      const body = generateApprovalEmailBody(item);
      
      sendEmail(approverEmail, subject, body);
    });
    
    return {
      success: true,
      message: `Notification sent to ${approvers.length} approver(s)`
    };
    
  } catch (error) {
    console.error(`Error sending approval notification: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get list of approvers for given amount
 * @private
 */
function getApproversForAmount(type, amount) {
  const levels = APPROVAL_LEVELS[type];
  if (!levels) return [];
  
  // Find required approval level
  let requiredLevel = null;
  for (const level of levels) {
    if (amount <= level.max) {
      requiredLevel = level;
      break;
    }
  }
  
  if (!requiredLevel) {
    requiredLevel = levels[levels.length - 1];
  }
  
  // Get all users with this role
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
  
  if (!empSheet) return [];
  
  const data = empSheet.getDataRange().getValues();
  const approvers = [];
  
  for (let i = 1; i < data.length; i++) {
    const role = data[i][EMPLOYEES_COLS.ROLE];
    const email = data[i][EMPLOYEES_COLS.EMAIL];
    const status = data[i][EMPLOYEES_COLS.STATUS];
    
    if (status === STATUS.ACTIVE && (role === requiredLevel.role || role === ROLES.CEO || role === ROLES.OWNER)) {
      approvers.push(email);
    }
  }
  
  return approvers;
}

/**
 * Generate approval email body
 * @private
 */
function generateApprovalEmailBody(item) {
  const itemType = item.type === 'EXPENSE' ? 'Expense' : 'Income';
  
  return `
<html>
<body style="font-family: Arial, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
    <h2 style="color: #4285f4;">New ${itemType} Requires Your Approval</h2>
    
    <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p><strong>Type:</strong> ${itemType}</p>
      <p><strong>Amount:</strong> ${formatCurrency(item.amount)}</p>
      <p><strong>Description:</strong> ${item.description}</p>
      <p><strong>Submitted By:</strong> ${item.submittedBy}</p>
      <p><strong>Date:</strong> ${formatDateForDisplay(new Date(item.date))}</p>
      ${item.project ? `<p><strong>Project:</strong> ${item.project}</p>` : ''}
    </div>
    
    <p>Please review and approve/reject this ${itemType.toLowerCase()} in the AutoMatrix ERP system.</p>
    
    <div style="margin: 30px 0;">
      <a href="${getWebAppUrl()}" style="background: #4285f4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Review ${itemType}
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    
    <p style="font-size: 12px; color: #666;">
      This is an automated notification from AutoMatrix ERP.<br>
      Please do not reply to this email.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send approval result notification to submitter
 * @param {string} submitterEmail - Submitter email
 * @param {object} item - Item details
 * @param {string} status - APPROVED or REJECTED
 * @param {string} reason - Reason for rejection or notes
 * @returns {object} - Result
 */
function sendApprovalResultNotification(submitterEmail, item, status, reason = '') {
  try {
    const itemType = item.type === 'EXPENSE' ? 'Expense' : 'Income';
    const isApproved = status === STATUS.APPROVED || status === STATUS.PARTIALLY_APPROVED;
    
    const subject = `[AutoMatrix ERP] Your ${itemType} ${isApproved ? 'Approved' : 'Rejected'}`;
    const body = generateApprovalResultEmailBody(item, status, reason);
    
    sendEmail(submitterEmail, subject, body);
    
    return {
      success: true,
      message: 'Notification sent to submitter'
    };
    
  } catch (error) {
    console.error(`Error sending approval result notification: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate approval result email body
 * @private
 */
function generateApprovalResultEmailBody(item, status, reason) {
  const itemType = item.type === 'EXPENSE' ? 'Expense' : 'Income';
  const isApproved = status === STATUS.APPROVED || status === STATUS.PARTIALLY_APPROVED;
  const isPartial = status === STATUS.PARTIALLY_APPROVED;
  
  return `
<html>
<body style="font-family: Arial, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
    <h2 style="color: ${isApproved ? '#28a745' : '#dc3545'};">
      Your ${itemType} ${isApproved ? 'Approved' : 'Rejected'}
    </h2>
    
    <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p><strong>Type:</strong> ${itemType}</p>
      <p><strong>Amount:</strong> ${formatCurrency(item.amount)}</p>
      ${isPartial ? `<p><strong>Approved Amount:</strong> ${formatCurrency(item.approvedAmount)}</p>` : ''}
      <p><strong>Description:</strong> ${item.description}</p>
      <p><strong>Status:</strong> <span style="color: ${isApproved ? '#28a745' : '#dc3545'}; font-weight: bold;">${status}</span></p>
      <p><strong>Processed By:</strong> ${item.approvedBy}</p>
      ${reason ? `<p><strong>${isApproved ? 'Notes' : 'Reason'}:</strong> ${reason}</p>` : ''}
    </div>
    
    ${isApproved ? 
      `<p style="color: #28a745;">✅ Your ${itemType.toLowerCase()} has been approved and processed.</p>` :
      `<p style="color: #dc3545;">❌ Your ${itemType.toLowerCase()} was rejected. Please review the reason above.</p>`
    }
    
    <div style="margin: 30px 0;">
      <a href="${getWebAppUrl()}" style="background: #4285f4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
        View in AutoMatrix ERP
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    
    <p style="font-size: 12px; color: #666;">
      This is an automated notification from AutoMatrix ERP.<br>
      Please do not reply to this email.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send daily approval digest
 * @param {string} approverEmail - Approver email
 * @returns {object} - Result
 */
function sendDailyApprovalDigest(approverEmail) {
  try {
    const pendingApprovals = getPendingApprovalsForUser(approverEmail);
    
    if (pendingApprovals.length === 0) {
      return {
        success: true,
        message: 'No pending approvals'
      };
    }
    
    const subject = `[AutoMatrix ERP] Daily Digest - ${pendingApprovals.length} Pending Approval${pendingApprovals.length > 1 ? 's' : ''}`;
    const body = generateDigestEmailBody(pendingApprovals);
    
    sendEmail(approverEmail, subject, body);
    
    return {
      success: true,
      message: `Digest sent with ${pendingApprovals.length} items`
    };
    
  } catch (error) {
    console.error(`Error sending digest: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get pending approvals for specific user
 * @private
 */
function getPendingApprovalsForUser(userEmail) {
  const result = getPendingApprovalsEnhanced();
  return result.success ? result.data : [];
}

/**
 * Generate digest email body
 * @private
 */
function generateDigestEmailBody(approvals) {
  const totalAmount = approvals.reduce((sum, item) => sum + item.amount, 0);
  
  const itemsHtml = approvals.map(item => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px;">${item.type}</td>
      <td style="padding: 10px;">${formatCurrency(item.amount)}</td>
      <td style="padding: 10px;">${truncateText(item.description, 50)}</td>
      <td style="padding: 10px;">${item.submitterName}</td>
      <td style="padding: 10px;">${item.daysWaiting} days</td>
    </tr>
  `).join('');
  
  return `
<html>
<body style="font-family: Arial, sans-serif; color: #333;">
  <div style="max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
    <h2 style="color: #4285f4;">Daily Approval Digest</h2>
    
    <div style="background: #f0f8ff; padding: 15px; margin: 20px 0; border-left: 4px solid #4285f4; border-radius: 3px;">
      <p style="margin: 5px 0;"><strong>Pending Approvals:</strong> ${approvals.length}</p>
      <p style="margin: 5px 0;"><strong>Total Amount:</strong> ${formatCurrency(totalAmount)}</p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #4285f4; color: white;">
          <th style="padding: 10px; text-align: left;">Type</th>
          <th style="padding: 10px; text-align: left;">Amount</th>
          <th style="padding: 10px; text-align: left;">Description</th>
          <th style="padding: 10px; text-align: left;">Submitted By</th>
          <th style="padding: 10px; text-align: left;">Waiting</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div style="margin: 30px 0;">
      <a href="${getWebAppUrl()}" style="background: #4285f4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Review All Approvals
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    
    <p style="font-size: 12px; color: #666;">
      This is your daily approval digest from AutoMatrix ERP.<br>
      To unsubscribe from these notifications, please contact your administrator.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send low stock alert
 * @param {array} lowStockItems - Array of low stock items
 * @returns {object} - Result
 */
function sendLowStockAlert(lowStockItems) {
  try {
    if (lowStockItems.length === 0) {
      return {
        success: true,
        message: 'No low stock items'
      };
    }
    
    // Send to Finance Manager and CEO
    const recipients = getRecipientsByRole([ROLES.FINANCE_MANAGER, ROLES.CEO, ROLES.OWNER]);
    
    const subject = `[AutoMatrix ERP] Low Stock Alert - ${lowStockItems.length} Item${lowStockItems.length > 1 ? 's' : ''}`;
    const body = generateLowStockEmailBody(lowStockItems);
    
    recipients.forEach(email => {
      sendEmail(email, subject, body);
    });
    
    return {
      success: true,
      message: `Alert sent to ${recipients.length} recipient(s)`
    };
    
  } catch (error) {
    console.error(`Error sending low stock alert: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate low stock email body
 * @private
 */
function generateLowStockEmailBody(items) {
  const itemsHtml = items.map(item => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px;">${item.itemName}</td>
      <td style="padding: 10px; color: #dc3545; font-weight: bold;">${item.quantity}</td>
      <td style="padding: 10px;">${item.minStock}</td>
      <td style="padding: 10px;">${item.reorderQty || 'N/A'}</td>
    </tr>
  `).join('');
  
  return `
<html>
<body style="font-family: Arial, sans-serif; color: #333;">
  <div style="max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
    <h2 style="color: #dc3545;">⚠️ Low Stock Alert</h2>
    
    <p>The following items are running low on stock:</p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #dc3545; color: white;">
          <th style="padding: 10px; text-align: left;">Item</th>
          <th style="padding: 10px; text-align: left;">Current Stock</th>
          <th style="padding: 10px; text-align: left;">Min Stock</th>
          <th style="padding: 10px; text-align: left;">Reorder Qty</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <p>Please review and place orders as needed.</p>
    
    <div style="margin: 30px 0;">
      <a href="${getWebAppUrl()}" style="background: #4285f4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
        View Inventory
      </a>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Get recipients by role
 * @private
 */
function getRecipientsByRole(roles) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
  
  if (!empSheet) return [];
  
  const data = empSheet.getDataRange().getValues();
  const recipients = [];
  
  for (let i = 1; i < data.length; i++) {
    const role = data[i][EMPLOYEES_COLS.ROLE];
    const email = data[i][EMPLOYEES_COLS.EMAIL];
    const status = data[i][EMPLOYEES_COLS.STATUS];
    
    if (status === STATUS.ACTIVE && roles.includes(role)) {
      recipients.push(email);
    }
  }
  
  return recipients;
}

/**
 * Send email (wrapper for MailApp)
 * @private
 */
function sendEmail(to, subject, htmlBody) {
  try {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: htmlBody
    });
    
    console.log(`Email sent to ${to}: ${subject}`);
    
    // Log to notifications sheet if exists
    logNotification(to, subject, 'SENT');
    
  } catch (error) {
    console.error(`Failed to send email to ${to}: ${error.message}`);
    logNotification(to, subject, 'FAILED');
    throw error;
  }
}

/**
 * Log notification to sheet
 * @private
 */
function logNotification(recipient, subject, status) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let notifSheet = ss.getSheetByName(SHEET_NAMES.NOTIFICATIONS);
    
    if (!notifSheet) {
      notifSheet = ss.insertSheet(SHEET_NAMES.NOTIFICATIONS);
      notifSheet.appendRow(['Timestamp', 'Recipient', 'Subject', 'Status']);
    }
    
    notifSheet.appendRow([new Date(), recipient, subject, status]);
  } catch (error) {
    console.error(`Failed to log notification: ${error.message}`);
  }
}

/**
 * Get Web App URL (from script properties or default)
 * @private
 */
function getWebAppUrl() {
  try {
    const url = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
    return url || 'https://script.google.com';
  } catch (error) {
    return 'https://script.google.com';
  }
}

/**
 * Set Web App URL (call after deployment)
 * @param {string} url - Web App URL
 */
function setWebAppUrl(url) {
  PropertiesService.getScriptProperties().setProperty('WEB_APP_URL', url);
}

/**
 * Schedule daily digest (to be called from time-driven trigger)
 */
function scheduledDailyDigest() {
  try {
    const approvers = getRecipientsByRole([ROLES.CEO, ROLES.OWNER, ROLES.FINANCE_MANAGER, ROLES.MANAGER]);
    
    approvers.forEach(email => {
      sendDailyApprovalDigest(email);
    });
    
    console.log(`Daily digest sent to ${approvers.length} approvers`);
  } catch (error) {
    console.error(`Error in scheduled digest: ${error.message}`);
  }
}

/**
 * Check low stock and send alerts (to be called from time-driven trigger)
 */
function scheduledLowStockCheck() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const invSheet = ss.getSheetByName(SHEET_NAMES.INVENTORY);
    
    if (!invSheet) return;
    
    const data = invSheet.getDataRange().getValues();
    const lowStockItems = [];
    
    for (let i = 1; i < data.length; i++) {
      const itemName = data[i][INVENTORY_COLS.ITEM_NAME];
      const quantity = parseFloat(data[i][INVENTORY_COLS.QUANTITY]) || 0;
      const minStock = parseFloat(data[i][INVENTORY_COLS.MIN_STOCK]) || 0;
      const reorderQty = parseFloat(data[i][INVENTORY_COLS.REORDER_QTY]) || 0;
      
      if (minStock > 0 && quantity <= minStock) {
        lowStockItems.push({
          itemName: itemName,
          quantity: quantity,
          minStock: minStock,
          reorderQty: reorderQty
        });
      }
    }
    
    if (lowStockItems.length > 0) {
      sendLowStockAlert(lowStockItems);
    }
    
  } catch (error) {
    console.error(`Error in low stock check: ${error.message}`);
  }
}
