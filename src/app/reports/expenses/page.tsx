import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import DateRangePicker from "@/components/DateRangePicker";
import QuerySelect from "@/components/QuerySelect";
import PaginationControls from "@/components/PaginationControls";

export default async function ExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; from?: string; to?: string; expenseType?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Expense Report</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const expenseType = (params.expenseType || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;
  const from = params.from;
  const to = params.to;

  const where: Record<string, unknown> = {
    status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
  };
  if (expenseType) where.expenseType = expenseType;
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.date = range;
  }
  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { project: { contains: search, mode: "insensitive" } },
    ];
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take,
      select: {
        id: true,
        date: true,
        category: true,
        description: true,
        expenseType: true,
        amount: true,
        approvedAmount: true,
        status: true,
        project: true,
      },
    }),
    prisma.expense.count({ where }),
  ]);

  const totals = expenses.reduce(
    (acc, exp) => {
      const usedAmount = exp.status === "PARTIALLY_APPROVED" && exp.approvedAmount
        ? Number(exp.approvedAmount)
        : Number(exp.amount);
      acc.total += usedAmount;
      acc.byCategory[exp.category] = (acc.byCategory[exp.category] || 0) + usedAmount;
      return acc;
    },
    { total: 0, byCategory: {} as Record<string, number> }
  );

  const categoryRows = Object.entries(totals.byCategory)
    .sort((a, b) => b[1] - a[1]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Expense Report</h1>
            <p className="mt-2 text-muted-foreground">Approved expenses by category and project.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <SearchInput placeholder="Search expenses..." />
            <QuerySelect
              param="expenseType"
              placeholder="All types"
              options={[
                { label: "Company", value: "COMPANY" },
                { label: "Owner Personal", value: "OWNER_PERSONAL" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Approved Expenses</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.total)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Categories</div>
          <div className="mt-2 text-xl font-semibold">{categoryRows.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Records</div>
          <div className="mt-2 text-xl font-semibold">{total}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">By Category</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {categoryRows.map(([category, amount]) => (
            <div key={category} className="flex items-center justify-between rounded-md border p-3">
              <div className="font-medium">{category}</div>
              <div className="text-sm font-semibold">{formatMoney(amount)}</div>
            </div>
          ))}
          {categoryRows.length === 0 && (
            <div className="text-muted-foreground">No expenses found for this period.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Category</th>
                <th className="py-2">Project</th>
                <th className="py-2">Type</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => {
                const usedAmount = exp.status === "PARTIALLY_APPROVED" && exp.approvedAmount
                  ? Number(exp.approvedAmount)
                  : Number(exp.amount);
                return (
                  <tr key={exp.id} className="border-b">
                    <td className="py-2">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="py-2">{exp.category}</td>
                    <td className="py-2">{exp.project || "-"}</td>
                    <td className="py-2">{exp.expenseType || "-"}</td>
                    <td className="py-2">{formatMoney(usedAmount)}</td>
                    <td className="py-2">{exp.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {expenses.length === 0 && (
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
