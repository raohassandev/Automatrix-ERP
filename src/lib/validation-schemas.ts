/**
 * Zod Validation Schemas for AutoMatrix ERP
 * Provides type-safe validation for all API endpoints and forms
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const emailSchema = z.string().email('Invalid email address');

export const phoneSchema = z.string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(20, 'Phone number too long')
  .optional();

export const positiveNumberSchema = z.number()
  .positive('Amount must be positive')
  .finite('Amount must be a valid number');

export const dateSchema = z.coerce.date();

export const urlSchema = z.string().url('Invalid URL').optional();

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long'),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// ============================================================================
// EMPLOYEE
// ============================================================================

export const employeeSchema = z.object({
  email: emailSchema,
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long'),
  phone: phoneSchema,
  role: z.string()
    .min(2, 'Role must be at least 2 characters')
    .max(50, 'Role too long'),
  walletBalance: z.number()
    .finite('Wallet balance must be a valid number')
    .default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateEmployeeSchema = employeeSchema.partial();

// ============================================================================
// EXPENSE
// ============================================================================

export const expenseSchema = z.object({
  date: dateSchema,
  category: z.string()
    .min(2, 'Category must be at least 2 characters')
    .max(100, 'Category too long'),
  amount: positiveNumberSchema,
  description: z.string()
    .min(5, 'Description must be at least 5 characters')
    .max(1000, 'Description too long'),
  project: z.string().max(100, 'Project name too long').optional(),
  projectId: z.string().uuid('Invalid project ID').optional(),
  paymentMode: z.enum(['Cash', 'Bank Transfer', 'Credit Card', 'Other'])
    .default('Cash'),
  paymentSource: z.enum(['EMPLOYEE_WALLET', 'COMPANY_DIRECT', 'COMPANY_ACCOUNT'])
    .default('COMPANY_DIRECT'),
  receiptUrl: urlSchema,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID'])
    .default('PENDING'),
}).refine((data) => {
  // Ensure date is not in the future
  return data.date <= new Date();
}, {
  message: 'Expense date cannot be in the future',
  path: ['date'],
});

export const updateExpenseSchema = z.object({
  date: dateSchema.optional(),
  category: z.string().min(2).max(100).optional(),
  amount: positiveNumberSchema.optional(),
  description: z.string().min(5).max(1000).optional(),
  project: z.string().max(100).optional(),
  projectId: z.string().uuid().optional(),
  paymentMode: z.enum(['Cash', 'Bank Transfer', 'Credit Card', 'Other']).optional(),
  receiptUrl: urlSchema,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID']).optional(),
});

export const bulkExpenseSchema = z.object({
  expenseIds: z.array(z.string().uuid('Invalid expense ID'))
    .min(1, 'At least one expense must be selected')
    .max(100, 'Cannot process more than 100 expenses at once'),
  action: z.enum(['APPROVE', 'REJECT', 'DELETE']),
  reason: z.string().max(500, 'Reason too long').optional(),
});

// ============================================================================
// INCOME
// ============================================================================

export const incomeSchema = z.object({
  date: dateSchema,
  source: z.string()
    .min(2, 'Source must be at least 2 characters')
    .max(100, 'Source too long'),
  amount: positiveNumberSchema,
  category: z.string()
    .min(2, 'Category must be at least 2 characters')
    .max(100, 'Category too long')
    .optional(),
  project: z.string().max(100, 'Project name too long').optional(),
  projectId: z.string().uuid('Invalid project ID').optional(),
  paymentMode: z.enum(['Cash', 'Bank Transfer', 'Cheque', 'Online Transfer', 'Other'])
    .default('Bank Transfer'),
  status: z.enum(['PENDING', 'APPROVED', 'RECEIVED'])
    .default('PENDING'),
  invoiceId: z.string().uuid('Invalid invoice ID').optional(),
  remarks: z.string().max(500, 'Remarks too long').optional(),
});

export const updateIncomeSchema = incomeSchema.partial();

// ============================================================================
// PROJECT
// ============================================================================

export const projectSchema = z.object({
  projectId: z.string()
    .min(2, 'Project ID must be at least 2 characters')
    .max(50, 'Project ID too long'),
  name: z.string()
    .min(3, 'Project name must be at least 3 characters')
    .max(200, 'Project name too long'),
  client: z.string()
    .min(2, 'Client name must be at least 2 characters')
    .max(200, 'Client name too long'),
  startDate: dateSchema,
  endDate: dateSchema.optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
    .default('ACTIVE'),
  contractValue: z.number().finite('Contract value must be a valid number').default(0),
  invoicedAmount: z.number().finite('Invoiced amount must be a valid number').default(0),
  receivedAmount: z.number().finite('Received amount must be a valid number').default(0),
  pendingRecovery: z.number().finite('Pending recovery must be a valid number').default(0),
  costToDate: z.number().finite('Cost to date must be a valid number').default(0),
  grossMargin: z.number().finite('Gross margin must be a valid number').default(0),
  marginPercent: z.number().finite('Margin percent must be a valid number').default(0),
}).refine((data) => {
  // If endDate exists, it must be after startDate
  if (data.endDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updateProjectSchema = z.object({
  projectId: z.string().min(2).max(50).optional(),
  name: z.string().min(3).max(200).optional(),
  client: z.string().min(2).max(200).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  contractValue: z.number().finite().optional(),
  invoicedAmount: z.number().finite().optional(),
  receivedAmount: z.number().finite().optional(),
  pendingRecovery: z.number().finite().optional(),
  costToDate: z.number().finite().optional(),
  grossMargin: z.number().finite().optional(),
  marginPercent: z.number().finite().optional(),
});

// ============================================================================
// INVENTORY
// ============================================================================

export const inventoryItemSchema = z.object({
  name: z.string()
    .min(2, 'Item name must be at least 2 characters')
    .max(200, 'Item name too long'),
  category: z.string()
    .min(2, 'Category must be at least 2 characters')
    .max(100, 'Category too long'),
  unit: z.string()
    .min(1, 'Unit must be specified')
    .max(50, 'Unit too long'),
  quantity: z.number().finite('Quantity must be a valid number').default(0),
  unitCost: z.number()
    .nonnegative('Unit cost cannot be negative')
    .finite('Unit cost must be a valid number')
    .default(0),
  totalValue: z.number().finite('Total value must be a valid number').default(0),
  minStock: z.number()
    .nonnegative('Min stock cannot be negative')
    .finite('Min stock must be a valid number')
    .default(0),
  reorderQty: z.number()
    .nonnegative('Reorder quantity cannot be negative')
    .finite('Reorder quantity must be a valid number')
    .default(0),
  reservedQty: z.number()
    .nonnegative('Reserved quantity cannot be negative')
    .finite('Reserved quantity must be a valid number')
    .default(0),
  availableQty: z.number().finite('Available quantity must be a valid number').default(0),
});

export const updateInventoryItemSchema = inventoryItemSchema.partial();

export const inventoryLedgerSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  type: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN', 'TRANSFER']),
  quantity: z.number()
    .positive('Quantity must be positive')
    .finite('Quantity must be a valid number'),
  unitCost: z.number()
    .nonnegative('Unit cost cannot be negative')
    .finite('Unit cost must be a valid number'),
  total: z.number().finite('Total must be a valid number'),
  date: dateSchema,
  reference: z.string().max(100, 'Reference too long').optional(),
  project: z.string().max(100, 'Project too long').optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
  runningBalance: z.number().finite('Running balance must be a valid number'),
});

// ============================================================================
// INVOICE
// ============================================================================

export const invoiceSchema = z.object({
  invoiceNumber: z.string()
    .min(1, 'Invoice number is required')
    .max(50, 'Invoice number too long'),
  projectId: z.string().uuid('Invalid project ID').optional(),
  client: z.string()
    .min(2, 'Client name must be at least 2 characters')
    .max(200, 'Client name too long'),
  date: dateSchema,
  dueDate: dateSchema,
  amount: positiveNumberSchema,
  tax: z.number()
    .nonnegative('Tax cannot be negative')
    .finite('Tax must be a valid number')
    .default(0),
  totalAmount: positiveNumberSchema,
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'])
    .default('DRAFT'),
  paidDate: dateSchema.optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
}).refine((data) => {
  // Due date must be after invoice date
  return data.dueDate >= data.date;
}, {
  message: 'Due date must be after invoice date',
  path: ['dueDate'],
}).refine((data) => {
  // If paid, paidDate must exist
  if (data.status === 'PAID' && !data.paidDate) {
    return false;
  }
  return true;
}, {
  message: 'Paid date is required when status is PAID',
  path: ['paidDate'],
});

export const updateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(50).optional(),
  projectId: z.string().uuid().optional(),
  client: z.string().min(2).max(200).optional(),
  date: dateSchema.optional(),
  dueDate: dateSchema.optional(),
  amount: positiveNumberSchema.optional(),
  tax: z.number().nonnegative().finite().optional(),
  totalAmount: positiveNumberSchema.optional(),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  paidDate: dateSchema.optional(),
  notes: z.string().max(1000).optional(),
});

// ============================================================================
// WALLET
// ============================================================================

export const walletLedgerSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: positiveNumberSchema,
  date: dateSchema,
  reference: z.string().max(100, 'Reference too long').optional(),
  balance: z.number().finite('Balance must be a valid number'),
});

export const walletTopUpSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  amount: positiveNumberSchema,
  description: z.string()
    .min(5, 'Description must be at least 5 characters')
    .max(500, 'Description too long'),
});

// ============================================================================
// APPROVAL
// ============================================================================

export const approvalSchema = z.object({
  expenseId: z.string().uuid('Invalid expense ID').optional(),
  incomeId: z.string().uuid('Invalid income ID').optional(),
  action: z.enum(['APPROVE', 'REJECT', 'PARTIAL_APPROVE']),
  reason: z.string().max(500, 'Reason too long').optional(),
  approvedAmount: positiveNumberSchema.optional(),
}).refine((data) => {
  // Must have either expenseId or incomeId
  return data.expenseId || data.incomeId;
}, {
  message: 'Either expenseId or incomeId must be provided',
  path: ['expenseId'],
}).refine((data) => {
  // Partial approve requires approvedAmount
  if (data.action === 'PARTIAL_APPROVE' && !data.approvedAmount) {
    return false;
  }
  return true;
}, {
  message: 'Approved amount is required for partial approval',
  path: ['approvedAmount'],
});

// ============================================================================
// ATTACHMENT
// ============================================================================

export const attachmentSchema = z.object({
  entityType: z.enum(['EXPENSE', 'INCOME', 'PROJECT', 'INVOICE', 'EMPLOYEE']),
  entityId: z.string().uuid('Invalid entity ID'),
  fileName: z.string()
    .min(1, 'File name is required')
    .max(255, 'File name too long'),
  fileSize: z.number()
    .positive('File size must be positive')
    .max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
  mimeType: z.string()
    .min(1, 'MIME type is required')
    .max(100, 'MIME type too long'),
  url: z.string().url('Invalid URL'),
  uploadedBy: z.string().uuid('Invalid user ID'),
});

// ============================================================================
// NOTIFICATION
// ============================================================================

export const notificationSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  type: z.enum(['INFO', 'WARNING', 'ERROR', 'SUCCESS']).default('INFO'),
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title too long'),
  message: z.string()
    .min(1, 'Message is required')
    .max(1000, 'Message too long'),
  link: z.string().max(500, 'Link too long').optional(),
  read: z.boolean().default(false),
});

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export const dateRangeSchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
}).refine((data) => {
  // If both dates exist, endDate must be after startDate
  if (data.startDate && data.endDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const searchSchema = z.object({
  query: z.string().max(200, 'Search query too long').optional(),
  category: z.string().max(100, 'Category too long').optional(),
  status: z.string().max(50, 'Status too long').optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type IncomeInput = z.infer<typeof incomeSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type WalletLedgerInput = z.infer<typeof walletLedgerSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
export type AttachmentInput = z.infer<typeof attachmentSchema>;
export type NotificationInput = z.infer<typeof notificationSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
