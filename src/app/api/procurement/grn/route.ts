import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goodsReceiptSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { resolveProjectId } from "@/lib/projects";

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

  for (const item of items) {
    const key = normalizeKey(item.itemName);
    const inventoryItem = inventoryByName.get(key);
    if (!inventoryItem) {
      missingItems.push(item.itemName);
      continue;
    }

    const qtyChange = Math.abs(item.quantity);
    const newQty = Number(inventoryItem.quantity) + qtyChange;
    const effectiveCost = Number(item.unitCost);
    const prevQty = Number(inventoryItem.quantity);
    const prevAvgCost = Number(inventoryItem.unitCost);
    const totalCost = prevQty * prevAvgCost + qtyChange * effectiveCost;
    const nextAvgCost = newQty > 0 ? totalCost / newQty : effectiveCost;
    const total = qtyChange * effectiveCost;

    const projectRef = item.purchaseOrderItemId
      ? projectByPoItemId.get(item.purchaseOrderItemId) || null
      : null;
    const resolvedProject = await resolveProject(projectRef);

    await tx.inventoryLedger.create({
      data: {
        date: new Date(receivedDate),
        itemId: inventoryItem.id,
        type: "PURCHASE",
        quantity: new Prisma.Decimal(qtyChange),
        unitCost: new Prisma.Decimal(effectiveCost),
        total: new Prisma.Decimal(total),
        reference: `GRN:${receiptId}`,
        project: resolvedProject || undefined,
        userId,
        runningBalance: new Prisma.Decimal(newQty),
      },
    });

    const updatedItem = await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        quantity: new Prisma.Decimal(newQty),
        unitCost: new Prisma.Decimal(nextAvgCost),
        lastPurchasePrice: new Prisma.Decimal(effectiveCost),
        totalValue: new Prisma.Decimal(newQty * nextAvgCost),
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "procurement.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.goodsReceipt.findMany({
    orderBy: { receivedDate: "desc" },
    include: { items: true, purchaseOrder: true },
  });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "procurement.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = goodsReceiptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sanitized = {
    ...parsed.data,
    grnNumber: sanitizeString(parsed.data.grnNumber),
    status: parsed.data.status ? sanitizeString(parsed.data.status) : "RECEIVED",
    notes: parsed.data.notes ? sanitizeString(parsed.data.notes) : undefined,
    items: parsed.data.items.map((item) => ({
      purchaseOrderItemId: item.purchaseOrderItemId ? sanitizeString(item.purchaseOrderItemId) : undefined,
      itemName: sanitizeString(item.itemName),
      unit: item.unit ? sanitizeString(item.unit) : undefined,
      quantity: item.quantity,
      unitCost: item.unitCost,
    })),
  };

  const purchaseOrder = sanitized.purchaseOrderId
    ? await prisma.purchaseOrder.findUnique({
        where: { id: sanitized.purchaseOrderId },
        include: { items: true },
      })
    : null;

  if (sanitized.purchaseOrderId) {
    if (!purchaseOrder) {
      return NextResponse.json({ success: false, error: "Purchase order not found" }, { status: 400 });
    }
  }

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
    const invalidItem = sanitized.items.find(
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
  const unmatchedItems: string[] = [];
  const receiptItems = sanitized.items.map((item) => {
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
    } else if (purchaseOrder) {
      unmatchedItems.push(item.itemName);
    }

    return {
      ...item,
      purchaseOrderItemId,
    };
  });

  if (purchaseOrder) {
    for (const [itemId, delta] of receivedDelta.entries()) {
      const poItem = poItemById.get(itemId);
      if (!poItem) continue;
      const newReceived = Number(poItem.receivedQty) + delta;
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

  const created = await prisma.$transaction(async (tx) => {
    const receipt = await tx.goodsReceipt.create({
      data: {
        grnNumber: sanitized.grnNumber,
        purchaseOrderId: sanitized.purchaseOrderId || null,
        receivedDate: new Date(sanitized.receivedDate),
        status: sanitized.status,
        notes: sanitized.notes,
        items: {
          create: receiptItems.map((item) => ({
            purchaseOrderItemId: item.purchaseOrderItemId,
            itemName: item.itemName,
            unit: item.unit,
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: new Prisma.Decimal(item.unitCost),
            total: new Prisma.Decimal(item.quantity * item.unitCost),
          })),
        },
      },
      include: { items: true, purchaseOrder: true },
    });

    if (purchaseOrder) {
      await recalcPurchaseOrderReceipts(tx, purchaseOrder.id);
    }

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

    if (purchaseOrder && unmatchedItems.length > 0) {
      const rolesToNotify = ["Owner", "CEO", "Admin", "Procurement", "Store Keeper"];
      const users = await tx.user.findMany({
        where: { role: { name: { in: rolesToNotify } } },
        select: { id: true },
      });
      if (users.length > 0) {
        await tx.notification.createMany({
          data: unmatchedItems.flatMap((name) =>
            users.map((user) => ({
              userId: user.id,
              type: "PROCUREMENT_UNMATCHED_GRN",
              message: `GRN item "${name}" does not match any PO line for ${purchaseOrder.poNumber}.`,
              status: "NEW",
            }))
          ),
        });
      }
    }

    return receipt;
  });

  await logAudit({
    action: "CREATE_GOODS_RECEIPT",
    entity: "GoodsReceipt",
    entityId: created.id,
    newValue: JSON.stringify(sanitized),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
