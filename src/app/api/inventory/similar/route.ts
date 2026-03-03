import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { normalizeInventoryName, normalizeInventorySearch, normalizeSku } from "@/lib/inventory-identity";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canView = await requirePermission(session.user.id, "inventory.view");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const skuInput = searchParams.get("sku");
  if (!q && !skuInput) {
    return NextResponse.json({ success: true, data: [] });
  }

  const normalizedQuery = normalizeInventoryName(q);
  const loose = normalizeInventorySearch(q);
  const sku = normalizeSku(skuInput);

  const rows = await prisma.inventoryItem.findMany({
    where: {
      OR: [
        q
          ? {
              name: {
                contains: q,
                mode: "insensitive",
              },
            }
          : undefined,
        loose
          ? {
              canonicalName: {
                contains: normalizedQuery || loose.replace(/\s+/g, ""),
                mode: "insensitive",
              },
            }
          : undefined,
        sku
          ? {
              sku: sku,
            }
          : undefined,
      ].filter(Boolean) as unknown as Array<Record<string, unknown>>,
    },
    orderBy: [{ lastUpdated: "desc" }, { createdAt: "desc" }],
    take: 8,
  });

  return NextResponse.json({
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      canonicalName: row.canonicalName,
      sku: row.sku,
      category: row.category,
      unit: row.unit,
      quantity: Number(row.quantity || 0),
      unitCost: canViewCost ? Number(row.unitCost || 0) : null,
    })),
  });
}
