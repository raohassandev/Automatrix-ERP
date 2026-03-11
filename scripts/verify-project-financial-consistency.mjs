import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const tolerance = Number(process.env.PROJECT_FINANCIAL_TOLERANCE || 1);
const failOnDrift = String(process.env.FAIL_ON_PROJECT_DRIFT || "0") === "1";
const maxProjects = Number(process.env.PROJECT_FINANCIAL_MAX || 0);

function toAmount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildProjectAliases(project) {
  const id = String(project.id || "").trim();
  const projectId = String(project.projectId || "").trim();
  const name = String(project.name || "").trim();
  return Array.from(
    new Set([
      id,
      projectId,
      name,
      projectId && name ? `${projectId} - ${name}` : "",
      projectId && name ? `${projectId}-${name}` : "",
    ].filter(Boolean)),
  );
}

function isApprovedExpenseStatus(status) {
  const normalized = String(status || "").toUpperCase();
  return normalized === "APPROVED" || normalized === "PARTIALLY_APPROVED" || normalized === "PAID";
}

function approvedExpenseAmount(row) {
  if (isApprovedExpenseStatus(row.status) && row.approvedAmount != null) {
    return toAmount(row.approvedAmount);
  }
  return toAmount(row.amount);
}

function mapKnownProjectRefs(projects) {
  const known = new Set();
  for (const p of projects) {
    for (const alias of buildProjectAliases(p)) {
      known.add(alias.toLowerCase());
    }
  }
  return known;
}

function isKnownProjectRef(rawRef, knownSet) {
  const raw = String(rawRef || "").trim();
  if (!raw) return true;
  if (knownSet.has(raw.toLowerCase())) return true;
  const split = raw.split(" - ");
  if (split.length >= 2) {
    const left = split[0].trim().toLowerCase();
    const right = split.slice(1).join(" - ").trim().toLowerCase();
    if (knownSet.has(left) || knownSet.has(right)) return true;
  }
  const firstToken = raw.split(" ").filter(Boolean)[0]?.trim().toLowerCase();
  if (firstToken && knownSet.has(firstToken)) return true;
  return false;
}

async function computeSnapshot(project) {
  const aliases = buildProjectAliases(project);
  const [
    postedBillsAgg,
    postedPaymentAllocationsAgg,
    approvedExpenseRows,
    approvedIncomeAgg,
    pendingIncomeAgg,
    pendingExpenseAgg,
    invoicedAgg,
  ] = await Promise.all([
    prisma.vendorBill.aggregate({
      where: { projectRef: { in: aliases }, status: "POSTED" },
      _sum: { totalAmount: true },
    }),
    prisma.vendorPaymentAllocation.aggregate({
      where: {
        vendorBill: { projectRef: { in: aliases }, status: "POSTED" },
        vendorPayment: { status: "POSTED" },
      },
      _sum: { amount: true },
    }),
    prisma.expense.findMany({
      where: {
        project: { in: aliases },
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
      },
      select: { amount: true, approvedAmount: true, status: true },
    }),
    prisma.income.aggregate({
      where: { project: { in: aliases }, status: "APPROVED" },
      _sum: { amount: true },
    }),
    prisma.income.aggregate({
      where: { project: { in: aliases }, status: { startsWith: "PENDING" } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { project: { in: aliases }, status: { startsWith: "PENDING" } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        projectId: { in: aliases },
        status: { notIn: ["DRAFT", "CANCELLED"] },
      },
      _sum: { amount: true },
    }),
  ]);

  const apBilledTotal = toAmount(postedBillsAgg._sum.totalAmount);
  const apPaidTotal = toAmount(postedPaymentAllocationsAgg._sum.amount);
  const nonStockExpensesApproved = approvedExpenseRows.reduce(
    (sum, row) => sum + approvedExpenseAmount(row),
    0,
  );
  const approvedIncomeReceived = toAmount(approvedIncomeAgg._sum.amount);
  const pendingIncomeSubmitted = toAmount(pendingIncomeAgg._sum.amount);
  const pendingExpenseSubmitted = toAmount(pendingExpenseAgg._sum.amount);
  const invoicedAmount = toAmount(invoicedAgg._sum.amount);
  const contractValue = toAmount(project.contractValue);
  const commercialBaseline = Math.max(invoicedAmount, contractValue);
  const pendingRecovery = Math.max(0, commercialBaseline - approvedIncomeReceived);
  const costToDate = apBilledTotal + nonStockExpensesApproved;
  const grossMargin = approvedIncomeReceived - costToDate;
  const marginPercent = approvedIncomeReceived > 0 ? (grossMargin / approvedIncomeReceived) * 100 : 0;

  return {
    contractValue,
    invoicedAmount,
    receivedAmount: approvedIncomeReceived,
    pendingRecovery,
    costToDate,
    grossMargin,
    marginPercent,
    pendingIncomeSubmitted,
    pendingExpenseSubmitted,
    apBilledTotal,
    apPaidTotal,
  };
}

function diffField(stored, computed) {
  const delta = computed - stored;
  return {
    stored,
    computed,
    delta,
    absDelta: Math.abs(delta),
  };
}

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    take: maxProjects > 0 ? maxProjects : undefined,
    select: {
      id: true,
      projectId: true,
      name: true,
      contractValue: true,
      invoicedAmount: true,
      receivedAmount: true,
      pendingRecovery: true,
      costToDate: true,
      grossMargin: true,
      marginPercent: true,
    },
  });

  const drifts = [];
  for (const project of projects) {
    const computed = await computeSnapshot(project);
    const fields = {
      contractValue: diffField(toAmount(project.contractValue), computed.contractValue),
      invoicedAmount: diffField(toAmount(project.invoicedAmount), computed.invoicedAmount),
      receivedAmount: diffField(toAmount(project.receivedAmount), computed.receivedAmount),
      pendingRecovery: diffField(toAmount(project.pendingRecovery), computed.pendingRecovery),
      costToDate: diffField(toAmount(project.costToDate), computed.costToDate),
      grossMargin: diffField(toAmount(project.grossMargin), computed.grossMargin),
      marginPercent: diffField(toAmount(project.marginPercent), computed.marginPercent),
    };
    const mismatchedFields = Object.entries(fields)
      .filter(([, v]) => v.absDelta > tolerance)
      .map(([key, v]) => ({ field: key, ...v }));
    if (mismatchedFields.length > 0) {
      drifts.push({
        projectDbId: project.id,
        projectId: project.projectId,
        name: project.name,
        mismatchedFields,
      });
    }
  }

  const knownRefs = mapKnownProjectRefs(projects);
  const incomeRefs = await prisma.income.findMany({
    where: { project: { not: null } },
    distinct: ["project"],
    select: { project: true },
  });
  const expenseRefs = await prisma.expense.findMany({
    where: { project: { not: null } },
    distinct: ["project"],
    select: { project: true },
  });

  const unresolvedIncomeRefs = incomeRefs
    .map((row) => String(row.project || "").trim())
    .filter(Boolean)
    .filter((ref) => !isKnownProjectRef(ref, knownRefs));
  const unresolvedExpenseRefs = expenseRefs
    .map((row) => String(row.project || "").trim())
    .filter(Boolean)
    .filter((ref) => !isKnownProjectRef(ref, knownRefs));

  const report = {
    checkedAt: new Date().toISOString(),
    tolerance,
    projectCount: projects.length,
    driftCount: drifts.length,
    drifts: drifts.slice(0, 50),
    unresolvedRefs: {
      incomeCount: unresolvedIncomeRefs.length,
      expenseCount: unresolvedExpenseRefs.length,
      income: unresolvedIncomeRefs.slice(0, 50),
      expense: unresolvedExpenseRefs.slice(0, 50),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (failOnDrift && (drifts.length > 0 || unresolvedIncomeRefs.length > 0 || unresolvedExpenseRefs.length > 0)) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(String(error?.stack || error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

