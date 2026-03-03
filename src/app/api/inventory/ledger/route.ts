import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inventoryLedgerSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { resolveProjectId } from "@/lib/projects";
import { ensureDefaultWarehouseId } from "@/lib/warehouses";
import { getWarehouseItemQuantity } from "@/lib/inventory-balance";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [canAdjust, canRequest] = await Promise.all([
    requirePermission(session.user.id, "inventory.adjust"),
    requirePermission(session.user.id, "inventory.request"),
  ]);
  const canViewCost = await requirePermission(session.user.id, "inventory.view_cost");

  const body = await req.json();
  const parsed = inventoryLedgerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { itemId, type, warehouseId, quantity, unitCost, reference, project } = parsed.data;
  const isProjectAllocation = type === "PROJECT_ALLOCATION";
  if (isProjectAllocation) {
    if (!canAdjust && !canRequest) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
  } else if (!canAdjust) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  if (type === "PURCHASE") {
    await logAudit({
      action: "BLOCK_MANUAL_PURCHASE_STOCK_IN",
      entity: "InventoryItem",
      entityId: itemId,
      reason: "Manual PURCHASE stock-in is blocked. Use Procurement PO -> GRN posting flow.",
      userId: session.user.id,
      newValue: JSON.stringify({ type, reference: reference || null, project: project || null }),
    });
    return NextResponse.json(
      {
        success: false,
        error:
          "Manual PURCHASE stock-in is blocked. Receive inventory through Procurement (PO -> GRN -> POST).",
      },
      { status: 400 }
    );
  }
  if (type === "TRANSFER") {
    await logAudit({
      action: "BLOCK_MANUAL_TRANSFER_LEDGER",
      entity: "InventoryItem",
      entityId: itemId,
      reason: "Manual TRANSFER ledger entry is blocked. Use dedicated inventory transfer flow.",
      userId: session.user.id,
      newValue: JSON.stringify({ type, reference: reference || null, project: project || null }),
    });
    return NextResponse.json(
      {
        success: false,
        error: "Manual TRANSFER entry is blocked. Use Inventory Transfer flow for warehouse-to-warehouse movement.",
      },
      { status: 400 }
    );
  }
  if (unitCost !== undefined && !canViewCost) {
    return NextResponse.json({ success: false, error: "Purchase price permission required" }, { status: 403 });
  }

  let resolvedProjectId: string | null = null;
  if (project) {
    resolvedProjectId = await resolveProjectId(project);
    if (!resolvedProjectId) {
      return NextResponse.json({ success: false, error: "Invalid project reference" }, { status: 400 });
    }
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
  }

  const qtyChange = ["SALE", "PROJECT_ALLOCATION"].includes(type)
    ? -Math.abs(quantity)
    : Math.abs(quantity);

  const newQty = Number(item.quantity) + qtyChange;
  if (newQty < 0) {
    return NextResponse.json({ success: false, error: "Insufficient stock" }, { status: 400 });
  }

  const currentAvgCost = Number(item.unitCost);
  const effectiveCost = unitCost ?? currentAvgCost;
  const nextAvgCost = currentAvgCost;
  const total = Math.abs(qtyChange) * effectiveCost;

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      let selectedWarehouseId = warehouseId || null;
      if (selectedWarehouseId) {
        const selectedWarehouse = await tx.warehouse.findUnique({
          where: { id: selectedWarehouseId },
          select: { id: true, isActive: true },
        });
        if (!selectedWarehouse || !selectedWarehouse.isActive) {
          throw new Error("Selected warehouse is invalid or inactive.");
        }
      } else {
        selectedWarehouseId = await ensureDefaultWarehouseId(tx);
      }

      const warehouseQty = await getWarehouseItemQuantity(tx, itemId, selectedWarehouseId);
      if (qtyChange < 0 && warehouseQty + qtyChange < -0.00001) {
        throw new Error("Insufficient stock in selected warehouse.");
      }

      const ledger = await tx.inventoryLedger.create({
        data: {
          date: new Date(),
          itemId,
          warehouseId: selectedWarehouseId,
          type,
          quantity: new Prisma.Decimal(qtyChange),
          unitCost: new Prisma.Decimal(effectiveCost),
          total: new Prisma.Decimal(total),
          reference,
          project: resolvedProjectId || undefined,
          userId: session.user.id,
          runningBalance: new Prisma.Decimal(warehouseQty + qtyChange),
          sourceType: "INVENTORY_LEDGER_MANUAL",
          // We'll set sourceId to the entry id in a follow-up update (see below).
          postedById: session.user.id,
          postedAt: new Date(),
        },
      });

      await tx.inventoryLedger.update({
        where: { id: ledger.id },
        data: { sourceId: ledger.id },
      });

      const updatedItem = await tx.inventoryItem.update({
        where: { id: itemId },
        data: {
          quantity: new Prisma.Decimal(newQty),
          unitCost: new Prisma.Decimal(nextAvgCost),
          lastPurchasePrice: item.lastPurchasePrice,
          totalValue: new Prisma.Decimal(newQty * nextAvgCost),
          availableQty: new Prisma.Decimal(newQty - Number(item.reservedQty)),
          lastUpdated: new Date(),
          lastPurchaseDate: item.lastPurchaseDate,
        },
      });

      return { ledger, updatedItem };
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to post inventory movement." },
      { status: 400 }
    );
  }

  await logAudit({
    action: "INVENTORY_LEDGER",
    entity: "InventoryItem",
    entityId: itemId,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  const minStock = Number(result.updatedItem.minStock);
  if (minStock > 0 && newQty <= minStock) {
    const rolesToNotify = ["Owner", "CEO", "Admin", "Procurement", "Store Keeper"];
    const users = await prisma.user.findMany({
      where: { role: { name: { in: rolesToNotify } } },
      select: { id: true },
    });
    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map((user) => ({
          userId: user.id,
          type: "LOW_STOCK",
          message: `Low stock alert: ${result.updatedItem.name} is at ${newQty} ${result.updatedItem.unit} (min ${minStock}).`,
          status: "NEW",
        })),
      });
    }
  }

  const sanitized = {
    ...result,
    ledger: {
      ...result.ledger,
      unitCost: canViewCost ? result.ledger.unitCost : null,
      total: canViewCost ? result.ledger.total : null,
    },
    updatedItem: {
      ...result.updatedItem,
      unitCost: canViewCost ? result.updatedItem.unitCost : null,
      totalValue: canViewCost ? result.updatedItem.totalValue : null,
    },
  };

  return NextResponse.json({ success: true, data: sanitized });
}
