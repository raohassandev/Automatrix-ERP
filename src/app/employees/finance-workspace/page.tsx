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
import { getEmployeeFinanceWorkspaceData } from "@/lib/employee-finance";

function hrefWithQuery(path: string, query: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function SummaryCard({
  label,
  value,
  note,
  href,
  accentClass,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
  accentClass?: string;
}) {
  const body = (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${accentClass || "text-foreground"}`}>{value}</div>
      {note ? <div className="mt-1 text-xs text-muted-foreground">{note}</div> : null}
    </div>
  );

  return href ? <a href={href}>{body}</a> : body;
}

export default async function EmployeeFinanceWorkspacePage({
  searchParams,
}: {
  searchParams: {
    employeeId?: string;
    search?: string;
    event?: string;
    category?: string;
    paymentSource?: string;
    project?: string;
    from?: string;
    to?: string;
  };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const [canViewAll, canViewTeam, canViewOwn, canReportsAll, canReportsTeam, canReportsOwn, canExport] = await Promise.all([
    requirePermission(session.user.id, "employees.view_all"),
    requirePermission(session.user.id, "employees.view_team"),
    requirePermission(session.user.id, "employees.view_own"),
    requirePermission(session.user.id, "reports.view_all"),
    requirePermission(session.user.id, "reports.view_team"),
    requirePermission(session.user.id, "reports.view_own"),
    requirePermission(session.user.id, "reports.export"),
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
    select: { id: true, name: true, email: true, status: true },
    orderBy: { name: "asc" },
  });

  if (employeeOptionsRaw.length === 0) {
    const linkedUser = session.user.email
      ? await findUserByEmailInsensitive(session.user.email, { select: { id: true } })
      : null;

    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee Finance Workspace</h1>
        <p className="mt-2 text-muted-foreground">
          No accessible employee record was linked to this login. Finance self-scope and team-scope pages require a matching employee profile.
        </p>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <div>Session email: {session.user.email || "Unknown"}</div>
          <div>User account linked: {linkedUser ? "Yes" : "No"}</div>
          <div>Next action: map this user email to an active Employee record in Employees or Access Control.</div>
        </div>
      </div>
    );
  }

  const selectedEmployeeId = employeeOptionsRaw.some((row) => row.id === (searchParams.employeeId || "").trim())
    ? (searchParams.employeeId || "").trim()
    : employeeOptionsRaw[0].id;

  const workspace = await getEmployeeFinanceWorkspaceData({
    employeeId: selectedEmployeeId,
    from: searchParams.from,
    to: searchParams.to,
    search: searchParams.search,
    event: searchParams.event,
    category: searchParams.category,
    paymentSource: searchParams.paymentSource,
    project: searchParams.project,
  });

  if (!workspace) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee Finance Workspace</h1>
        <p className="mt-2 text-muted-foreground">Employee not found.</p>
      </div>
    );
  }

  const selectedEmployee = workspace.employee;
  const filterQueryBase = {
    employeeId: selectedEmployee.id,
    from: workspace.rangeFrom.toISOString(),
    to: workspace.rangeTo.toISOString(),
    category: searchParams.category,
    paymentSource: searchParams.paymentSource,
    project: searchParams.project,
    search: searchParams.search,
    event: searchParams.event,
  };

  const walletCreditHref = hrefWithQuery("/wallets", {
    employeeId: selectedEmployee.id,
    type: "CREDIT",
    from: workspace.rangeFrom.toISOString(),
    to: workspace.rangeTo.toISOString(),
  });
  const walletDebitHref = hrefWithQuery("/wallets", {
    employeeId: selectedEmployee.id,
    type: "DEBIT",
    from: workspace.rangeFrom.toISOString(),
    to: workspace.rangeTo.toISOString(),
  });
  const expenseListHref = hrefWithQuery("/expenses", {
    submittedById: workspace.linkedUserId,
    from: workspace.rangeFrom.toISOString(),
    to: workspace.rangeTo.toISOString(),
    category: searchParams.category,
    paymentSource: searchParams.paymentSource,
    project: searchParams.project,
    search: searchParams.search,
  });
  const financeExportHref = hrefWithQuery("/api/employees/finance-workspace/export", filterQueryBase);
  const advanceHref = hrefWithQuery("/salary-advances", {
    employeeId: selectedEmployee.id,
    from: workspace.rangeFrom.toISOString(),
    to: workspace.rangeTo.toISOString(),
  });

  const filteredExpenseTotal = workspace.expenseDetailRows.reduce((sum, row) => sum + row.approvedAmount, 0);
  const filteredPocketTotal = workspace.categorySummary.reduce((sum, row) => sum + row.pocket, 0);
  const filteredWalletTotal = workspace.categorySummary.reduce((sum, row) => sum + row.wallet, 0);
  const filteredCompanyTotal = workspace.categorySummary.reduce((sum, row) => sum + row.company, 0);
  const filteredClaims = workspace.expenseDetailRows.length;
  const filteredAverageClaim = filteredClaims > 0 ? filteredExpenseTotal / filteredClaims : 0;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Employee Finance Workspace</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              One-screen employee finance investigation for issued amounts, expenses, reimbursements, advances, payroll, and variable pay.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/employees/${selectedEmployee.id}`} className="rounded-md border px-3 py-2 hover:bg-accent">
              Open Profile
            </Link>
            <Link href={walletCreditHref} className="rounded-md border px-3 py-2 hover:bg-accent">
              Wallet Credits
            </Link>
            <Link href={expenseListHref} className="rounded-md border px-3 py-2 hover:bg-accent">
              Expense Evidence
            </Link>
            {canExport ? (
              <a href={financeExportHref} className="rounded-md border px-3 py-2 hover:bg-accent">
                Export Timeline CSV
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded-md border px-2 py-1">{selectedEmployee.name} ({selectedEmployee.email})</span>
          <span className="rounded-md border px-2 py-1">Status: {selectedEmployee.status}</span>
          <span className="rounded-md border px-2 py-1">Range: {workspace.rangeFrom.toLocaleDateString()} - {workspace.rangeTo.toLocaleDateString()}</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <DateRangePicker />
          <QuerySelect
            param="employeeId"
            placeholder="Select employee"
            options={employeeOptionsRaw.map((row) => ({ value: row.id, label: `${row.name} (${row.email})` }))}
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
          <QuerySelect
            param="category"
            placeholder="All categories"
            options={workspace.options.categories.map((value) => ({ value, label: value }))}
          />
          <QuerySelect
            param="paymentSource"
            placeholder="All payment sources"
            options={workspace.options.paymentSources.map((value) => ({ value, label: value.replaceAll("_", " ") }))}
          />
          <QuerySelect
            param="project"
            placeholder="All projects"
            options={workspace.options.projects.map((value) => ({ value, label: value }))}
            className="min-w-[180px] rounded-md border px-3 py-2 text-sm"
          />
          <div className="min-w-[240px]">
            <SearchInput placeholder="Search notes, category, project, reference..." />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Statement cards below reflect the full employee interval. Expense-only filters (`category`, `payment source`, `project`) narrow the expense analytics and the timeline when no specific module is selected.
        </div>
      </div>

      <div id="statement" className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Opening Balance" value={formatMoney(workspace.statement.openingBalance)} note="Wallet position at range start" href={walletCreditHref} />
        <SummaryCard label="Issued In Interval" value={formatMoney(workspace.statement.issuedAmount)} note="Wallet credits and company-issued funding" href={walletCreditHref} accentClass="text-emerald-700" />
        <SummaryCard label="Consumed In Interval" value={formatMoney(workspace.statement.consumedAmount)} note="Wallet debits and recoveries" href={walletDebitHref} accentClass="text-rose-700" />
        <SummaryCard label="Closing Balance" value={formatMoney(workspace.statement.closingBalance)} note="Wallet position at range end" href={walletDebitHref} />
        <SummaryCard label="Current Available" value={formatMoney(workspace.statement.currentAvailable)} note={`Balance ${formatMoney(workspace.statement.currentBalance)} • Hold ${formatMoney(workspace.statement.currentHold)}`} href={hrefWithQuery("/wallets", { employeeId: selectedEmployee.id })} />
        <SummaryCard label="Expense Approved" value={formatMoney(workspace.statement.expenseApproved)} note={`Booked ${formatMoney(workspace.statement.expenseBooked)}`} href="#expense-detail" />
        <SummaryCard label="Reimburse Due" value={formatMoney(workspace.statement.expensePayable)} note="Approved employee-pocket claims still payable" href="#expense-detail" accentClass="text-amber-700" />
        <SummaryCard label="Reimbursed" value={formatMoney(workspace.statement.reimbursedAmount)} note="Employee-pocket claims already paid" href="#expense-detail" />
        <SummaryCard label="Advance Outstanding" value={formatMoney(workspace.statement.advanceOutstanding)} note={`Issued ${formatMoney(workspace.statement.advanceIssued)}`} href={advanceHref} accentClass="text-rose-700" />
        <SummaryCard label="Payroll Due" value={formatMoney(workspace.statement.payrollDue)} note={`Paid ${formatMoney(workspace.statement.payrollPaid)}`} href="/payroll" />
        <SummaryCard label="Variable Pay Due" value={formatMoney(workspace.statement.variablePayDue)} note={`Settled ${formatMoney(workspace.statement.variablePaid)}`} href={hrefWithQuery("/incentives", { employeeId: selectedEmployee.id })} />
        <SummaryCard label="Net Company Payable" value={formatMoney(workspace.statement.netCompanyPayable)} note="Payroll + variable pay + reimbursements - advance outstanding" href="#monthly-summary" accentClass={workspace.statement.netCompanyPayable >= 0 ? "text-foreground" : "text-rose-700"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Filtered Expense Total" value={formatMoney(filteredExpenseTotal)} note={`Claims ${filteredClaims}`} href="#expense-detail" />
        <SummaryCard label="Average Claim" value={formatMoney(filteredAverageClaim)} note="Based on current expense slice" href="#expense-detail" />
        <SummaryCard label="Pocket-Funded" value={formatMoney(filteredPocketTotal)} note="Employee own-pocket claims" href="#expense-categories" />
        <SummaryCard label="Wallet-Funded" value={formatMoney(filteredWalletTotal)} note="Consumed from employee wallet" href="#expense-categories" />
        <SummaryCard label="Company-Funded" value={formatMoney(filteredCompanyTotal)} note="Company direct/account funded" href="#expense-categories" />
      </div>

      <div id="expense-categories" className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Category Breakdown</h2>
              <p className="mt-1 text-sm text-muted-foreground">Approved expense totals by category for the active expense slice.</p>
            </div>
            <div className="text-sm text-muted-foreground">{workspace.categorySummary.length} categories</div>
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Category</th>
                  <th className="py-2">Claims</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Avg Claim</th>
                  <th className="py-2">Pocket</th>
                  <th className="py-2">Wallet</th>
                  <th className="py-2">Company</th>
                </tr>
              </thead>
              <tbody>
                {workspace.categorySummary.map((row) => (
                  <tr key={row.category} className="border-b">
                    <td className="py-2 font-medium">{row.category}</td>
                    <td className="py-2">{row.claims}</td>
                    <td className="py-2">{formatMoney(row.total)}</td>
                    <td className="py-2">{formatMoney(row.averageClaim)}</td>
                    <td className="py-2">{formatMoney(row.pocket)}</td>
                    <td className="py-2">{formatMoney(row.wallet)}</td>
                    <td className="py-2">{formatMoney(row.company)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {workspace.categorySummary.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">No expense rows match the active slice.</div>
          ) : null}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Investigation Shortcuts</h2>
          <div className="mt-4 space-y-3 text-sm">
            <Link href={walletCreditHref} className="block rounded-lg border p-3 hover:bg-accent">
              Wallet credits in selected interval
            </Link>
            <Link href={walletDebitHref} className="block rounded-lg border p-3 hover:bg-accent">
              Wallet debits in selected interval
            </Link>
            <Link href={expenseListHref} className="block rounded-lg border p-3 hover:bg-accent">
              Exact expense rows for current slice
            </Link>
            <Link href={advanceHref} className="block rounded-lg border p-3 hover:bg-accent">
              Salary advances and outstanding recovery
            </Link>
            <Link href={hrefWithQuery("/reports/employee-expenses", {
              submittedById: workspace.linkedUserId,
              from: workspace.rangeFrom.toISOString(),
              to: workspace.rangeTo.toISOString(),
              category: searchParams.category,
              paymentSource: searchParams.paymentSource,
              project: searchParams.project,
              search: searchParams.search,
            })} className="block rounded-lg border p-3 hover:bg-accent">
              Employee expense analytics
            </Link>
          </div>
        </div>
      </div>

      <div id="monthly-summary" className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Monthly Expense & Funding Trend</h2>
            <p className="mt-1 text-sm text-muted-foreground">Month-wise issued, consumed, approved, payable, reimbursed, payroll, and variable pay movement.</p>
          </div>
          <div className="text-sm text-muted-foreground">{workspace.monthlySummary.length} month rows</div>
        </div>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Month</th>
                <th className="py-2">Issued</th>
                <th className="py-2">Consumed</th>
                <th className="py-2">Expense Approved</th>
                <th className="py-2">Pocket Payable</th>
                <th className="py-2">Reimbursed</th>
                <th className="py-2">Advance Issued</th>
                <th className="py-2">Payroll Paid</th>
                <th className="py-2">Variable Paid</th>
                <th className="py-2">Claims</th>
                <th className="py-2">Avg Claim</th>
              </tr>
            </thead>
            <tbody>
              {workspace.monthlySummary.map((row) => (
                <tr key={row.month} className="border-b">
                  <td className="py-2 font-medium">{row.month}</td>
                  <td className="py-2">{formatMoney(row.issued)}</td>
                  <td className="py-2">{formatMoney(row.consumed)}</td>
                  <td className="py-2">{formatMoney(row.expenseApproved)}</td>
                  <td className="py-2">{formatMoney(row.pocketPayable)}</td>
                  <td className="py-2">{formatMoney(row.reimbursed)}</td>
                  <td className="py-2">{formatMoney(row.advanceIssued)}</td>
                  <td className="py-2">{formatMoney(row.payrollPaid)}</td>
                  <td className="py-2">{formatMoney(row.variablePaid)}</td>
                  <td className="py-2">{row.claims}</td>
                  <td className="py-2">{formatMoney(row.averageClaim)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {workspace.monthlySummary.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">No month summary is available for the current interval.</div>
        ) : null}
      </div>

      <div id="expense-detail" className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Detailed Expense Rows</h2>
            <p className="mt-1 text-sm text-muted-foreground">Exact expense evidence for the active employee and expense slice.</p>
          </div>
          <div className="text-sm text-muted-foreground">{workspace.expenseDetailRows.length} rows</div>
        </div>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Category</th>
                <th className="py-2">Project</th>
                <th className="py-2">Source</th>
                <th className="py-2">Status</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Approved</th>
                <th className="py-2">Description</th>
                <th className="py-2">Drill</th>
              </tr>
            </thead>
            <tbody>
              {workspace.expenseDetailRows.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="py-2">{row.date.toLocaleDateString()}</td>
                  <td className="py-2">{row.category}</td>
                  <td className="py-2">{row.project || "-"}</td>
                  <td className="py-2">{row.paymentSource || "-"}</td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2">{formatMoney(row.amount)}</td>
                  <td className="py-2">{formatMoney(row.approvedAmount)}</td>
                  <td className="py-2">{row.description}</td>
                  <td className="py-2">
                    <Link href={row.href} className="text-primary underline underline-offset-2">
                      Open source rows
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {workspace.expenseDetailRows.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">No expense rows match the current slice.</div>
        ) : null}
      </div>

      <div id="timeline" className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Filtered Timeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Unified timeline across wallet, expense, advance, payroll, incentive, and commission events.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">{workspace.timeline.length} rows</div>
        </div>
        {workspace.filters.hasExpenseSlice && !workspace.filters.moduleFilter ? (
          <div className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Because an expense-only slice is active, the timeline is narrowed to matching expense rows unless a specific module is selected.
          </div>
        ) : null}
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Module</th>
                <th className="py-2">Reference</th>
                <th className="py-2">Context</th>
                <th className="py-2">Status</th>
                <th className="py-2">Impact</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Running Balance</th>
                <th className="py-2">Drill</th>
              </tr>
            </thead>
            <tbody>
              {workspace.timeline.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="py-2">{row.date.toLocaleDateString()}</td>
                  <td className="py-2 font-medium">{row.module}</td>
                  <td className="py-2">{row.reference}</td>
                  <td className="py-2">
                    {[row.category, row.paymentSource, row.project, row.sourceType, row.note].filter(Boolean).join(" • ") || "-"}
                  </td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2">{row.impact}</td>
                  <td className="py-2">{formatMoney(row.amount)}</td>
                  <td className="py-2">{row.runningBalance === null ? "-" : formatMoney(row.runningBalance)}</td>
                  <td className="py-2">
                    <Link href={row.href} className="text-primary underline underline-offset-2">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {workspace.timeline.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">No timeline rows match the active filters.</div>
        ) : null}
      </div>
    </div>
  );
}
