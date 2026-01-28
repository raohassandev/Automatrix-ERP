// ============================================================================
// FORMATTING UTILITIES
// ============================================================================
// Data formatting and display helpers
// ============================================================================

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency symbol (default: from settings)
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount, currency = SYSTEM_SETTINGS.CURRENCY) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0`;
  }
  
  // Format with Indian number system (lakhs, crores)
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  let formatted;
  if (absAmount >= 10000000) {
    // Crores
    formatted = (absAmount / 10000000).toFixed(2) + ' Cr';
  } else if (absAmount >= 100000) {
    // Lakhs
    formatted = (absAmount / 100000).toFixed(2) + ' L';
  } else if (absAmount >= 1000) {
    // Thousands
    formatted = (absAmount / 1000).toFixed(2) + ' K';
  } else {
    formatted = absAmount.toFixed(2);
  }
  
  return (isNegative ? '-' : '') + currency + formatted;
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - Formatted number string
 */
function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format percentage
 * @param {number} value - Value to format (0.15 = 15%)
 * @param {number} decimals - Decimal places (default: 1)
 * @returns {string} - Formatted percentage string
 */
function formatPercentage(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format status with icon/color
 * @param {string} status - Status value
 * @returns {object} - {text, icon, color}
 */
function formatStatus(status) {
  const statusMap = {
    [STATUS.PENDING]: { icon: '⏳', color: '#FFA500', text: 'Pending' },
    [STATUS.PENDING_L1]: { icon: '⏳', color: '#FFA500', text: 'Pending L1' },
    [STATUS.PENDING_L2]: { icon: '⏳', color: '#FFA500', text: 'Pending L2' },
    [STATUS.PENDING_L3]: { icon: '⏳', color: '#FFA500', text: 'Pending L3' },
    [STATUS.APPROVED]: { icon: '✅', color: '#28a745', text: 'Approved' },
    [STATUS.REJECTED]: { icon: '❌', color: '#dc3545', text: 'Rejected' },
    [STATUS.PARTIALLY_APPROVED]: { icon: '⚠️', color: '#FFC107', text: 'Partial' },
    [STATUS.ACTIVE]: { icon: '🟢', color: '#28a745', text: 'Active' },
    [STATUS.INACTIVE]: { icon: '🔴', color: '#dc3545', text: 'Inactive' },
    [STATUS.IN_PROGRESS]: { icon: '🔄', color: '#007bff', text: 'In Progress' },
    [STATUS.COMPLETED]: { icon: '✅', color: '#28a745', text: 'Completed' },
    [STATUS.CANCELLED]: { icon: '🚫', color: '#6c757d', text: 'Cancelled' },
    [STATUS.DRAFT]: { icon: '📝', color: '#6c757d', text: 'Draft' },
    [STATUS.SENT]: { icon: '📤', color: '#007bff', text: 'Sent' },
    [STATUS.PAID]: { icon: '💰', color: '#28a745', text: 'Paid' },
    [STATUS.OVERDUE]: { icon: '⚠️', color: '#dc3545', text: 'Overdue' }
  };
  
  return statusMap[status] || { icon: '', color: '#6c757d', text: status };
}

/**
 * Format role with badge
 * @param {string} role - Role value
 * @returns {object} - {text, color, icon}
 */
function formatRole(role) {
  const roleMap = {
    [ROLES.CEO]: { icon: '👑', color: '#8B4513', text: 'CEO' },
    [ROLES.OWNER]: { icon: '👑', color: '#8B4513', text: 'Owner' },
    [ROLES.FINANCE_MANAGER]: { icon: '💼', color: '#007bff', text: 'Finance Manager' },
    [ROLES.MANAGER]: { icon: '👔', color: '#28a745', text: 'Manager' },
    [ROLES.STAFF]: { icon: '👤', color: '#6c757d', text: 'Staff' },
    [ROLES.GUEST]: { icon: '🔒', color: '#dc3545', text: 'Guest' }
  };
  
  return roleMap[role] || { icon: '👤', color: '#6c757d', text: role };
}

/**
 * Truncate text to length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix for truncated text (default: '...')
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Format trend indicator
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {object} - {change, percentage, icon, color}
 */
function formatTrend(current, previous) {
  if (!previous || previous === 0) {
    return { change: 0, percentage: 0, icon: '—', color: '#6c757d' };
  }
  
  const change = current - previous;
  const percentage = (change / previous) * 100;
  
  const isPositive = change > 0;
  const icon = isPositive ? '↑' : (change < 0 ? '↓' : '—');
  const color = isPositive ? '#28a745' : (change < 0 ? '#dc3545' : '#6c757d');
  
  return {
    change: Math.abs(change),
    percentage: Math.abs(percentage),
    icon: icon,
    color: color,
    isPositive: isPositive
  };
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format phone number
 * @param {string} phone - Phone number
 * @returns {string} - Formatted phone number
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format for Indian numbers (10 digits)
  if (cleaned.length === 10) {
    return `+91 ${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
  }
  
  return phone;
}

/**
 * Generate initials from name
 * @param {string} name - Full name
 * @returns {string} - Initials
 */
function getInitials(name) {
  if (!name) return '';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Format list as comma-separated string
 * @param {array} items - Array of items
 * @param {number} maxItems - Maximum items to show
 * @returns {string} - Formatted list
 */
function formatList(items, maxItems = 3) {
  if (!items || items.length === 0) {
    return '';
  }
  
  if (items.length <= maxItems) {
    return items.join(', ');
  }
  
  const visible = items.slice(0, maxItems);
  const remaining = items.length - maxItems;
  
  return visible.join(', ') + ` +${remaining} more`;
}

/**
 * Highlight search term in text
 * @param {string} text - Text to highlight in
 * @param {string} searchTerm - Term to highlight
 * @returns {string} - Text with highlighted term
 */
function highlightSearchTerm(text, searchTerm) {
  if (!text || !searchTerm) {
    return text;
  }
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}
