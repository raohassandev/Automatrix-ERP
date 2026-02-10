import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { canUserApprove } from "@/lib/approval-engine";

const billLineSchema = z.object({
  description: z.string().trim().min(1),
  total: z.number().finite().nonnegative(),
  project: z.string().trim().optional(),
});

const vendorBillUpdateSchema = z.object({
  billNumber: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1).optional(),
  billDate: z.string().trim().min(1).optional(),
  dueDate: z.string().trim().optional(),
  currency: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  lines: z.array(billLineSchema).min(1).optional(),
  action: z.enum(["SUBMIT", "APPROVE", "POST", "VOID"]).optional(),
  reason: z.string().trim().optional(),
});

function isEditableStatus(status: string) {
  return status === "DRAFT";
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "procurement.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const bill = await prisma.vendorBill.findUnique({
    where: { id },
    include: { vendor: true, lines: true, allocations: { include: { vendorPayment: true } } },
  });
  if (!bill) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const paid = bill.allocations
    .filter((alloc) => alloc.vendorPayment.status === "POSTED")
    .reduce((sum, alloc) => sum + Number(alloc.amount), 0);

  return NextResponse.json({
    success: true,
    data: {
      id: bill.id,
      billNumber: bill.billNumber,
      vendorId: bill.vendorId,
      billDate: bill.billDate.toISOString(),
      dueDate: bill.dueDate ? bill.dueDate.toISOString() : null,
      status: bill.status,
      currency: bill.currency,
      notes: bill.notes,
      totalAmount: Number(bill.totalAmount),
      paidAmount: paid,
      outstandingAmount: Math.max(0, Number(bill.totalAmount) - paid),
      vendor: { id: bill.vendor.id, name: bill.vendor.name },
      lines: bill.lines.map((l) => ({
        id: l.id,
        description: l.description,
        total: Number(l.total),
        project: l.project,
      })),
      createdAt: bill.createdAt.toISOString(),
      updatedAt: bill.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "procurement.edit");
  const canApproveAny =
    (await requirePermission(session.user.id, "approvals.approve_low")) ||
    (await requirePermission(session.user.id, "approvals.approve_high")) ||
    (await requirePermission(session.user.id, "expenses.approve_low")) ||
    (await requirePermission(session.user.id, "expenses.approve_medium")) ||
    (await requirePermission(session.user.id, "expenses.approve_high"));

  if (!canEdit && !canApproveAny) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.vendorBill.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = vendorBillUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // State transitions
  if (parsed.data.action) {
    const action = parsed.data.action;

    if (action === "SUBMIT") {
      if (!canEdit) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      if (existing.status !== "DRAFT") {
        return NextResponse.json({ success: false, error: "Only DRAFT bills can be submitted." }, { status: 400 });
      }
      const updated = await prisma.vendorBill.update({ where: { id }, data: { status: "SUBMITTED" } });
      await logAudit({
        action: "SUBMIT_VENDOR_BILL",
        entity: "VendorBill",
        entityId: id,
        oldValue: existing.status,
        newValue: updated.status,
        reason: parsed.data.reason || null,
        userId: session.user.id,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "APPROVE") {
      if (!canApproveAny) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      if (existing.status !== "SUBMITTED") {
        return NextResponse.json({ success: false, error: "Only SUBMITTED bills can be approved." }, { status: 400 });
      }
      const amount = Number(existing.totalAmount);
      const { canApprove, reason } = await canUserApprove(session.user.id, { module: "expense", amount });
      if (!canApprove) {
        return NextResponse.json({ success: false, error: reason || "Not allowed to approve this amount." }, { status: 403 });
      }

      const updated = await prisma.vendorBill.update({
        where: { id },
        data: { status: "APPROVED" },
      });
      await logAudit({
        action: "APPROVE_VENDOR_BILL",
        entity: "VendorBill",
        entityId: id,
        oldValue: existing.status,
        newValue: updated.status,
        reason: parsed.data.reason || null,
        userId: session.user.id,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "POST") {
      if (!canApproveAny) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      if (existing.status !== "APPROVED") {
        return NextResponse.json({ success: false, error: "Only APPROVED bills can be posted." }, { status: 400 });
      }
      const updated = await prisma.vendorBill.update({ where: { id }, data: { status: "POSTED" } });
      await logAudit({
        action: "POST_VENDOR_BILL",
        entity: "VendorBill",
        entityId: id,
        oldValue: existing.status,
        newValue: updated.status,
        reason: parsed.data.reason || null,
        userId: session.user.id,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "VOID") {
      if (!canApproveAny) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      if (existing.status === "POSTED") {
        return NextResponse.json({ success: false, error: "Posted bills cannot be voided (use reversal later)." }, { status: 400 });
      }
      const updated = await prisma.vendorBill.update({ where: { id }, data: { status: "VOID" } });
      await logAudit({
        action: "VOID_VENDOR_BILL",
        entity: "VendorBill",
        entityId: id,
        oldValue: existing.status,
        newValue: updated.status,
        reason: parsed.data.reason || null,
        userId: session.user.id,
      });
      return NextResponse.json({ success: true, data: updated });
    }
  }

  // Field updates
  if (!canEdit) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  if (!isEditableStatus(existing.status)) {
    return NextResponse.json({ success: false, error: "Only DRAFT bills can be edited." }, { status: 400 });
  }

  const nextLines = parsed.data.lines;
  const totalAmount =
    nextLines?.reduce((sum, line) => sum + Number(line.total), 0) ?? Number(existing.totalAmount);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (nextLines) {
        await tx.vendorBillLine.deleteMany({ where: { vendorBillId: id } });
        await tx.vendorBillLine.createMany({
          data: nextLines.map((line) => ({
            vendorBillId: id,
            description: line.description,
            total: new Prisma.Decimal(line.total),
            project: line.project || null,
          })),
        });
      }

      return tx.vendorBill.update({
        where: { id },
        data: {
          billNumber: parsed.data.billNumber,
          vendorId: parsed.data.vendorId,
          billDate: parsed.data.billDate ? new Date(parsed.data.billDate) : undefined,
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : parsed.data.dueDate === "" ? null : undefined,
          currency: parsed.data.currency,
          notes: parsed.data.notes,
          totalAmount: new Prisma.Decimal(totalAmount),
        },
        include: { lines: true },
      });
    });

    await logAudit({
      action: "UPDATE_VENDOR_BILL",
      entity: "VendorBill",
      entityId: id,
      oldValue: JSON.stringify({ ...existing, totalAmount: Number(existing.totalAmount) }),
      newValue: JSON.stringify(parsed.data),
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json({ success: false, error: "Bill number already exists" }, { status: 400 });
    }
    console.error("Error updating vendor bill:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "procurement.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const bill = await prisma.vendorBill.findUnique({
    where: { id },
    include: { allocations: true },
  });
  if (!bill) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (bill.status !== "DRAFT") {
    return NextResponse.json({ success: false, error: "Only DRAFT bills can be deleted." }, { status: 400 });
  }
  if (bill.allocations.length > 0) {
    return NextResponse.json({ success: false, error: "Cannot delete: bill has payment allocations." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorBillLine.deleteMany({ where: { vendorBillId: id } });
    await tx.vendorBill.delete({ where: { id } });
  });

  await logAudit({
    action: "DELETE_VENDOR_BILL",
    entity: "VendorBill",
    entityId: id,
    oldValue: JSON.stringify({ status: bill.status, billNumber: bill.billNumber }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}

