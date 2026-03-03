import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { normalizeInventoryName, normalizeSku } from "@/lib/inventory-identity";

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
  const existing = await prisma.inventoryItem.findUnique({
    where: { id },
    select: { id: true, name: true, canonicalName: true, sku: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Inventory item not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = sanitizeString(body.name || "");
    if (!name) {
      return NextResponse.json({ success: false, error: "Item name cannot be empty" }, { status: 400 });
    }
    const canonicalName = normalizeInventoryName(name);
    if (!canonicalName) {
      return NextResponse.json({ success: false, error: "Item name is invalid" }, { status: 400 });
    }
    const conflict = await prisma.inventoryItem.findFirst({
      where: { canonicalName, id: { not: id } },
      select: { id: true, name: true, sku: true, unit: true, category: true },
    });
    if (conflict) {
      return NextResponse.json(
        {
          success: false,
          error: "Similar item already exists. Use existing item to preserve stock history.",
          duplicate: conflict,
        },
        { status: 409 },
      );
    }
    data.name = name;
    data.canonicalName = canonicalName;
  }
  if (body.sku !== undefined) {
    const sku = normalizeSku(body.sku ? sanitizeString(body.sku) : null);
    if (sku) {
      const conflict = await prisma.inventoryItem.findFirst({
        where: { sku, id: { not: id } },
        select: { id: true, name: true, sku: true, unit: true, category: true },
      });
      if (conflict) {
        return NextResponse.json(
          { success: false, error: "SKU already exists on another item.", duplicate: conflict },
          { status: 409 },
        );
      }
    }
    data.sku = sku;
  }
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
