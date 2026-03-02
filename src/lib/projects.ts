import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

async function findProjectByRef(projectRef: string) {
  const raw = projectRef.trim();
  const baseRefs = new Set<string>([raw]);
  const splitDash = raw.split(" - ");
  if (splitDash.length >= 2) {
    baseRefs.add(splitDash[0].trim());
    baseRefs.add(splitDash.slice(1).join(" - ").trim());
  }
  const firstToken = raw.split(" ").filter(Boolean)[0];
  if (firstToken) {
    baseRefs.add(firstToken.trim());
  }
  const refs = Array.from(baseRefs).filter(Boolean);

  return prisma.project.findFirst({
    where: {
      OR: [{ id: { in: refs } }, { projectId: { in: refs } }, { name: { in: refs } }],
    },
  });
}

export async function resolveProjectId(projectRef?: string | null) {
  if (!projectRef) return null;
  const trimmed = projectRef.trim();
  if (!trimmed) return null;
  const project = await findProjectByRef(trimmed);
  return project?.projectId || null;
}

export async function resolveProjectDbId(projectRef?: string | null) {
  if (!projectRef) return null;
  const trimmed = projectRef.trim();
  if (!trimmed) return null;
  const project = await findProjectByRef(trimmed);
  return project?.id || null;
}

type ProjectAliasInput = {
  id?: string | null;
  projectId?: string | null;
  name?: string | null;
};

type ProjectFinancialSource = ProjectAliasInput & {
  contractValue?: Prisma.Decimal | number | null;
};

export type ProjectFinancialSnapshot = {
  contractValue: number;
  invoicedAmount: number;
  receivedAmount: number;
  // Pending against invoices only (strict AR view).
  invoicedPendingRecovery: number;
  // Pending using commercial baseline (max(invoice, contract) - received).
  pendingRecovery: number;
  costToDate: number;
  grossMargin: number;
  marginPercent: number;
  apBilledTotal: number;
  apPaidTotal: number;
  apOutstanding: number;
  incentivesApproved: number;
  otherNonStockExpensesApproved: number;
  nonStockExpensesApproved: number;
  approvedIncomeReceived: number;
  pendingIncomeSubmitted: number;
  pendingExpenseSubmitted: number;
  totalProjectCosts: number;
  projectProfit: number;
  overdueRecoveryAmount: number;
  overdueInvoiceCount: number;
  negativeMargin: boolean;
  highUnpaidVendorExposure: boolean;
};

function toAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function effectiveApprovedExpenseAmount(expense: {
  amount?: unknown;
  approvedAmount?: unknown;
  status?: string | null;
}) {
  const status = String(expense.status || "").toUpperCase();
  const canUseApproved =
    status === "APPROVED" || status === "PARTIALLY_APPROVED" || status === "PAID";
  if (canUseApproved && expense.approvedAmount != null) {
    return toAmount(expense.approvedAmount);
  }
  return toAmount(expense.amount);
}

export function buildProjectAliases(project: ProjectAliasInput) {
  const id = String(project.id || "").trim();
  const projectId = String(project.projectId || "").trim();
  const name = String(project.name || "").trim();

  const aliases = [
    id,
    projectId,
    name,
    projectId && name ? `${projectId} - ${name}` : "",
    projectId && name ? `${projectId}-${name}` : "",
  ].filter(Boolean);

  return Array.from(new Set(aliases));
}

export async function computeProjectFinancialSnapshot(
  project: ProjectFinancialSource,
): Promise<ProjectFinancialSnapshot> {
  const projectAliases = buildProjectAliases(project);
  if (projectAliases.length === 0) {
    return {
      contractValue: toAmount(project.contractValue),
      invoicedAmount: 0,
      receivedAmount: 0,
      invoicedPendingRecovery: 0,
      pendingRecovery: 0,
      costToDate: 0,
      grossMargin: 0,
      marginPercent: 0,
      apBilledTotal: 0,
      apPaidTotal: 0,
      apOutstanding: 0,
      incentivesApproved: 0,
      otherNonStockExpensesApproved: 0,
      nonStockExpensesApproved: 0,
      approvedIncomeReceived: 0,
      pendingIncomeSubmitted: 0,
      pendingExpenseSubmitted: 0,
      totalProjectCosts: 0,
      projectProfit: 0,
      overdueRecoveryAmount: 0,
      overdueInvoiceCount: 0,
      negativeMargin: false,
      highUnpaidVendorExposure: false,
    };
  }

  const [
    postedBillsAgg,
    postedPaymentAllocationsAgg,
    approvedExpenseRows,
    pendingExpenseAgg,
    approvedIncomeAgg,
    pendingIncomeAgg,
    invoicedAgg,
    overdueAgg,
  ] = await Promise.all([
    prisma.vendorBill.aggregate({
      where: {
        projectRef: { in: projectAliases },
        status: "POSTED",
      },
      _sum: { totalAmount: true },
    }),
    prisma.vendorPaymentAllocation.aggregate({
      where: {
        vendorBill: {
          projectRef: { in: projectAliases },
          status: "POSTED",
        },
        vendorPayment: {
          status: "POSTED",
        },
      },
      _sum: { amount: true },
    }),
    prisma.expense.findMany({
      where: {
        project: { in: projectAliases },
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
      },
      select: {
        amount: true,
        approvedAmount: true,
        status: true,
        category: true,
      },
    }),
    prisma.expense.aggregate({
      where: {
        project: { in: projectAliases },
        status: { startsWith: "PENDING" },
      },
      _sum: { amount: true },
    }),
    prisma.income.aggregate({
      where: {
        project: { in: projectAliases },
        status: "APPROVED",
      },
      _sum: { amount: true },
    }),
    prisma.income.aggregate({
      where: {
        project: { in: projectAliases },
        status: { startsWith: "PENDING" },
      },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        projectId: { in: projectAliases },
        status: { notIn: ["DRAFT", "CANCELLED"] },
      },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        projectId: { in: projectAliases },
        dueDate: { lt: new Date() },
        status: { notIn: ["PAID", "CANCELLED", "DRAFT"] },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const apBilledTotal = toAmount(postedBillsAgg._sum.totalAmount);
  const apPaidTotal = toAmount(postedPaymentAllocationsAgg._sum.amount);
  const apOutstanding = Math.max(0, apBilledTotal - apPaidTotal);

  const nonStockExpensesApproved = approvedExpenseRows.reduce((sum, expense) => {
    return sum + effectiveApprovedExpenseAmount(expense);
  }, 0);

  const incentivesApproved = approvedExpenseRows
    .filter((expense) => String(expense.category || "").toLowerCase().includes("incentive"))
    .reduce((sum, expense) => sum + effectiveApprovedExpenseAmount(expense), 0);

  const otherNonStockExpensesApproved = Math.max(0, nonStockExpensesApproved - incentivesApproved);
  const contractValue = toAmount(project.contractValue);
  const approvedIncomeReceived = toAmount(approvedIncomeAgg._sum.amount);
  const pendingIncomeSubmitted = toAmount(pendingIncomeAgg._sum.amount);
  const pendingExpenseSubmitted = toAmount(pendingExpenseAgg._sum.amount);
  const invoicedAmount = toAmount(invoicedAgg._sum.amount);
  const invoicedPendingRecovery = Math.max(0, invoicedAmount - approvedIncomeReceived);
  // Owners often track pending against contract when invoice posting lags behind collection tracking.
  const commercialBaseline = Math.max(invoicedAmount, contractValue);
  const pendingRecovery = Math.max(0, commercialBaseline - approvedIncomeReceived);
  const totalProjectCosts = apBilledTotal + nonStockExpensesApproved;
  const projectProfit = approvedIncomeReceived - totalProjectCosts;
  const grossMargin = projectProfit;
  const marginPercent = approvedIncomeReceived > 0 ? (grossMargin / approvedIncomeReceived) * 100 : 0;
  const overdueRecoveryAmount = toAmount(overdueAgg._sum.amount);
  const overdueInvoiceCount = overdueAgg._count;
  const highUnpaidVendorExposure = apOutstanding > Math.max(100000, approvedIncomeReceived * 0.6);
  const negativeMargin = grossMargin < 0;

  return {
    contractValue,
    invoicedAmount,
    receivedAmount: approvedIncomeReceived,
    invoicedPendingRecovery,
    pendingRecovery,
    costToDate: totalProjectCosts,
    grossMargin,
    marginPercent,
    apBilledTotal,
    apPaidTotal,
    apOutstanding,
    incentivesApproved,
    otherNonStockExpensesApproved,
    nonStockExpensesApproved,
    approvedIncomeReceived,
    pendingIncomeSubmitted,
    pendingExpenseSubmitted,
    totalProjectCosts,
    projectProfit,
    overdueRecoveryAmount,
    overdueInvoiceCount,
    negativeMargin,
    highUnpaidVendorExposure,
  };
}

export async function recalculateProjectFinancials(projectRef: string) {
  const project = await findProjectByRef(projectRef);
  if (!project) return null;
  const snapshot = await computeProjectFinancialSnapshot(project);

  return prisma.project.update({
    where: { id: project.id },
    data: {
      invoicedAmount: new Prisma.Decimal(snapshot.invoicedAmount),
      receivedAmount: new Prisma.Decimal(snapshot.receivedAmount),
      pendingRecovery: new Prisma.Decimal(snapshot.pendingRecovery),
      costToDate: new Prisma.Decimal(snapshot.costToDate),
      grossMargin: new Prisma.Decimal(snapshot.grossMargin),
      marginPercent: new Prisma.Decimal(snapshot.marginPercent),
    },
  });
}
