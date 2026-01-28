import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { redirect } from 'next/navigation';


export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
    redirect("/login")
    );
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
  const netProfit = totalIncome - totalExpenses;
  const lowStockCount = inventoryItems.filter(
    (item) => Number(item.quantity) <= Number(item.minStock)
  ).length;
  const pendingRecovery = Number(pendingRecoverySum._sum.pendingRecovery || 0);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-gray-600">KPIs across finance, inventory, and recovery.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Total Income</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totalIncome)}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Total Expenses</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totalExpenses)}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Net Profit</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(netProfit)}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Pending Approvals</div>
          <div className="mt-2 text-xl font-semibold">{pendingExpenses + pendingIncome}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Pending Recovery</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(pendingRecovery)}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Low Stock Alerts</div>
          <div className="mt-2 text-xl font-semibold">{lowStockCount}</div>
        </div>
      </div>
    </div>
  );
}
