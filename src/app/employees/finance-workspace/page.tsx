import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import DateRangePicker from "@/components/DateRangePicker";
import QuerySelect from "@/components/QuerySelect";
import SearchInput from "@/components/SearchInput";
import { findEmployeeByEmailInsensitive, findUserByEmailInsensitive } from "@/lib/identity";

type TimelineRow = {
  id: string;
  date: Date;
  module: "WALLET" | "EXPENSE" | "ADVANCE" | "PAYROLL" | "INCENTIVE" | "COMMISSION";
  impact: "IN" | "OUT" | "INFO";
  amount: number;
  status: string;
  note: string;
  reference: string;
  href: string;
};

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeExpenseAmount(expense: {
  status: string;
  amount: { toString(): string } | number;
  approvedAmount: { toString(): string } | number | null;
}) {
  if (
    (expense.status === "APPROVED" || expense.status === "PARTIALLY_APPROVED" || expense.status === "PAID") &&
    expense.approvedAmount !== null
  ) {
    return Number(expense.approvedAmount);
  }
  return Number(expense.amount);
}

export default async function EmployeeFinanceWorkspacePage({
  searchParams,
}: {
  searchParams: {
    employeeId?: string;
    search?: string;
    event?: string;
    from?: string;
    to?: string;
  };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const [canViewAll, canViewTeam, canViewOwn, canReportsAll, canReportsTeam, canReportsOwn] = await Promise.all([
    requirePermission(session.user.id, "employees.view_all"),
    requirePermission(session.user.id, "employees.view_team"),
    requirePermission(session.user.id, "employees.view_own"),
    requirePermission(session.user.id, "reports.view_all"),
    requirePermission(session.user.id, "reports.view_team"),
    requirePermission(session.user.id, "reports.view_own"),
  ]);

  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee Finance Workspace</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to employee records.</p>
      </div>
    );
  }

  if (!canReportsAll && !canReportsTeam && !canReportsOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee Finance Workspace</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to finance reporting views.</p>
      </div>
    );
  }

  const params = searchParams;
  const textSearch = (params.search || "").trim().toLowerCase();
  const eventFilter = (params.event || "").trim().toUpperCase();

  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const parsedFrom = parseDate(params.from) || defaultFrom;
  const parsedTo = parseDate(params.to) || today;
  const rangeFrom = parsedFrom <= parsedTo ? parsedFrom : parsedTo;
  const rangeTo = parsedTo >= parsedFrom ? parsedTo : parsedFrom;

  const currentEmployee = session.user.email
    ? await findEmployeeByEmailInsensitive(session.user.email, {
        select: { id: true, directReports: { select: { id: true } } },
      })
    : null;

  const scopedEmployeeIds = canViewAll
    ? null
    : canViewTeam
      ? [currentEmployee?.id, ...(currentEmployee?.directReports.map((row) => row.id) || [])].filter(Boolean)
      : currentEmployee?.id
        ? [currentEmployee.id]
        : [];

  const employeeOptionsRaw = await prisma.employee.findMany({
    where: scopedEmployeeIds ? { id: { in: scopedEmployeeIds as string[] } } : {},
    select: { id: true, name: true, email: true, walletBalance: true, walletHold: true, status: true },
    orderBy: { name: "asc" },
  });

  if (employeeOptionsRaw.length === 0) {
    const linkedUser = session.user.email
      ? await findUserByEmailInsensitive(session.user.email, { select: { id: true, email: true } })
      : null;

    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee Finance Workspace</h1>
        <p className="mt-2 text-muted-foreground">
          No accessible employee record was linked to this login. Finance self-scope and team-scope pages require a matching active employee profile.
        </p>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <div>Session email: {session.user.email || "Unknown"}</div>
          <div>User account linked: {linkedUser ? "Yes" : "No"}</div>
          <div>Next action: map this user email to an active Employee record in Employees or Access Control.</div>
        </div>
      </div>
    );
  }

  const employeeOptions = employeeOptionsRaw.map((row) => ({
    id: row.id,
    label: `${row.name} (${row.email})`,
  }));
  const selectedEmployeeIdRaw = (params.employeeId || "").trim();
  const selectedEmployeeId = employeeOptions.some((row) => row.id === selectedEmployeeIdRaw)
    ? selectedEmployeeIdRaw
    : employeeOptions[0].id;
  const selectedEmployee = employeeOptionsRaw.find((row) => row.id === selectedEmployeeId)!;

  const linkedUser = await findUserByEmailInsensitive(selectedEmployee.email, { select: { id: true } });

  const [openingBalanceRow, closingBalanceRow, walletRows, expenseRows, advanceRows, payrollRows, incentiveRows, commissionRows] =
    await Promise.all([
      prisma.walletLedger.findFirst({
        where: { employeeId: selectedEmployee.id, date: { lt: rangeFrom } },
        orderBy: { date: "desc" },
        select: { balance: true },
      }),
      prisma.walletLedger.findFirst({
        where: { employeeId: selectedEmployee.id, date: { lte: rangeTo } },
        orderBy: { date: "desc" },
        select: { balance: true },
      }),
      prisma.walletLedger.findMany({
        where: { employeeId: selectedEmployee.id, date: { gte: rangeFrom, lte: rangeTo } },
        orderBy: { date: "desc" },
        include: { companyAccount: { select: { name: true } }, postedBy: { select: { name: true, email: true } } },
      }),
      linkedUser?.id
        ? prisma.expense.findMany({
            where: { submittedById: linkedUser.id, date: { gte: rangeFrom, lte: rangeTo } },
            orderBy: { date: "desc" },
            select: {
              id: true,
              date: true,
              amount: true,
              approvedAmount: true,
              status: true,
              description: true,
              project: true,
              paymentSource: true,
            },
          })
        : Promise.resolve([]),
      prisma.salaryAdvance.findMany({
        where: { employeeId: selectedEmployee.id, createdAt: { gte: rangeFrom, lte: rangeTo } },
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, outstandingAmount: true, status: true, reason: true, createdAt: true },
      }),
      prisma.payrollEntry.findMany({
        where: { employeeId: selectedEmployee.id, createdAt: { gte: rangeFrom, lte: rangeTo } },
        orderBy: { createdAt: "desc" },
        select: { id: true, netPay: true, status: true, createdAt: true, payrollRun: { select: { periodStart: true, periodEnd: true } } },
      }),
      prisma.incentiveEntry.findMany({
        where: { employeeId: selectedEmployee.id, createdAt: { gte: rangeFrom, lte: rangeTo } },
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, status: true, settlementStatus: true, projectRef: true, createdAt: true },
      }),
      prisma.commissionEntry.findMany({
        where: { employeeId: selectedEmployee.id, payeeType: "EMPLOYEE", createdAt: { gte: rangeFrom, lte: rangeTo } },
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, status: true, settlementStatus: true, projectRef: true, createdAt: true },
      }),
    ]);

  const openingBalance = Number(openingBalanceRow?.balance || 0);
  const closingBalance = Number(closingBalanceRow?.balance || 0);
  const currentBalance = Number(selectedEmployee.walletBalance || 0);
  const currentHold = Number(selectedEmployee.walletHold || 0);
  const currentAvailable = currentBalance - currentHold;

  const issuedAmount = walletRows
    .filter((row) => row.type === "CREDIT")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const consumedAmount = walletRows
    .filter((row) => row.type === "DEBIT")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const expenseBooked = expenseRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const expenseApproved = expenseRows.reduce((sum, row) => sum + normalizeExpenseAmount(row), 0);
  const expensePayable = expenseRows
    .filter((row) => row.paymentSource === "EMPLOYEE_POCKET" && (row.status === "APPROVED" || row.status === "PARTIALLY_APPROVED"))
    .reduce((sum, row) => sum + normalizeExpenseAmount(row), 0);
  const expensePaid = expenseRows
    .filter((row) => row.status === "PAID")
    .reduce((sum, row) => sum + normalizeExpenseAmount(row), 0);
  const advanceIssued = advanceRows
    .filter((row) => row.status === "PAID" || row.status === "PARTIALLY_RECOVERED")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const advanceOutstanding = advanceRows.reduce((sum, row) => sum + Number(row.outstandingAmount || 0), 0);
  const payrollPaid = payrollRows
    .filter((row) => String(row.status || "").toUpperCase() === "PAID")
    .reduce((sum, row) => sum + Number(row.netPay || 0), 0);
  const incentiveSettled = incentiveRows
    .filter((row) => String(row.settlementStatus || "").toUpperCase() === "SETTLED")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const commissionSettled = commissionRows
    .filter((row) => String(row.settlementStatus || "").toUpperCase() === "SETTLED")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const timeline: TimelineRow[] = [
    ...walletRows.map((row) => ({
      id: `wallet-${row.id}`,
      date: new Date(row.date),
      module: "WALLET" as const,
      impact: (row.type === "CREDIT" ? "IN" : "OUT") as TimelineRow["impact"],
      amount: Number(row.amount || 0),
      status: row.type,
      note: [row.sourceType, row.reference, row.companyAccount?.name, row.postedBy?.name || row.postedBy?.email]
        .filter(Boolean)
        .join(" • "),
      reference: row.reference || row.id,
      href: `/wallets?employeeId=${selectedEmployee.id}`,
    })),
    ...expenseRows.map((row) => ({
      id: `expense-${row.id}`,
      date: new Date(row.date),
      module: "EXPENSE" as const,
      impact: (row.status === "PAID" ? "OUT" : "INFO") as TimelineRow["impact"],
      amount: normalizeExpenseAmount(row),
      status: row.status,
      note: [row.paymentSource, row.project, row.description].filter(Boolean).join(" • "),
      reference: row.id,
      href: `/expenses/${row.id}`,
    })),
    ...advanceRows.map((row) => ({
      id: `advance-${row.id}`,
      date: new Date(row.createdAt),
      module: "ADVANCE" as const,
      impact: (row.status === "PAID" || row.status === "PARTIALLY_RECOVERED" ? "IN" : "INFO") as TimelineRow["impact"],
      amount: Number(row.amount || 0),
      status: row.status,
      note: `${row.reason} • Outstanding ${formatMoney(Number(row.outstandingAmount || 0))}`,
      reference: row.id,
      href: `/salary-advances?search=${encodeURIComponent(selectedEmployee.name)}`,
    })),
    ...payrollRows.map((row) => ({
      id: `payroll-${row.id}`,
      date: new Date(row.createdAt),
      module: "PAYROLL" as const,
      impact: (String(row.status || "").toUpperCase() === "PAID" ? "IN" : "INFO") as TimelineRow["impact"],
      amount: Number(row.netPay || 0),
      status: row.status,
      note: row.payrollRun
        ? `${new Date(row.payrollRun.periodStart).toLocaleDateString()} - ${new Date(row.payrollRun.periodEnd).toLocaleDateString()}`
        : "Payroll run",
      reference: row.id,
      href: "/payroll",
    })),
    ...incentiveRows.map((row) => ({
      id: `incentive-${row.id}`,
      date: new Date(row.createdAt),
      module: "INCENTIVE" as const,
      impact: (String(row.settlementStatus || "").toUpperCase() === "SETTLED" ? "IN" : "INFO") as TimelineRow["impact"],
      amount: Number(row.amount || 0),
      status: `${row.status}/${row.settlementStatus}`,
      note: row.projectRef || "Incentive",
      reference: row.id,
      href: `/incentives?employeeId=${selectedEmployee.id}`,
    })),
    ...commissionRows.map((row) => ({
      id: `commission-${row.id}`,
      date: new Date(row.createdAt),
      module: "COMMISSION" as const,
      impact: (String(row.settlementStatus || "").toUpperCase() === "SETTLED" ? "IN" : "INFO") as TimelineRow["impact"],
      amount: Number(row.amount || 0),
      status: `${row.status}/${row.settlementStatus}`,
      note: row.projectRef || "Commission",
      reference: row.id,
      href: `/commissions?search=${encodeURIComponent(selectedEmployee.name)}`,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .filter((row) => (eventFilter ? row.module === eventFilter : true))
    .filter((row) => {
      if (!textSearch) return true;
      const haystack = [row.module, row.status, row.note, row.reference].join(" ").toLowerCase();
      return haystack.includes(textSearch);
    });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Employee Finance Workspace</h1>
            <p className="mt-2 text-muted-foreground">
              Consolidated employee-level finance view for audit, reconciliation, and payout controls.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <QuerySelect
              param="employeeId"
              placeholder="Select employee"
              options={employeeOptions.map((row) => ({ label: row.label, value: row.id }))}
              className="min-w-[240px] rounded-md border px-3 py-2 text-sm"
            />
            <QuerySelect
              param="event"
              placeholder="All modules"
              options={[
                { label: "Wallet", value: "WALLET" },
                { label: "Expense", value: "EXPENSE" },
                { label: "Advance", value: "ADVANCE" },
                { label: "Payroll", value: "PAYROLL" },
                { label: "Incentive", value: "INCENTIVE" },
                { label: "Commission", value: "COMMISSION" },
              ]}
            />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search status/reference/note..." />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded-md border px-2 py-1">{selectedEmployee.name} ({selectedEmployee.email})</span>
          <span className="rounded-md border px-2 py-1">Status: {selectedEmployee.status}</span>
          <Link href={`/employees/${selectedEmployee.id}`} className="rounded-md border px-2 py-1 hover:bg-accent">
            Open Profile
          </Link>
          <Link href={`/wallets?employeeId=${selectedEmployee.id}`} className="rounded-md border px-2 py-1 hover:bg-accent">
            Open Wallet Ledger
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Opening Balance</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(openingBalance)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Issued In Interval</div>
          <div className="mt-1 text-lg font-semibold text-emerald-700">{formatMoney(issuedAmount)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Consumed In Interval</div>
          <div className="mt-1 text-lg font-semibold text-rose-700">{formatMoney(consumedAmount)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Closing Balance (to range end)</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(closingBalance)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Current Available</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(currentAvailable)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Expense Booked</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(expenseBooked)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Approved basis: {formatMoney(expenseApproved)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Pocket Payable</div>
          <div className="mt-1 text-lg font-semibold text-amber-700">{formatMoney(expensePayable)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Already reimbursed: {formatMoney(expensePaid)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Advance Issued</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(advanceIssued)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Outstanding: {formatMoney(advanceOutstanding)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Settled Credits</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(payrollPaid + incentiveSettled + commissionSettled)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Payroll {formatMoney(payrollPaid)} • Incentive {formatMoney(incentiveSettled)} • Commission {formatMoney(commissionSettled)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Unified Timeline</h2>
          <div className="text-sm text-muted-foreground">{timeline.length} entries</div>
        </div>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Module</th>
                <th className="py-2">Impact</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2">Reference</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{row.date.toLocaleDateString()}</td>
                  <td className="py-2">{row.module}</td>
                  <td className="py-2">
                    <span
                      className={
                        row.impact === "IN"
                          ? "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                          : row.impact === "OUT"
                            ? "rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700"
                            : "rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                      }
                    >
                      {row.impact}
                    </span>
                  </td>
                  <td className="py-2">{formatMoney(row.amount)}</td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2">
                    <Link href={row.href} className="underline underline-offset-2">
                      {row.reference}
                    </Link>
                  </td>
                  <td className="py-2">{row.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3 md:hidden">
          {timeline.map((row) => (
            <div key={row.id} className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{row.module}</div>
              <div className="text-muted-foreground">{row.date.toLocaleDateString()}</div>
              <div className="mt-1">Impact: {row.impact}</div>
              <div>Amount: {formatMoney(row.amount)}</div>
              <div>Status: {row.status}</div>
              <div className="truncate">Notes: {row.note || "-"}</div>
              <Link href={row.href} className="mt-1 inline-block underline underline-offset-2">
                Open source
              </Link>
            </div>
          ))}
        </div>
        {timeline.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No entries in selected filters/interval.</div>
        ) : null}
      </div>
    </div>
  );
}
