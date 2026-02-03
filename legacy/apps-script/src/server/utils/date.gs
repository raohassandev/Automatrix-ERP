// ============================================================================
// DATE UTILITIES
// ============================================================================
// Date manipulation and formatting helpers
// ============================================================================

/**
 * Format date to string
 * @param {Date} date - Date object
 * @param {string} format - Format string (default: 'yyyy-MM-dd')
 * @returns {string} - Formatted date string
 */
function formatDate(date, format = SYSTEM_SETTINGS.DATE_FORMAT) {
  if (!date || !(date instanceof Date)) {
    return '';
  }
  
  return Utilities.formatDate(date, SYSTEM_SETTINGS.TIMEZONE, format);
}

/**
 * Parse date from string
 * @param {string} dateStr - Date string
 * @returns {Date} - Date object
 */
function parseDate(dateStr) {
  if (!dateStr) {
    return null;
  }
  
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get start of month
 * @param {Date} date - Date object (default: today)
 * @returns {Date} - Start of month
 */
function getStartOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get end of month
 * @param {Date} date - Date object (default: today)
 * @returns {Date} - End of month
 */
function getEndOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Get date range for period
 * @param {string} period - Period ('THIS_MONTH', 'LAST_MONTH', 'THIS_QUARTER', 'THIS_YEAR')
 * @returns {object} - {start: Date, end: Date}
 */
function getDateRangeForPeriod(period) {
  const today = new Date();
  let start, end;
  
  switch (period) {
    case 'THIS_MONTH':
      start = getStartOfMonth(today);
      end = getEndOfMonth(today);
      break;
      
    case 'LAST_MONTH':
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      start = getStartOfMonth(lastMonth);
      end = getEndOfMonth(lastMonth);
      break;
      
    case 'THIS_QUARTER':
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      start = new Date(today.getFullYear(), quarterStartMonth, 1);
      end = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
      break;
      
    case 'THIS_YEAR':
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
      break;
      
    case 'LAST_7_DAYS':
      start = new Date(today);
      start.setDate(start.getDate() - 7);
      end = today;
      break;
      
    case 'LAST_30_DAYS':
      start = new Date(today);
      start.setDate(start.getDate() - 30);
      end = today;
      break;
      
    default:
      start = getStartOfMonth(today);
      end = getEndOfMonth(today);
  }
  
  return { start, end };
}

/**
 * Check if date is within range
 * @param {Date} date - Date to check
 * @param {Date} start - Range start
 * @param {Date} end - Range end
 * @returns {boolean} - True if within range
 */
function isDateInRange(date, start, end) {
  if (!date || !start || !end) {
    return false;
  }
  
  return date >= start && date <= end;
}

/**
 * Get days between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} - Number of days
 */
function getDaysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1 - date2) / oneDay));
}

/**
 * Get aging bucket for date
 * @param {Date} date - Date to check
 * @returns {string} - Aging bucket ('0-30', '31-60', '61-90', '90+')
 */
function getAgingBucket(date) {
  const today = new Date();
  const days = getDaysBetween(date, today);
  
  if (days <= 30) {
    return '0-30';
  } else if (days <= 60) {
    return '31-60';
  } else if (days <= 90) {
    return '61-90';
  } else {
    return '90+';
  }
}

/**
 * Add days to date
 * @param {Date} date - Starting date
 * @param {number} days - Number of days to add
 * @returns {Date} - New date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to date
 * @param {Date} date - Starting date
 * @param {number} months - Number of months to add
 * @returns {Date} - New date
 */
function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Get current financial year dates
 * @param {number} fyStartMonth - Financial year start month (0-based, default: 3 for April)
 * @returns {object} - {start: Date, end: Date}
 */
function getFinancialYearDates(fyStartMonth = 3) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let fyYear = currentYear;
  if (currentMonth < fyStartMonth) {
    fyYear = currentYear - 1;
  }
  
  const start = new Date(fyYear, fyStartMonth, 1);
  const end = new Date(fyYear + 1, fyStartMonth, 0);
  
  return { start, end };
}

/**
 * Format date to display string
 * @param {Date} date - Date object
 * @returns {string} - Display string (e.g., "Jan 27, 2026")
 */
function formatDateForDisplay(date) {
  if (!date || !(date instanceof Date)) {
    return '';
  }
  
  return formatDate(date, 'MMM dd, yyyy');
}

/**
 * Get relative date string
 * @param {Date} date - Date to format
 * @returns {string} - Relative string (e.g., "2 days ago", "Today")
 */
function getRelativeDateString(date) {
  if (!date || !(date instanceof Date)) {
    return '';
  }
  
  const today = new Date();
  const days = getDaysBetween(date, today);
  
  if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days} days ago`;
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
}
