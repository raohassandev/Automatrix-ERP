import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [expenseSum, incomeSum, pendingExpenses, pendingIncome, inventoryItems, pendingRecoverySum] =
    await Promise.all([
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.income.aggregate({ _sum: { amount: true } }),
      prisma.expense.count({ where: { status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] } } }),
      prisma.income.count({ where: { status: "PENDING" } }),
      prisma.inventoryItem.findMany({
        where: { minStock: { gt: 0 } },
        select: { quantity: true, minStock: true },
      }),
      prisma.project.aggregate({ _sum: { pendingRecovery: true } }),
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
