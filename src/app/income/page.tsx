import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MobileCard } from "@/components/MobileCard";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import QuerySelect from "@/components/QuerySelect";
import DateRangePicker from "@/components/DateRangePicker";
import { PageCreateButton } from "@/components/PageCreateButton";
import { IncomeActions } from "@/components/IncomeActions";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string; status?: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;

 if (!userId) {
     return (
     redirect("/login")
     );
   }

  const canViewAll = await requirePermission(userId, "income.view_all");
  const canViewOwn = await requirePermission(userId, "income.view_own");
  const canCreate = await requirePermission(userId, "income.add");
  const canEditAny = await requirePermission(userId, "income.edit");
  const canExport = canViewAll || canViewOwn;

  const params = searchParams;
  const search = (params.search || "").trim();
  const status = (params.status || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let entries: Array<{
    id: string;
    date: string;
    source: string;
    category: string;
    project: string | null;
    amount: number;
    status: string;
    paymentMode: string;
    invoiceId: string | null;
    remarks: string | null;
    addedById: string | null;
  }> = [];
  let total = 0;
  try {
    const baseWhere = canViewAll ? {} : canViewOwn ? { addedById: userId } : { id: "__none__" };
    const where: Record<string, unknown> = { ...baseWhere };
    if (search) {
      where.AND = [
        baseWhere,
        {
          OR: [
            { source: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
            { project: { contains: search, mode: "insensitive" as const } },
            { status: { contains: search, mode: "insensitive" as const } },
          ],
        },
      ];
    }
    if (status) {
      where.status = status;
    }

    const [entriesResult, totalResult] = await Promise.all([
      prisma.income.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.income.count({ where }),
    ]);
    entries = entriesResult.map((entry) => ({
      id: entry.id,
      date: entry.date.toISOString(),
      source: entry.source,
      category: entry.category,
      project: entry.project,
      amount: Number(entry.amount),
      status: entry.status,
      paymentMode: entry.paymentMode,
      invoiceId: entry.invoiceId,
      remarks: entry.remarks,
      addedById: entry.addedById,
    }));
    total = totalResult;
  } catch (error) {
    console.error("Error fetching income entries:", error);
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Income</h1>
        <p className="mt-2 text-muted-foreground">Error loading income data. Please try again later.</p>
      </div>
    );
  }
  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Income</h1>
            <p className="mt-2 text-muted-foreground">Income entries.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search income..." />
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
            {canExport ? (
              <Link
                href="/api/income/export"
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Export CSV
              </Link>
            ) : null}
            {canCreate ? <PageCreateButton label="Log Income" formType="income" /> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Source</th>
                <th className="py-2">Category</th>
                <th className="py-2">Project</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-2">{entry.source}</td>
                  <td className="py-2">{entry.category}</td>
                  <td className="py-2">{entry.project || "-"}</td>
                  <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                  <td className="py-2">{entry.status}</td>
                  <td className="py-2">
                    <IncomeActions entry={entry} canEditAny={canEditAny} currentUserId={userId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Cards */}
        <div className="md:hidden space-y-4">
          {entries.map((entry) => (
            <MobileCard
              key={entry.id}
              title={entry.source}
              subtitle={new Date(entry.date).toLocaleDateString()}
              fields={[
                { label: "Amount", value: formatMoney(Number(entry.amount)) },
                { label: "Category", value: entry.category },
                { label: "Project", value: entry.project || "-" },
                { label: "Status", value: entry.status },
                { label: "Date", value: new Date(entry.date).toLocaleDateString() },
              ]}
              actions={<IncomeActions entry={entry} canEditAny={canEditAny} currentUserId={userId} />}
            />
          ))}
        </div>

        {entries.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <div>No income entries found.</div>
            {canCreate ? <PageCreateButton label="Log Income" formType="income" /> : null}
          </div>
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
