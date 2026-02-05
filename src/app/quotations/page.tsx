import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { CreateProjectFromQuoteButton } from "@/components/CreateProjectFromQuoteButton";
import Link from "next/link";
import PaginationControls from "@/components/PaginationControls";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "quotations.view_all");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Quotations</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to quotations.</p>
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const query = (params.q || "").trim();
  const status = (params.status || "").trim();
  const take = 25;
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = {};
  if (query) {
    where.OR = [
      { quoteNumber: { contains: query, mode: "insensitive" as const } },
      { clientName: { contains: query, mode: "insensitive" as const } },
      { projectRef: { contains: query, mode: "insensitive" as const } },
    ];
  }
  if (status) {
    where.status = status;
  }

  const [quotations, total, statuses] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { voucherDate: "desc" },
      include: { client: true, _count: { select: { lineItems: true } } },
      skip,
      take,
    }),
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({
      select: { status: true },
      distinct: ["status"],
      where: { status: { not: null } },
      orderBy: { status: "asc" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Quotations</h1>
        <p className="mt-2 text-muted-foreground">Imported from Refrens.</p>
      </div>

      <form className="rounded-xl border bg-card p-6 shadow-sm" method="get">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium">Search</label>
            <input
              name="q"
              defaultValue={query}
              placeholder="Quote #, client, project"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="text-sm font-medium">Status</label>
            <select name="status" defaultValue={status} className="mt-1 w-full rounded-md border px-3 py-2">
              <option value="">All</option>
              {statuses.map((row) => (
                <option key={row.status || "unknown"} value={row.status || ""}>
                  {row.status || "Unknown"}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded-md bg-black px-4 py-2 text-white">Apply</button>
        </div>
      </form>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Quote #</th>
                <th className="py-2">Client</th>
                <th className="py-2">Project Ref</th>
                <th className="py-2">Date</th>
                <th className="py-2">Status</th>
                <th className="py-2">Total</th>
                <th className="py-2">Items</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((quote) => (
                <tr key={quote.id} className="border-b">
                  <td className="py-2 font-medium">
                    <Link className="text-primary hover:underline" href={`/quotations/${quote.id}`}>
                      {quote.quoteNumber}
                    </Link>
                  </td>
                  <td className="py-2">{quote.client?.name || quote.clientName || "-"}</td>
                  <td className="py-2">{quote.projectRef || "-"}</td>
                  <td className="py-2">
                    {quote.voucherDate ? new Date(quote.voucherDate).toLocaleDateString() : "-"}
                  </td>
                  <td className="py-2">{quote.status || "-"}</td>
                  <td className="py-2">{formatMoney(Number(quote.totalAmount || 0))}</td>
                  <td className="py-2">{quote._count.lineItems}</td>
                  <td className="py-2">
                    <CreateProjectFromQuoteButton quoteId={quote.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {quotations.map((quote) => (
            <div key={quote.id} className="border rounded-lg p-4 space-y-2">
              <div className="font-semibold">
                <Link className="text-primary hover:underline" href={`/quotations/${quote.id}`}>
                  {quote.quoteNumber}
                </Link>
              </div>
              <div className="text-sm">Client: {quote.client?.name || quote.clientName || "-"}</div>
              <div className="text-sm">Project Ref: {quote.projectRef || "-"}</div>
              <div className="text-sm">
                Date: {quote.voucherDate ? new Date(quote.voucherDate).toLocaleDateString() : "-"}
              </div>
              <div className="text-sm">Status: {quote.status || "-"}</div>
              <div className="text-sm">Total: {formatMoney(Number(quote.totalAmount || 0))}</div>
              <div className="text-sm">Items: {quote._count.lineItems}</div>
              <CreateProjectFromQuoteButton quoteId={quote.id} />
            </div>
          ))}
        </div>

        {quotations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No quotations found.</div>
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
