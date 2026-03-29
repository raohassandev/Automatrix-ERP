import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { employeeCodeFromId } from "@/lib/employee-display";
import Link from "next/link";
import { MobileCard } from "@/components/MobileCard";
import { BellRing, CalendarCheck2, CreditCard, HandCoins } from "lucide-react";
import { findEmployeeByEmailInsensitive } from "@/lib/identity";
import { Prisma } from "@prisma/client";

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

function formatServicePeriod(joinDate?: Date | null) {
  if (!joinDate) return "Not set";
  const now = new Date();
  const start = new Date(joinDate);
  if (Number.isNaN(start.getTime()) || start > now) return "Not available";
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years <= 0) return `${Math.max(remMonths, 0)} month(s)`;
  if (remMonths <= 0) return `${years} year(s)`;
  return `${years} year(s), ${remMonths} month(s)`;
}

function financeNoticeTone(severity: "high" | "medium" | "info") {
  if (severity === "high") return "border-rose-500/25 bg-rose-500/10";
  if (severity === "medium") return "border-amber-500/25 bg-amber-500/10";
  return "border-sky-500/25 bg-sky-500/10";
}

async function getPendingPayrollIncentiveAmount(employeeId: string, currentMonthKey: string) {
  try {
    const result = await prisma.incentiveEntry.aggregate({
      where: {
        employeeId,
        status: "APPROVED",
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        OR: [{ scheduledPayrollMonth: null }, { scheduledPayrollMonth: { lte: currentMonthKey } }],
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount || 0);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2022") {
      throw error;
    }
    const fallback = await prisma.incentiveEntry.aggregate({
      where: {
        employeeId,
        status: "APPROVED",
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
      },
      _sum: { amount: true },
    });
    return Number(fallback._sum.amount || 0);
  }
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

  const employee = await findEmployeeByEmailInsensitive(session.user.email, {
    include: {
      reportingOfficer: {
        select: {
          id: true,
          name: true,
        },
      },
      compensation: {
        select: {
          baseSalary: true,
          currency: true,
        },
      },
    },
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
  const currentMonthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

  const [assignments, walletEntries, expenses, expenseCounts, payrollEntries, incentiveEntries, commissionEntries, salaryAdvances, attendanceCounts, leaveRequests, pendingPayrollIncentive, advanceIssueAgg, advanceSettlementAgg, pocketPayableRows, advanceUsedThisMonthAgg, reimbursementPaidThisMonthRows] = await Promise.all([
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
      select: {
        id: true,
        createdAt: true,
        amount: true,
        status: true,
        settlementStatus: true,
        payoutMode: true,
        projectRef: true,
      },
    }),
    prisma.commissionEntry.findMany({
      where: { employeeId: employee.id, payeeType: "EMPLOYEE" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        amount: true,
        status: true,
        settlementStatus: true,
        payoutMode: true,
        projectRef: true,
      },
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
    getPendingPayrollIncentiveAmount(employee.id, currentMonthKey),
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
  const advanceIssued = Number(advanceIssueAgg._sum.amount || 0);
  const advanceSettled = Number(advanceSettlementAgg._sum.amount || 0);
  const advanceOutstanding = Math.max(0, advanceIssued - advanceSettled);
  const pocketPayable = pocketPayableRows.reduce((sum, row) => sum + resolveExpenseAmount(row), 0);
  const advanceUsedThisMonth = Number(advanceUsedThisMonthAgg._sum.amount || 0);
  const reimbursementPaidThisMonth = reimbursementPaidThisMonthRows.reduce((sum, row) => sum + resolveExpenseAmount(row), 0);
  const latestSalary = Number(payrollEntries[0]?.netPay || 0);
  const pendingVariableEntries = [
    ...incentiveEntries.filter(
      (row) => String(row.status || "").toUpperCase() === "APPROVED" && String(row.settlementStatus || "").toUpperCase() !== "SETTLED",
    ),
    ...commissionEntries.filter(
      (row) => String(row.status || "").toUpperCase() === "APPROVED" && String(row.settlementStatus || "").toUpperCase() !== "SETTLED",
    ),
  ];
  const pendingVariablePay = pendingVariableEntries.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const expenseStatusMap = new Map(expenseCounts.map((row) => [row.status, row._count._all]));
  const assignedProjects = assignments.map((a) => a.project);
  const attendanceMap = new Map(attendanceCounts.map((row) => [row.status, row._count._all]));
  const pendingExpenseCount = Number(expenseStatusMap.get("PENDING") || 0) + Number(expenseStatusMap.get("PENDING_L1") || 0) + Number(expenseStatusMap.get("PENDING_L2") || 0) + Number(expenseStatusMap.get("PENDING_L3") || 0);
  const pendingLeaveCount = leaveRequests.filter((row) => String(row.status || "").toUpperCase().startsWith("PENDING")).length;
  const payrollPendingCount = payrollEntries.filter((row) => String(row.status || "").toUpperCase() !== "PAID").length;
  const employeeCode = employeeCodeFromId(employee.id);
  const servicePeriod = formatServicePeriod(employee.joinDate);
  const profileSalary = Number(employee.compensation?.baseSalary || 0);
  const profileCurrency = employee.compensation?.currency || "PKR";
  const financeNotices = [
    pocketPayable > 0
      ? {
          id: "reimburse-due",
          severity: "high" as const,
          title: "Approved reimbursements are waiting payment",
          detail: `${formatMoney(pocketPayable)} is still payable from your approved employee-pocket claims.`,
          href: `/expenses?paymentSource=EMPLOYEE_POCKET&status=APPROVED`,
          cta: "Open reimbursements",
        }
      : null,
    advanceOutstanding > 0
      ? {
          id: "advance-outstanding",
          severity: "medium" as const,
          title: "Advance is still outstanding",
          detail: `${formatMoney(advanceOutstanding)} remains to be recovered against prior company advance issue.`,
          href: `/salary-advances?employeeId=${employee.id}`,
          cta: "Open advances",
        }
      : null,
    payrollPendingCount > 0
      ? {
          id: "payroll-pending",
          severity: "medium" as const,
          title: "Payroll entry is not yet paid",
          detail: `${payrollPendingCount} payroll entr${payrollPendingCount === 1 ? "y is" : "ies are"} still pending payment.`,
          href: `/payroll`,
          cta: "Open payroll history",
        }
      : null,
    pendingVariablePay > 0
      ? {
          id: "variable-pending",
          severity: "info" as const,
          title: "Variable pay is approved but unsettled",
          detail: `${formatMoney(pendingVariablePay)} is pending in incentives/commissions settlement.`,
          href: `/incentives?employeeId=${employee.id}&settlement=UNSETTLED&status=APPROVED`,
          cta: "Open variable pay",
        }
      : null,
    walletHold > 0
      ? {
          id: "wallet-hold",
          severity: "info" as const,
          title: "Wallet hold is reducing available amount",
          detail: `${formatMoney(walletHold)} is reserved and not available for direct use.`,
          href: `/wallets?employeeId=${employee.id}`,
          cta: "Open wallet history",
        }
      : null,
  ].filter((notice): notice is NonNullable<typeof notice> => Boolean(notice));
  const variablePayHistory = [
    ...incentiveEntries.map((entry) => ({ ...entry, entryType: "INCENTIVE" as const })),
    ...commissionEntries.map((entry) => ({ ...entry, entryType: "COMMISSION" as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Profile Snapshot</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Personal identity and reporting details used by payroll and HR workflows.
            </p>
          </div>
          <Link
            href={`/employees/${employee.id}`}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Open Full Profile
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-sky-500/25 bg-card/95 p-3 text-sm ring-1 ring-sky-500/10">
            <div className="text-sky-700 dark:text-sky-300">Employee ID</div>
            <div className="mt-1 font-semibold">{employeeCode}</div>
            <div className="text-xs text-muted-foreground">{employee.name}</div>
          </div>
          <div className="rounded-lg border border-indigo-500/25 bg-card/95 p-3 text-sm ring-1 ring-indigo-500/10">
            <div className="text-indigo-700 dark:text-indigo-300">Role & Reporting</div>
            <div className="mt-1 font-semibold">{employee.role || "-"}</div>
            <div className="text-xs text-muted-foreground">
              Manager: {employee.reportingOfficer?.name || "Not assigned"}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-card/95 p-3 text-sm ring-1 ring-emerald-500/10">
            <div className="text-emerald-700 dark:text-emerald-300">Service Period</div>
            <div className="mt-1 font-semibold">{servicePeriod}</div>
            <div className="text-xs text-muted-foreground">
              Join date: {employee.joinDate ? new Date(employee.joinDate).toLocaleDateString() : "Not set"}
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/25 bg-card/95 p-3 text-sm ring-1 ring-amber-500/10">
            <div className="text-amber-700 dark:text-amber-300">Department</div>
            <div className="mt-1 font-semibold">{employee.department || "-"}</div>
            <div className="text-xs text-muted-foreground">Designation: {employee.designation || "-"}</div>
          </div>
          <div className="rounded-lg border border-violet-500/25 bg-card/95 p-3 text-sm ring-1 ring-violet-500/10">
            <div className="text-violet-700 dark:text-violet-300">Base Salary (Profile)</div>
            <div className="mt-1 font-semibold">
              {profileCurrency} {profileSalary.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Used as payroll draft baseline</div>
          </div>
          <div className="rounded-lg border border-cyan-500/25 bg-card/95 p-3 text-sm ring-1 ring-cyan-500/10">
            <div className="text-cyan-700 dark:text-cyan-300">Employment Status</div>
            <div className="mt-1 font-semibold">{employee.status || "ACTIVE"}</div>
            <div className="text-xs text-muted-foreground">{employee.email}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">My Finance Summary</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Self-service summary for wallet, reimbursements, advances, payroll, and variable pay.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={`/wallets?employeeId=${employee.id}`} className="rounded-md border px-3 py-2 hover:bg-accent">
              Wallet History
            </Link>
            <Link href={`/expenses?submittedById=${session.user.id}`} className="rounded-md border px-3 py-2 hover:bg-accent">
              My Expenses
            </Link>
            <Link href={`/salary-advances?employeeId=${employee.id}`} className="rounded-md border px-3 py-2 hover:bg-accent">
              My Advances
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-emerald-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-emerald-500/10">
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Available Wallet</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{formatMoney(walletAvailable)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Balance minus hold amount</div>
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-rose-500/10">
            <div className="text-sm text-rose-700 dark:text-rose-300">Reimburse Due</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{formatMoney(pocketPayable)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Approved employee-pocket claims</div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-amber-500/10">
            <div className="text-sm text-amber-700 dark:text-amber-300">Advance Outstanding</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{formatMoney(advanceOutstanding)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Advance still to recover</div>
          </div>
          <div className="rounded-xl border border-sky-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-sky-500/10">
            <div className="text-sm text-sky-700 dark:text-sky-300">Payroll Pending</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{formatMoney(payrollPendingCount > 0 ? latestSalary : 0)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{payrollPendingCount} unpaid payroll entr{payrollPendingCount === 1 ? "y" : "ies"}</div>
          </div>
          <div className="rounded-xl border border-violet-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-violet-500/10">
            <div className="text-sm text-violet-700 dark:text-violet-300">Variable Pay Pending</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{formatMoney(pendingVariablePay)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{pendingVariableEntries.length} unsettled incentive/commission entr{pendingVariableEntries.length === 1 ? "y" : "ies"}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Finance Notices</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The finance items that need your follow-up or explain why a number looks lower than expected.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">{financeNotices.length} active</div>
        </div>
        <div className="mt-4 space-y-3">
          {financeNotices.map((notice) => (
            <div key={notice.id} className={`rounded-lg border p-4 ${financeNoticeTone(notice.severity)}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{notice.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{notice.detail}</div>
                </div>
                <Link href={notice.href} className="text-sm font-medium text-primary underline underline-offset-2">
                  {notice.cta}
                </Link>
              </div>
            </div>
          ))}
          {financeNotices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No active finance notices right now.
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="text-sm font-semibold">My Action Queue</div>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-md border border-amber-500/25 bg-card/95 p-3 ring-1 ring-amber-500/10">
            Expense approvals pending: <span className="font-semibold">{pendingExpenseCount}</span>
          </div>
          <div className="rounded-md border border-sky-500/25 bg-card/95 p-3 ring-1 ring-sky-500/10">
            Leave requests pending: <span className="font-semibold">{pendingLeaveCount}</span>
          </div>
          <div className="rounded-md border border-violet-500/25 bg-card/95 p-3 ring-1 ring-violet-500/10">
            Payroll entries unpaid: <span className="font-semibold">{payrollPendingCount}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-semibold">My Reimbursements</div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div>Due now: <span className="font-semibold text-foreground">{formatMoney(pocketPayable)}</span></div>
            <div>Paid this month: <span className="font-semibold text-foreground">{formatMoney(reimbursementPaidThisMonth)}</span></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href={`/expenses?paymentSource=EMPLOYEE_POCKET&status=APPROVED`} className="rounded-md border px-3 py-2 hover:bg-accent">
              Due Claims
            </Link>
            <Link href={`/expenses?paymentSource=EMPLOYEE_POCKET&status=PAID&from=${monthStartStr}&to=${monthEndStr}`} className="rounded-md border px-3 py-2 hover:bg-accent">
              Paid This Month
            </Link>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-semibold">My Advances</div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div>Issued total: <span className="font-semibold text-foreground">{formatMoney(advanceIssued)}</span></div>
            <div>Outstanding: <span className="font-semibold text-foreground">{formatMoney(advanceOutstanding)}</span></div>
            <div>Used this month: <span className="font-semibold text-foreground">{formatMoney(advanceUsedThisMonth)}</span></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href={`/salary-advances?employeeId=${employee.id}`} className="rounded-md border px-3 py-2 hover:bg-accent">
              Advance History
            </Link>
            <Link href={`/wallets?employeeId=${employee.id}&type=DEBIT&from=${monthStartStr}&to=${monthEndStr}`} className="rounded-md border px-3 py-2 hover:bg-accent">
              Wallet Debits
            </Link>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-semibold">My Payroll</div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div>Latest net pay: <span className="font-semibold text-foreground">{formatMoney(latestSalary)}</span></div>
            <div>Pending rows: <span className="font-semibold text-foreground">{payrollPendingCount}</span></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href="/payroll" className="rounded-md border px-3 py-2 hover:bg-accent">
              Payroll History
            </Link>
            <a href="/api/me/payroll/export" className="rounded-md border px-3 py-2 hover:bg-accent">
              Export Salary CSV
            </a>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-semibold">My Variable Pay</div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div>Pending now: <span className="font-semibold text-foreground">{formatMoney(pendingVariablePay)}</span></div>
            <div>Payroll-mode due: <span className="font-semibold text-foreground">{formatMoney(pendingPayrollIncentive)}</span></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href={`/incentives?employeeId=${employee.id}&settlement=UNSETTLED&status=APPROVED`} className="rounded-md border px-3 py-2 hover:bg-accent">
              Incentives
            </Link>
            <Link href={`/commissions?search=${encodeURIComponent(employee.name)}`} className="rounded-md border px-3 py-2 hover:bg-accent">
              Commissions
            </Link>
          </div>
        </div>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance Snapshot</div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-emerald-500/10">
          <div className="text-sm text-emerald-700 dark:text-emerald-300">This Month Present</div>
          <div className="mt-2 text-xl font-semibold text-foreground">{attendanceMap.get("PRESENT") || 0}</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-amber-500/10">
          <div className="text-sm text-amber-700 dark:text-amber-300">This Month Late</div>
          <div className="mt-2 text-xl font-semibold text-foreground">{attendanceMap.get("LATE") || 0}</div>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-rose-500/10">
          <div className="text-sm text-rose-700 dark:text-rose-300">This Month Absent</div>
          <div className="mt-2 text-xl font-semibold text-foreground">{attendanceMap.get("ABSENT") || 0}</div>
        </div>
        <div className="rounded-xl border border-sky-500/30 bg-card/95 p-6 shadow-sm ring-1 ring-sky-500/10">
          <div className="text-sm text-sky-700 dark:text-sky-300">Leave Requests</div>
          <div className="mt-2 text-xl font-semibold text-foreground">{leaveRequests.length}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Achievements (Profile v1)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manual/admin achievements feed is now reserved in profile. Structured scoring timeline will follow in Task Performance phase.
        </p>
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          No achievements added yet.
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
          <h2 className="text-lg font-semibold">Variable Pay History</h2>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Project</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {variablePayHistory.map((entry) => (
                  <tr key={`${entry.entryType}-${entry.id}`} className="border-b">
                    <td className="py-2">{new Date(entry.createdAt).toLocaleDateString()}</td>
                    <td className="py-2">{entry.entryType}</td>
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
            {variablePayHistory.map((entry) => (
              <MobileCard
                key={`${entry.entryType}-${entry.id}`}
                title={entry.projectRef || (entry.entryType === "INCENTIVE" ? "Incentive" : "Commission")}
                subtitle={new Date(entry.createdAt).toLocaleDateString()}
                fields={[
                  { label: "Type", value: entry.entryType },
                  { label: "Amount", value: formatMoney(Number(entry.amount)) },
                  { label: "Status", value: entry.status },
                  { label: "Payout", value: entry.payoutMode || "-" },
                  { label: "Settlement", value: entry.settlementStatus || "-" },
                ]}
              />
            ))}
          </div>
          {variablePayHistory.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No incentives or commissions recorded yet.</div>
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
