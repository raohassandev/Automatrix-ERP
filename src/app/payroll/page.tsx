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

function getPreviousMonthRange(now: Date) {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

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
  const previousRange = getPreviousMonthRange(new Date());
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
        createdAt: { lte: previousRange.end },
      },
      _sum: { amount: true },
    }),
    prisma.incentiveEntry.aggregate({
      where: {
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        status: "APPROVED",
        createdAt: { lte: previousRange.end },
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
        createdAt: { lte: previousRange.end },
      },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 50,
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
            <span className="font-semibold">Ready incentives:</span> {formatMoney(approvedUnsettledIncentive)} (approved up to {previousRange.end.toLocaleDateString()}, settled on payroll approval).
          </div>
          <div>
            <span className="font-semibold">Important:</span> Auto-fill policy now excludes future-created incentives from older payroll periods.
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-sky-300/35 bg-sky-500/10 p-3 text-xs text-sky-900 dark:text-sky-200">
          Monthly auto-draft scheduler target day: <span className="font-semibold">day {autoDraftDay}</span>. You can still use
          <span className="font-semibold"> Auto-Create Draft </span>
          for manual trigger and then fine-tune values before approval.
        </div>
        <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-4">
          <div className="text-sm font-semibold text-foreground">How Payroll Flow Works</div>
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
        </div>
        <div className="mt-4 rounded-lg border border-indigo-300/35 bg-indigo-500/10 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/25">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Payroll Incentive Queue (Due)</div>
              <div className="text-xs text-muted-foreground">
                Includes unsettled payroll incentives created on or before {previousRange.end.toLocaleDateString()}.
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
