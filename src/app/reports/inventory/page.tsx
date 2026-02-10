import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
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
        <h1 className="text-2xl font-semibold">Inventory Report</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");
  const canExport = await requirePermission(session.user.id, "reports.export");

  const params = searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  const ledgerItemIds =
    !canViewAll && !canViewTeam && canViewOwn
      ? await prisma.inventoryLedger.findMany({
          where: { userId: session.user.id },
          select: { itemId: true },
        })
      : [];
  const scopedItemIds =
    !canViewAll && !canViewTeam && canViewOwn
      ? Array.from(new Set(ledgerItemIds.map((entry) => entry.itemId)))
      : null;

  const baseWhere: Record<string, unknown> =
    scopedItemIds && scopedItemIds.length > 0 ? { id: { in: scopedItemIds } } : scopedItemIds ? { id: "__none__" } : {};

  const where = search
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { category: { contains: search, mode: "insensitive" as const } },
              { sku: { contains: search, mode: "insensitive" as const } },
            ],
          },
        ],
      }
    : baseWhere;

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({ where, orderBy: { name: "asc" }, skip, take }),
    prisma.inventoryItem.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / take));

  const totalValue = canViewCost
    ? items.reduce((sum, item) => sum + Number(item.totalValue || 0), 0)
    : 0;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Inventory Report</h1>
            <p className="mt-2 text-muted-foreground">Stock valuation and low stock view.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search inventory..." />
            </div>
            {canExport ? (
              <a
                href="/api/reports/inventory/export"
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
          <div className="text-sm text-muted-foreground">Items</div>
          <div className="mt-2 text-xl font-semibold">{total}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Low Stock</div>
          <div className="mt-2 text-xl font-semibold">
            {items.filter((item) => Number(item.quantity) <= Number(item.minStock)).length}
          </div>
        </div>
        {canViewCost ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground">Total Stock Value</div>
            <div className="mt-2 text-xl font-semibold">{formatMoney(totalValue)}</div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Item</th>
                <th className="py-2">Category</th>
                <th className="py-2">Qty</th>
                {canViewCost ? <th className="py-2">Avg Cost</th> : null}
                {canViewCost ? <th className="py-2">Last Purchase</th> : null}
                {canViewCost ? <th className="py-2">Total Value</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLow = Number(item.quantity) <= Number(item.minStock);
                return (
                  <tr key={item.id} className={`border-b ${isLow ? "bg-amber-50/60" : ""}`}>
                    <td className="py-2">{item.name}</td>
                    <td className="py-2">{item.category}</td>
                    <td className="py-2">
                      {Number(item.quantity)}{" "}
                      {isLow ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Low
                        </span>
                      ) : null}
                    </td>
                    {canViewCost ? <td className="py-2">{formatMoney(Number(item.unitCost))}</td> : null}
                    {canViewCost ? (
                      <td className="py-2">
                        {formatMoney(Number(item.lastPurchasePrice ?? item.unitCost))}
                      </td>
                    ) : null}
                    {canViewCost ? <td className="py-2">{formatMoney(Number(item.totalValue))}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No inventory items found.</div>
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
