import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEdit = await requirePermission(session.user.id, "inventory.adjust");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");
  const canViewSelling = await requirePermission(session.user.id, "inventory.view_selling");

  const { id } = await context.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.sku !== undefined) data.sku = body.sku ? sanitizeString(body.sku) : null;
  if (body.category) data.category = sanitizeString(body.category);
  if (body.unit) data.unit = sanitizeString(body.unit);
  if (body.unitCost !== undefined) {
    if (!canViewCost) {
      return NextResponse.json({ success: false, error: "Purchase price permission required" }, { status: 403 });
    }
    data.unitCost = new Prisma.Decimal(body.unitCost);
  }
  if (body.sellingPrice !== undefined) {
    if (!canViewSelling) {
      return NextResponse.json({ success: false, error: "Selling price permission required" }, { status: 403 });
    }
    data.sellingPrice = new Prisma.Decimal(body.sellingPrice);
  }
  if (body.minStock !== undefined) data.minStock = new Prisma.Decimal(body.minStock);
  if (body.reorderQty !== undefined) data.reorderQty = new Prisma.Decimal(body.reorderQty);

  const updated = await prisma.inventoryItem.update({ where: { id }, data });

  await logAudit({
    action: "UPDATE_INVENTORY_ITEM",
    entity: "InventoryItem",
    entityId: id,
    newValue: JSON.stringify(body),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updated });
}
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEdit = await requirePermission(session.user.id, "inventory.adjust");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  await prisma.inventoryItem.delete({ where: { id } });

  await logAudit({
    action: "DELETE_INVENTORY_ITEM",
    entity: "InventoryItem",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
