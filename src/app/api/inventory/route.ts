import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inventorySchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "inventory.view");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");
  const canViewSelling = await requirePermission(session.user.id, "inventory.view_selling");

  const data = await prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" } });
  const sanitized = data.map((item) => ({
    ...item,
    unitCost: canViewCost ? item.unitCost : null,
    totalValue: canViewCost ? item.totalValue : null,
    lastPurchasePrice: canViewCost ? item.lastPurchasePrice : null,
    sellingPrice: canViewSelling ? item.sellingPrice : null,
  }));

  return NextResponse.json({ success: true, data: sanitized });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canAdjust = await requirePermission(session.user.id, "inventory.adjust");
  if (!canAdjust) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");
  const canViewSelling = await requirePermission(session.user.id, "inventory.view_selling");
  if (!canViewCost) {
    return NextResponse.json({ success: false, error: "Purchase price permission required" }, { status: 403 });
  }
  if (!canViewSelling) {
    return NextResponse.json({ success: false, error: "Selling price permission required" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = inventorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Sanitize string inputs after validation
  const sanitizedData = {
    ...parsed.data,
    name: sanitizeString(parsed.data.name),
    sku: parsed.data.sku ? sanitizeString(parsed.data.sku) : undefined,
    category: sanitizeString(parsed.data.category),
    unit: sanitizeString(parsed.data.unit),
  };

  const initialQuantity = sanitizedData.initialQuantity || 0;
  const totalValue = initialQuantity * sanitizedData.unitCost;

  const created = await prisma.inventoryItem.create({
    data: {
      name: sanitizedData.name,
      sku: sanitizedData.sku,
      category: sanitizedData.category,
      unit: sanitizedData.unit,
      unitCost: new Prisma.Decimal(sanitizedData.unitCost),
      lastPurchasePrice: new Prisma.Decimal(sanitizedData.unitCost),
      sellingPrice: new Prisma.Decimal(sanitizedData.sellingPrice),
      quantity: new Prisma.Decimal(initialQuantity),
      totalValue: new Prisma.Decimal(totalValue),
      minStock: new Prisma.Decimal(sanitizedData.minStock || 0),
      reorderQty: new Prisma.Decimal(sanitizedData.reorderQty || 0),
      reservedQty: new Prisma.Decimal(0),
      availableQty: new Prisma.Decimal(initialQuantity),
      lastUpdated: new Date(),
      avgUsage30Days: new Prisma.Decimal(0),
    },
  });

  await logAudit({
    action: "CREATE_INVENTORY_ITEM",
    entity: "InventoryItem",
    entityId: created.id,
    newValue: JSON.stringify(sanitizedData),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
