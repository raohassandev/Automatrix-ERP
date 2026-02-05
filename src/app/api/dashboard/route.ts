import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewDashboard = await requirePermission(session.user.id, "dashboard.view");
  if (!canViewDashboard) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const canViewAllMetrics = await requirePermission(session.user.id, "dashboard.view_all_metrics");
  const canViewInventory = await requirePermission(session.user.id, "inventory.view");

  const expenseWhere = canViewAllMetrics ? {} : { submittedById: session.user.id };
  const incomeWhere = canViewAllMetrics ? {} : { addedById: session.user.id };

  const [expenseSum, incomeSum, pendingExpenses, pendingIncome, inventoryItems, pendingRecoverySum] =
    await Promise.all([
      prisma.expense.aggregate({ _sum: { amount: true }, where: expenseWhere }),
      prisma.income.aggregate({ _sum: { amount: true }, where: incomeWhere }),
      prisma.expense.count({
        where: {
          ...expenseWhere,
          status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] },
        },
      }),
      prisma.income.count({ where: { ...incomeWhere, status: "PENDING" } }),
      canViewAllMetrics || canViewInventory
        ? prisma.inventoryItem.findMany({
            where: { minStock: { gt: 0 } },
            select: { quantity: true, minStock: true },
          })
        : Promise.resolve([]),
      canViewAllMetrics
        ? prisma.project.aggregate({ _sum: { pendingRecovery: true } })
        : Promise.resolve({ _sum: { pendingRecovery: 0 } }),
    ]);

  const totalExpenses = Number(expenseSum._sum.amount || 0);
  const totalIncome = Number(incomeSum._sum.amount || 0);
  const lowStockCount = inventoryItems.filter(
    (item) => Number(item.quantity) <= Number(item.minStock)
  ).length;

  return NextResponse.json({
    success: true,
    data: {
      totalExpenses,
      totalIncome,
      netProfit: totalIncome - totalExpenses,
      pendingApprovals: pendingExpenses + pendingIncome,
      lowStockCount,
      pendingRecovery: Number(pendingRecoverySum._sum.pendingRecovery || 0),
    },
  });
}
