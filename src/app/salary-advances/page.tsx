import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import PaginationControls from "@/components/PaginationControls";
import SearchInput from "@/components/SearchInput";
import { SalaryAdvanceCreateButton } from "@/components/SalaryAdvanceCreateButton";
import { SalaryAdvanceActions } from "@/components/SalaryAdvanceActions";
import { StatusBadge } from "@/components/StatusBadge";
import { MobileCard } from "@/components/MobileCard";
import { findEmployeeByEmailInsensitive } from "@/lib/identity";
import DateRangePicker from "@/components/DateRangePicker";
import QuerySelect from "@/components/QuerySelect";
import Link from "next/link";

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
}

function ageDays(date: Date) {
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default async function SalaryAdvancesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; from?: string; to?: string; status?: string; employeeId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }
  const params = await searchParams;

  const canViewAll = await requirePermission(session.user.id, "salary_advance.view_all");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  const canEdit = await requirePermission(session.user.id, "salary_advance.edit");
  const canApprove = await requirePermission(session.user.id, "salary_advance.approve");
  if (!canViewAll && !canViewOwn && !canEdit) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Salary Advances</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to salary advances.</p>
      </div>
    );
  }

  const search = (params.search || "").trim();
  const status = (params.status || "").trim();
  const employeeId = (params.employeeId || "").trim();
  const from = params.from;
  const to = params.to;
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let ownEmployeeId: string | null = null;
  if (!canViewAll && session.user.email) {
    const employee = await findEmployeeByEmailInsensitive(session.user.email, {
      select: { id: true },
    });
    ownEmployeeId = employee?.id || null;
  }

  const where: import("@prisma/client").Prisma.SalaryAdvanceWhereInput = {};
  if (!canViewAll) {
    where.employeeId = ownEmployeeId || "__none__";
  } else if (employeeId) {
    where.employeeId = employeeId;
  }
  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { employee: { name: { contains: search, mode: "insensitive" } } },
      { employee: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status) {
    where.status = status;
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.createdAt = range;
  }

  const [rows, allMatchingRows, total, employees] = await Promise.all([
    prisma.salaryAdvance.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: { employee: true },
      skip,
      take,
    }),
    prisma.salaryAdvance.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: { employee: true },
    }),
    prisma.salaryAdvance.count({ where }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));
  const totalIssued = allMatchingRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const totalOutstanding = allMatchingRows.reduce((sum, row) => sum + Number(row.outstandingAmount || 0), 0);
  const openRows = allMatchingRows.filter((row) => Number(row.outstandingAmount || 0) > 0).length;
  const overdueRows = allMatchingRows.filter((row) => Number(row.outstandingAmount || 0) > 0 && ageDays(new Date(row.createdAt)) > 30).length;
  const averageAdvance = allMatchingRows.length > 0 ? totalIssued / allMatchingRows.length : 0;

  const monthlySummaryMap = new Map<string, { month: string; issued: number; outstanding: number; rows: number }>();
  allMatchingRows.forEach((row) => {
    const month = monthLabel(new Date(row.createdAt));
    const entry = monthlySummaryMap.get(month) || { month, issued: 0, outstanding: 0, rows: 0 };
    entry.rows += 1;
    entry.issued += Number(row.amount);
    entry.outstanding += Number(row.outstandingAmount || 0);
    monthlySummaryMap.set(month, entry);
  });
  const monthlySummary = Array.from(monthlySummaryMap.values()).sort(
    (a, b) => new Date(`01 ${b.month}`).getTime() - new Date(`01 ${a.month}`).getTime(),
  );

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Salary Advances</h1>
            <p className="mt-2 text-muted-foreground">Advance issue, recovery, aging, and outstanding analysis.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:flex-wrap">
            <DateRangePicker />
            <div className="w-full sm:min-w-[220px]">
              <SearchInput placeholder="Search employee or reason..." />
            </div>
            {canViewAll ? (
              <QuerySelect
                param="employeeId"
                placeholder="All employees"
                options={employees.map((row) => ({ value: row.id, label: `${row.name} (${row.email})` }))}
                className="min-w-[220px] rounded-md border px-3 py-2 text-sm"
              />
            ) : null}
            <QuerySelect
              param="status"
              placeholder="All statuses"
              options={[
                { label: "Pending", value: "PENDING" },
                { label: "Approved", value: "APPROVED" },
                { label: "Paid", value: "PAID" },
                { label: "Partially Recovered", value: "PARTIALLY_RECOVERED" },
                { label: "Recovered", value: "RECOVERED" },
                { label: "Rejected", value: "REJECTED" },
              ]}
            />
            <Link
              href={`/api/salary-advances/export?${new URLSearchParams({
                ...(search ? { search } : {}),
                ...(status ? { status } : {}),
                ...(employeeId ? { employeeId } : {}),
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
              }).toString()}`}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Export CSV
            </Link>
            {canEdit ? <SalaryAdvanceCreateButton employees={employees} /> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Issued Total</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totalIssued)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Outstanding Total</div>
          <div className="mt-2 text-xl font-semibold text-rose-700">{formatMoney(totalOutstanding)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Open Rows</div>
          <div className="mt-2 text-xl font-semibold">{openRows}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Overdue 30+ Days</div>
          <div className="mt-2 text-xl font-semibold text-amber-700">{overdueRows}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Average Advance</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(averageAdvance)}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Monthly Summary</h2>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Month</th>
                <th className="py-2">Rows</th>
                <th className="py-2">Issued</th>
                <th className="py-2">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((row) => (
                <tr key={row.month} className="border-b">
                  <td className="py-2 font-medium">{row.month}</td>
                  <td className="py-2">{row.rows}</td>
                  <td className="py-2">{formatMoney(row.issued)}</td>
                  <td className="py-2">{formatMoney(row.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {monthlySummary.length === 0 ? <div className="mt-4 text-sm text-muted-foreground">No advances found for the current filter set.</div> : null}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Employee</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Outstanding</th>
                <th className="py-2">Age</th>
                <th className="py-2">Recovery</th>
                <th className="py-2">Reason</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">{row.employee?.name || row.employee?.email || "-"}</td>
                  <td className="py-2">{formatMoney(Number(row.amount))}</td>
                  <td className="py-2">{formatMoney(Number(row.outstandingAmount || 0))}</td>
                  <td className="py-2">{ageDays(new Date(row.createdAt))} day(s)</td>
                  <td className="py-2">{row.recoveryMode}</td>
                  <td className="py-2">{row.reason}</td>
                  <td className="py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-2">
                    {canEdit ? (
                      <SalaryAdvanceActions
                        advance={{
                          id: row.id,
                          employeeId: row.employeeId,
                          amount: Number(row.amount),
                          recoveryMode: row.recoveryMode,
                          installmentAmount: row.installmentAmount ? Number(row.installmentAmount) : null,
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
              title={row.employee?.name || row.employee?.email || "-"}
              subtitle={row.reason}
              fields={[
                { label: "Date", value: new Date(row.createdAt).toLocaleDateString() },
                { label: "Amount", value: formatMoney(Number(row.amount)) },
                { label: "Outstanding", value: formatMoney(Number(row.outstandingAmount || 0)) },
                { label: "Age", value: `${ageDays(new Date(row.createdAt))} day(s)` },
                { label: "Recovery", value: row.recoveryMode },
                { label: "Status", value: <StatusBadge status={row.status} /> },
              ]}
              actions={
                canEdit ? (
                  <SalaryAdvanceActions
                    advance={{
                      id: row.id,
                      employeeId: row.employeeId,
                      amount: Number(row.amount),
                      recoveryMode: row.recoveryMode,
                      installmentAmount: row.installmentAmount ? Number(row.installmentAmount) : null,
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
          <div className="text-center py-8 text-muted-foreground">No salary advances found.</div>
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
