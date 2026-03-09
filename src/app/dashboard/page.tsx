import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { getDashboardDataEnhanced } from "@/lib/dashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canViewCeo = await requirePermission(session.user.id, "dashboard.view_all_metrics");
  const canManageCompanyAccounts = await requirePermission(session.user.id, "company_accounts.manage");
  const canViewProcurement = await requirePermission(session.user.id, "procurement.view_all");
  const canEditProcurement = await requirePermission(session.user.id, "procurement.edit");
  const canViewInventory = await requirePermission(session.user.id, "inventory.view");
  const canViewApprovals = await requirePermission(session.user.id, "approvals.view_pending");
  const canViewAllApprovals = await requirePermission(session.user.id, "approvals.view_all");
  const canViewAudit = await requirePermission(session.user.id, "audit.view");
  const canViewReportsOwn = await requirePermission(session.user.id, "reports.view_own");
  const canViewReportsTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewReportsAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewAccounting = await requirePermission(session.user.id, "accounting.view");
  const canManageAccounting = await requirePermission(session.user.id, "accounting.manage");
  const canViewOwnEmployees = await requirePermission(session.user.id, "employees.view_own");
  const canViewAllEmployees = await requirePermission(session.user.id, "employees.view_all");
  const canSubmitExpense = await requirePermission(session.user.id, "expenses.submit");

  const canViewReports = canViewReportsOwn || canViewReportsTeam || canViewReportsAll;
  const canViewControls = canViewApprovals || canViewAllApprovals || canViewAudit;
  const canViewWorkspace = canViewOwnEmployees || canViewAllEmployees || canSubmitExpense;
  const dashboardMetrics = await getDashboardDataEnhanced("THIS_MONTH");
  const netPositive = (dashboardMetrics?.netProfit || 0) >= 0;
  const pendingRisk = (dashboardMetrics?.pendingApprovals || 0) > 0 || (dashboardMetrics?.pendingRecovery || 0) > 0;
  const incomeDelta = (dashboardMetrics?.totalIncome || 0) - (dashboardMetrics?.prevMonthIncome || 0);
  const expenseDelta = (dashboardMetrics?.totalExpenses || 0) - (dashboardMetrics?.prevMonthExpenses || 0);
  const netDelta = (dashboardMetrics?.netProfit || 0) - (dashboardMetrics?.prevMonthNet || 0);
  const formatDelta = (value: number) => `${value >= 0 ? "+" : "-"}${formatMoney(Math.abs(value))}`;

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-sky-500/10 p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Cash signal view for daily operations: receipts, costs, pending approvals, and recovery pressure.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full border px-3 py-1 font-medium ${netPositive ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300"}`}>
              {netPositive ? "Net positive this month" : "Net negative this month"}
            </span>
            <span className={`rounded-full border px-3 py-1 font-medium ${pendingRisk ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300" : "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>
              {pendingRisk ? "Pending cash risk exists" : "Pending queue healthy"}
            </span>
          </div>
        </div>
        {canViewCeo ? (
          <div className="mt-4">
            <Link className="inline-flex rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15" href="/ceo/dashboard">
              Open CEO dashboard (truthful KPIs)
            </Link>
          </div>
        ) : null}
      </div>

      {dashboardMetrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-5 shadow-sm">
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Income (This Month)</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{formatMoney(dashboardMetrics.totalIncome)}</div>
            <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">Entries: {dashboardMetrics.incomeCount}</div>
            <div className={`mt-1 text-xs font-medium ${incomeDelta >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
              vs last month: {formatDelta(incomeDelta)}
            </div>
          </div>
          <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-5 shadow-sm">
            <div className="text-sm text-rose-700 dark:text-rose-300">Expense (This Month)</div>
            <div className="mt-2 text-2xl font-semibold text-rose-900 dark:text-rose-100">{formatMoney(dashboardMetrics.totalExpenses)}</div>
            <div className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">Entries: {dashboardMetrics.expenseCount}</div>
            <div className={`mt-1 text-xs font-medium ${expenseDelta <= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
              vs last month: {formatDelta(expenseDelta)}
            </div>
          </div>
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-5 shadow-sm">
            <div className="text-sm text-primary">Net Position</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{formatMoney(dashboardMetrics.netProfit)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Margin: {dashboardMetrics.profitMargin.toFixed(1)}%</div>
            <div className={`mt-1 text-xs font-medium ${netDelta >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
              vs last month: {formatDelta(netDelta)}
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-5 shadow-sm">
            <div className="text-sm text-amber-700 dark:text-amber-300">Pending Queue</div>
            <div className="mt-2 text-2xl font-semibold text-amber-900 dark:text-amber-100">{dashboardMetrics.pendingApprovals}</div>
            <div className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
              Recovery: {formatMoney(dashboardMetrics.pendingRecovery)}
            </div>
          </div>
          <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 p-5 shadow-sm">
            <div className="text-sm text-sky-700 dark:text-sky-300">Wallet Available</div>
            <div className="mt-2 text-2xl font-semibold text-sky-900 dark:text-sky-100">
              {formatMoney(dashboardMetrics.walletAvailable)}
            </div>
            <div className="mt-1 text-xs text-sky-700/80 dark:text-sky-300/80">
              Hold: {formatMoney(dashboardMetrics.walletHold)}
            </div>
          </div>
        </div>
      ) : null}

      {dashboardMetrics ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 shadow-sm">
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Cash Inflow Signal</div>
            <div className="mt-2 text-xl font-semibold text-emerald-900 dark:text-emerald-100">{formatMoney(dashboardMetrics.totalIncome)}</div>
            <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">Approved and captured this month</div>
          </div>
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-5 shadow-sm">
            <div className="text-sm text-rose-700 dark:text-rose-300">Cash Outflow Signal</div>
            <div className="mt-2 text-xl font-semibold text-rose-900 dark:text-rose-100">{formatMoney(dashboardMetrics.totalExpenses)}</div>
            <div className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">Expenses requiring control and settlement speed</div>
          </div>
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-5 shadow-sm">
            <div className="text-sm text-violet-700 dark:text-violet-300">Next Focus</div>
            <div className="mt-2 text-sm font-medium text-violet-900 dark:text-violet-100">
              {dashboardMetrics.pendingApprovals > 0
                ? `Clear ${dashboardMetrics.pendingApprovals} pending approval item(s)`
                : "No urgent approvals pending"}
            </div>
            <div className="mt-2 text-xs text-violet-700/80 dark:text-violet-300/80">
              Pending recovery: {formatMoney(dashboardMetrics.pendingRecovery)}
            </div>
          </div>
        </div>
      ) : null}

      {dashboardMetrics ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold">Why This Month Changed</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">
              <div className="text-emerald-700 dark:text-emerald-300">Income movement</div>
              <div className="mt-1 font-semibold">{formatDelta(incomeDelta)}</div>
            </div>
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm">
              <div className="text-rose-700 dark:text-rose-300">Expense movement</div>
              <div className="mt-1 font-semibold">{formatDelta(expenseDelta)}</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
              <div className="text-amber-800 dark:text-amber-300">Pending approvals</div>
              <div className="mt-1 font-semibold">{dashboardMetrics.pendingApprovals}</div>
            </div>
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-sm">
              <div className="text-sky-700 dark:text-sky-300">Wallet available</div>
              <div className="mt-1 font-semibold">{formatMoney(dashboardMetrics.walletAvailable)}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {canViewProcurement || canEditProcurement ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Procurement Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="underline underline-offset-2" href="/procurement/purchase-orders">
                Purchase Orders
              </Link>
              <Link className="underline underline-offset-2" href="/procurement/grn">
                Goods Receipts (GRN)
              </Link>
              <Link className="underline underline-offset-2" href="/procurement/vendor-bills">
                Vendor Bills
              </Link>
              {canManageCompanyAccounts ? (
                <Link className="underline underline-offset-2" href="/procurement/vendor-payments">
                  Vendor Payments
                </Link>
              ) : null}
              <Link className="underline underline-offset-2" href="/reports/procurement">
                Procurement Report
              </Link>
            </div>
          </div>
        ) : null}

        {canViewInventory ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Inventory Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="underline underline-offset-2" href="/inventory">
                Items
              </Link>
              <Link className="underline underline-offset-2" href="/inventory/ledger">
                Stock Ledger
              </Link>
              <Link className="underline underline-offset-2" href="/reports/inventory">
                Inventory Report
              </Link>
              <Link className="underline underline-offset-2" href="/inventory/warehouses">
                Warehouses
              </Link>
            </div>
          </div>
        ) : null}

        {canViewControls ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Controls Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              {canViewApprovals || canViewAllApprovals ? (
                <Link className="underline underline-offset-2" href="/approvals">
                  Approvals Queue
                </Link>
              ) : null}
              {canViewAudit ? (
                <Link className="underline underline-offset-2" href="/audit">
                  Audit Log
                </Link>
              ) : null}
              <Link className="underline underline-offset-2" href="/reports/controls">
                Exceptions Report
              </Link>
            </div>
          </div>
        ) : null}

        {canViewReports ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Reports Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              {canViewAccounting || canManageAccounting || canManageCompanyAccounts ? (
                <Link className="underline underline-offset-2" href="/reports/ap">
                  AP Aging
                </Link>
              ) : null}
              {canViewProcurement || canViewReportsAll || canViewReportsTeam ? (
                <Link className="underline underline-offset-2" href="/reports/procurement">
                  Procurement (Stock-in)
                </Link>
              ) : null}
              <Link className="underline underline-offset-2" href="/reports">
                All Reports
              </Link>
              {canViewAccounting || canManageAccounting ? (
                <Link className="underline underline-offset-2" href="/reports/accounting/cash-position">
                  Cash Position
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {canViewWorkspace ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">My Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="underline underline-offset-2" href="/me">
                My Dashboard
              </Link>
              <Link className="underline underline-offset-2" href="/wallets">
                Wallets
              </Link>
              <Link className="underline underline-offset-2" href="/expenses">
                Expenses
              </Link>
              <Link className="underline underline-offset-2" href="/payroll">
                Payroll
              </Link>
              <Link className="underline underline-offset-2" href="/hrms/attendance">
                HR Attendance
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
