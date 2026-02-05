import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inventoryLedgerSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { resolveProjectId } from "@/lib/projects";

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
  const parsed = inventoryLedgerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { itemId, type, quantity, unitCost, reference, project } = parsed.data;
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
  const isPurchase = type === "PURCHASE";
  let nextAvgCost = currentAvgCost;
  if (isPurchase) {
    const prevQty = Number(item.quantity);
    const totalCost = prevQty * currentAvgCost + Math.abs(qtyChange) * effectiveCost;
    nextAvgCost = newQty > 0 ? totalCost / newQty : effectiveCost;
  }
  const total = Math.abs(qtyChange) * effectiveCost;

  const result = await prisma.$transaction(async (tx) => {
    const ledger = await tx.inventoryLedger.create({
      data: {
        date: new Date(),
        itemId,
        type,
        quantity: new Prisma.Decimal(qtyChange),
        unitCost: new Prisma.Decimal(effectiveCost),
        total: new Prisma.Decimal(total),
        reference,
        project: resolvedProjectId || undefined,
        userId: session.user.id,
        runningBalance: new Prisma.Decimal(newQty),
      },
    });

    const updatedItem = await tx.inventoryItem.update({
      where: { id: itemId },
      data: {
        quantity: new Prisma.Decimal(newQty),
        unitCost: new Prisma.Decimal(nextAvgCost),
        lastPurchasePrice: isPurchase ? new Prisma.Decimal(effectiveCost) : item.lastPurchasePrice,
        totalValue: new Prisma.Decimal(newQty * nextAvgCost),
        availableQty: new Prisma.Decimal(newQty - Number(item.reservedQty)),
        lastUpdated: new Date(),
        lastPurchaseDate: isPurchase ? new Date() : item.lastPurchaseDate,
      },
    });

    return { ledger, updatedItem };
  });

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
