import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inventoryLedgerSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canAdjust = await requirePermission(session.user.id, "inventory.adjust");
  if (!canAdjust) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = inventoryLedgerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { itemId, type, quantity, unitCost, reference, project } = parsed.data;

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

  const cost = unitCost ?? Number(item.unitCost);
  const total = Math.abs(qtyChange) * cost;

  const result = await prisma.$transaction(async (tx) => {
    const ledger = await tx.inventoryLedger.create({
      data: {
        date: new Date(),
        itemId,
        type,
        quantity: new Prisma.Decimal(qtyChange),
        unitCost: new Prisma.Decimal(cost),
        total: new Prisma.Decimal(total),
        reference,
        project,
        userId: session.user.id,
        runningBalance: new Prisma.Decimal(newQty),
      },
    });

    const updatedItem = await tx.inventoryItem.update({
      where: { id: itemId },
      data: {
        quantity: new Prisma.Decimal(newQty),
        totalValue: new Prisma.Decimal(newQty * cost),
        availableQty: new Prisma.Decimal(newQty - Number(item.reservedQty)),
        lastUpdated: new Date(),
        lastPurchaseDate: type === "PURCHASE" ? new Date() : item.lastPurchaseDate,
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

  return NextResponse.json({ success: true, data: result });
}
