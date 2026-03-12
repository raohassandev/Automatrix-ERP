import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toMonthKey, toPostingStatusFromWorkflow, toSettlementStatusFromWorkflow } from "@/lib/lifecycle";

type DbClient = PrismaClient;

function asMoney(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function bounds(from?: string, to?: string) {
  const start = from ? new Date(from) : null;
  const end = to ? new Date(to) : null;
  return {
    start: start && !Number.isNaN(start.getTime()) ? start : null,
    end: end && !Number.isNaN(end.getTime()) ? end : null,
  };
}

export type PayrollControlRegisterRow = {
  payrollRunId: string;
  payrollEntryId: string;
  payrollMonth: string;
  employeeId: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  variablePay: number;
  deductions: number;
  netPay: number;
  runWorkflowStatus: string;
  postingStatus: string;
  settlementStatus: string;
  paymentMode: string | null;
  companyAccount: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  overdue: boolean;
};

export type VariablePayRegisterRow = {
  sourceType: "INCENTIVE" | "COMMISSION";
  sourceId: string;
  payeeType: "EMPLOYEE" | "MIDDLEMAN";
  employeeId: string | null;
  employeeName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  projectRef: string | null;
  earningMonth: string;
  approvedMonth: string;
  approvedAmount: number;
  payoutMode: string;
  settlementStatus: string;
  scheduledPayrollMonth: string | null;
  settledAt: string | null;
  settledMonth: string | null;
};

export type EmployeeSettlementRegisterRow = {
  employeeId: string;
  employeeName: string;
  walletBalance: number;
  advanceOutstanding: number;
  reimbursementDue: number;
  payrollDue: number;
  variablePayDue: number;
  netCompanyPayable: number;
};

export type ProjectFinancialRegisterRow = {
  projectId: string;
  projectRef: string;
  projectName: string;
  status: string;
  contractValue: number;
  invoicedAmount: number;
  receivedAmount: number;
  pendingRecovery: number;
  costToDate: number;
  grossMargin: number;
  marginPercent: number;
};

export type ProcurementApRegisterRow = {
  vendorId: string;
  vendorName: string;
  projectRef: string | null;
  orderedValue: number;
  receivedValue: number;
  billedValue: number;
  paidValue: number;
  outstandingValue: number;
  blockedByMatching: boolean;
};

export type TaskApprovalRegisterRow = {
  itemType: "TASK" | "APPROVAL";
  itemId: string;
  title: string;
  owner: string;
  assignedTo: string;
  dueDate: string | null;
  overdue: boolean;
  blockingReason: string | null;
  linkedModuleRecord: string | null;
  requiredAction: string;
  priority: string;
};

export async function getPayrollControlRegister(args?: {
  db?: DbClient;
  from?: string;
  to?: string;
  take?: number;
}) {
  const db = args?.db || prisma;
  const { start, end } = bounds(args?.from, args?.to);
  const today = new Date();
  const entries = await db.payrollEntry.findMany({
    where: {
      payrollRun: {
        ...(start || end
          ? {
              periodEnd: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            }
          : {}),
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: args?.take || 200,
    include: {
      employee: { select: { id: true, name: true } },
      payrollRun: { select: { id: true, periodStart: true, periodEnd: true, status: true } },
      companyAccount: { select: { name: true } },
      components: { select: { componentType: true, amount: true, description: true } },
    },
  });

  const rows: PayrollControlRegisterRow[] = entries.map((entry) => {
    const variablePay = entry.components
      .filter((line) => ["INCENTIVE", "COMMISSION", "ADJUSTMENT", "VARIABLE_PAY"].includes(String(line.componentType)))
      .reduce((sum, line) => sum + asMoney(line.amount), 0);

    const due = String(entry.status || "").toUpperCase() !== "PAID" && entry.payrollRun.periodEnd.getTime() < today.getTime();
    return {
      payrollRunId: entry.payrollRunId,
      payrollEntryId: entry.id,
      payrollMonth: toMonthKey(entry.payrollRun.periodEnd),
      employeeId: entry.employeeId,
      employeeName: entry.employee?.name || "Employee",
      periodStart: entry.payrollRun.periodStart.toISOString(),
      periodEnd: entry.payrollRun.periodEnd.toISOString(),
      baseSalary: asMoney(entry.baseSalary),
      variablePay: asMoney(variablePay),
      deductions: asMoney(entry.deductions),
      netPay: asMoney(entry.netPay),
      runWorkflowStatus: entry.payrollRun.status,
      postingStatus: toPostingStatusFromWorkflow(entry.payrollRun.status),
      settlementStatus: toSettlementStatusFromWorkflow(entry.status),
      paymentMode: entry.paymentMode || null,
      companyAccount: entry.companyAccount?.name || null,
      paymentReference: entry.paymentReference || null,
      paidAt: entry.paidAt ? entry.paidAt.toISOString() : null,
      overdue: due,
    };
  });

  return rows;
}

export async function getVariablePayRegister(args?: {
  db?: DbClient;
  from?: string;
  to?: string;
  take?: number;
}) {
  const db = args?.db || prisma;
  const { start, end } = bounds(args?.from, args?.to);
  const timeWhere = start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {};

  const [incentives, commissions] = await Promise.all([
    db.incentiveEntry.findMany({
      where: timeWhere,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: args?.take || 300,
    }),
    db.commissionEntry.findMany({
      where: timeWhere,
      include: {
        employee: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: args?.take || 300,
    }),
  ]);

  const incentiveRows: VariablePayRegisterRow[] = incentives.map((row) => ({
    sourceType: "INCENTIVE",
    sourceId: row.id,
    payeeType: "EMPLOYEE",
    employeeId: row.employeeId,
    employeeName: row.employee?.name || null,
    vendorId: null,
    vendorName: null,
    projectRef: row.projectRef || null,
    earningMonth: toMonthKey(row.createdAt),
    approvedMonth: toMonthKey(row.updatedAt),
    approvedAmount: asMoney(row.amount),
    payoutMode: row.payoutMode || "PAYROLL",
    settlementStatus: row.settlementStatus || "UNSETTLED",
    scheduledPayrollMonth: row.payoutMode === "PAYROLL" ? toMonthKey(row.createdAt) : null,
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
    settledMonth: toMonthKey(row.settledAt),
  }));

  const commissionRows: VariablePayRegisterRow[] = commissions.map((row) => ({
    sourceType: "COMMISSION",
    sourceId: row.id,
    payeeType: (row.payeeType || "EMPLOYEE") as "EMPLOYEE" | "MIDDLEMAN",
    employeeId: row.employeeId || null,
    employeeName: row.employee?.name || null,
    vendorId: row.vendorId || null,
    vendorName: row.vendor?.name || null,
    projectRef: row.projectRef || null,
    earningMonth: toMonthKey(row.createdAt),
    approvedMonth: toMonthKey(row.updatedAt),
    approvedAmount: asMoney(row.amount),
    payoutMode: row.payoutMode || "PAYROLL",
    settlementStatus: row.settlementStatus || "UNSETTLED",
    scheduledPayrollMonth: row.payoutMode === "PAYROLL" ? toMonthKey(row.createdAt) : null,
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
    settledMonth: toMonthKey(row.settledAt),
  }));

  return [...incentiveRows, ...commissionRows].sort((a, b) => (a.settledAt || "").localeCompare(b.settledAt || ""));
}

export async function getEmployeeSettlementRegister(args?: { db?: DbClient; take?: number }) {
  const db = args?.db || prisma;
  const [employees, advances, expensesDue, payrollDue, incentives, commissions] = await Promise.all([
    db.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      take: args?.take || 500,
      select: { id: true, name: true, email: true, walletBalance: true },
    }),
    db.salaryAdvance.findMany({
      where: { status: { in: ["PAID", "PARTIALLY_RECOVERED"] } },
      select: { employeeId: true, outstandingAmount: true },
    }),
    db.expense.findMany({
      where: {
        paymentSource: "EMPLOYEE_POCKET",
        status: { in: ["APPROVED", "PARTIALLY_APPROVED"] },
      },
      select: { amount: true, approvedAmount: true, submittedBy: { select: { email: true } } },
    }),
    db.payrollEntry.findMany({
      where: { status: { not: "PAID" }, payrollRun: { status: { in: ["APPROVED", "POSTED"] } } },
      select: { employeeId: true, netPay: true },
    }),
    db.incentiveEntry.findMany({
      where: { payoutMode: "PAYROLL", settlementStatus: "UNSETTLED", status: "APPROVED" },
      select: { employeeId: true, amount: true },
    }),
    db.commissionEntry.findMany({
      where: {
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        status: "APPROVED",
        payeeType: "EMPLOYEE",
      },
      select: { employeeId: true, amount: true },
    }),
  ]);

  const employeeByEmail = new Map(employees.map((e) => [String(e.email || "").toLowerCase(), e.id]));

  const advanceByEmployee = new Map<string, number>();
  advances.forEach((row) => {
    advanceByEmployee.set(row.employeeId, (advanceByEmployee.get(row.employeeId) || 0) + asMoney(row.outstandingAmount));
  });

  const reimbursementByEmployee = new Map<string, number>();
  expensesDue.forEach((row) => {
    const email = String(row.submittedBy?.email || "").toLowerCase();
    const employeeId = employeeByEmail.get(email);
    if (!employeeId) return;
    const amount = asMoney(row.approvedAmount ?? row.amount);
    reimbursementByEmployee.set(employeeId, (reimbursementByEmployee.get(employeeId) || 0) + amount);
  });

  const payrollDueByEmployee = new Map<string, number>();
  payrollDue.forEach((row) => {
    payrollDueByEmployee.set(row.employeeId, (payrollDueByEmployee.get(row.employeeId) || 0) + asMoney(row.netPay));
  });

  const variablePayByEmployee = new Map<string, number>();
  [...incentives, ...commissions].forEach((row) => {
    if (!row.employeeId) return;
    variablePayByEmployee.set(row.employeeId, (variablePayByEmployee.get(row.employeeId) || 0) + asMoney(row.amount));
  });

  const rows: EmployeeSettlementRegisterRow[] = employees.map((employee) => {
    const advanceOutstanding = asMoney(advanceByEmployee.get(employee.id) || 0);
    const reimbursementDue = asMoney(reimbursementByEmployee.get(employee.id) || 0);
    const payrollDueAmount = asMoney(payrollDueByEmployee.get(employee.id) || 0);
    const variablePayDue = asMoney(variablePayByEmployee.get(employee.id) || 0);
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      walletBalance: asMoney(employee.walletBalance),
      advanceOutstanding,
      reimbursementDue,
      payrollDue: payrollDueAmount,
      variablePayDue,
      netCompanyPayable: asMoney(payrollDueAmount + reimbursementDue + variablePayDue - advanceOutstanding),
    };
  });

  return rows;
}

export async function getProjectFinancialRegister(args?: { db?: DbClient; take?: number }) {
  const db = args?.db || prisma;
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: args?.take || 500,
    select: {
      id: true,
      projectId: true,
      name: true,
      status: true,
      contractValue: true,
      invoicedAmount: true,
      receivedAmount: true,
      pendingRecovery: true,
      costToDate: true,
      grossMargin: true,
      marginPercent: true,
    },
  });

  return projects.map((p) => ({
    projectId: p.id,
    projectRef: p.projectId,
    projectName: p.name,
    status: p.status,
    contractValue: asMoney(p.contractValue),
    invoicedAmount: asMoney(p.invoicedAmount),
    receivedAmount: asMoney(p.receivedAmount),
    pendingRecovery: asMoney(p.pendingRecovery),
    costToDate: asMoney(p.costToDate),
    grossMargin: asMoney(p.grossMargin),
    marginPercent: asMoney(p.marginPercent),
  }));
}

export async function getProcurementApRegister(args?: { db?: DbClient; take?: number }) {
  const db = args?.db || prisma;
  const [purchaseOrders, goodsReceipts, vendorBills, vendorPayments] = await Promise.all([
    db.purchaseOrder.findMany({
      take: args?.take || 1000,
      select: { vendorId: true, projectRef: true, totalAmount: true, status: true },
    }),
    db.goodsReceiptItem.findMany({
      take: args?.take || 3000,
      where: { goodsReceipt: { status: { in: ["POSTED", "RECEIVED", "PARTIAL"] } } },
      select: { quantity: true, unitCost: true, goodsReceipt: { select: { projectRef: true, purchaseOrder: { select: { vendorId: true } } } } },
    }),
    db.vendorBill.findMany({
      take: args?.take || 1000,
      select: { vendorId: true, projectRef: true, totalAmount: true, status: true, vendor: { select: { name: true } } },
    }),
    db.vendorPayment.findMany({
      take: args?.take || 1000,
      where: { status: "POSTED" },
      select: { vendorId: true, projectRef: true, amount: true },
    }),
  ]);

  const vendorIds = Array.from(new Set(vendorBills.map((b) => b.vendorId)));
  const vendors = await db.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } });
  const vendorNameById = new Map(vendors.map((v) => [v.id, v.name]));

  const key = (vendorId: string, projectRef?: string | null) => `${vendorId}::${String(projectRef || "")}`;
  const map = new Map<string, ProcurementApRegisterRow>();
  const ensure = (vendorId: string, projectRef?: string | null) => {
    const k = key(vendorId, projectRef);
    if (!map.has(k)) {
      map.set(k, {
        vendorId,
        vendorName: vendorNameById.get(vendorId) || "Vendor",
        projectRef: projectRef || null,
        orderedValue: 0,
        receivedValue: 0,
        billedValue: 0,
        paidValue: 0,
        outstandingValue: 0,
        blockedByMatching: false,
      });
    }
    return map.get(k)!;
  };

  purchaseOrders.forEach((row) => {
    if (String(row.status || "").toUpperCase() === "VOID") return;
    if (!row.vendorId) return;
    const r = ensure(row.vendorId, row.projectRef);
    r.orderedValue = asMoney(r.orderedValue + asMoney(row.totalAmount));
  });
  goodsReceipts.forEach((row) => {
    const vendorId = row.goodsReceipt.purchaseOrder?.vendorId;
    if (!vendorId) return;
    const projectRef = row.goodsReceipt.projectRef || null;
    const r = ensure(vendorId, projectRef);
    r.receivedValue = asMoney(r.receivedValue + asMoney(row.quantity) * asMoney(row.unitCost));
  });
  vendorBills.forEach((row) => {
    if (String(row.status || "").toUpperCase() === "VOID") return;
    const r = ensure(row.vendorId, row.projectRef);
    r.billedValue = asMoney(r.billedValue + asMoney(row.totalAmount));
    if (["SUBMITTED", "APPROVED"].includes(String(row.status || "").toUpperCase())) {
      r.blockedByMatching = true;
    }
  });
  vendorPayments.forEach((row) => {
    const r = ensure(row.vendorId, row.projectRef);
    r.paidValue = asMoney(r.paidValue + asMoney(row.amount));
  });

  Array.from(map.values()).forEach((row) => {
    row.outstandingValue = asMoney(row.billedValue - row.paidValue);
  });

  return Array.from(map.values()).sort((a, b) => b.outstandingValue - a.outstandingValue);
}

export async function getTaskApprovalRegister(args?: { db?: DbClient; take?: number }) {
  const db = args?.db || prisma;
  const today = new Date();
  const [tasks, approvals] = await Promise.all([
    db.projectTask.findMany({
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: args?.take || 300,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        description: true,
        project: { select: { projectId: true, name: true } },
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    db.approval.findMany({
      where: { status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] } },
      orderBy: { createdAt: "desc" },
      take: args?.take || 300,
      select: { id: true, type: true, status: true, amount: true, createdAt: true, reason: true, expenseId: true, incomeId: true },
    }),
  ]);

  const taskRows: TaskApprovalRegisterRow[] = tasks.map((task) => ({
    itemType: "TASK",
    itemId: task.id,
    title: task.title,
    owner: task.createdBy?.name || "Owner",
    assignedTo: task.assignedTo?.name || "Unassigned",
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    overdue:
      Boolean(task.dueDate) &&
      !["DONE", "CANCELLED"].includes(String(task.status || "").toUpperCase()) &&
      task.dueDate!.getTime() < today.getTime(),
    blockingReason: String(task.status || "").toUpperCase() === "BLOCKED" ? task.description || "Blocked task" : null,
    linkedModuleRecord: task.project ? `${task.project.projectId} - ${task.project.name}` : null,
    requiredAction: `Update task status (${task.status})`,
    priority: task.priority,
  }));

  const approvalRows: TaskApprovalRegisterRow[] = approvals.map((item) => ({
    itemType: "APPROVAL",
    itemId: item.id,
    title: `${item.type} approval`,
    owner: "Approval queue",
    assignedTo: "Approver",
    dueDate: item.createdAt.toISOString(),
    overdue: today.getTime() - item.createdAt.getTime() > 48 * 60 * 60 * 1000,
    blockingReason: item.reason || null,
    linkedModuleRecord: item.expenseId || item.incomeId || null,
    requiredAction: `Approve/reject (${item.status})`,
    priority: asMoney(item.amount) >= 100000 ? "HIGH" : "MEDIUM",
  }));

  return [...taskRows, ...approvalRows].sort((a, b) => Number(b.overdue) - Number(a.overdue));
}

export async function getControlRegistersSummary(args?: { db?: DbClient; from?: string; to?: string }) {
  const [payroll, variablePay, settlements, projects, procurement, taskApprovals] = await Promise.all([
    getPayrollControlRegister(args),
    getVariablePayRegister(args),
    getEmployeeSettlementRegister(args),
    getProjectFinancialRegister(args),
    getProcurementApRegister(args),
    getTaskApprovalRegister(args),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    payroll: {
      count: payroll.length,
      totalNetPay: asMoney(payroll.reduce((sum, row) => sum + row.netPay, 0)),
      totalOverdue: payroll.filter((row) => row.overdue).length,
    },
    variablePay: {
      count: variablePay.length,
      unsettledAmount: asMoney(
        variablePay.filter((row) => row.settlementStatus !== "SETTLED").reduce((sum, row) => sum + row.approvedAmount, 0),
      ),
    },
    settlements: {
      employees: settlements.length,
      netCompanyPayable: asMoney(settlements.reduce((sum, row) => sum + row.netCompanyPayable, 0)),
      reimbursementDue: asMoney(settlements.reduce((sum, row) => sum + row.reimbursementDue, 0)),
      advanceOutstanding: asMoney(settlements.reduce((sum, row) => sum + row.advanceOutstanding, 0)),
    },
    projects: {
      count: projects.length,
      pendingRecovery: asMoney(projects.reduce((sum, row) => sum + row.pendingRecovery, 0)),
      grossMargin: asMoney(projects.reduce((sum, row) => sum + row.grossMargin, 0)),
    },
    procurement: {
      rows: procurement.length,
      outstanding: asMoney(procurement.reduce((sum, row) => sum + row.outstandingValue, 0)),
      blocked: procurement.filter((row) => row.blockedByMatching).length,
    },
    taskApprovals: {
      items: taskApprovals.length,
      overdue: taskApprovals.filter((row) => row.overdue).length,
    },
  };
}
