import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import Link from "next/link";
import { MobileCard } from "@/components/MobileCard";

function resolveExpenseAmount(expense: { status: string; amount: number | { toString(): string }; approvedAmount: number | { toString(): string } | null }) {
  if ((expense.status === "APPROVED" || expense.status === "PARTIALLY_APPROVED" || expense.status === "PAID") && expense.approvedAmount) {
    return Number(expense.approvedAmount);
  }
  return Number(expense.amount);
}

export default async function MyDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  const canViewAll = await requirePermission(session.user.id, "employees.view_all");
  if (!canViewOwn && !canViewAll) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold">My Dashboard</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  if (!session.user.email) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">My Dashboard</h1>
        <p className="mt-2 text-muted-foreground">No user email available.</p>
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { email: session.user.email },
  });
  if (!employee) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">My Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          No employee record found. Contact admin to link your account.
        </p>
      </div>
    );
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [assignments, walletEntries, expenses, expenseCounts, payrollEntries, incentiveEntries, salaryAdvances, attendanceCounts, leaveRequests, pendingPayrollIncentiveAgg, advanceIssueAgg, advanceSettlementAgg, pocketPayableAgg] = await Promise.all([
    prisma.projectAssignment.findMany({
      where: { userId: session.user.id },
      select: { project: { select: { id: true, projectId: true, name: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.walletLedger.findMany({
      where: { employeeId: employee.id },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.expense.findMany({
      where: { submittedById: session.user.id },
      orderBy: { date: "desc" },
      take: 10,
      select: {
        id: true,
        date: true,
        description: true,
        category: true,
        amount: true,
        approvedAmount: true,
        status: true,
        paymentSource: true,
        project: true,
      },
    }),
    prisma.expense.groupBy({
      by: ["status"],
      where: { submittedById: session.user.id },
      _count: { _all: true },
    }),
    prisma.payrollEntry.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { payrollRun: true, components: true },
    }),
    prisma.incentiveEntry.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.salaryAdvance.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.attendanceEntry.groupBy({
      by: ["status"],
      where: { employeeId: employee.id, date: { gte: monthStart } },
      _count: { _all: true },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.incentiveEntry.aggregate({
      where: {
        employeeId: employee.id,
        status: "APPROVED",
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
      },
      _sum: { amount: true },
    }),
    prisma.walletLedger.aggregate({
      where: { employeeId: employee.id, type: "CREDIT", sourceType: "COMPANY_ADVANCE_ISSUE" },
      _sum: { amount: true },
    }),
    prisma.walletLedger.aggregate({
      where: { employeeId: employee.id, type: "DEBIT", sourceType: { in: ["COMPANY_ADVANCE_ADJUSTMENT", "EXPENSE_SETTLEMENT"] } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        submittedById: session.user.id,
        paymentSource: "EMPLOYEE_POCKET",
        status: { in: ["APPROVED", "PARTIALLY_APPROVED"] },
      },
      _sum: { approvedAmount: true, amount: true },
    }),
  ]);

  const walletBalance = Number(employee.walletBalance || 0);
  const walletHold = Number(employee.walletHold || 0);
  const walletAvailable = walletBalance - walletHold;
  const pendingPayrollIncentive = Number(pendingPayrollIncentiveAgg._sum.amount || 0);
  const advanceIssued = Number(advanceIssueAgg._sum.amount || 0);
  const advanceSettled = Number(advanceSettlementAgg._sum.amount || 0);
  const advanceOutstanding = Math.max(0, advanceIssued - advanceSettled);
  const pocketPayable = Number(pocketPayableAgg._sum.approvedAmount || pocketPayableAgg._sum.amount || 0);
  const latestSalary = Number(payrollEntries[0]?.netPay || 0);
  const expenseStatusMap = new Map(expenseCounts.map((row) => [row.status, row._count._all]));
  const assignedProjects = assignments.map((a) => a.project);
  const attendanceMap = new Map(attendanceCounts.map((row) => [row.status, row._count._all]));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">My Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Personal wallet, expenses, and approvals snapshot.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Wallet Balance</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(walletBalance)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">On Hold</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(walletHold)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Available</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(walletAvailable)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Latest Salary</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(latestSalary)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-6 shadow-sm">
          <div className="text-sm text-indigo-700">Pending Incentive (Payroll)</div>
          <div className="mt-2 text-xl font-semibold text-indigo-900">{formatMoney(pendingPayrollIncentive)}</div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-6 shadow-sm">
          <div className="text-sm text-sky-700">Company Advance Issued</div>
          <div className="mt-2 text-xl font-semibold text-sky-900">{formatMoney(advanceIssued)}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <div className="text-sm text-amber-700">Advance Outstanding</div>
          <div className="mt-2 text-xl font-semibold text-amber-900">{formatMoney(advanceOutstanding)}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-6 shadow-sm">
          <div className="text-sm text-rose-700">Own-Pocket Reimbursement Due</div>
          <div className="mt-2 text-xl font-semibold text-rose-900">{formatMoney(pocketPayable)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
          <div className="text-sm text-emerald-700">This Month Present</div>
          <div className="mt-2 text-xl font-semibold text-emerald-800">{attendanceMap.get("PRESENT") || 0}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <div className="text-sm text-amber-700">This Month Late</div>
          <div className="mt-2 text-xl font-semibold text-amber-800">{attendanceMap.get("LATE") || 0}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-6 shadow-sm">
          <div className="text-sm text-rose-700">This Month Absent</div>
          <div className="mt-2 text-xl font-semibold text-rose-800">{attendanceMap.get("ABSENT") || 0}</div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-6 shadow-sm">
          <div className="text-sm text-sky-700">Leave Requests</div>
          <div className="mt-2 text-xl font-semibold text-sky-800">{leaveRequests.length}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">HR Self-Service</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mark attendance and submit leave directly from HRMS pages.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/hrms/attendance" className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent">
            Open Attendance
          </Link>
          <Link href="/hrms/leave" className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent">
            Open Leave
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["PENDING_L1", "PENDING_L2", "PENDING_L3", "PARTIALLY_APPROVED", "APPROVED", "PAID"].map((status) => (
          <div key={status} className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground">{status.replace("_", " ")}</div>
            <div className="mt-2 text-xl font-semibold">
              {expenseStatusMap.get(status) || 0}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">My Assigned Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">Quick links to projects you are assigned to.</p>
          <div className="mt-4 space-y-3">
            {assignedProjects.length === 0 ? (
              <div className="text-sm text-muted-foreground">No project assignments.</div>
            ) : (
              assignedProjects.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-b pb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      <Link className="underline underline-offset-2" href={`/projects/${p.id}`}>
                        {p.projectId} — {p.name}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Status: {p.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Recent Wallet Activity</h2>
            <a
              href={`/wallets?employeeId=${employee.id}`}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Full History
            </a>
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {walletEntries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="py-2">{entry.type}</td>
                    <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                    <td className="py-2">{entry.reference || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {walletEntries.map((entry) => (
              <MobileCard
                key={entry.id}
                title={new Date(entry.date).toLocaleDateString()}
                subtitle={entry.reference || "Wallet entry"}
                fields={[
                  { label: "Type", value: entry.type },
                  { label: "Amount", value: formatMoney(Number(entry.amount)) },
                  { label: "Balance", value: formatMoney(Number(entry.balance)) },
                  { label: "Source", value: entry.sourceType || "-" },
                ]}
              />
            ))}
          </div>
          {walletEntries.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No wallet activity yet.</div>
          )}
          <div className="pt-4">
            <a
              href="/api/me/wallet/export"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Export Wallet CSV
            </a>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Recent Expenses</h2>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Project</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => {
                  const usedAmount = resolveExpenseAmount(exp);
                  return (
                    <tr key={exp.id} className="border-b">
                      <td className="py-2">{new Date(exp.date).toLocaleDateString()}</td>
                      <td className="py-2">{exp.description}</td>
                      <td className="py-2">{exp.project || "-"}</td>
                      <td className="py-2">{formatMoney(usedAmount)}</td>
                      <td className="py-2">{exp.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {expenses.map((exp) => {
              const usedAmount = resolveExpenseAmount(exp);
              return (
                <MobileCard
                  key={exp.id}
                  title={exp.description}
                  subtitle={new Date(exp.date).toLocaleDateString()}
                  fields={[
                    { label: "Project", value: exp.project || "-" },
                    { label: "Category", value: exp.category },
                    { label: "Amount", value: formatMoney(usedAmount) },
                    { label: "Status", value: exp.status },
                  ]}
                />
              );
            })}
          </div>
          {expenses.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No expenses submitted yet.</div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Salary History</h2>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Period</th>
                  <th className="py-2">Net Pay</th>
                  <th className="py-2">Breakdown</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payrollEntries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-2">
                      {entry.payrollRun
                        ? `${new Date(entry.payrollRun.periodStart).toLocaleDateString()} - ${new Date(
                            entry.payrollRun.periodEnd
                          ).toLocaleDateString()}`
                        : "-"}
                    </td>
                    <td className="py-2">{formatMoney(Number(entry.netPay))}</td>
                    <td className="py-2">
                      {entry.components.length > 0 ? (
                        <div className="space-y-1">
                          {entry.components.slice(0, 3).map((line) => (
                            <div key={line.id} className="text-xs text-muted-foreground">
                              {line.componentType}: {formatMoney(Number(line.amount))}
                              {line.projectRef ? ` (${line.projectRef})` : ""}
                            </div>
                          ))}
                          {entry.components.length > 3 ? (
                            <div className="text-xs text-muted-foreground">
                              +{entry.components.length - 3} more
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2">{entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {payrollEntries.map((entry) => (
              <MobileCard
                key={entry.id}
                title={
                  entry.payrollRun
                    ? `${new Date(entry.payrollRun.periodStart).toLocaleDateString()} - ${new Date(entry.payrollRun.periodEnd).toLocaleDateString()}`
                    : "Salary Record"
                }
                subtitle={entry.status}
                fields={[
                  { label: "Net Pay", value: formatMoney(Number(entry.netPay)) },
                  { label: "Deductions", value: formatMoney(Number(entry.deductions)) },
                  {
                    label: "Components",
                    value: entry.components.length > 0 ? `${entry.components.length} lines` : "-",
                  },
                  {
                    label: "Top Line",
                    value: entry.components[0]
                      ? `${entry.components[0].componentType}: ${formatMoney(Number(entry.components[0].amount))}`
                      : "-",
                  },
                ]}
              />
            ))}
          </div>
          {payrollEntries.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No salary records yet.</div>
          )}
          <div className="pt-4">
            <a
              href="/api/me/payroll/export"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Export Salary CSV
            </a>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Incentive History</h2>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Project</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {incentiveEntries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-2">{new Date(entry.createdAt).toLocaleDateString()}</td>
                    <td className="py-2">{entry.projectRef || "-"}</td>
                    <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                    <td className="py-2">{entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {incentiveEntries.map((entry) => (
              <MobileCard
                key={entry.id}
                title={entry.projectRef || "Incentive"}
                subtitle={new Date(entry.createdAt).toLocaleDateString()}
                fields={[
                  { label: "Amount", value: formatMoney(Number(entry.amount)) },
                  { label: "Status", value: entry.status },
                  { label: "Payout", value: entry.payoutMode || "-" },
                  { label: "Settlement", value: entry.settlementStatus || "-" },
                ]}
              />
            ))}
          </div>
          {incentiveEntries.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No incentives recorded yet.</div>
          )}
          <div className="pt-4">
            <a
              href="/api/me/incentives/export"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Export Incentives CSV
            </a>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Salary Advances</h2>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Reason</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {salaryAdvances.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                  <td className="py-2">{entry.reason}</td>
                  <td className="py-2">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3 md:hidden">
          {salaryAdvances.map((entry) => (
            <MobileCard
              key={entry.id}
              title={new Date(entry.createdAt).toLocaleDateString()}
              subtitle={entry.reason}
              fields={[
                { label: "Amount", value: formatMoney(Number(entry.amount)) },
                { label: "Status", value: entry.status },
              ]}
            />
          ))}
        </div>
        {salaryAdvances.length === 0 && (
          <div className="py-6 text-center text-muted-foreground">No salary advances.</div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Recent Leave Requests</h2>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Type</th>
                <th className="py-2">Dates</th>
                <th className="py-2">Days</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{row.leaveType}</td>
                  <td className="py-2">
                    {new Date(row.startDate).toLocaleDateString()} - {new Date(row.endDate).toLocaleDateString()}
                  </td>
                  <td className="py-2">{Number(row.totalDays)}</td>
                  <td className="py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3 md:hidden">
          {leaveRequests.map((row) => (
            <MobileCard
              key={row.id}
              title={row.leaveType}
              subtitle={`${new Date(row.startDate).toLocaleDateString()} - ${new Date(row.endDate).toLocaleDateString()}`}
              fields={[
                { label: "Days", value: Number(row.totalDays).toString() },
                { label: "Status", value: row.status },
              ]}
            />
          ))}
        </div>
        {leaveRequests.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">No leave requests yet.</div>
        ) : null}
      </div>
    </div>
  );
}
