import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
       redirect("/login")
       );
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  const canExport = await requirePermission(session.user.id, "reports.export");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-gray-600">You do not have access to reports.</p>
      </div>
    );
  }

  const [expenseSum, incomeSum, projectCount, invoiceCount, pendingRecoverySum, inventoryItems] =
    await Promise.all([
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.income.aggregate({ _sum: { amount: true } }),
      prisma.project.count(),
      prisma.invoice.count(),
      prisma.project.aggregate({ _sum: { pendingRecovery: true } }),
      prisma.inventoryItem.findMany({
        where: { minStock: { gt: 0 } },
        select: { quantity: true, minStock: true },
      }),
    ]);

  const totalExpenses = Number(expenseSum._sum.amount || 0);
  const totalIncome = Number(incomeSum._sum.amount || 0);
  const lowStockCount = inventoryItems.filter(
    (item) => Number(item.quantity) <= Number(item.minStock)
  ).length;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Reports</h1>
            <p className="mt-2 text-gray-600">High-level summary report.</p>
          </div>
          {canExport ? (
            <a
              href="/api/reports/export"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Total Income</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totalIncome)}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Total Expenses</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totalExpenses)}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Projects</div>
          <div className="mt-2 text-xl font-semibold">{projectCount}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Invoices</div>
          <div className="mt-2 text-xl font-semibold">{invoiceCount}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Pending Recovery</div>
          <div className="mt-2 text-xl font-semibold">
            {formatMoney(Number(pendingRecoverySum._sum.pendingRecovery || 0))}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Low Stock Alerts</div>
          <div className="mt-2 text-xl font-semibold">{lowStockCount}</div>
        </div>
      </div>
    </div>
  );
}
