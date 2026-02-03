import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

async function findProjectByRef(projectRef: string) {
  return prisma.project.findFirst({
    where: {
      OR: [{ projectId: projectRef }, { name: projectRef }],
    },
  });
}

export async function recalculateProjectFinancials(projectRef: string) {
  const project = await findProjectByRef(projectRef);
  if (!project) return null;

  const [expenses, incomes, invoices] = await Promise.all([
    prisma.expense.findMany({
      where: {
        project: { in: [project.projectId, project.name] },
        status: { in: ["APPROVED", "PARTIALLY_APPROVED"] },
      },
      select: { amount: true, approvedAmount: true, status: true },
    }),
    prisma.income.findMany({
      where: {
        project: { in: [project.projectId, project.name] },
        status: "APPROVED",
      },
      select: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { projectId: project.projectId },
      select: { amount: true },
    }),
  ]);

  const totalExpenses = expenses.reduce((sum, exp) => {
    if (exp.status === "PARTIALLY_APPROVED" && exp.approvedAmount) {
      return sum + Number(exp.approvedAmount);
    }
    return sum + Number(exp.amount);
  }, 0);

  const totalIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
  const invoicedAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const pendingRecovery = Math.max(0, invoicedAmount - totalIncome);
  const grossMargin = totalIncome - totalExpenses;
  const marginPercent = totalIncome > 0 ? (grossMargin / totalIncome) * 100 : 0;

  return prisma.project.update({
    where: { id: project.id },
    data: {
      invoicedAmount: new Prisma.Decimal(invoicedAmount),
      receivedAmount: new Prisma.Decimal(totalIncome),
      pendingRecovery: new Prisma.Decimal(pendingRecovery),
      costToDate: new Prisma.Decimal(totalExpenses),
      grossMargin: new Prisma.Decimal(grossMargin),
      marginPercent: new Prisma.Decimal(marginPercent),
    },
  });
}
