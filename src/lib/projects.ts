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

export async function recalculateProjectFinancials(projectRef: string) {
  const project = await findProjectByRef(projectRef);
  if (!project) return null;
  const projectAliases = buildProjectAliases(project);

  const [expenses, incomes, invoices, postedBills] = await Promise.all([
    prisma.expense.findMany({
      where: {
        project: { in: projectAliases },
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
      },
      select: { amount: true, approvedAmount: true, status: true },
    }),
    prisma.income.findMany({
      where: {
        project: { in: projectAliases },
        status: "APPROVED",
      },
      select: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { projectId: { in: projectAliases } },
      select: { amount: true },
    }),
    prisma.vendorBill.findMany({
      where: {
        projectRef: { in: projectAliases },
        status: "POSTED",
      },
      select: { totalAmount: true },
    }),
  ]);

  const totalExpenses = expenses.reduce((sum, exp) => {
    if (exp.status === "PARTIALLY_APPROVED" && exp.approvedAmount) {
      return sum + Number(exp.approvedAmount);
    }
    return sum + Number(exp.amount);
  }, 0);

  const totalIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
  const totalPostedProcurementCost = postedBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
  const totalCosts = totalExpenses + totalPostedProcurementCost;
  const invoicedAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const pendingRecovery = Math.max(0, invoicedAmount - totalIncome);
  const grossMargin = totalIncome - totalCosts;
  const marginPercent = totalIncome > 0 ? (grossMargin / totalIncome) * 100 : 0;

  return prisma.project.update({
    where: { id: project.id },
    data: {
      invoicedAmount: new Prisma.Decimal(invoicedAmount),
      receivedAmount: new Prisma.Decimal(totalIncome),
      pendingRecovery: new Prisma.Decimal(pendingRecovery),
      costToDate: new Prisma.Decimal(totalCosts),
      grossMargin: new Prisma.Decimal(grossMargin),
      marginPercent: new Prisma.Decimal(marginPercent),
    },
  });
}
