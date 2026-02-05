import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import PaginationControls from "@/components/PaginationControls";
import DateRangePicker from "@/components/DateRangePicker";
import Link from "next/link";
import dynamic from "next/dynamic";

const InventoryLedgerActions = dynamic(
  () => import("@/components/InventoryLedgerActions").then((mod) => mod.InventoryLedgerActions),
  { ssr: false }
);

export default async function InventoryLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; type?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "inventory.view");
  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory Ledger</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to inventory.</p>
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const query = (params.q || "").trim();
  const type = (params.type || "").trim();
  const from = params.from;
  const to = params.to;
  const take = 25;
  const skip = (page - 1) * take;

  let itemFilterIds: string[] | undefined = undefined;
  if (query) {
    const items = await prisma.inventoryItem.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      select: { id: true },
    });
    itemFilterIds = items.map((item) => item.id);
  }

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (query) {
    where.OR = [
      { reference: { contains: query, mode: "insensitive" } },
      { project: { contains: query, mode: "insensitive" } },
      ...(itemFilterIds && itemFilterIds.length > 0 ? [{ itemId: { in: itemFilterIds } }] : []),
    ];
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.date = range;
  }

  const [entries, total] = await Promise.all([
    prisma.inventoryLedger.findMany({
      where,
      orderBy: { date: "desc" },
      include: { item: true },
      skip,
      take,
    }),
    prisma.inventoryLedger.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));
  const items = await prisma.inventoryItem.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Inventory Ledger</h1>
            <p className="mt-2 text-muted-foreground">Stock movement history.</p>
          </div>
          <InventoryLedgerActions items={items} canViewCost={canViewCost} />
        </div>
      </div>

      <form className="rounded-xl border bg-card p-6 shadow-sm" method="get">
        <div className="flex flex-wrap gap-3 items-end">
          <DateRangePicker />
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium">Search</label>
            <input
              name="q"
              defaultValue={query}
              placeholder="Item, project, reference"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="text-sm font-medium">Type</label>
            <select name="type" defaultValue={type} className="mt-1 w-full rounded-md border px-3 py-2">
              <option value="">All</option>
              <option value="PURCHASE">PURCHASE</option>
              <option value="SALE">SALE</option>
              <option value="PROJECT_ALLOCATION">PROJECT_ALLOCATION</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="RETURN">RETURN</option>
              <option value="TRANSFER">TRANSFER</option>
            </select>
          </div>
          <button className="rounded-md bg-black px-4 py-2 text-white">Apply</button>
          <Link
            href={`/api/inventory/ledger/export?${new URLSearchParams({
              ...(query ? { q: query } : {}),
              ...(type ? { type } : {}),
              ...(from ? { from } : {}),
              ...(to ? { to } : {}),
            }).toString()}`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Export CSV
          </Link>
        </div>
      </form>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Item</th>
                <th className="py-2">Type</th>
                <th className="py-2">Qty</th>
                {canViewCost ? <th className="py-2">Unit Cost</th> : null}
                {canViewCost ? <th className="py-2">Total</th> : null}
                <th className="py-2">Project</th>
                <th className="py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-2">{entry.item?.name || "-"}</td>
                  <td className="py-2">{entry.type}</td>
                  <td className="py-2">{Number(entry.quantity)}</td>
                  {canViewCost ? (
                    <td className="py-2">{formatMoney(Number(entry.unitCost))}</td>
                  ) : null}
                  {canViewCost ? (
                    <td className="py-2">{formatMoney(Number(entry.total))}</td>
                  ) : null}
                  <td className="py-2">{entry.project || "-"}</td>
                  <td className="py-2">{entry.reference || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="border rounded-lg p-4 text-sm space-y-1">
              <div className="font-semibold">{entry.item?.name || "-"}</div>
              <div>Date: {new Date(entry.date).toLocaleDateString()}</div>
              <div>Type: {entry.type}</div>
              <div>Qty: {Number(entry.quantity)}</div>
              {canViewCost ? (
                <div>Unit Cost: {formatMoney(Number(entry.unitCost))}</div>
              ) : null}
              {canViewCost ? (
                <div>Total: {formatMoney(Number(entry.total))}</div>
              ) : null}
              <div>Project: {entry.project || "-"}</div>
              <div>Ref: {entry.reference || "-"}</div>
            </div>
          ))}
        </div>

        {entries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No inventory movements found.</div>
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
