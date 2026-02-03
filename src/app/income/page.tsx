import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MobileCard } from "@/components/MobileCard";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
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
  const canExport = canViewAll || canViewOwn;

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let entries = [];
  let total = 0;
  try {
    const baseWhere = canViewAll ? {} : canViewOwn ? { addedById: userId } : { id: "__none__" };
    const where = search
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                { source: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
                { project: { contains: search, mode: "insensitive" } },
                { status: { contains: search, mode: "insensitive" } },
              ],
            },
          ],
        }
      : baseWhere;

    const [entriesResult, totalResult] = await Promise.all([
      prisma.income.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.income.count({ where }),
    ]);
    entries = entriesResult;
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
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search income..." />
            </div>
            {canExport ? (
              <Link
                href="/api/income/export"
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Export CSV
              </Link>
            ) : null}
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
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-2">{entry.source}</td>
                  <td className="py-2">{entry.category}</td>
                  <td className="py-2">{formatMoney(Number(entry.amount))}</td>
                  <td className="py-2">{entry.status}</td>
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
                { label: "Status", value: entry.status },
                { label: "Date", value: new Date(entry.date).toLocaleDateString() },
              ]}
            />
          ))}
        </div>

        {entries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No income entries found.</div>
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
