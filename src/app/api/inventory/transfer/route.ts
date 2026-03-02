import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { resolveProjectId } from "@/lib/projects";

const transferSchema = z.object({
  itemId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
  project: z.string().trim().optional(),
  reference: z.string().trim().max(255).optional(),
});

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

  const body = await req.json();
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { itemId, fromWarehouseId, toWarehouseId, quantity, unitCost, project, reference } = parsed.data;
  if (fromWarehouseId === toWarehouseId) {
    return NextResponse.json(
      { success: false, error: "Source and destination warehouses must be different." },
      { status: 400 },
    );
  }
  if (unitCost !== undefined && !canViewCost) {
    return NextResponse.json({ success: false, error: "Purchase price permission required" }, { status: 403 });
  }

  const [item, fromWarehouse, toWarehouse] = await Promise.all([
    prisma.inventoryItem.findUnique({ where: { id: itemId } }),
    prisma.warehouse.findUnique({ where: { id: fromWarehouseId }, select: { id: true, name: true, isActive: true } }),
    prisma.warehouse.findUnique({ where: { id: toWarehouseId }, select: { id: true, name: true, isActive: true } }),
  ]);
  if (!item) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
  }
  if (!fromWarehouse?.isActive || !toWarehouse?.isActive) {
    return NextResponse.json({ success: false, error: "Warehouse is invalid or inactive." }, { status: 400 });
  }
  if (Number(item.quantity) < quantity) {
    return NextResponse.json({ success: false, error: "Insufficient item stock for transfer." }, { status: 400 });
  }

  let resolvedProject: string | null = null;
  if (project) {
    resolvedProject = await resolveProjectId(project);
    if (!resolvedProject) {
      return NextResponse.json({ success: false, error: "Invalid project reference" }, { status: 400 });
    }
  }

  const effectiveCost = unitCost ?? Number(item.unitCost || 0);
  const now = new Date();
  const transferRef = `TRF-${now.getTime()}`;
  const userReference = reference?.trim() || transferRef;

  const result = await prisma.$transaction(async (tx) => {
    const baseQty = Number(item.quantity || 0);
    const qty = Math.abs(quantity);
    const total = qty * effectiveCost;

    const outEntry = await tx.inventoryLedger.create({
      data: {
        date: now,
        itemId,
        warehouseId: fromWarehouseId,
        type: "TRANSFER",
        quantity: new Prisma.Decimal(-qty),
        unitCost: new Prisma.Decimal(effectiveCost),
        total: new Prisma.Decimal(-total),
        reference: `${userReference} (to ${toWarehouse.name})`,
        project: resolvedProject || undefined,
        userId: session.user.id,
        runningBalance: new Prisma.Decimal(baseQty - qty),
        sourceType: "INVENTORY_TRANSFER",
        sourceId: transferRef,
        postedById: session.user.id,
        postedAt: now,
      },
    });

    const inEntry = await tx.inventoryLedger.create({
      data: {
        date: now,
        itemId,
        warehouseId: toWarehouseId,
        type: "TRANSFER",
        quantity: new Prisma.Decimal(qty),
        unitCost: new Prisma.Decimal(effectiveCost),
        total: new Prisma.Decimal(total),
        reference: `${userReference} (from ${fromWarehouse.name})`,
        project: resolvedProject || undefined,
        userId: session.user.id,
        runningBalance: new Prisma.Decimal(baseQty),
        sourceType: "INVENTORY_TRANSFER",
        sourceId: transferRef,
        postedById: session.user.id,
        postedAt: now,
      },
    });

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { lastUpdated: now },
    });

    return { transferRef, outEntryId: outEntry.id, inEntryId: inEntry.id };
  });

  await logAudit({
    action: "INVENTORY_TRANSFER",
    entity: "InventoryItem",
    entityId: item.id,
    userId: session.user.id,
    newValue: JSON.stringify({
      transferRef: result.transferRef,
      itemId: item.id,
      itemName: item.name,
      fromWarehouseId,
      toWarehouseId,
      quantity,
      unitCost: effectiveCost,
      reference: userReference,
      project: resolvedProject || null,
      outEntryId: result.outEntryId,
      inEntryId: result.inEntryId,
    }),
  });

  return NextResponse.json({ success: true, data: result });
}
