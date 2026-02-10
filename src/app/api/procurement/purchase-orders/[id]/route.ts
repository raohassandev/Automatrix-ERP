import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { purchaseOrderUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";

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
  const existing = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Purchase order not found" }, { status: 404 });
  }

  const body = await req.json();
  const action = typeof body?.action === "string" ? body.action.trim().toUpperCase() : null;
  const currentStatus = (existing.status || "").toUpperCase();

  if (action) {
    if (!["SUBMIT", "APPROVE", "CANCEL"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    if (action === "SUBMIT") {
      if (currentStatus !== "DRAFT") {
        return NextResponse.json(
          { success: false, error: "Only DRAFT purchase orders can be submitted." },
          { status: 400 }
        );
      }
      const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "SUBMITTED" } });
      await logAudit({
        action: "SUBMIT_PURCHASE_ORDER",
        entity: "PurchaseOrder",
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
        return NextResponse.json(
          { success: false, error: "Only SUBMITTED purchase orders can be approved." },
          { status: 400 }
        );
      }
      // We reuse the existing operational status name "ORDERED" to avoid disrupting legacy reporting.
      const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "ORDERED" } });
      await logAudit({
        action: "APPROVE_PURCHASE_ORDER",
        entity: "PurchaseOrder",
        entityId: id,
        oldValue: existing.status,
        newValue: updated.status,
        reason: typeof body?.reason === "string" ? body.reason : null,
        userId: session.user.id,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // CANCEL
    if (["RECEIVED", "PARTIALLY_RECEIVED"].includes(currentStatus)) {
      return NextResponse.json(
        { success: false, error: "Received purchase orders cannot be cancelled." },
        { status: 400 }
      );
    }

    const hasPostedReceipts = await prisma.goodsReceipt.count({
      where: {
        purchaseOrderId: id,
        OR: [{ status: "POSTED" }, { status: "RECEIVED" }, { status: "PARTIAL" }],
      },
    });
    if (hasPostedReceipts > 0) {
      return NextResponse.json(
        { success: false, error: "Cannot cancel a PO that has posted goods receipts." },
        { status: 400 }
      );
    }

    const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    await logAudit({
      action: "CANCEL_PURCHASE_ORDER",
      entity: "PurchaseOrder",
      entityId: id,
      oldValue: existing.status,
      newValue: updated.status,
      reason: typeof body?.reason === "string" ? body.reason : null,
      userId: session.user.id,
    });
    return NextResponse.json({ success: true, data: updated });
  }

  if (currentStatus !== "DRAFT") {
    return NextResponse.json(
      { success: false, error: `Only DRAFT purchase orders can be edited. Current status: ${existing.status}.` },
      { status: 400 }
    );
  }

  const parsed = purchaseOrderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.poNumber) data.poNumber = sanitizeString(parsed.data.poNumber);
  if (parsed.data.vendorId !== undefined) {
    data.vendorId = parsed.data.vendorId ? sanitizeString(parsed.data.vendorId) : null;
  }
  if (parsed.data.vendorName) data.vendorName = sanitizeString(parsed.data.vendorName);
  if (parsed.data.vendorContact !== undefined) {
    data.vendorContact = parsed.data.vendorContact ? sanitizeString(parsed.data.vendorContact) : null;
  }
  if (parsed.data.orderDate) data.orderDate = new Date(parsed.data.orderDate);
  if (parsed.data.expectedDate !== undefined) {
    data.expectedDate = parsed.data.expectedDate ? new Date(parsed.data.expectedDate) : null;
  }
  if (parsed.data.currency) data.currency = sanitizeString(parsed.data.currency);
  if (parsed.data.notes !== undefined) {
    data.notes = parsed.data.notes ? sanitizeString(parsed.data.notes) : null;
  }

  if (data.vendorId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: data.vendorId as string },
      select: { id: true, name: true, contactName: true },
    });
    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 400 });
    }
    data.vendorName = vendor.name;
    if (!data.vendorContact && vendor.contactName) {
      data.vendorContact = vendor.contactName;
    }
  }

  let updated = existing;
  await prisma.$transaction(async (tx) => {
    if (parsed.data.items && parsed.data.items.length > 0) {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      const totalAmount = parsed.data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitCost,
        0
      );
      data.totalAmount = new Prisma.Decimal(totalAmount);
      await tx.purchaseOrderItem.createMany({
        data: parsed.data.items.map((item) => ({
          purchaseOrderId: id,
          itemName: sanitizeString(item.itemName),
          unit: item.unit ? sanitizeString(item.unit) : null,
          quantity: new Prisma.Decimal(item.quantity),
          unitCost: new Prisma.Decimal(item.unitCost),
          total: new Prisma.Decimal(item.quantity * item.unitCost),
          project: item.project ? sanitizeString(item.project) : null,
        })),
      });
    }

    updated = await tx.purchaseOrder.update({
      where: { id },
      data,
      include: { items: true },
    });
  });

  await logAudit({
    action: "UPDATE_PURCHASE_ORDER",
    entity: "PurchaseOrder",
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
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Purchase order not found" }, { status: 404 });
  }

  if ((existing.status || "").toUpperCase() !== "DRAFT") {
    return NextResponse.json(
      { success: false, error: "Only DRAFT purchase orders can be deleted." },
      { status: 400 }
    );
  }

  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
  await prisma.purchaseOrder.delete({ where: { id } });

  await logAudit({
    action: "DELETE_PURCHASE_ORDER",
    entity: "PurchaseOrder",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
