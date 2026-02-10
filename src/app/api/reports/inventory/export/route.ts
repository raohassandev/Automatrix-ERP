import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canExport = await requirePermission(session.user.id, "reports.export");
  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");
  if (!canExport || (!canViewAll && !canViewTeam && !canViewOwn)) {
    return new Response("Forbidden", { status: 403 });
  }

  await logAudit({
    action: "EXPORT_INVENTORY_REPORT_CSV",
    entity: "Export",
    entityId: "inventory-report",
    newValue: JSON.stringify({
      route: "/api/reports/inventory/export",
      scope: canViewAll ? "ALL" : canViewTeam ? "TEAM" : "OWN",
      includesCost: canViewCost,
    }),
    userId: session.user.id,
  });

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

  const where: Record<string, unknown> =
    scopedItemIds && scopedItemIds.length > 0
      ? { id: { in: scopedItemIds } }
      : scopedItemIds
        ? { id: "__none__" }
        : {};

  const items = await prisma.inventoryItem.findMany({
    where,
    orderBy: { name: "asc" },
  });

  const header = canViewCost
    ? ["Item", "Category", "Quantity", "Min Stock", "Avg Cost", "Last Purchase", "Total Value"]
    : ["Item", "Category", "Quantity", "Min Stock"];
  const rows: Array<Array<string | number | null | undefined>> = [
    header,
    ...items.map((item) =>
      canViewCost
        ? [
            item.name,
            item.category,
            Number(item.quantity),
            Number(item.minStock),
            formatMoney(Number(item.unitCost)),
            formatMoney(Number(item.lastPurchasePrice ?? item.unitCost)),
            formatMoney(Number(item.totalValue)),
          ]
        : [item.name, item.category, Number(item.quantity), Number(item.minStock)]
    ),
  ];

  const csv = toCsv(rows);
  const filename = `inventory_report_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
