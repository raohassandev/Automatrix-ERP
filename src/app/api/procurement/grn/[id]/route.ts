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

function isEditableStatus(status: string | null | undefined) {
  return (status || "").toUpperCase() === "DRAFT";
}

function isPostedStatus(status: string | null | undefined) {
  const s = (status || "").toUpperCase();
  return s === "POSTED" || s === "RECEIVED" || s === "PARTIAL";
}

function isLifecycleStatus(status: string | null | undefined) {
  const s = (status || "").toUpperCase();
  return s === "DRAFT" || s === "SUBMITTED" || s === "APPROVED" || s === "VOID";
}

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
      goodsReceipt: {
        purchaseOrderId,
        OR: [{ status: "POSTED" }, { status: "RECEIVED" }, { status: "PARTIAL" }],
      },
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
    projectRef,
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
    projectRef?: string | null;
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
    const effectiveCost = Number(item.unitCost);
    const prevQty = Number(inventoryItem.quantity);
    const prevAvgCost = Number(inventoryItem.unitCost);
    const totalCost = prevQty * prevAvgCost + qtyChange * effectiveCost;
    const nextAvgCost = newQty > 0 ? totalCost / newQty : effectiveCost;
    const total = qtyChange * effectiveCost;

    const lineProjectRef = item.purchaseOrderItemId
      ? projectByPoItemId.get(item.purchaseOrderItemId) || null
      : null;
    const resolvedProject = await resolveProject(lineProjectRef || projectRef || null);

    await tx.inventoryLedger.create({
      data: {
        date: new Date(receivedDate),
        itemId: inventoryItem.id,
        warehouseId: defaultWarehouseId,
        type: "PURCHASE",
        quantity: new Prisma.Decimal(qtyChange),
        unitCost: new Prisma.Decimal(effectiveCost),
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
  const action = typeof body?.action === "string" ? body.action.trim().toUpperCase() : null;

  // Lifecycle actions (Phase 1 locked).
  if (action) {
    if (!["SUBMIT", "APPROVE", "POST", "VOID"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    const currentStatus = (existing.status || "").toUpperCase();

    if (action === "SUBMIT") {
      if (currentStatus !== "DRAFT") {
        return NextResponse.json({ success: false, error: "Only DRAFT GRNs can be submitted." }, { status: 400 });
      }
      if (!existing.projectRef) {
        if (existing.purchaseOrderId) {
          const po = await prisma.purchaseOrder.findUnique({
            where: { id: existing.purchaseOrderId },
            include: { items: true },
          });
          const inferred = po?.projectRef || po?.items.find((i) => i.project)?.project || null;
          const resolved = inferred ? await resolveProjectId(inferred) : null;
          if (!resolved) {
            return NextResponse.json(
              { success: false, error: "Project is required on GRNs (Phase 1). Set project on PO or GRN before submitting." },
              { status: 400 }
            );
          }
          await prisma.goodsReceipt.update({ where: { id }, data: { projectRef: resolved } });
        } else {
          return NextResponse.json(
            { success: false, error: "Project is required on GRNs (Phase 1). Select a project before submitting." },
            { status: 400 }
          );
        }
      }
      const updated = await prisma.goodsReceipt.update({ where: { id }, data: { status: "SUBMITTED" } });
      await logAudit({
        action: "SUBMIT_GOODS_RECEIPT",
        entity: "GoodsReceipt",
        entityId: id,
        oldValue: existing.status,
        newValue: updated.status,
        reason: typeof body?.reason === "string" ? body.reason : null,
        userId: session.user.id,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "APPROVE") {
      if (currentStatus !== "SUBMITTED") {
        return NextResponse.json({ success: false, error: "Only SUBMITTED GRNs can be approved." }, { status: 400 });
      }
      const updated = await prisma.goodsReceipt.update({ where: { id }, data: { status: "APPROVED" } });
      await logAudit({
        action: "APPROVE_GOODS_RECEIPT",
        entity: "GoodsReceipt",
        entityId: id,
        oldValue: existing.status,
        newValue: updated.status,
        reason: typeof body?.reason === "string" ? body.reason : null,
        userId: session.user.id,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "POST") {
      if (currentStatus !== "APPROVED") {
        return NextResponse.json({ success: false, error: "Only APPROVED GRNs can be posted." }, { status: 400 });
      }

      let posted;
      try {
        posted = await prisma.$transaction(async (tx) => {
          // Prevent double posting.
          const already = await tx.inventoryLedger.count({ where: { reference: `GRN:${id}` } });
          if (already > 0) {
            throw new Error("This GRN already has inventory postings.");
          }

        const receipt = await tx.goodsReceipt.findUnique({
          where: { id },
          include: {
            items: true,
            purchaseOrder: { include: { items: true } },
          },
        });
        if (!receipt) throw new Error("Goods receipt not found");
        const effectiveProjectRef =
          receipt.projectRef ||
          receipt.purchaseOrder?.projectRef ||
          receipt.purchaseOrder?.items.find((i) => i.project)?.project ||
          null;
        const resolvedProjectRef = effectiveProjectRef ? await resolveProjectId(effectiveProjectRef) : null;
        if (!resolvedProjectRef) {
          throw new Error("Project is required on GRNs (Phase 1).");
        }
        if (!receipt.projectRef) {
          await tx.goodsReceipt.update({ where: { id }, data: { projectRef: resolvedProjectRef } });
        }

        const receiptItems = receipt.items.map((item) => ({
          purchaseOrderItemId: item.purchaseOrderItemId,
          itemName: item.itemName,
          unit: item.unit,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
        }));

        const projectByPoItemId = new Map(
          (receipt.purchaseOrder?.items || []).map((item) => [item.id, item.project || null])
        );

        await applyInventoryStockIn(tx, {
          items: receiptItems,
          receiptId: receipt.id,
          receivedDate: receipt.receivedDate,
          userId: session.user.id,
          projectByPoItemId,
          projectRef: resolvedProjectRef,
        });

        if (receipt.purchaseOrderId) {
          await recalcPurchaseOrderReceipts(tx, receipt.purchaseOrderId);
        }

          return tx.goodsReceipt.update({ where: { id }, data: { status: "POSTED" } });
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to post GRN";
        if (
          message.includes("Project is required on GRNs") ||
          message.includes("already has inventory postings")
        ) {
          return NextResponse.json({ success: false, error: message }, { status: 400 });
        }
        throw err;
      }

      await logAudit({
        action: "POST_GOODS_RECEIPT",
        entity: "GoodsReceipt",
        entityId: id,
        oldValue: existing.status,
        newValue: "POSTED",
        reason: typeof body?.reason === "string" ? body.reason : null,
        userId: session.user.id,
      });

      return NextResponse.json({ success: true, data: posted });
    }

    // VOID
    if (isPostedStatus(existing.status)) {
      return NextResponse.json(
        { success: false, error: "Posted GRNs cannot be voided (use reversal later)." },
        { status: 400 }
      );
    }
    const updated = await prisma.goodsReceipt.update({ where: { id }, data: { status: "VOID" } });
    await logAudit({
      action: "VOID_GOODS_RECEIPT",
      entity: "GoodsReceipt",
      entityId: id,
      oldValue: existing.status,
      newValue: updated.status,
      reason: typeof body?.reason === "string" ? body.reason : null,
      userId: session.user.id,
    });
    return NextResponse.json({ success: true, data: updated });
  }

  // Field updates are allowed only while DRAFT. Legacy receipts are treated as posted.
  if (!isEditableStatus(existing.status)) {
    const status = (existing.status || "").toUpperCase();
    const hint = isLifecycleStatus(existing.status) ? status : "LEGACY_POSTED";
    return NextResponse.json(
      { success: false, error: `Only DRAFT GRNs can be edited. Current status: ${hint}.` },
      { status: 400 }
    );
  }

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
  if (parsed.data.projectRef !== undefined) {
    data.projectRef = parsed.data.projectRef ? sanitizeString(parsed.data.projectRef) : null;
  }
  if (parsed.data.receivedDate) data.receivedDate = new Date(parsed.data.receivedDate);
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

  // Phase 1 rule: one-project-per-document.
  // - If linked to a PO: projectRef must match PO.projectRef (inferred if needed), and is not user-editable.
  // - If direct GRN: projectRef is required and must resolve to a known project.
  if (purchaseOrder) {
    const inferred = purchaseOrder.projectRef || purchaseOrder.items.find((i) => i.project)?.project || null;
    const resolved = inferred ? await resolveProjectId(inferred) : null;
    if (!resolved) {
      return NextResponse.json(
        { success: false, error: "Linked PO has no project. Please set project on PO before editing this GRN." },
        { status: 400 }
      );
    }
    data.projectRef = resolved;
  } else if (data.projectRef !== undefined) {
    const raw = data.projectRef ? String(data.projectRef) : "";
    const resolved = raw ? await resolveProjectId(raw) : null;
    if (!resolved) {
      return NextResponse.json({ success: false, error: "Project is required on GRNs (Phase 1)." }, { status: 400 });
    }
    data.projectRef = resolved;
  } else if (!existing.projectRef) {
    return NextResponse.json({ success: false, error: "Project is required on GRNs (Phase 1)." }, { status: 400 });
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
        goodsReceipt: {
          purchaseOrderId: targetPurchaseOrderId,
          id: { not: id },
          OR: [{ status: "POSTED" }, { status: "RECEIVED" }, { status: "PARTIAL" }],
        },
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

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.items !== undefined) {
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

  if (!isEditableStatus(existing.status)) {
    return NextResponse.json(
      { success: false, error: "Only DRAFT GRNs can be deleted." },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: id } });
    await tx.goodsReceipt.delete({ where: { id } });
  });

  await logAudit({
    action: "DELETE_GOODS_RECEIPT",
    entity: "GoodsReceipt",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
