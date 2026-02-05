import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import DateRangePicker from "@/components/DateRangePicker";
import PaginationControls from "@/components/PaginationControls";

type ExpenseRow = {
  submittedById: string | null;
  amount: number;
  approvedAmount: number | null;
  status: string;
  project: string | null;
  description: string;
  category: string;
  submittedBy: { name: string | null; email: string } | null;
};

export default async function EmployeeExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  const canExport = await requirePermission(session.user.id, "reports.export");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employee Expense Summary</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim().toLowerCase();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const from = params.from;
  const to = params.to;

  const where: Record<string, unknown> = {
    status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
  };
  if (!canViewAll && !canViewTeam) {
    where.submittedById = session.user.id;
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.date = range;
  }

  const expenses = await prisma.expense.findMany({
    where,
    select: {
      submittedById: true,
      amount: true,
      approvedAmount: true,
      status: true,
      project: true,
      description: true,
      category: true,
      submittedBy: { select: { name: true, email: true } },
    },
    orderBy: { date: "desc" },
  });

  const filtered = search
    ? expenses.filter((exp) => {
        const haystack = [
          exp.submittedBy?.name,
          exp.submittedBy?.email,
          exp.project,
          exp.description,
          exp.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
    : expenses;

  const aggregated = new Map<
    string,
    { name: string; email: string; total: number; count: number }
  >();

  filtered.forEach((exp: ExpenseRow) => {
    const key = exp.submittedById || "unknown";
    const usedAmount =
      exp.status === "PARTIALLY_APPROVED" && exp.approvedAmount !== null
        ? Number(exp.approvedAmount)
        : Number(exp.amount);
    const entry = aggregated.get(key) || {
      name: exp.submittedBy?.name || "Unknown",
      email: exp.submittedBy?.email || "unknown",
      total: 0,
      count: 0,
    };
    entry.total += usedAmount;
    entry.count += 1;
    aggregated.set(key, entry);
  });

  const rows = Array.from(aggregated.values()).sort((a, b) => b.total - a.total);
  const totalPages = Math.max(1, Math.ceil(rows.length / take));
  const pageStart = (page - 1) * take;
  const pageRows = rows.slice(pageStart, pageStart + take);

  const totalExpenses = rows.reduce((sum, row) => sum + row.total, 0);
  const totalEmployees = rows.length;
  const totalRecords = filtered.length;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Employee Expense Summary</h1>
            <p className="mt-2 text-muted-foreground">
              Approved expenses grouped by employee.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search employee, project, category..." />
            </div>
            {canExport ? (
              <a
                href={`/api/reports/employee-expenses/export?${new URLSearchParams({
                  ...(search ? { search } : {}),
                  ...(from ? { from } : {}),
                  ...(to ? { to } : {}),
                }).toString()}`}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Export CSV
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Approved Expenses</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totalExpenses)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Employees</div>
          <div className="mt-2 text-xl font-semibold">{totalEmployees}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Records</div>
          <div className="mt-2 text-xl font-semibold">{totalRecords}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Employee</th>
                <th className="py-2">Email</th>
                <th className="py-2">Records</th>
                <th className="py-2">Total Approved</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={`${row.email}-${row.name}`} className="border-b">
                  <td className="py-2 font-medium">{row.name}</td>
                  <td className="py-2">{row.email}</td>
                  <td className="py-2">{row.count}</td>
                  <td className="py-2">{formatMoney(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {pageRows.map((row) => (
            <div key={`${row.email}-${row.name}`} className="border rounded-lg p-4 text-sm space-y-1">
              <div className="font-semibold">{row.name}</div>
              <div>Email: {row.email}</div>
              <div>Records: {row.count}</div>
              <div>Total: {formatMoney(row.total)}</div>
            </div>
          ))}
        </div>

        {pageRows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No expenses found.</div>
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
