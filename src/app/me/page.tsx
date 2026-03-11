import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import Link from "next/link";
import { MobileCard } from "@/components/MobileCard";
import { BellRing, CalendarCheck2, CreditCard, HandCoins } from "lucide-react";

function resolveExpenseAmount(expense: { status: string; amount: number | { toString(): string }; approvedAmount: number | { toString(): string } | null }) {
  if ((expense.status === "APPROVED" || expense.status === "PARTIALLY_APPROVED" || expense.status === "PAID") && expense.approvedAmount) {
    return Number(expense.approvedAmount);
  }
  return Number(expense.amount);
}

function getStatusPillClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "PAID" || normalized === "APPROVED") return "border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  if (normalized.includes("PENDING")) return "border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300";
  if (normalized === "REJECTED") return "border-rose-500/35 bg-rose-500/15 text-rose-800 dark:text-rose-300";
  return "border-slate-400/35 bg-slate-500/10 text-slate-700 dark:text-slate-300";
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
  const monthEnd = new Date();
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

  const [assignments, walletEntries, expenses, expenseCounts, payrollEntries, incentiveEntries, salaryAdvances, attendanceCounts, leaveRequests, pendingPayrollIncentiveAgg, advanceIssueAgg, advanceSettlementAgg, pocketPayableRows, advanceUsedThisMonthAgg, reimbursementPaidThisMonthRows] = await Promise.all([
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
    prisma.expense.findMany({
      where: {
        submittedById: session.user.id,
        paymentSource: "EMPLOYEE_POCKET",
        status: { in: ["APPROVED", "PARTIALLY_APPROVED"] },
      },
      select: { amount: true, approvedAmount: true, status: true },
    }),
    prisma.walletLedger.aggregate({
      where: {
        employeeId: employee.id,
        type: "DEBIT",
        sourceType: { in: ["EXPENSE_SETTLEMENT", "COMPANY_ADVANCE_ADJUSTMENT"] },
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.expense.findMany({
      where: {
        submittedById: session.user.id,
        paymentSource: "EMPLOYEE_POCKET",
        status: "PAID",
        updatedAt: { gte: monthStart, lte: monthEnd },
      },
      select: { amount: true, approvedAmount: true, status: true },
    }),
  ]);

  const walletBalance = Number(employee.walletBalance || 0);
  const walletHold = Number(employee.walletHold || 0);
  const walletAvailable = walletBalance - walletHold;
  const pendingPayrollIncentive = Number(pendingPayrollIncentiveAgg._sum.amount || 0);
  const advanceIssued = Number(advanceIssueAgg._sum.amount || 0);
  const advanceSettled = Number(advanceSettlementAgg._sum.amount || 0);
  const advanceOutstanding = Math.max(0, advanceIssued - advanceSettled);
  const pocketPayable = pocketPayableRows.reduce((sum, row) => sum + resolveExpenseAmount(row), 0);
  const advanceUsedThisMonth = Number(advanceUsedThisMonthAgg._sum.amount || 0);
  const reimbursementPaidThisMonth = reimbursementPaidThisMonthRows.reduce((sum, row) => sum + resolveExpenseAmount(row), 0);
  const latestSalary = Number(payrollEntries[0]?.netPay || 0);
  const expenseStatusMap = new Map(expenseCounts.map((row) => [row.status, row._count._all]));
  const assignedProjects = assignments.map((a) => a.project);
  const attendanceMap = new Map(attendanceCounts.map((row) => [row.status, row._count._all]));

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-sky-500/10 p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">My Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Personal control panel for wallet, expenses, salary, and HR self-service.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <span className={`rounded-full border px-3 py-1 font-medium ${walletAvailable > 0 ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" : "border-rose-500/35 bg-rose-500/15 text-rose-800 dark:text-rose-300"}`}>
              Available: {formatMoney(walletAvailable)}
            </span>
            <span className={`rounded-full border px-3 py-1 font-medium ${pocketPayable > 0 ? "border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300" : "border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"}`}>
              Reimburse due: {formatMoney(pocketPayable)}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/expenses"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <CreditCard className="h-4 w-4" />
            Submit Expense
          </Link>
          <Link
            href="/wallets"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <HandCoins className="h-4 w-4" />
            Wallet History
          </Link>
          <Link
            href="/hrms/attendance"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <CalendarCheck2 className="h-4 w-4" />
            Mark Attendance
          </Link>
          <Link
            href="/hrms/leave"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <BellRing className="h-4 w-4" />
            Apply Leave
          </Link>
        </div>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wallet Snapshot</div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="text-sm text-emerald-700 dark:text-emerald-300">Wallet Available</div>
          <div className="mt-2 text-xl font-semibold text-emerald-900 dark:text-emerald-100">{formatMoney(walletAvailable)}</div>
          <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">Balance minus hold amount</div>
        </div>
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-6 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/30">
          <div className="text-sm text-indigo-700 dark:text-indigo-300">Wallet Balance</div>
          <div className="mt-2 text-xl font-semibold text-indigo-900 dark:text-indigo-100">{formatMoney(walletBalance)}</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="text-sm text-amber-700 dark:text-amber-300">On Hold</div>
          <div className="mt-2 text-xl font-semibold text-amber-900 dark:text-amber-100">{formatMoney(walletHold)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Latest Salary</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(latestSalary)}</div>
        </div>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Advance and Reimbursement</div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-6 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/30">
          <div className="text-sm text-indigo-700 dark:text-indigo-300">Pending Incentive (Payroll)</div>
          <div className="mt-2 text-xl font-semibold text-indigo-900 dark:text-indigo-100">{formatMoney(pendingPayrollIncentive)}</div>
        </div>
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-6 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="text-sm text-sky-700 dark:text-sky-300">Company Advance Issued</div>
          <div className="mt-2 text-xl font-semibold text-sky-900 dark:text-sky-100">{formatMoney(advanceIssued)}</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="text-sm text-amber-700 dark:text-amber-300">Advance Outstanding</div>
          <div className="mt-2 text-xl font-semibold text-amber-900 dark:text-amber-100">{formatMoney(advanceOutstanding)}</div>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="text-sm text-rose-700 dark:text-rose-300">Own-Pocket Reimbursement Due</div>
          <div className="mt-2 text-xl font-semibold text-rose-900 dark:text-rose-100">{formatMoney(pocketPayable)}</div>
          <div className="mt-2 text-xs">
            <Link
              href={`/expenses?paymentSource=EMPLOYEE_POCKET&status=APPROVED`}
              className="font-medium text-rose-700 dark:text-rose-300 underline underline-offset-2"
            >
              View approved reimbursements
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-6 shadow-sm dark:border-violet-900/60 dark:bg-violet-950/30">
          <div className="text-sm text-violet-700 dark:text-violet-300">Advance Used This Month</div>
          <div className="mt-2 text-xl font-semibold text-violet-900 dark:text-violet-100">{formatMoney(advanceUsedThisMonth)}</div>
          <div className="mt-2 text-xs">
            <Link
              href={`/wallets?employeeId=${employee.id}&type=DEBIT&from=${monthStartStr}&to=${monthEndStr}`}
              className="font-medium text-violet-700 dark:text-violet-300 underline underline-offset-2"
            >
              Open wallet debits this month
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-6 shadow-sm dark:border-cyan-900/60 dark:bg-cyan-950/30">
          <div className="text-sm text-cyan-700 dark:text-cyan-300">Reimbursement Paid This Month</div>
          <div className="mt-2 text-xl font-semibold text-cyan-900 dark:text-cyan-100">{formatMoney(reimbursementPaidThisMonth)}</div>
          <div className="mt-2 text-xs">
            <Link
              href={`/expenses?paymentSource=EMPLOYEE_POCKET&status=PAID&from=${monthStartStr}&to=${monthEndStr}`}
              className="font-medium text-cyan-700 dark:text-cyan-300 underline underline-offset-2"
            >
              Open paid reimbursements
            </Link>
          </div>
        </div>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance Snapshot</div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="text-sm text-emerald-700 dark:text-emerald-300">This Month Present</div>
          <div className="mt-2 text-xl font-semibold text-emerald-800 dark:text-emerald-300">{attendanceMap.get("PRESENT") || 0}</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="text-sm text-amber-700 dark:text-amber-300">This Month Late</div>
          <div className="mt-2 text-xl font-semibold text-amber-800 dark:text-amber-300">{attendanceMap.get("LATE") || 0}</div>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="text-sm text-rose-700 dark:text-rose-300">This Month Absent</div>
          <div className="mt-2 text-xl font-semibold text-rose-800 dark:text-rose-300">{attendanceMap.get("ABSENT") || 0}</div>
        </div>
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-6 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="text-sm text-sky-700 dark:text-sky-300">Leave Requests</div>
          <div className="mt-2 text-xl font-semibold text-sky-800 dark:text-sky-300">{leaveRequests.length}</div>
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
            <div className="text-sm text-muted-foreground">{status.replaceAll("_", " ")}</div>
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
                    <td className="py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusPillClass(exp.status)}`}>
                        {exp.status}
                      </span>
                    </td>
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
                    <td className="py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusPillClass(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>
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
                    <td className="py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusPillClass(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>
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
                  <td className="py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusPillClass(entry.status)}`}>
                      {entry.status}
                    </span>
                  </td>
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
                  <td className="py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusPillClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
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
