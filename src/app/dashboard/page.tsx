import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { getDashboardDataEnhanced } from "@/lib/dashboard";
import { getControlRegistersSummary } from "@/lib/control-registers";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [
    canViewCeo,
    canManageCompanyAccounts,
    canViewProcurement,
    canEditProcurement,
    canViewInventory,
    canViewApprovals,
    canViewAllApprovals,
    canViewAudit,
    canViewReportsOwn,
    canViewReportsTeam,
    canViewReportsAll,
    canViewAccounting,
    canManageAccounting,
    canViewOwnEmployees,
    canViewAllEmployees,
    canSubmitExpense,
    canViewExpensesOwn,
    canViewExpensesAll,
    canEditWallet,
    canViewPayroll,
    canEditPayroll,
    canApprovePayroll,
    canViewTeamEmployees,
    canViewTasksAll,
    canViewTasksAssigned,
  ] = await Promise.all([
    requirePermission(session.user.id, "dashboard.view_all_metrics"),
    requirePermission(session.user.id, "company_accounts.manage"),
    requirePermission(session.user.id, "procurement.view_all"),
    requirePermission(session.user.id, "procurement.edit"),
    requirePermission(session.user.id, "inventory.view"),
    requirePermission(session.user.id, "approvals.view_pending"),
    requirePermission(session.user.id, "approvals.view_all"),
    requirePermission(session.user.id, "audit.view"),
    requirePermission(session.user.id, "reports.view_own"),
    requirePermission(session.user.id, "reports.view_team"),
    requirePermission(session.user.id, "reports.view_all"),
    requirePermission(session.user.id, "accounting.view"),
    requirePermission(session.user.id, "accounting.manage"),
    requirePermission(session.user.id, "employees.view_own"),
    requirePermission(session.user.id, "employees.view_all"),
    requirePermission(session.user.id, "expenses.submit"),
    requirePermission(session.user.id, "expenses.view_own"),
    requirePermission(session.user.id, "expenses.view_all"),
    requirePermission(session.user.id, "employees.edit_wallet"),
    requirePermission(session.user.id, "payroll.view_all"),
    requirePermission(session.user.id, "payroll.edit"),
    requirePermission(session.user.id, "payroll.approve"),
    requirePermission(session.user.id, "employees.view_team"),
    requirePermission(session.user.id, "tasks.view_all"),
    requirePermission(session.user.id, "tasks.view_assigned"),
  ]);

  const canViewReports = canViewReportsOwn || canViewReportsTeam || canViewReportsAll;
  const canViewControls = canViewApprovals || canViewAllApprovals || canViewAudit;
  const canViewWorkspace = canViewOwnEmployees || canViewAllEmployees || canSubmitExpense;
  const canOpenExpenses = canViewExpensesOwn || canViewExpensesAll;
  const canOpenWallets = canViewOwnEmployees || canViewAllEmployees || canEditWallet;
  const canOpenPayroll = canViewPayroll || canEditPayroll || canApprovePayroll;
  const canOpenAttendance = canViewOwnEmployees || canViewTeamEmployees || canViewAllEmployees;
  const canViewManagerWorkspace = canViewTeamEmployees || canViewApprovals || canViewAllApprovals;
  const canOpenTasks = canViewTasksAll || canViewTasksAssigned;
  const canViewFinanceWorkspace = canManageCompanyAccounts || canViewAccounting || canManageAccounting || canEditPayroll || canApprovePayroll;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dashboardMetrics = await getDashboardDataEnhanced("THIS_MONTH");
  const netPositive = (dashboardMetrics?.netProfit || 0) >= 0;
  const pendingRisk = (dashboardMetrics?.pendingApprovals || 0) > 0 || (dashboardMetrics?.pendingRecovery || 0) > 0;
  const incomeDelta = (dashboardMetrics?.totalIncome || 0) - (dashboardMetrics?.prevMonthIncome || 0);
  const expenseDelta = (dashboardMetrics?.totalExpenses || 0) - (dashboardMetrics?.prevMonthExpenses || 0);
  const netDelta = (dashboardMetrics?.netProfit || 0) - (dashboardMetrics?.prevMonthNet || 0);
  const formatDelta = (value: number) => `${value >= 0 ? "+" : "-"}${formatMoney(Math.abs(value))}`;
  const controlSummary = canViewReports ? await getControlRegistersSummary() : null;
  const managerQueues = canViewManagerWorkspace
    ? await (async () => {
        const [overdueTasks, pendingTeamExpenses, pendingApprovalsQueue] = await Promise.all([
          prisma.projectTask.count({
            where: {
              status: { notIn: ["DONE", "CANCELLED"] },
              dueDate: { lt: now },
            },
          }),
          prisma.expense.count({
            where: {
              submittedById: { not: session.user.id },
              status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] },
            },
          }),
          prisma.approval.count({ where: { status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] } } }),
        ]);
        return { overdueTasks, pendingTeamExpenses, pendingApprovalsQueue };
      })()
    : null;
  const myQueues = canViewWorkspace
    ? await (async () => {
        const [pendingMyExpenses, pendingMyLeaves, myOpenTasks] = await Promise.all([
          prisma.expense.count({
            where: {
              submittedById: session.user.id,
              status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] },
            },
          }),
          prisma.leaveRequest.count({
            where: {
              employee: { email: session.user.email || undefined },
              status: "PENDING",
            },
          }),
          prisma.projectTask.count({
            where: {
              assignedToId: session.user.id,
              status: { notIn: ["DONE", "CANCELLED"] },
            },
          }),
        ]);
        return { pendingMyExpenses, pendingMyLeaves, myOpenTasks };
      })()
    : null;
  const ceoQueues = canViewCeo
    ? await (async () => {
        const [blockedActions7d, pendingIncomeApprovals, overdueVendorBills] = await Promise.all([
          prisma.auditLog.count({
            where: {
              action: { startsWith: "BLOCK_" },
              createdAt: { gte: sevenDaysAgo },
            },
          }),
          prisma.income.count({ where: { status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] } } }),
          prisma.vendorBill.count({
            where: {
              status: "POSTED",
              dueDate: { lt: new Date() },
            },
          }),
        ]);
        return { blockedActions7d, pendingIncomeApprovals, overdueVendorBills };
      })()
    : null;
  const financeQueues = canViewFinanceWorkspace
    ? await (async () => {
        const [openPeriods, overdueOpenPeriods, unreconciledSnapshots, unmatchedStatementLines] = await Promise.all([
          prisma.fiscalPeriod.count({ where: { status: "OPEN" } }),
          prisma.fiscalPeriod.count({ where: { status: "OPEN", endDate: { lt: now } } }),
          prisma.bankReconciliationSnapshot.count({ where: { status: { in: ["UNRECONCILED", "REVIEW"] } } }),
          prisma.bankStatementLine.count({ where: { status: "UNMATCHED" } }),
        ]);
        return { openPeriods, overdueOpenPeriods, unreconciledSnapshots, unmatchedStatementLines };
      })()
    : null;

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
          <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-5 shadow-sm">
            <div className="text-sm text-rose-700 dark:text-rose-300">Reimbursement Due</div>
            <div className="mt-2 text-2xl font-semibold text-rose-900 dark:text-rose-100">
              {formatMoney(dashboardMetrics.reimbursementDue || 0)}
            </div>
            <div className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">
              Approved own-pocket expenses pending payment
            </div>
          </div>
          <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-5 shadow-sm">
            <div className="text-sm text-cyan-700 dark:text-cyan-300">Reimbursement Paid</div>
            <div className="mt-2 text-2xl font-semibold text-cyan-900 dark:text-cyan-100">
              {formatMoney(dashboardMetrics.reimbursementPaid || 0)}
            </div>
            <div className="mt-1 text-xs text-cyan-700/80 dark:text-cyan-300/80">
              Paid own-pocket reimbursements in selected range
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-5 text-sm text-amber-800 shadow-sm dark:text-amber-300">
          Dashboard metrics are not available right now. Try again in a few moments.
        </div>
      )}

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

      {controlSummary ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Control Register Snapshot</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Real-time control totals across payroll, variable pay, settlements, and procurement.
              </p>
            </div>
            <Link className="text-sm underline underline-offset-2" href="/reports/controls">
              Open control report
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-3 text-sm">
              <div className="text-sky-700 dark:text-sky-300">Payroll</div>
              <div className="mt-1 font-semibold">{controlSummary.payroll.count} entries</div>
              <div className="text-xs text-muted-foreground">
                Net: {formatMoney(controlSummary.payroll.totalNetPay)} • Overdue: {controlSummary.payroll.totalOverdue}
              </div>
            </div>
            <div className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 p-3 text-sm">
              <div className="text-indigo-700 dark:text-indigo-300">Variable Pay</div>
              <div className="mt-1 font-semibold">{controlSummary.variablePay.count} rows</div>
              <div className="text-xs text-muted-foreground">
                Unsettled: {formatMoney(controlSummary.variablePay.unsettledAmount)}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm">
              <div className="text-emerald-700 dark:text-emerald-300">Employee Settlements</div>
              <div className="mt-1 font-semibold">{controlSummary.settlements.employees} employees</div>
              <div className="text-xs text-muted-foreground">
                Net payable: {formatMoney(controlSummary.settlements.netCompanyPayable)}
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm">
              <div className="text-amber-700 dark:text-amber-300">Projects</div>
              <div className="mt-1 font-semibold">{controlSummary.projects.count} projects</div>
              <div className="text-xs text-muted-foreground">
                Pending recovery: {formatMoney(controlSummary.projects.pendingRecovery)}
              </div>
            </div>
            <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-sm">
              <div className="text-rose-700 dark:text-rose-300">Procurement / AP</div>
              <div className="mt-1 font-semibold">{controlSummary.procurement.rows} vendor rows</div>
              <div className="text-xs text-muted-foreground">
                Outstanding: {formatMoney(controlSummary.procurement.outstanding)} • Blocked: {controlSummary.procurement.blocked}
              </div>
            </div>
            <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 p-3 text-sm">
              <div className="text-violet-700 dark:text-violet-300">Tasks & Approvals</div>
              <div className="mt-1 font-semibold">{controlSummary.taskApprovals.items} items</div>
              <div className="text-xs text-muted-foreground">Overdue: {controlSummary.taskApprovals.overdue}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {canViewProcurement || canEditProcurement ? (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-6 shadow-sm">
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
              {canViewReports ? (
                <Link className="underline underline-offset-2" href="/reports/procurement">
                  Procurement Report
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {canViewInventory ? (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Inventory Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="underline underline-offset-2" href="/inventory">
                Items
              </Link>
              <Link className="underline underline-offset-2" href="/inventory/ledger">
                Stock Ledger
              </Link>
              {canViewReports ? (
                <Link className="underline underline-offset-2" href="/reports/inventory">
                  Inventory Report
                </Link>
              ) : null}
              <Link className="underline underline-offset-2" href="/inventory/warehouses">
                Warehouses
              </Link>
            </div>
          </div>
        ) : null}

        {canViewControls ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 shadow-sm">
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
              {canViewReports ? (
                <Link className="underline underline-offset-2" href="/reports/controls">
                  Exceptions Report
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {canViewReports ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-sm">
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
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">My Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="rounded-md border border-violet-500/20 bg-violet-500/10 px-3 py-2">
                My pending expenses: <span className="font-semibold">{myQueues?.pendingMyExpenses ?? 0}</span>
              </div>
              <div className="rounded-md border border-violet-500/20 bg-violet-500/10 px-3 py-2">
                My pending leaves: <span className="font-semibold">{myQueues?.pendingMyLeaves ?? 0}</span>
              </div>
              <div className="rounded-md border border-violet-500/20 bg-violet-500/10 px-3 py-2">
                My open tasks: <span className="font-semibold">{myQueues?.myOpenTasks ?? 0}</span>
              </div>
              <Link className="underline underline-offset-2" href="/me">
                My Dashboard
              </Link>
              {canOpenWallets ? (
                <Link className="underline underline-offset-2" href="/wallets">
                  Wallets
                </Link>
              ) : null}
              {canOpenExpenses ? (
                <Link className="underline underline-offset-2" href="/expenses">
                  Expenses
                </Link>
              ) : null}
              {canOpenPayroll ? (
                <Link className="underline underline-offset-2" href="/payroll">
                  Payroll
                </Link>
              ) : null}
              {canOpenAttendance ? (
                <Link className="underline underline-offset-2" href="/hrms/attendance">
                  HR Attendance
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {canViewManagerWorkspace ? (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Manager Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                Team tasks overdue: <span className="font-semibold">{managerQueues?.overdueTasks ?? controlSummary?.taskApprovals.overdue ?? 0}</span>
              </div>
              <div className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                Team pending expenses: <span className="font-semibold">{managerQueues?.pendingTeamExpenses ?? 0}</span>
              </div>
              <div className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                Pending approvals queue: <span className="font-semibold">{managerQueues?.pendingApprovalsQueue ?? dashboardMetrics?.pendingApprovals ?? 0}</span>
              </div>
              {canOpenTasks ? (
                <Link className="underline underline-offset-2" href="/tasks">
                  Team Tasks
                </Link>
              ) : null}
              {canViewApprovals || canViewAllApprovals ? (
                <Link className="underline underline-offset-2" href="/approvals">
                  Approval Queue
                </Link>
              ) : null}
              <Link className="underline underline-offset-2" href="/reports/controls">
                Exceptions & Controls
              </Link>
            </div>
          </div>
        ) : null}

        {canViewFinanceWorkspace ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Finance Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2">
                AP outstanding: <span className="font-semibold">{formatMoney(controlSummary?.procurement.outstanding ?? 0)}</span>
              </div>
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2">
                Payroll overdue: <span className="font-semibold">{controlSummary?.payroll.totalOverdue ?? 0}</span>
              </div>
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2">
                Period-close pressure: <span className="font-semibold">{financeQueues?.overdueOpenPeriods ?? 0}</span> overdue open period(s)
              </div>
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2">
                Bank reconciliation queue: <span className="font-semibold">{financeQueues?.unreconciledSnapshots ?? 0}</span> snapshot(s),{" "}
                <span className="font-semibold">{financeQueues?.unmatchedStatementLines ?? 0}</span> unmatched line(s)
              </div>
              {canOpenPayroll ? (
                <Link className="underline underline-offset-2" href="/payroll">
                  Payroll Runs
                </Link>
              ) : null}
              {canManageCompanyAccounts ? (
                <Link className="underline underline-offset-2" href="/company-accounts">
                  Company Accounts
                </Link>
              ) : null}
              {canViewAccounting || canManageAccounting ? (
                <Link className="underline underline-offset-2" href="/reports/accounting/cash-position">
                  Cash Position
                </Link>
              ) : null}
              {canViewAccounting || canManageAccounting ? (
                <Link className="underline underline-offset-2" href="/accounting/fiscal-periods">
                  Fiscal Period Close Queue ({financeQueues?.openPeriods ?? 0} open)
                </Link>
              ) : null}
              {canViewAccounting || canManageAccounting ? (
                <Link className="underline underline-offset-2" href="/reports/accounting/bank-reconciliation">
                  Bank Reconciliation
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {canViewCeo ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">CEO Workspace</div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                Cash to recover: <span className="font-semibold">{formatMoney(controlSummary?.projects.pendingRecovery ?? 0)}</span>
              </div>
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                Overdue vendor bills: <span className="font-semibold">{ceoQueues?.overdueVendorBills ?? 0}</span>
              </div>
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                Income approvals pending: <span className="font-semibold">{ceoQueues?.pendingIncomeApprovals ?? 0}</span>
              </div>
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                Blocked actions (7d): <span className="font-semibold">{ceoQueues?.blockedActions7d ?? 0}</span>
              </div>
              <Link className="underline underline-offset-2" href="/ceo/dashboard">
                Executive dashboard
              </Link>
              <Link className="underline underline-offset-2" href="/reports/projects">
                Project recovery report
              </Link>
              <Link className="underline underline-offset-2" href="/audit">
                Blocked actions audit
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
