import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import PaginationControls from "@/components/PaginationControls";
import { PayrollRunCreateButton } from "@/components/PayrollRunCreateButton";
import { PayrollRunActions } from "@/components/PayrollRunActions";
import { PayrollAutoDraftButton } from "@/components/PayrollAutoDraftButton";
import { PayrollEntrySettlementDialog } from "@/components/PayrollEntrySettlementDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { MobileCard } from "@/components/MobileCard";
import { employeeCodeFromId } from "@/lib/employee-display";
import Link from "next/link";

function ageInDays(value: Date) {
  const now = Date.now();
  const diff = now - value.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "payroll.view_all");
  const canEdit = await requirePermission(session.user.id, "payroll.edit");
  const canApprove = await requirePermission(session.user.id, "payroll.approve");
  if (!canView && !canEdit && !canApprove) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to payroll.</p>
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 20;
  const skip = (page - 1) * take;
  const autoDraftDayRaw = Number(process.env.PAYROLL_AUTO_DRAFT_DAY || "1");
  const autoDraftDay = Number.isFinite(autoDraftDayRaw)
    ? Math.min(28, Math.max(1, Math.floor(autoDraftDayRaw)))
    : 1;

  const [
    runs,
    total,
    employees,
    pendingApprovalIncentiveAgg,
    approvedUnsettledIncentiveAgg,
    settledIncentivePayrollAgg,
    openSalaryAdvanceAgg,
    incentiveQueueRows,
    unpaidPayrollRows,
    settlementAuditRows,
  ] =
    await Promise.all([
    prisma.payrollRun.findMany({
      orderBy: { periodStart: "desc" },
      include: { entries: { include: { employee: { select: { id: true, name: true } }, components: true } } },
      skip,
      take,
    }),
    prisma.payrollRun.count(),
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        compensation: { select: { baseSalary: true } },
      },
    }),
    prisma.incentiveEntry.aggregate({
      where: {
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        status: "PENDING",
      },
      _sum: { amount: true },
    }),
    prisma.incentiveEntry.aggregate({
      where: {
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        status: "APPROVED",
      },
      _sum: { amount: true },
    }),
    prisma.incentiveEntry.aggregate({
      where: {
        payoutMode: "PAYROLL",
        settlementStatus: "SETTLED",
        status: "APPROVED",
      },
      _sum: { amount: true },
    }),
    prisma.salaryAdvance.aggregate({
      where: { status: "OPEN" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.incentiveEntry.findMany({
      where: {
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
      },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 50,
    }),
    prisma.payrollEntry.findMany({
      where: {
        status: { not: "PAID" },
        payrollRun: { status: { in: ["APPROVED", "POSTED"] } },
      },
      select: {
        employeeId: true,
        netPay: true,
        payrollRun: { select: { periodStart: true, periodEnd: true } },
        employee: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        action: {
          in: ["MARK_PAYROLL_ENTRY_PAID", "CREATE_PAYROLL_RUN", "UPDATE_PAYROLL_RUN"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));
  const summary = runs.reduce(
    (acc, run) => {
      const net = run.entries.reduce((sum, entry) => sum + Number(entry.netPay), 0);
      acc.totalNet += net;
      acc.totalEntries += run.entries.length;
      if (run.status === "APPROVED" || run.status === "POSTED") acc.approvedRuns += 1;
      return acc;
    },
    { totalNet: 0, totalEntries: 0, approvedRuns: 0 },
  );
  const pendingApprovalIncentive = Number(pendingApprovalIncentiveAgg._sum.amount || 0);
  const approvedUnsettledIncentive = Number(approvedUnsettledIncentiveAgg._sum.amount || 0);
  const settledIncentivePayroll = Number(settledIncentivePayrollAgg._sum.amount || 0);
  const openSalaryAdvance = Number(openSalaryAdvanceAgg._sum.amount || 0);
  const openSalaryAdvanceCount = Number(openSalaryAdvanceAgg._count._all || 0);
  const latestRun = runs[0];
  const approvedQueueRows = incentiveQueueRows.filter((row) => row.status === "APPROVED");
  const pendingQueueRows = incentiveQueueRows.filter((row) => row.status !== "APPROVED");
  const approvedUnsettledIncentiveByEmployee = approvedQueueRows.reduce(
    (map, row) => {
      const current = map.get(row.employeeId) || 0;
      map.set(row.employeeId, current + Number(row.amount || 0));
      return map;
    },
    new Map<string, number>(),
  );
  const payrollPayableByEmployee = unpaidPayrollRows.reduce(
    (map, row) => {
      const current = map.get(row.employeeId) || 0;
      map.set(row.employeeId, current + Number(row.netPay || 0));
      return map;
    },
    new Map<string, number>(),
  );
  const employeeIdsInPayable = Array.from(
    new Set([...approvedUnsettledIncentiveByEmployee.keys(), ...payrollPayableByEmployee.keys()]),
  );
  const payableRows = employeeIdsInPayable
    .map((employeeId) => {
      const payrollDue = Number(payrollPayableByEmployee.get(employeeId) || 0);
      const incentiveDue = Number(approvedUnsettledIncentiveByEmployee.get(employeeId) || 0);
      const latestUnpaid = unpaidPayrollRows.find((row) => row.employeeId === employeeId);
      const employeeName = latestUnpaid?.employee?.name || approvedQueueRows.find((row) => row.employeeId === employeeId)?.employee?.name || "Employee";
      const oldestIncentive = approvedQueueRows
        .filter((row) => row.employeeId === employeeId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      const oldestAgeDays = oldestIncentive ? ageInDays(oldestIncentive.createdAt) : 0;
      return {
        employeeId,
        employeeName,
        payrollDue,
        incentiveDue,
        totalDue: Number((payrollDue + incentiveDue).toFixed(2)),
        unpaidPayrollCount: unpaidPayrollRows.filter((row) => row.employeeId === employeeId).length,
        approvedIncentiveCount: approvedQueueRows.filter((row) => row.employeeId === employeeId).length,
        oldestIncentiveAgeDays: oldestAgeDays,
      };
    })
    .filter((row) => row.totalDue > 0)
    .sort((a, b) => b.totalDue - a.totalDue);
  const settleLogs = settlementAuditRows.filter((row) => row.action === "MARK_PAYROLL_ENTRY_PAID");
  const settleEntryIds = Array.from(new Set(settleLogs.map((row) => row.entityId).filter(Boolean)));
  const settleActorIds = Array.from(new Set(settleLogs.map((row) => row.userId).filter(Boolean))) as string[];
  const [settledEntries, settleActors] = await Promise.all([
    settleEntryIds.length > 0
      ? prisma.payrollEntry.findMany({
          where: { id: { in: settleEntryIds } },
          select: {
            id: true,
            employeeId: true,
            employee: { select: { name: true } },
            payrollRun: { select: { id: true, periodStart: true, periodEnd: true } },
            netPay: true,
          },
        })
      : Promise.resolve([]),
    settleActorIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: settleActorIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);
  const settledEntryMap = new Map(settledEntries.map((row) => [row.id, row]));
  const settleActorMap = new Map(settleActors.map((row) => [row.id, row]));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Payroll</h1>
            <p className="mt-2 text-muted-foreground">Manage pay periods and wallet credits.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <PayrollRunCreateButton
                employees={employees.map((employee) => ({
                  id: employee.id,
                  name: employee.name,
                  email: employee.email,
                  baseSalary: Number(employee.compensation?.baseSalary || 0),
                }))}
              />
            ) : null}
            {canEdit ? <PayrollAutoDraftButton /> : null}
            <Link
              href="/employees"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Employee Salary Profiles
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/incentives"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Incentives
          </Link>
          <Link
            href="/salary-advances"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Salary Advances
          </Link>
          <Link
            href="/reports/employee-expenses"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Employee Expense Report
          </Link>
          <Link
            href="/help#feature-payroll"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            ERP Guide
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
            <div className="text-sm text-sky-700 dark:text-sky-300">Runs on this page</div>
            <div className="text-xl font-semibold text-sky-800 dark:text-sky-100">{runs.length}</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
            <div className="text-sm text-indigo-700 dark:text-indigo-300">Payroll Entries</div>
            <div className="text-xl font-semibold text-indigo-800 dark:text-indigo-100">{summary.totalEntries}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Net Pay</div>
            <div className="text-xl font-semibold text-emerald-800 dark:text-emerald-100">{formatMoney(summary.totalNet)}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="text-sm text-amber-700 dark:text-amber-300">Approved/Posted</div>
            <div className="text-xl font-semibold text-amber-800 dark:text-amber-100">{summary.approvedRuns}</div>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
            <div className="text-sm text-violet-700 dark:text-violet-300">Incentive Ready for Payroll</div>
            <div className="text-xl font-semibold text-violet-800 dark:text-violet-100">{formatMoney(approvedUnsettledIncentive)}</div>
            <div className="text-xs text-violet-700/80 dark:text-violet-300/80">{approvedQueueRows.length} approved incentive line(s)</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Incentive Settled (Payroll)</div>
            <div className="text-xl font-semibold text-emerald-800 dark:text-emerald-100">{formatMoney(settledIncentivePayroll)}</div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
            <div className="text-sm text-rose-700 dark:text-rose-300">Open Salary Advances</div>
            <div className="text-xl font-semibold text-rose-800 dark:text-rose-100">{formatMoney(openSalaryAdvance)}</div>
            <div className="text-xs text-rose-700/80 dark:text-rose-300/80">{openSalaryAdvanceCount} employee advance(s)</div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 rounded-lg border border-amber-300/40 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200 md:grid-cols-3">
          <div>
            <span className="font-semibold">Pending incentives:</span> {formatMoney(pendingApprovalIncentive)} (not approved yet, excluded from payroll).
          </div>
          <div>
            <span className="font-semibold">Ready incentives:</span> {formatMoney(approvedUnsettledIncentive)} (all approved + unsettled payroll incentives).
          </div>
          <div>
            <span className="font-semibold">Important:</span> Auto-fill policy includes all approved unsettled incentives until they are settled.
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-sky-300/35 bg-sky-500/10 p-3 text-xs text-sky-900 dark:text-sky-200">
          Monthly auto-draft scheduler target day: <span className="font-semibold">day {autoDraftDay}</span>. You can still use
          <span className="font-semibold"> Auto-Create Draft </span>
          for manual trigger and then fine-tune values before approval.
        </div>
        <details className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
            Help: How Payroll Flow Works
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Set each employee base salary from Employee Profile.</li>
            <li>Create incentive against project and get it approved.</li>
            <li>Open payroll run for previous month and click <span className="font-semibold text-foreground">Auto-fill by Policy</span>.</li>
            <li>Review per-employee base, incentive, deductions, and reasons.</li>
            <li>Approve payroll run to freeze period and authorize payouts.</li>
            <li>Use <span className="font-semibold text-foreground">Settle Entries</span> to mark each employee paid after transfer confirmation.</li>
            <li>Run auto-moves to <span className="font-semibold text-foreground">POSTED</span> when all entries are paid.</li>
            <li>Use Incentives page to verify settlement status and payroll page for monthly totals.</li>
          </ol>
        </details>
        <div className="mt-4 rounded-lg border border-indigo-300/35 bg-indigo-500/10 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/25">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Payroll Incentive Queue (Due)</div>
              <div className="text-xs text-muted-foreground">
                Includes all unsettled payroll incentives waiting for payroll settlement.
              </div>
            </div>
            <Link href="/incentives" className="text-xs font-medium text-primary underline underline-offset-2">
              Open Incentives Register
            </Link>
          </div>
          {incentiveQueueRows.length === 0 ? (
            <div className="text-xs text-muted-foreground">No incentive queue due for this payroll period.</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Created</th>
                      <th className="py-2">Employee</th>
                      <th className="py-2">Project</th>
                      <th className="py-2">Amount</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Aging</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incentiveQueueRows.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
                        <td className="py-2">
                          <Link href={`/employees/${row.employeeId}`} className="font-medium text-primary underline underline-offset-2">
                            {employeeCodeFromId(row.employeeId)} - {row.employee?.name || "Employee"}
                          </Link>
                        </td>
                        <td className="py-2">{row.projectRef || "-"}</td>
                        <td className="py-2">{formatMoney(Number(row.amount || 0))}</td>
                        <td className="py-2">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="py-2">{ageInDays(row.createdAt)} day(s)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 md:hidden">
                {incentiveQueueRows.map((row) => (
                  <MobileCard
                    key={row.id}
                    title={`${employeeCodeFromId(row.employeeId)} - ${row.employee?.name || "Employee"}`}
                    subtitle={new Date(row.createdAt).toLocaleDateString()}
                    fields={[
                      { label: "Project", value: row.projectRef || "-" },
                      { label: "Amount", value: formatMoney(Number(row.amount || 0)) },
                      { label: "Status", value: <StatusBadge status={row.status} /> },
                      { label: "Aging", value: `${ageInDays(row.createdAt)} day(s)` },
                    ]}
                  />
                ))}
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <div>Approved queue lines: {approvedQueueRows.length}</div>
                <div>Pending approval lines: {pendingQueueRows.length}</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Employee Payable Snapshot</h2>
          <div className="text-xs text-muted-foreground">
            Salary pending in approved/posted payroll + approved unsettled payroll incentives
          </div>
        </div>
        {payableRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No open payroll/incentive payable found.</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Employee</th>
                    <th className="py-2">Payroll Due</th>
                    <th className="py-2">Incentive Due</th>
                    <th className="py-2">Total Due</th>
                    <th className="py-2">Unpaid Payroll Rows</th>
                    <th className="py-2">Approved Incentives</th>
                    <th className="py-2">Oldest Incentive Aging</th>
                  </tr>
                </thead>
                <tbody>
                  {payableRows.map((row) => (
                    <tr key={row.employeeId} className="border-b">
                      <td className="py-2">
                        <Link href={`/employees/${row.employeeId}`} className="font-medium text-primary underline underline-offset-2">
                          {employeeCodeFromId(row.employeeId)} - {row.employeeName}
                        </Link>
                      </td>
                      <td className="py-2">{formatMoney(row.payrollDue)}</td>
                      <td className="py-2">{formatMoney(row.incentiveDue)}</td>
                      <td className="py-2 font-semibold">{formatMoney(row.totalDue)}</td>
                      <td className="py-2">{row.unpaidPayrollCount}</td>
                      <td className="py-2">{row.approvedIncentiveCount}</td>
                      <td className="py-2">{row.oldestIncentiveAgeDays} day(s)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {payableRows.map((row) => (
                <MobileCard
                  key={row.employeeId}
                  title={`${employeeCodeFromId(row.employeeId)} - ${row.employeeName}`}
                  fields={[
                    { label: "Payroll Due", value: formatMoney(row.payrollDue) },
                    { label: "Incentive Due", value: formatMoney(row.incentiveDue) },
                    { label: "Total Due", value: formatMoney(row.totalDue) },
                    { label: "Unpaid Payroll Rows", value: row.unpaidPayrollCount.toString() },
                    { label: "Approved Incentives", value: row.approvedIncentiveCount.toString() },
                    { label: "Oldest Incentive", value: `${row.oldestIncentiveAgeDays} day(s)` },
                  ]}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Payroll Settlement Audit Trail</h2>
          <div className="text-xs text-muted-foreground">Latest employee-level payroll payment postings</div>
        </div>
        {settleLogs.length === 0 ? (
          <div className="text-sm text-muted-foreground">No payroll settlement logs found yet.</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Time</th>
                    <th className="py-2">Employee</th>
                    <th className="py-2">Run Period</th>
                    <th className="py-2">Net Pay</th>
                    <th className="py-2">Action By</th>
                  </tr>
                </thead>
                <tbody>
                  {settleLogs.slice(0, 20).map((log) => {
                    const row = settledEntryMap.get(log.entityId);
                    const actor = log.userId ? settleActorMap.get(log.userId) : null;
                    return (
                      <tr key={log.id} className="border-b">
                        <td className="py-2">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="py-2">
                          {row ? (
                            <Link href={`/employees/${row.employeeId}`} className="font-medium text-primary underline underline-offset-2">
                              {employeeCodeFromId(row.employeeId)} - {row.employee?.name || "Employee"}
                            </Link>
                          ) : (
                            "Employee"
                          )}
                        </td>
                        <td className="py-2">
                          {row?.payrollRun
                            ? `${new Date(row.payrollRun.periodStart).toLocaleDateString()} - ${new Date(row.payrollRun.periodEnd).toLocaleDateString()}`
                            : "-"}
                        </td>
                        <td className="py-2">{row ? formatMoney(Number(row.netPay || 0)) : "-"}</td>
                        <td className="py-2">{actor?.name || actor?.email || "User"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {settleLogs.slice(0, 20).map((log) => {
                const row = settledEntryMap.get(log.entityId);
                const actor = log.userId ? settleActorMap.get(log.userId) : null;
                return (
                  <MobileCard
                    key={log.id}
                    title={row ? `${employeeCodeFromId(row.employeeId)} - ${row.employee?.name || "Employee"}` : "Employee"}
                    subtitle={new Date(log.createdAt).toLocaleString()}
                    fields={[
                      {
                        label: "Run",
                        value: row?.payrollRun
                          ? `${new Date(row.payrollRun.periodStart).toLocaleDateString()} - ${new Date(row.payrollRun.periodEnd).toLocaleDateString()}`
                          : "-",
                      },
                      { label: "Net Pay", value: row ? formatMoney(Number(row.netPay || 0)) : "-" },
                      { label: "Action By", value: actor?.name || actor?.email || "User" },
                    ]}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Period</th>
                <th className="py-2">Entries</th>
                <th className="py-2">Paid / Pending</th>
                <th className="py-2">Total Net</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const totalNet = run.entries.reduce((sum, entry) => sum + Number(entry.netPay), 0);
                const paidCount = run.entries.filter((entry) => String(entry.status || "").toUpperCase() === "PAID").length;
                const pendingCount = run.entries.length - paidCount;
                return (
                  <tr key={run.id} className="border-b">
                    <td className="py-2">
                      {new Date(run.periodStart).toLocaleDateString()} -{" "}
                      {new Date(run.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="py-2">{run.entries.length}</td>
                    <td className="py-2">
                      <span className="font-medium">{paidCount}</span> / {pendingCount}
                    </td>
                    <td className="py-2">{formatMoney(totalNet)}</td>
                    <td className="py-2">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {canEdit ? (
                          <PayrollRunActions
                            run={{
                              id: run.id,
                              periodStart: run.periodStart.toISOString(),
                              periodEnd: run.periodEnd.toISOString(),
                              status: run.status,
                              notes: run.notes,
                              entries: run.entries.map((entry) => ({
                                employeeId: entry.employeeId,
                                baseSalary: Number(entry.baseSalary),
                                incentiveTotal: Number(entry.incentiveTotal),
                                deductions: Number(entry.deductions),
                                deductionReason: entry.deductionReason || "",
                              })),
                            }}
                            employees={employees.map((employee) => ({
                              id: employee.id,
                              name: employee.name,
                              email: employee.email,
                              baseSalary: Number(employee.compensation?.baseSalary || 0),
                            }))}
                            canApprove={canApprove}
                          />
                        ) : null}
                        {canApprove ? (
                          <PayrollEntrySettlementDialog
                            payrollRunId={run.id}
                            runStatus={run.status}
                            canApprove={canApprove}
                            entries={run.entries.map((entry) => ({
                              id: entry.id,
                              employeeId: entry.employeeId,
                              employeeName: entry.employee?.name || null,
                              baseSalary: Number(entry.baseSalary || 0),
                              incentiveTotal: Number(entry.incentiveTotal || 0),
                              deductions: Number(entry.deductions || 0),
                              netPay: Number(entry.netPay || 0),
                              status: entry.status,
                            }))}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {runs.map((run) => {
            const totalNet = run.entries.reduce((sum, entry) => sum + Number(entry.netPay), 0);
            const paidCount = run.entries.filter((entry) => String(entry.status || "").toUpperCase() === "PAID").length;
            const pendingCount = run.entries.length - paidCount;
            return (
              <MobileCard
                key={run.id}
                title={`${new Date(run.periodStart).toLocaleDateString()} - ${new Date(run.periodEnd).toLocaleDateString()}`}
                subtitle={run.notes || "Payroll run"}
                fields={[
                  { label: "Entries", value: run.entries.length.toString() },
                  { label: "Paid/Pending", value: `${paidCount}/${pendingCount}` },
                  { label: "Total Net", value: formatMoney(totalNet) },
                  { label: "Status", value: <StatusBadge status={run.status} /> },
                ]}
                actions={
                  <div className="flex flex-wrap gap-2">
                    {canEdit ? (
                      <PayrollRunActions
                        run={{
                          id: run.id,
                          periodStart: run.periodStart.toISOString(),
                          periodEnd: run.periodEnd.toISOString(),
                          status: run.status,
                          notes: run.notes,
                          entries: run.entries.map((entry) => ({
                            employeeId: entry.employeeId,
                            baseSalary: Number(entry.baseSalary),
                            incentiveTotal: Number(entry.incentiveTotal),
                            deductions: Number(entry.deductions),
                            deductionReason: entry.deductionReason || "",
                          })),
                        }}
                        employees={employees.map((employee) => ({
                          id: employee.id,
                          name: employee.name,
                          email: employee.email,
                          baseSalary: Number(employee.compensation?.baseSalary || 0),
                        }))}
                        canApprove={canApprove}
                      />
                    ) : null}
                    {canApprove ? (
                      <PayrollEntrySettlementDialog
                        payrollRunId={run.id}
                        runStatus={run.status}
                        canApprove={canApprove}
                        entries={run.entries.map((entry) => ({
                          id: entry.id,
                          employeeId: entry.employeeId,
                          employeeName: entry.employee?.name || null,
                          baseSalary: Number(entry.baseSalary || 0),
                          incentiveTotal: Number(entry.incentiveTotal || 0),
                          deductions: Number(entry.deductions || 0),
                          netPay: Number(entry.netPay || 0),
                          status: entry.status,
                        }))}
                      />
                    ) : null}
                  </div>
                }
              />
            );
          })}
        </div>

        {runs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No payroll runs found.</div>
        )}

        {latestRun ? (
          <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Latest Run Entry Breakdown</h2>
              <div className="text-xs text-muted-foreground">
                {new Date(latestRun.periodStart).toLocaleDateString()} - {new Date(latestRun.periodEnd).toLocaleDateString()}
              </div>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Employee</th>
                    <th className="py-2">Base</th>
                    <th className="py-2">Incentive</th>
                    <th className="py-2">Deductions</th>
                    <th className="py-2">Net</th>
                    <th className="py-2">Variable Components</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRun.entries.map((entry) => {
                    const variableLines = entry.components.filter(
                      (line) => line.componentType === "INCENTIVE" || line.componentType === "COMMISSION",
                    );
                    const variableTotal = variableLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
                    return (
                      <tr key={entry.id} className="border-b">
                        <td className="py-2">
                          <Link href={`/employees/${entry.employeeId}`} className="font-medium text-primary underline underline-offset-2">
                            {employeeCodeFromId(entry.employeeId)} - {entry.employee?.name || "Employee"}
                          </Link>
                        </td>
                        <td className="py-2">{formatMoney(Number(entry.baseSalary || 0))}</td>
                        <td className="py-2">{formatMoney(Number(entry.incentiveTotal || 0))}</td>
                        <td className="py-2">{formatMoney(Number(entry.deductions || 0))}</td>
                        <td className="py-2">{formatMoney(Number(entry.netPay || 0))}</td>
                        <td className="py-2">
                          {variableLines.length === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <div className="space-y-1">
                              {variableLines.map((line) => (
                                <div key={line.id} className="text-xs">
                                  <span className="font-medium">{line.componentType}</span>{" "}
                                  <span className="text-muted-foreground">{line.projectRef || "No project"}</span>{" "}
                                  <span>{formatMoney(Number(line.amount || 0))}</span>
                                </div>
                              ))}
                              <div className="text-xs font-medium">Total: {formatMoney(variableTotal)}</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {totalPages > 1 && (
          <div className="mt-4">
            <PaginationControls totalPages={totalPages} currentPage={page} />
          </div>
        )}
      </div>
    </div>
  );
}
