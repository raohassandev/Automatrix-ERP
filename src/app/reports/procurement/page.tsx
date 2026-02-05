import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import DateRangePicker from "@/components/DateRangePicker";
import QueryInput from "@/components/QueryInput";
import { resolveProjectId } from "@/lib/projects";

export default async function ProcurementReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    from?: string;
    to?: string;
    project?: string;
    vendor?: string;
  }>;
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
        <h1 className="text-2xl font-semibold">Procurement Report</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;
  const from = params.from;
  const to = params.to;
  const projectFilter = (params.project || "").trim();
  const vendorFilter = (params.vendor || "").trim();

  const canExport = await requirePermission(session.user.id, "reports.export");
  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (projectFilter) exportParams.set("project", projectFilter);
  if (vendorFilter) exportParams.set("vendor", vendorFilter);
  const exportQuery = exportParams.toString();

  const expenseWhere: Record<string, unknown> = {
    status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
    category: { contains: "material", mode: "insensitive" as const },
  };
  if (projectFilter) {
    const resolvedProject = await resolveProjectId(projectFilter);
    const projectValues = [projectFilter];
    if (resolvedProject && resolvedProject !== projectFilter) {
      projectValues.push(resolvedProject);
    }
    expenseWhere.project = { in: projectValues };
  }
  if (!canViewAll && !canViewTeam) {
    expenseWhere.submittedById = session.user.id;
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    expenseWhere.date = range;
  }
  if (search) {
    expenseWhere.OR = [
      { description: { contains: search, mode: "insensitive" as const } },
      { category: { contains: search, mode: "insensitive" as const } },
      { project: { contains: search, mode: "insensitive" as const } },
    ];
  }

  const ledgerWhere: Record<string, unknown> = { type: "PURCHASE" };
  if (projectFilter) {
    const resolvedProject = await resolveProjectId(projectFilter);
    const projectValues = [projectFilter];
    if (resolvedProject && resolvedProject !== projectFilter) {
      projectValues.push(resolvedProject);
    }
    ledgerWhere.project = { in: projectValues };
  }
  if (!canViewAll && !canViewTeam) {
    ledgerWhere.userId = session.user.id;
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    ledgerWhere.date = range;
  }
  if (search) {
    ledgerWhere.OR = [
      { reference: { contains: search, mode: "insensitive" as const } },
      { project: { contains: search, mode: "insensitive" as const } },
    ];
  }

  const [expenses, expensesTotal, ledgerEntries, ledgerTotal, totalExpenseCount, totalLedgerCount] =
    await Promise.all([
      prisma.expense.findMany({
        where: expenseWhere,
        orderBy: { date: "desc" },
        skip,
        take,
        select: {
          id: true,
          date: true,
          description: true,
          category: true,
          amount: true,
          approvedAmount: true,
          status: true,
          project: true,
        },
      }),
      prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true, approvedAmount: true } }),
      prisma.inventoryLedger.findMany({
        where: ledgerWhere,
        orderBy: { date: "desc" },
        skip,
        take,
        include: { item: { select: { name: true, unit: true } } },
      }),
      prisma.inventoryLedger.aggregate({ where: ledgerWhere, _sum: { total: true } }),
      prisma.expense.count({ where: expenseWhere }),
      prisma.inventoryLedger.count({ where: ledgerWhere }),
    ]);

  const expenseSum = Number(expensesTotal._sum.approvedAmount || expensesTotal._sum.amount || 0);
  const ledgerSum = Number(ledgerTotal._sum.total || 0);
  const totalPages = Math.max(1, Math.ceil(Math.max(totalExpenseCount, totalLedgerCount) / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Procurement Report</h1>
            <p className="mt-2 text-muted-foreground">
              Material purchases and stock-in activity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search procurement..." />
            </div>
            <div className="min-w-[200px]">
              <QueryInput param="project" placeholder="Filter project..." />
            </div>
            <div className="min-w-[200px]">
              <QueryInput param="vendor" placeholder="Filter vendor..." />
            </div>
            {canExport ? (
              <>
                <a
                  href={`/api/reports/procurement/export?type=expenses${exportQuery ? `&${exportQuery}` : ""}`}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Export Expenses
                </a>
                <a
                  href={`/api/reports/procurement/export?type=ledger${exportQuery ? `&${exportQuery}` : ""}`}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Export Stock-in
                </a>
                <a
                  href={`/api/reports/procurement/po-export${exportQuery ? `?${exportQuery}` : ""}`}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Export POs
                </a>
                <a
                  href={`/api/reports/procurement/grn-export${exportQuery ? `?${exportQuery}` : ""}`}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Export GRNs
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Approved Material Spend</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(expenseSum)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Stock-in Value</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(ledgerSum)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Records</div>
          <div className="mt-2 text-xl font-semibold">
            {Math.max(totalExpenseCount, totalLedgerCount)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Material Expenses</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Project</th>
                  <th className="py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => {
                  const usedAmount =
                    exp.status === "PARTIALLY_APPROVED" && exp.approvedAmount
                      ? Number(exp.approvedAmount)
                      : Number(exp.amount);
                  return (
                    <tr key={exp.id} className="border-b">
                      <td className="py-2">{new Date(exp.date).toLocaleDateString()}</td>
                      <td className="py-2">{exp.category}</td>
                      <td className="py-2">{exp.project || "-"}</td>
                      <td className="py-2">{formatMoney(usedAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {expenses.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No material expenses found.</div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Inventory Purchases</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th className="py-2">Item</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="py-2">{entry.item?.name || "Item"}</td>
                    <td className="py-2">
                      {Number(entry.quantity)} {entry.item?.unit || ""}
                    </td>
                    <td className="py-2">{formatMoney(Number(entry.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ledgerEntries.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">No inventory purchases found.</div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-2">
          <PaginationControls totalPages={totalPages} currentPage={page} />
        </div>
      )}
    </div>
  );
}
