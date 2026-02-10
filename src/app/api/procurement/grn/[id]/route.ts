import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goodsReceiptUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { resolveProjectId } from "@/lib/projects";
import { ensureDefaultWarehouseId } from "@/lib/warehouses";

type PurchaseOrderItem = {
  id: string;
  itemName: string;
  unit: string | null;
  quantity: Prisma.Decimal;
  receivedQty: Prisma.Decimal;
  project: string | null;
};

const normalizeKey = (value?: string | null) => value?.trim().toLowerCase() || "";
const buildItemKey = (name: string, unit?: string | null) =>
  `${normalizeKey(name)}::${normalizeKey(unit)}`;

async function recalcPurchaseOrderReceipts(
  tx: Prisma.TransactionClient,
  purchaseOrderId: string
) {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true },
  });
  if (!po) return;

  const receiptItems = await tx.goodsReceiptItem.findMany({
    where: {
      goodsReceipt: { purchaseOrderId },
      purchaseOrderItemId: { not: null },
    },
    select: { purchaseOrderItemId: true, quantity: true },
  });

  const totals = new Map<string, number>();
  receiptItems.forEach((item) => {
    if (!item.purchaseOrderItemId) return;
    totals.set(
      item.purchaseOrderItemId,
      (totals.get(item.purchaseOrderItemId) || 0) + Number(item.quantity)
    );
  });

  await Promise.all(
    po.items.map((item) => {
      const receivedQty = totals.get(item.id) || 0;
      return tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: new Prisma.Decimal(receivedQty) },
      });
    })
  );

  if (po.status === "CANCELLED") return;

  const anyReceived = po.items.some((item) => (totals.get(item.id) || 0) > 0);
  const allReceived = po.items.every(
    (item) => (totals.get(item.id) || 0) >= Number(item.quantity)
  );

  if (anyReceived) {
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED" },
    });
  } else {
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "ORDERED" },
    });
  }
}

async function revertInventoryStockIn(tx: Prisma.TransactionClient, receiptId: string) {
  const entries = await tx.inventoryLedger.findMany({
    where: { reference: `GRN:${receiptId}` },
  });

  for (const entry of entries) {
    const item = await tx.inventoryItem.findUnique({ where: { id: entry.itemId } });
    if (!item) continue;

    const newQty = Number(item.quantity) - Number(entry.quantity);
    if (newQty < 0) {
      throw new Error(`Cannot revert stock-in for ${item.name}`);
    }

    const cost = Number(entry.unitCost);
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        quantity: new Prisma.Decimal(newQty),
        totalValue: new Prisma.Decimal(newQty * cost),
        availableQty: new Prisma.Decimal(newQty - Number(item.reservedQty)),
        lastUpdated: new Date(),
      },
    });
  }

  if (entries.length > 0) {
    await tx.inventoryLedger.deleteMany({ where: { reference: `GRN:${receiptId}` } });
  }
}

async function applyInventoryStockIn(
  tx: Prisma.TransactionClient,
  {
    items,
    receiptId,
    receivedDate,
    userId,
    projectByPoItemId,
  }: {
    items: Array<{
      itemName: string;
      unit?: string | null;
      quantity: number;
      unitCost: number;
      purchaseOrderItemId?: string | null;
    }>;
    receiptId: string;
    receivedDate: string | Date;
    userId: string;
    projectByPoItemId: Map<string, string | null>;
  }
) {
  const uniqueNames = Array.from(
    new Set(items.map((item) => item.itemName.trim()).filter(Boolean))
  );
  if (uniqueNames.length === 0) return;

  const inventoryItems = await tx.inventoryItem.findMany({
    where: {
      OR: uniqueNames.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })),
    },
  });
  const inventoryByName = new Map(
    inventoryItems.map((item) => [normalizeKey(item.name), item])
  );

  const projectCache = new Map<string, string | null>();
  const resolveProject = async (ref?: string | null) => {
    if (!ref) return null;
    if (projectCache.has(ref)) return projectCache.get(ref) || null;
    const resolved = await resolveProjectId(ref);
    projectCache.set(ref, resolved || ref);
    return resolved || ref;
  };

  const missingItems: string[] = [];
  const defaultWarehouseId = await ensureDefaultWarehouseId(tx);

  for (const item of items) {
    const key = normalizeKey(item.itemName);
    const inventoryItem = inventoryByName.get(key);
    if (!inventoryItem) {
      missingItems.push(item.itemName);
      continue;
    }

    const qtyChange = Math.abs(item.quantity);
    const newQty = Number(inventoryItem.quantity) + qtyChange;
    const cost = Number(item.unitCost);
    const total = qtyChange * cost;

    const projectRef = item.purchaseOrderItemId
      ? projectByPoItemId.get(item.purchaseOrderItemId) || null
      : null;
    const resolvedProject = await resolveProject(projectRef);

    await tx.inventoryLedger.create({
      data: {
        date: new Date(receivedDate),
        itemId: inventoryItem.id,
        warehouseId: defaultWarehouseId,
        type: "PURCHASE",
        quantity: new Prisma.Decimal(qtyChange),
        unitCost: new Prisma.Decimal(cost),
        total: new Prisma.Decimal(total),
        reference: `GRN:${receiptId}`,
        project: resolvedProject || undefined,
        userId,
        runningBalance: new Prisma.Decimal(newQty),
        sourceType: "GRN",
        sourceId: receiptId,
        postedById: userId,
        postedAt: new Date(receivedDate),
      },
    });

    const updatedItem = await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        quantity: new Prisma.Decimal(newQty),
        totalValue: new Prisma.Decimal(newQty * cost),
        availableQty: new Prisma.Decimal(newQty - Number(inventoryItem.reservedQty)),
        lastUpdated: new Date(),
        lastPurchaseDate: new Date(receivedDate),
      },
    });

    inventoryByName.set(key, updatedItem);
  }

  if (missingItems.length > 0) {
    const rolesToNotify = ["Owner", "CEO", "Admin", "Procurement", "Store Keeper"];
    const users = await tx.user.findMany({
      where: { role: { name: { in: rolesToNotify } } },
      select: { id: true },
    });
    if (users.length > 0) {
      await tx.notification.createMany({
        data: missingItems.flatMap((name) =>
          users.map((user) => ({
            userId: user.id,
            type: "PROCUREMENT_MISSING_ITEM",
            message: `GRN item "${name}" has no matching inventory item.`,
            status: "NEW",
          }))
        ),
      });
    }
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "procurement.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.goodsReceipt.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Goods receipt not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = goodsReceiptUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.grnNumber) data.grnNumber = sanitizeString(parsed.data.grnNumber);
  if (parsed.data.purchaseOrderId !== undefined) {
    data.purchaseOrderId = parsed.data.purchaseOrderId || null;
  }
  if (parsed.data.receivedDate) data.receivedDate = new Date(parsed.data.receivedDate);
  if (parsed.data.status) data.status = sanitizeString(parsed.data.status);
  if (parsed.data.notes !== undefined) {
    data.notes = parsed.data.notes ? sanitizeString(parsed.data.notes) : null;
  }

  const targetPurchaseOrderId =
    parsed.data.purchaseOrderId !== undefined
      ? parsed.data.purchaseOrderId || null
      : existing.purchaseOrderId;

  const purchaseOrder = targetPurchaseOrderId
    ? await prisma.purchaseOrder.findUnique({
        where: { id: targetPurchaseOrderId },
        include: { items: true },
      })
    : null;
  if (targetPurchaseOrderId && !purchaseOrder) {
    return NextResponse.json({ success: false, error: "Purchase order not found" }, { status: 400 });
  }

  const sanitizedItems = parsed.data.items
    ? parsed.data.items.map((item) => ({
        purchaseOrderItemId: item.purchaseOrderItemId
          ? sanitizeString(item.purchaseOrderItemId)
          : undefined,
        itemName: sanitizeString(item.itemName),
        unit: item.unit ? sanitizeString(item.unit) : undefined,
        quantity: item.quantity,
        unitCost: item.unitCost,
      }))
    : existing.items.map((item) => ({
        purchaseOrderItemId: item.purchaseOrderItemId || undefined,
        itemName: item.itemName,
        unit: item.unit || undefined,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      }));

  const poItemsByKey = new Map<string, Array<PurchaseOrderItem>>();
  const poItemById = new Map<string, PurchaseOrderItem>();
  if (purchaseOrder) {
    purchaseOrder.items.forEach((item) => {
      const key = buildItemKey(item.itemName, item.unit);
      poItemsByKey.set(key, [...(poItemsByKey.get(key) || []), item]);
      poItemById.set(item.id, item);
    });
  }

  if (purchaseOrder) {
    const invalidItem = sanitizedItems.find(
      (item) => item.purchaseOrderItemId && !poItemById.has(item.purchaseOrderItemId)
    );
    if (invalidItem) {
      return NextResponse.json(
        { success: false, error: "Purchase order item does not belong to the selected PO." },
        { status: 400 }
      );
    }
  }

  const receivedDelta = new Map<string, number>();
  const receiptItems = sanitizedItems.map((item) => {
    let purchaseOrderItemId = item.purchaseOrderItemId || null;
    if (purchaseOrder && !purchaseOrderItemId) {
      const key = buildItemKey(item.itemName, item.unit);
      const candidates = poItemsByKey.get(key) || [];
      const match =
        candidates.find(
          (candidate) =>
            Number(candidate.quantity) >
            Number(candidate.receivedQty) + (receivedDelta.get(candidate.id) || 0)
        ) || candidates[0];
      if (match) {
        purchaseOrderItemId = match.id;
      }
    }
    if (purchaseOrderItemId) {
      receivedDelta.set(
        purchaseOrderItemId,
        (receivedDelta.get(purchaseOrderItemId) || 0) + item.quantity
      );
    }
    return {
      ...item,
      purchaseOrderItemId,
    };
  });

  if (purchaseOrder) {
    const otherReceiptItems = await prisma.goodsReceiptItem.findMany({
      where: {
        goodsReceipt: { purchaseOrderId: targetPurchaseOrderId, id: { not: id } },
        purchaseOrderItemId: { not: null },
      },
      select: { purchaseOrderItemId: true, quantity: true },
    });

    const otherTotals = new Map<string, number>();
    otherReceiptItems.forEach((item) => {
      if (!item.purchaseOrderItemId) return;
      otherTotals.set(
        item.purchaseOrderItemId,
        (otherTotals.get(item.purchaseOrderItemId) || 0) + Number(item.quantity)
      );
    });

    for (const [itemId, delta] of receivedDelta.entries()) {
      const poItem = poItemById.get(itemId);
      if (!poItem) continue;
      const newReceived = (otherTotals.get(itemId) || 0) + delta;
      if (newReceived > Number(poItem.quantity)) {
        return NextResponse.json(
          {
            success: false,
            error: `Received quantity exceeds ordered quantity for ${poItem.itemName}.`,
          },
          { status: 400 }
        );
      }
    }
  }

  const shouldReplaceItems =
    parsed.data.items !== undefined ||
    (parsed.data.purchaseOrderId !== undefined &&
      parsed.data.purchaseOrderId !== existing.purchaseOrderId);
  const shouldRefreshInventory =
    parsed.data.items !== undefined ||
    parsed.data.receivedDate !== undefined ||
    (parsed.data.purchaseOrderId !== undefined &&
      parsed.data.purchaseOrderId !== existing.purchaseOrderId);

  const previousPurchaseOrderId = existing.purchaseOrderId;

  const updated = await prisma.$transaction(async (tx) => {
    if (shouldRefreshInventory) {
      await revertInventoryStockIn(tx, id);
    }

    if (shouldReplaceItems) {
      await tx.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: id } });
      await tx.goodsReceiptItem.createMany({
        data: receiptItems.map((item) => ({
          goodsReceiptId: id,
          purchaseOrderItemId: item.purchaseOrderItemId,
          itemName: sanitizeString(item.itemName),
          unit: item.unit ? sanitizeString(item.unit) : null,
          quantity: new Prisma.Decimal(item.quantity),
          unitCost: new Prisma.Decimal(item.unitCost),
          total: new Prisma.Decimal(item.quantity * item.unitCost),
        })),
      });
    }

    const receipt = await tx.goodsReceipt.update({
      where: { id },
      data,
      include: { items: true, purchaseOrder: true },
    });

    if (shouldRefreshInventory) {
      const projectByPoItemId = new Map(
        (purchaseOrder?.items || []).map((item) => [item.id, item.project || null])
      );
      await applyInventoryStockIn(tx, {
        items: receiptItems,
        receiptId: receipt.id,
        receivedDate: receipt.receivedDate,
        userId: session.user.id,
        projectByPoItemId,
      });
    }

    if (previousPurchaseOrderId) {
      await recalcPurchaseOrderReceipts(tx, previousPurchaseOrderId);
    }
    if (receipt.purchaseOrderId && receipt.purchaseOrderId !== previousPurchaseOrderId) {
      await recalcPurchaseOrderReceipts(tx, receipt.purchaseOrderId);
    }

    return receipt;
  });

  await logAudit({
    action: "UPDATE_GOODS_RECEIPT",
    entity: "GoodsReceipt",
    entityId: id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "procurement.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.goodsReceipt.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Goods receipt not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await revertInventoryStockIn(tx, id);
    await tx.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: id } });
    await tx.goodsReceipt.delete({ where: { id } });
    if (existing.purchaseOrderId) {
      await recalcPurchaseOrderReceipts(tx, existing.purchaseOrderId);
    }
  });

  await logAudit({
    action: "DELETE_GOODS_RECEIPT",
    entity: "GoodsReceipt",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
