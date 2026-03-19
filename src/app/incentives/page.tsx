import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { IncentiveCreateButton } from "@/components/IncentiveCreateButton";
import { IncentiveActions } from "@/components/IncentiveActions";
import { MobileCard } from "@/components/MobileCard";
import { employeeCodeFromId } from "@/lib/employee-display";
import QuerySelect from "@/components/QuerySelect";
import Link from "next/link";

export default async function IncentivesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    month?: string;
    payout?: string;
    settlement?: string;
    status?: string;
    employeeId?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "incentives.view_all");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  const canEdit = await requirePermission(session.user.id, "incentives.edit");
  const canApprove = await requirePermission(session.user.id, "incentives.approve");
  if (!canViewAll && !canViewOwn && !canEdit) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold">Incentives</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to incentives.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const month = (params.month || "").trim();
  const payout = (params.payout || "").trim().toUpperCase();
  const settlement = (params.settlement || "").trim().toUpperCase();
  const status = (params.status || "").trim().toUpperCase();
  const employeeId = (params.employeeId || "").trim();
  const take = 25;
  const skip = (page - 1) * take;

  let ownEmployeeId: string | null = null;
  if (!canViewAll && session.user.email) {
    const employee = await prisma.employee.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    ownEmployeeId = employee?.id || null;
  }

  const where: Record<string, unknown> = {};
  if (!canViewAll) {
    where.employeeId = ownEmployeeId || "__none__";
  } else if (employeeId) {
    where.employeeId = employeeId;
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    where.scheduledPayrollMonth = month;
  }
  if (payout) {
    where.payoutMode = payout;
  }
  if (settlement) {
    where.settlementStatus = settlement;
  }
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { projectRef: { contains: search, mode: "insensitive" as const } },
      { employee: { name: { contains: search, mode: "insensitive" as const } } },
      { employee: { email: { contains: search, mode: "insensitive" as const } } },
    ];
  }

  const [rows, total, employees] = await Promise.all([
    prisma.incentiveEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { employee: true },
      skip,
      take,
    }),
    prisma.incentiveEntry.count({ where }),
    prisma.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));
  const summary = rows.reduce(
    (acc, row) => {
      const amount = Number(row.amount || 0);
      acc.total += amount;
      if (String(row.status || "").toUpperCase() === "APPROVED") acc.approved += amount;
      if (String(row.status || "").toUpperCase().startsWith("PENDING")) acc.pending += amount;
      if (String(row.settlementStatus || "").toUpperCase() === "UNSETTLED") acc.unsettled += amount;
      if (String(row.payoutMode || "").toUpperCase() === "PAYROLL") acc.payroll += amount;
      return acc;
    },
    { total: 0, approved: 0, pending: 0, unsettled: 0, payroll: 0 },
  );

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Incentives</h1>
            <p className="mt-2 text-muted-foreground">Track project incentives and deductions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search employee or project..." />
            </div>
            <QuerySelect
              param="status"
              placeholder="All statuses"
              options={[
                { label: "Pending", value: "PENDING" },
                { label: "Approved", value: "APPROVED" },
                { label: "Rejected", value: "REJECTED" },
              ]}
            />
            <QuerySelect
              param="payout"
              placeholder="All payout modes"
              options={[
                { label: "Payroll", value: "PAYROLL" },
                { label: "Wallet", value: "WALLET" },
              ]}
            />
            <QuerySelect
              param="settlement"
              placeholder="All settlement"
              options={[
                { label: "Unsettled", value: "UNSETTLED" },
                { label: "Settled", value: "SETTLED" },
              ]}
            />
            <QuerySelect
              param="employeeId"
              placeholder="All employees"
              options={employees.map((row) => ({
                value: row.id,
                label: `${employeeCodeFromId(row.id)} - ${row.name}`,
              }))}
            />
            <Link
              href="/help#feature-incentives"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Help
            </Link>
            {canEdit ? <IncentiveCreateButton employees={employees} /> : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <form action="/incentives" className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-2">
            <label htmlFor="month-filter" className="text-xs text-muted-foreground">Month</label>
            <input
              id="month-filter"
              name="month"
              type="month"
              defaultValue={month}
              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            />
            <button className="rounded border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-accent" type="submit">
              Apply
            </button>
          </form>
          {month ? <span className="rounded-full border px-2 py-1">Month: {month}</span> : null}
          {payout ? <span className="rounded-full border px-2 py-1">Payout: {payout}</span> : null}
          {settlement ? <span className="rounded-full border px-2 py-1">Settlement: {settlement}</span> : null}
          {status ? <span className="rounded-full border px-2 py-1">Status: {status}</span> : null}
          {employeeId ? <span className="rounded-full border px-2 py-1">Employee filter active</span> : null}
          {month || payout || settlement || status || employeeId ? (
            <Link href="/incentives" className="underline underline-offset-2">
              Clear filters
            </Link>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
            <div className="text-xs text-sky-700 dark:text-sky-300">Total (Page)</div>
            <div className="text-lg font-semibold text-sky-900 dark:text-sky-100">{formatMoney(summary.total)}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="text-xs text-emerald-700 dark:text-emerald-300">Approved</div>
            <div className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">{formatMoney(summary.approved)}</div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="text-xs text-amber-700 dark:text-amber-300">Pending</div>
            <div className="text-lg font-semibold text-amber-900 dark:text-amber-100">{formatMoney(summary.pending)}</div>
          </div>
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
            <div className="text-xs text-violet-700 dark:text-violet-300">Unsettled</div>
            <div className="text-lg font-semibold text-violet-900 dark:text-violet-100">{formatMoney(summary.unsettled)}</div>
          </div>
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
            <div className="text-xs text-indigo-700 dark:text-indigo-300">Payroll Payout</div>
            <div className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">{formatMoney(summary.payroll)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <details className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-primary">
            Help: Incentive Flow
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Create incentive against completed project with amount or formula basis.</li>
            <li>Approve incentive after commercial confirmation.</li>
            <li>`PAYROLL` payout remains unsettled until payroll settlement marks it paid.</li>
            <li>`WALLET` payout settles on approval through wallet credit flow.</li>
            <li>Use employee and project filters to verify due and settled variable pay.</li>
          </ol>
        </details>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Employee</th>
                <th className="py-2">Project</th>
                <th className="py-2">Payout</th>
                <th className="py-2">Payroll Month</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Settlement</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">
                    {row.employee ? (
                      <Link href={`/employees/${row.employeeId}`} className="font-medium text-primary underline underline-offset-2">
                        {employeeCodeFromId(row.employeeId)} - {row.employee.name}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2">{row.projectRef || "-"}</td>
                  <td className="py-2">{row.payoutMode || "-"}</td>
                  <td className="py-2">{row.payoutMode === "PAYROLL" ? row.scheduledPayrollMonth || "-" : "-"}</td>
                  <td className="py-2">{formatMoney(Number(row.amount))}</td>
                  <td className="py-2">{row.settlementStatus || "-"}</td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2">
                    {canEdit ? (
                      <IncentiveActions
                        incentive={{
                          id: row.id,
                          employeeId: row.employeeId,
                          projectRef: row.projectRef,
                          earningDate: row.earningDate?.toISOString() || null,
                          scheduledPayrollMonth: row.scheduledPayrollMonth,
                          dueDate: row.dueDate?.toISOString() || null,
                          formulaType: row.formulaType,
                          basisAmount: row.basisAmount ? Number(row.basisAmount) : null,
                          percent: row.percent ? Number(row.percent) : null,
                          payoutMode: row.payoutMode,
                          amount: Number(row.amount),
                          reason: row.reason,
                          status: row.status,
                        }}
                        employees={employees}
                        canApprove={canApprove}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <MobileCard
              key={row.id}
              title={`${employeeCodeFromId(row.employeeId)} - ${row.employee?.name || "Employee"}`}
              subtitle={new Date(row.createdAt).toLocaleDateString()}
              fields={[
                { label: "Project", value: row.projectRef || "-" },
                { label: "Payout", value: row.payoutMode || "-" },
                { label: "Payroll Month", value: row.payoutMode === "PAYROLL" ? row.scheduledPayrollMonth || "-" : "-" },
                { label: "Amount", value: formatMoney(Number(row.amount)) },
                { label: "Settlement", value: row.settlementStatus || "-" },
                { label: "Status", value: row.status },
              ]}
              actions={
                canEdit ? (
                  <IncentiveActions
                    incentive={{
                      id: row.id,
                      employeeId: row.employeeId,
                      projectRef: row.projectRef,
                      earningDate: row.earningDate?.toISOString() || null,
                      scheduledPayrollMonth: row.scheduledPayrollMonth,
                      dueDate: row.dueDate?.toISOString() || null,
                      formulaType: row.formulaType,
                      basisAmount: row.basisAmount ? Number(row.basisAmount) : null,
                      percent: row.percent ? Number(row.percent) : null,
                      payoutMode: row.payoutMode,
                      amount: Number(row.amount),
                      reason: row.reason,
                      status: row.status,
                    }}
                    employees={employees}
                    canApprove={canApprove}
                  />
                ) : null
              }
            />
          ))}
        </div>

        {rows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No incentives found.</div>
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <PaginationControls totalPages={totalPages} currentPage={page} />
          </div>
        )}
      </div>
    </div>
  );
}
