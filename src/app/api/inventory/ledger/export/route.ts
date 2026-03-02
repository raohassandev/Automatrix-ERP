import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) =>
      row
        .map((field) => {
          const value = field ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "inventory.view");
  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");
  if (!canView) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") || "").trim();
  const type = (searchParams.get("type") || "").trim();
  const warehouseId = (searchParams.get("warehouseId") || "").trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await logAudit({
    action: "EXPORT_INVENTORY_LEDGER_CSV",
    entity: "Export",
    entityId: "inventory-ledger",
    newValue: JSON.stringify({
      route: "/api/inventory/ledger/export",
      query: searchParams.toString(),
      includesCost: canViewCost,
    }),
    userId: session.user.id,
  });

  let itemFilterIds: string[] | undefined = undefined;
  if (query) {
    const items = await prisma.inventoryItem.findMany({
      where: { name: { contains: query, mode: "insensitive" as const } },
      select: { id: true },
    });
    itemFilterIds = items.map((item) => item.id);
  }

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (warehouseId) where.warehouseId = warehouseId;
  if (query) {
    where.OR = [
      { reference: { contains: query, mode: "insensitive" as const } },
      { project: { contains: query, mode: "insensitive" as const } },
      ...(itemFilterIds && itemFilterIds.length > 0 ? [{ itemId: { in: itemFilterIds } }] : []),
    ];
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.date = range;
  }

  const entries = await prisma.inventoryLedger.findMany({
    where,
    include: { item: true, warehouse: true },
    orderBy: { date: "desc" },
  });

  const header = canViewCost
    ? ["Date", "Item", "Type", "Quantity", "Unit Cost", "Total", "Warehouse", "Project", "Reference"]
    : ["Date", "Item", "Type", "Quantity", "Warehouse", "Project", "Reference"];
  const rows = [
    header,
    ...entries.map((entry) =>
      canViewCost
        ? [
            entry.date.toISOString(),
            entry.item?.name || "",
            entry.type,
            entry.quantity.toString(),
            entry.unitCost.toString(),
            entry.total.toString(),
            entry.warehouse?.name || "",
            entry.project || "",
            entry.reference || "",
          ]
        : [
            entry.date.toISOString(),
            entry.item?.name || "",
            entry.type,
            entry.quantity.toString(),
            entry.warehouse?.name || "",
            entry.project || "",
            entry.reference || "",
          ]
    ),
  ];

  const csv = toCsv(rows);
  const filename = `inventory_ledger_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
