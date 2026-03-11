import { z } from "zod";

export const expenseSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1).max(500),
  category: z.string().min(1),
  amount: z.number().positive(),
  paymentMode: z.string().min(1),
  paymentSource: z.enum(["EMPLOYEE_WALLET", "EMPLOYEE_POCKET", "COMPANY_DIRECT", "COMPANY_ACCOUNT"]),
  companyAccountId: z.string().min(1).optional(),
  expenseType: z.enum(["COMPANY", "OWNER_PERSONAL"]).optional(),
  project: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(1).optional()
  ),
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
  companyAccountId: z.string().min(1),
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
  warehouseId: z.string().min(1).optional(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
  reference: z.string().optional(),
  project: z.string().optional(),
});

export const employeeSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  cnic: z.string().optional(),
  address: z.string().optional(),
  education: z.string().optional(),
  experience: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  reportingOfficerId: z.string().optional(),
  joinDate: z.string().optional(),
  role: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_HOLD"]).optional(),
});

export const employeeUpdateSchema = employeeSchema.partial();

export const departmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const departmentUpdateSchema = departmentSchema.partial();

export const designationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const designationUpdateSchema = designationSchema.partial();

export const walletSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["CREDIT", "DEBIT"]),
  amount: z.number().positive(),
  reference: z.string().optional(),
  companyAccountId: z.string().optional(),
  purpose: z
    .enum(["SALARY", "INCENTIVE", "COMPANY_ADVANCE", "REIMBURSEMENT", "ADJUSTMENT"])
    .optional(),
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

const incentiveBaseSchema = z.object({
  employeeId: z.string().min(1),
  projectRef: z.string().min(1),
  formulaType: z.enum(["FIXED", "PERCENT_PROFIT", "PERCENT_AMOUNT"]).optional(),
  basisAmount: z.number().nonnegative().optional(),
  percent: z.number().positive().optional(),
  amount: z.number().positive().optional(),
  payoutMode: z.enum(["PAYROLL", "WALLET"]).optional(),
  reason: z.string().optional(),
  status: z.string().optional(),
});

export const incentiveSchema = incentiveBaseSchema
  .refine(
    (data) =>
      typeof data.amount === "number" ||
      (typeof data.percent === "number" &&
        (data.formulaType === "PERCENT_PROFIT" || typeof data.basisAmount === "number")),
    {
      message: "Provide amount, or percent with profit/amount basis.",
      path: ["amount"],
    },
  );

export const incentiveUpdateSchema = incentiveBaseSchema.partial();

export const payrollRunSchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  status: z.string().optional(),
  notes: z.string().optional(),
  entries: z.array(
    z.object({
      employeeId: z.string().min(1),
      baseSalary: z.number().nonnegative(),
      incentiveTotal: z.number().nonnegative().optional(),
      deductions: z.number().nonnegative().optional(),
      deductionReason: z.string().optional(),
    })
  ).min(1),
});

export const payrollRunUpdateSchema = payrollRunSchema.partial();

export const salaryAdvanceSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(1),
  status: z.enum(["PENDING", "APPROVED", "PAID", "REJECTED", "RECOVERED"]).optional(),
});

export const salaryAdvanceUpdateSchema = salaryAdvanceSchema.partial();

export const purchaseOrderSchema = z.object({
  poNumber: z.string().min(1),
  vendorId: z.string().optional(),
  vendorName: z.string().min(1),
  vendorContact: z.string().optional(),
  // Phase 1 (locked): one-project-per-document. Stored as Project.projectId reference.
  projectRef: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(1).optional()
  ),
  orderDate: z.string().min(1),
  expectedDate: z.string().optional(),
  status: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      itemName: z.string().min(1),
      unit: z.string().optional(),
      quantity: z.number().positive(),
      unitCost: z.number().nonnegative(),
      // Kept for backward compatibility with older payloads/rows; API enforces header-only.
      project: z.string().optional(),
    })
  ).min(1),
});

export const purchaseOrderUpdateSchema = purchaseOrderSchema.partial();

export const vendorSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

export const vendorUpdateSchema = vendorSchema.partial();

const commissionBaseSchema = z.object({
  employeeId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  payeeType: z.enum(["EMPLOYEE", "MIDDLEMAN"]).optional(),
  projectRef: z.string().min(1),
  basisType: z.string().optional(),
  basisAmount: z.number().nonnegative().optional(),
  percent: z.number().nonnegative().optional(),
  payoutMode: z.enum(["PAYROLL", "WALLET", "AP"]).optional(),
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
  status: z.string().optional(),
});

export const commissionSchema = commissionBaseSchema.superRefine((data, ctx) => {
  const payeeType = data.payeeType || "EMPLOYEE";
  if (payeeType === "EMPLOYEE" && !data.employeeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["employeeId"],
      message: "Employee is required for employee commission.",
    });
  }
  if (payeeType === "MIDDLEMAN" && !data.vendorId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["vendorId"],
      message: "Middleman (vendor) is required for middleman commission.",
    });
  }
  const hasAmount = typeof data.amount === "number" && data.amount > 0;
  const hasPercentFormula =
    typeof data.percent === "number" &&
    data.percent > 0 &&
    typeof data.basisAmount === "number" &&
    data.basisAmount >= 0;
  if (!hasAmount && !hasPercentFormula) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["amount"],
      message: "Amount is required or provide percent + basis amount.",
    });
  }
});

export const commissionUpdateSchema = commissionBaseSchema.partial();

export const goodsReceiptSchema = z.object({
  grnNumber: z.string().min(1),
  purchaseOrderId: z.string().optional(),
  // Phase 1 (locked): required when GRN is not linked to a PO. When linked, API inherits from PO.
  projectRef: z.string().min(1).optional(),
  receivedDate: z.string().min(1),
  status: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      purchaseOrderItemId: z.string().optional(),
      itemName: z.string().min(1),
      unit: z.string().optional(),
      quantity: z.number().positive(),
      unitCost: z.number().nonnegative(),
    })
  ).min(1),
});

export const goodsReceiptUpdateSchema = goodsReceiptSchema.partial();

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
