import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import {
  getControlRegistersSummary,
  getProcurementApRegister,
  getProjectFinancialRegister,
  maskControlRegistersSummary,
} from "@/lib/control-registers";

function withinDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export default async function ControlsReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Controls Report</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const from30 = withinDays(30);
  const [pendingExpense, pendingIncome, submittedProcurement, blockedEvents30, authDenied30, authSuccess30] =
    await Promise.all([
      prisma.expense.count({ where: { status: { startsWith: "PENDING" } } }),
      prisma.income.count({ where: { status: "PENDING" } }),
      Promise.all([
        prisma.purchaseOrder.count({ where: { status: "SUBMITTED" } }),
        prisma.goodsReceipt.count({ where: { status: "SUBMITTED" } }),
        prisma.vendorBill.count({ where: { status: "SUBMITTED" } }),
        prisma.vendorPayment.count({ where: { status: "SUBMITTED" } }),
      ]),
      prisma.auditLog.count({
        where: {
          action: { startsWith: "BLOCK_" },
          createdAt: { gte: from30 },
        },
      }),
      prisma.auditLog.count({
        where: { action: "AUTH_SIGNIN_DENIED", createdAt: { gte: from30 } },
      }),
      prisma.auditLog.count({
        where: { action: "AUTH_SIGNIN_SUCCESS", createdAt: { gte: from30 } },
      }),
    ]);
  const canViewFinancials =
    canViewAll ||
    (await requirePermission(session.user.id, "accounting.view")) ||
    (await requirePermission(session.user.id, "accounting.manage")) ||
    (await requirePermission(session.user.id, "projects.view_financials")) ||
    (await requirePermission(session.user.id, "company_accounts.manage"));
  const [summaryRaw, procurementRegister, projectRegister] = await Promise.all([
    getControlRegistersSummary(),
    getProcurementApRegister({ take: 20 }),
    getProjectFinancialRegister({ take: 20 }),
  ]);
  const controlSummary = maskControlRegistersSummary(summaryRaw, canViewFinancials);
  const topProcurementRows = procurementRegister
    .filter((row) => row.outstandingValue > 0 || row.blockedByMatching)
    .sort((a, b) => b.outstandingValue - a.outstandingValue)
    .slice(0, 10);
  const topRecoveryProjects = projectRegister
    .filter((row) => row.pendingRecovery > 0)
    .sort((a, b) => b.pendingRecovery - a.pendingRecovery)
    .slice(0, 10);

  const [poSubmitted, grnSubmitted, billSubmitted, paymentSubmitted] = submittedProcurement;
  const totalQueue = pendingExpense + pendingIncome + poSubmitted + grnSubmitted + billSubmitted + paymentSubmitted;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Controls Report</h1>
        <p className="mt-2 text-muted-foreground">
          Approval queue health, blocked control events, and security sign-in signals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <div className="text-sm text-amber-700">Total Pending Queue</div>
          <div className="mt-2 text-2xl font-semibold text-amber-900">{totalQueue}</div>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
          <div className="text-sm text-rose-700">Blocked Events (30d)</div>
          <div className="mt-2 text-2xl font-semibold text-rose-900">{blockedEvents30}</div>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
          <div className="text-sm text-sky-700">Denied Sign-ins (30d)</div>
          <div className="mt-2 text-2xl font-semibold text-sky-900">{authDenied30}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Queue Breakdown</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-md border p-3">Expenses pending: <span className="font-semibold">{pendingExpense}</span></div>
          <div className="rounded-md border p-3">Income pending: <span className="font-semibold">{pendingIncome}</span></div>
          <div className="rounded-md border p-3">PO submitted: <span className="font-semibold">{poSubmitted}</span></div>
          <div className="rounded-md border p-3">GRN submitted: <span className="font-semibold">{grnSubmitted}</span></div>
          <div className="rounded-md border p-3">Vendor bills submitted: <span className="font-semibold">{billSubmitted}</span></div>
          <div className="rounded-md border p-3">Vendor payments submitted: <span className="font-semibold">{paymentSubmitted}</span></div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Cross-Module Register Snapshot</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border p-3">
            Payroll rows: <span className="font-semibold">{controlSummary.payroll.count}</span>
            <div className="mt-1 text-xs text-muted-foreground">
              Net pay: {controlSummary.payroll.totalNetPay === null ? "Masked" : formatMoney(controlSummary.payroll.totalNetPay)}
            </div>
          </div>
          <div className="rounded-md border p-3">
            Variable pay rows: <span className="font-semibold">{controlSummary.variablePay.count}</span>
            <div className="mt-1 text-xs text-muted-foreground">
              Unsettled: {controlSummary.variablePay.unsettledAmount === null ? "Masked" : formatMoney(controlSummary.variablePay.unsettledAmount)}
            </div>
          </div>
          <div className="rounded-md border p-3">
            Employee settlements: <span className="font-semibold">{controlSummary.settlements.employees}</span>
            <div className="mt-1 text-xs text-muted-foreground">
              Net payable: {controlSummary.settlements.netCompanyPayable === null ? "Masked" : formatMoney(controlSummary.settlements.netCompanyPayable)}
            </div>
          </div>
          <div className="rounded-md border p-3">
            Project rows: <span className="font-semibold">{controlSummary.projects.count}</span>
            <div className="mt-1 text-xs text-muted-foreground">
              Pending recovery: {controlSummary.projects.pendingRecovery === null ? "Masked" : formatMoney(controlSummary.projects.pendingRecovery)}
            </div>
          </div>
          <div className="rounded-md border p-3">
            Procurement rows: <span className="font-semibold">{controlSummary.procurement.rows}</span>
            <div className="mt-1 text-xs text-muted-foreground">
              Outstanding: {controlSummary.procurement.outstanding === null ? "Masked" : formatMoney(controlSummary.procurement.outstanding)}
            </div>
          </div>
          <div className="rounded-md border p-3">
            Task/approval items: <span className="font-semibold">{controlSummary.taskApprovals.items}</span>
            <div className="mt-1 text-xs text-muted-foreground">Overdue: {controlSummary.taskApprovals.overdue}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm text-sm">
        Successful sign-ins in last 30 days: <span className="font-semibold">{authSuccess30}</span>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Procurement and AP Register (Top Open Rows)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Vendor-wise ordered/received/billed/paid/outstanding with matching block flags.
        </p>
        {topProcurementRows.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">No open procurement/AP rows.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Vendor</th>
                  <th className="py-2">Project</th>
                  <th className="py-2">Ordered</th>
                  <th className="py-2">Billed</th>
                  <th className="py-2">Paid</th>
                  <th className="py-2">Outstanding</th>
                  <th className="py-2">Blocked</th>
                </tr>
              </thead>
              <tbody>
                {topProcurementRows.map((row) => (
                  <tr key={`${row.vendorId}-${row.projectRef || "none"}`} className="border-b">
                    <td className="py-2">{row.vendorName}</td>
                    <td className="py-2">{row.projectRef || "-"}</td>
                    <td className="py-2">{canViewFinancials ? formatMoney(row.orderedValue) : "Masked"}</td>
                    <td className="py-2">{canViewFinancials ? formatMoney(row.billedValue) : "Masked"}</td>
                    <td className="py-2">{canViewFinancials ? formatMoney(row.paidValue) : "Masked"}</td>
                    <td className="py-2 font-medium">{canViewFinancials ? formatMoney(row.outstandingValue) : "Masked"}</td>
                    <td className="py-2">{row.blockedByMatching ? "YES" : "NO"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Project Financial Register (Recovery Focus)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Project-level pending recovery and cost/profit signal for management action.
        </p>
        {topRecoveryProjects.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">No projects with pending recovery.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Project</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Contract</th>
                  <th className="py-2">Received</th>
                  <th className="py-2">Cost To Date</th>
                  <th className="py-2">Pending Recovery</th>
                  <th className="py-2">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {topRecoveryProjects.map((row) => (
                  <tr key={row.projectId} className="border-b">
                    <td className="py-2">
                      <a className="underline underline-offset-2" href={`/projects/${row.projectId}`}>
                        {row.projectRef}
                      </a>
                    </td>
                    <td className="py-2">{row.status}</td>
                    <td className="py-2">{canViewFinancials ? formatMoney(row.contractValue) : "Masked"}</td>
                    <td className="py-2">{canViewFinancials ? formatMoney(row.receivedAmount) : "Masked"}</td>
                    <td className="py-2">{canViewFinancials ? formatMoney(row.costToDate) : "Masked"}</td>
                    <td className="py-2 font-medium">{canViewFinancials ? formatMoney(row.pendingRecovery) : "Masked"}</td>
                    <td className="py-2">{canViewFinancials ? `${row.marginPercent.toFixed(1)}%` : "Masked"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
