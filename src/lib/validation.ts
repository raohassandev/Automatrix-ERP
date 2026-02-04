import { z } from "zod";

export const expenseSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1).max(500),
  category: z.string().min(1),
  amount: z.number().positive(),
  paymentMode: z.string().min(1),
  paymentSource: z.enum(["EMPLOYEE_WALLET", "COMPANY_DIRECT", "COMPANY_ACCOUNT"]).optional(),
  expenseType: z.enum(["COMPANY", "OWNER_PERSONAL"]).optional(),
  project: z.string().min(1).optional(),
  inventoryItemId: z.string().optional(),
  inventoryQuantity: z.number().positive().optional(),
  inventoryUnitCost: z.number().nonnegative().optional(),
  receiptUrl: z.string().url().optional(),
  receiptFileId: z.string().optional(),
  remarks: z.string().optional(),
  categoryRequest: z.string().optional(),
});

export const expenseUpdateSchema = expenseSchema.partial();

export const incomeSchema = z.object({
  date: z.string().min(1),
  source: z.string().min(1),
  category: z.string().min(1).optional(),
  amount: z.number().positive(),
  paymentMode: z.string().min(1),
  project: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  receiptFileId: z.string().optional(),
  invoiceId: z.string().optional(),
  remarks: z.string().optional(),
});

export const incomeUpdateSchema = incomeSchema.partial();

export const approvalSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  action: z.enum(["APPROVE", "REJECT", "PARTIAL"]),
  id: z.string().min(1),
  reason: z.string().optional(),
  approvedAmount: z.number().optional(),
});

export const projectSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  clientId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  status: z.string().optional(),
  contractValue: z.number().nonnegative(),
});

export const clientSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  address: z.string().optional(),
  contacts: z
    .array(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        designation: z.string().optional(),
        email: z.string().email().optional(),
      })
    )
    .optional(),
});

export const inventorySchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  category: z.string().min(1),
  unit: z.string().min(1),
  unitCost: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  initialQuantity: z.number().nonnegative().optional(),
  minStock: z.number().optional(),
  reorderQty: z.number().optional(),
});

export const inventoryLedgerSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(["PURCHASE", "SALE", "ADJUSTMENT", "TRANSFER", "RETURN", "PROJECT_ALLOCATION"]),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
  reference: z.string().optional(),
  project: z.string().optional(),
});

export const employeeSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.string().min(1),
});

export const walletSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["CREDIT", "DEBIT"]),
  amount: z.number().positive(),
  reference: z.string().optional(),
});

export const invoiceSchema = z.object({
  invoiceNo: z.string().min(1),
  projectId: z.string().min(1),
  date: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().min(1),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export const attachmentSchema = z.object({
  type: z.string().min(1),
  recordId: z.string().min(1),
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  fileId: z.string().optional(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
});

export const notificationSchema = z.object({
  userId: z.string().optional(),
  type: z.string().min(1),
  message: z.string().min(1),
  status: z.string().optional(),
});
