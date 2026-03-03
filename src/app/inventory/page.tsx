import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { InventoryTable } from "@/components/InventoryTable";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { PageCreateButton } from "@/components/PageCreateButton";
import { formatMoney } from "@/lib/format";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-2 text-muted-foreground">Please sign in.</p>
      </div>
    );
  }

  const canView = await requirePermission(session.user.id, "inventory.view");
  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");
  const canViewSelling = await requirePermission(session.user.id, "inventory.view_selling");
  const canAdjust = await requirePermission(session.user.id, "inventory.adjust");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to inventory.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let items: Array<{
    id: string;
    name: string;
    sku: string | null;
    category: string;
    quantity: number;
    unit: string;
    unitCost: number | null;
    lastPurchasePrice: number | null;
    sellingPrice: number | null;
    totalValue: number | null;
    minStock: number | null;
    reorderQty: number | null;
  }> = [];
  let total = 0;
  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
            { sku: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [itemsResult, totalResult] = await Promise.all([
      prisma.inventoryItem.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.inventoryItem.count({ where }),
    ]);
    items = itemsResult.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitCost: canViewCost ? Number(item.unitCost) : null,
      lastPurchasePrice: canViewCost ? Number(item.lastPurchasePrice ?? item.unitCost) : null,
      sellingPrice: canViewSelling ? Number(item.sellingPrice) : null,
      totalValue: canViewCost ? Number(item.totalValue) : null,
      minStock: item.minStock !== null ? Number(item.minStock) : null,
      reorderQty: item.reorderQty !== null ? Number(item.reorderQty) : null,
    }));
    total = totalResult;
  } catch (error) {
    console.error("Error fetching inventory items:", error);
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-2 text-muted-foreground">Error loading inventory data. Please try again later.</p>
      </div>
    );
  }
  const totalPages = Math.max(1, Math.ceil(total / take));
  const summary = items.reduce(
    (acc, item) => {
      const qty = Number(item.quantity || 0);
      acc.quantity += qty;
      if (item.totalValue != null) acc.value += Number(item.totalValue || 0);
      const minStock = Number(item.minStock || 0);
      if (minStock > 0 && qty <= minStock) acc.lowStock += 1;
      return acc;
    },
    { quantity: 0, value: 0, lowStock: 0 },
  );

  return (
    <div className="grid gap-6 overflow-x-hidden">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Inventory</h1>
            <p className="mt-2 text-muted-foreground">Inventory item list.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search inventory..." />
            </div>
            {canAdjust ? (
              <PageCreateButton label="Add Inventory" formType="inventory" queryBackedOpen />
            ) : null}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
            <div className="text-sm text-sky-700">Items</div>
            <div className="text-xl font-semibold text-sky-800">{items.length}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="text-sm text-emerald-700">Total Quantity</div>
            <div className="text-xl font-semibold text-emerald-800">{summary.quantity}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <div className="text-sm text-amber-700">Low Stock Items</div>
            <div className="text-xl font-semibold text-amber-800">{summary.lowStock}</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="text-sm text-indigo-700">Inventory Value</div>
            <div className="text-xl font-semibold text-indigo-800">
              {canViewCost ? formatMoney(summary.value) : "-"}
            </div>
          </div>
        </div>
      </div>

      <InventoryTable
        items={items}
        canViewCost={canViewCost}
        canViewSelling={canViewSelling}
        canAdjust={canAdjust}
      />

      {items.length === 0 && (
        <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground shadow-sm">
          <div>No inventory items found.</div>
          {canAdjust ? (
            <div className="mt-3">
              <PageCreateButton label="Add Inventory" formType="inventory" />
            </div>
          ) : null}
        </div>
      )}

      {totalPages > 1 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <PaginationControls totalPages={totalPages} currentPage={page} />
        </div>
      )}
    </div>
  );
}
