import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { LedgerClient } from "./LedgerClient";

export default async function InventoryLedgerPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; type?: string; from?: string; to?: string; warehouseId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "inventory.view");
  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");
  const canAdjust = await requirePermission(session.user.id, "inventory.adjust");
  const canRequest = await requirePermission(session.user.id, "inventory.request");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Inventory Ledger</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to inventory.</p>
      </div>
    );
  }

  // NOTE: searchParams is not a promise here, it's an object.
  // The error was likely due to how it was passed to the client component.
  // We pass the plain object directly.
  const page = Math.max(parseInt(searchParams.page || "1", 10), 1);
  const query = (searchParams.q || "").trim();
  const type = (searchParams.type || "").trim();
  const warehouseId = (searchParams.warehouseId || "").trim();
  const from = searchParams.from;
  const to = searchParams.to;
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
  if (warehouseId) where.warehouseId = warehouseId;
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
      include: { item: true, warehouse: true },
      skip,
      take,
    }),
    prisma.inventoryLedger.count({ where }),
  ]);

  const items = await prisma.inventoryItem.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });

  const serializedEntries = entries.map((entry) => ({
    id: entry.id,
    date: entry.date,
    type: entry.type,
    quantity: Number(entry.quantity),
    unitCost: Number(entry.unitCost),
    total: Number(entry.total),
    project: entry.project,
    reference: entry.reference,
    warehouseName: entry.warehouse?.name || null,
    item: entry.item ? { name: entry.item.name } : null,
  }));

  return (
    <LedgerClient
      entries={serializedEntries}
      total={total}
      items={items}
      warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
      canViewCost={canViewCost}
      canAdjust={canAdjust}
      canRequest={canRequest}
      searchParams={searchParams}
    />
  );
}
