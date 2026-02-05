import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import ReportExporter from "@/components/ReportExporter";

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
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
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
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Reports</h1>
            <p className="mt-2 text-muted-foreground">High-level summary report.</p>
          </div>
          <div className="flex gap-2">
            {canExport ? (
              <a
                href="/api/reports/export"
                className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Export CSV
              </a>
            ) : null}
            {canExport ? <ReportExporter /> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Income</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totalIncome)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Expenses</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totalExpenses)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Projects</div>
          <div className="mt-2 text-xl font-semibold">{projectCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Invoices</div>
          <div className="mt-2 text-xl font-semibold">{invoiceCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Pending Recovery</div>
          <div className="mt-2 text-xl font-semibold">
            {formatMoney(Number(pendingRecoverySum._sum.pendingRecovery || 0))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Low Stock Alerts</div>
          <div className="mt-2 text-xl font-semibold">{lowStockCount}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <a
          href="/reports/projects"
          className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent"
        >
          <div className="text-sm text-muted-foreground">Project Expense Report</div>
          <div className="mt-2 text-lg font-semibold">View project-wise expenses</div>
        </a>
        <a
          href="/reports/expenses"
          className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent"
        >
          <div className="text-sm text-muted-foreground">Expense Report</div>
          <div className="mt-2 text-lg font-semibold">Approved expenses by category</div>
        </a>
        <a
          href="/reports/inventory"
          className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent"
        >
          <div className="text-sm text-muted-foreground">Inventory Report</div>
          <div className="mt-2 text-lg font-semibold">Stock valuation and low stock</div>
        </a>
        <a
          href="/reports/wallets"
          className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent"
        >
          <div className="text-sm text-muted-foreground">Wallet Summary</div>
          <div className="mt-2 text-lg font-semibold">Employee balances and holds</div>
        </a>
        <a
          href="/reports/employee-expenses"
          className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent"
        >
          <div className="text-sm text-muted-foreground">Employee Expense Summary</div>
          <div className="mt-2 text-lg font-semibold">Approved expenses by employee</div>
        </a>
        <a
          href="/reports/procurement"
          className="rounded-xl border bg-card p-6 shadow-sm hover:bg-accent"
        >
          <div className="text-sm text-muted-foreground">Procurement Summary</div>
          <div className="mt-2 text-lg font-semibold">Material spend and stock-in</div>
        </a>
      </div>
    </div>
  );
}
