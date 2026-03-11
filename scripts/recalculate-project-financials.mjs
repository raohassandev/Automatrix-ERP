import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const mode = String(process.env.MODE || "dry").toLowerCase();
const shouldApply = mode === "execute";
const tolerance = Number(process.env.PROJECT_FINANCIAL_TOLERANCE || 1);
const maxProjects = Number(process.env.PROJECT_FINANCIAL_MAX || 0);

function toAmount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildAliases(project) {
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

function approvedExpenseAmount(row) {
  const status = String(row.status || "").toUpperCase();
  const isApproved = status === "APPROVED" || status === "PARTIALLY_APPROVED" || status === "PAID";
  if (isApproved && row.approvedAmount != null) {
    return toAmount(row.approvedAmount);
  }
  return toAmount(row.amount);
}

async function compute(project) {
  const aliases = buildAliases(project);
  const [
    postedBillsAgg,
    approvedExpenseRows,
    approvedIncomeAgg,
    invoicedAgg,
  ] = await Promise.all([
    prisma.vendorBill.aggregate({
      where: { projectRef: { in: aliases }, status: "POSTED" },
      _sum: { totalAmount: true },
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
    prisma.invoice.aggregate({
      where: { projectId: { in: aliases }, status: { notIn: ["DRAFT", "CANCELLED"] } },
      _sum: { amount: true },
    }),
  ]);

  const contractValue = toAmount(project.contractValue);
  const invoicedAmount = toAmount(invoicedAgg._sum.amount);
  const receivedAmount = toAmount(approvedIncomeAgg._sum.amount);
  const nonStockExpensesApproved = approvedExpenseRows.reduce((sum, row) => sum + approvedExpenseAmount(row), 0);
  const apBilledTotal = toAmount(postedBillsAgg._sum.totalAmount);
  const costToDate = apBilledTotal + nonStockExpensesApproved;
  const commercialBaseline = Math.max(invoicedAmount, contractValue);
  const pendingRecovery = Math.max(0, commercialBaseline - receivedAmount);
  const grossMargin = receivedAmount - costToDate;
  const marginPercent = receivedAmount > 0 ? (grossMargin / receivedAmount) * 100 : 0;

  return {
    contractValue,
    invoicedAmount,
    receivedAmount,
    pendingRecovery,
    costToDate,
    grossMargin,
    marginPercent,
  };
}

function hasDrift(stored, computed) {
  const checks = [
    Math.abs(toAmount(stored.invoicedAmount) - computed.invoicedAmount),
    Math.abs(toAmount(stored.receivedAmount) - computed.receivedAmount),
    Math.abs(toAmount(stored.pendingRecovery) - computed.pendingRecovery),
    Math.abs(toAmount(stored.costToDate) - computed.costToDate),
    Math.abs(toAmount(stored.grossMargin) - computed.grossMargin),
    Math.abs(toAmount(stored.marginPercent) - computed.marginPercent),
  ];
  return checks.some((delta) => delta > tolerance);
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

  const updates = [];
  for (const project of projects) {
    const computed = await compute(project);
    if (!hasDrift(project, computed)) continue;
    updates.push({
      id: project.id,
      projectId: project.projectId,
      name: project.name,
      before: {
        invoicedAmount: toAmount(project.invoicedAmount),
        receivedAmount: toAmount(project.receivedAmount),
        pendingRecovery: toAmount(project.pendingRecovery),
        costToDate: toAmount(project.costToDate),
        grossMargin: toAmount(project.grossMargin),
        marginPercent: toAmount(project.marginPercent),
      },
      after: computed,
    });
  }

  if (shouldApply && updates.length > 0) {
    for (const row of updates) {
      await prisma.project.update({
        where: { id: row.id },
        data: {
          invoicedAmount: row.after.invoicedAmount,
          receivedAmount: row.after.receivedAmount,
          pendingRecovery: row.after.pendingRecovery,
          costToDate: row.after.costToDate,
          grossMargin: row.after.grossMargin,
          marginPercent: row.after.marginPercent,
        },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: shouldApply ? "execute" : "dry",
        tolerance,
        projectCount: projects.length,
        driftCount: updates.length,
        updates: updates.slice(0, 100),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(String(error?.stack || error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

