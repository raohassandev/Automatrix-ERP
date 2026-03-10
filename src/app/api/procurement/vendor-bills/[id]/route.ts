import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { canUserApprove } from "@/lib/approval-engine";
import { recalculateProjectFinancials, resolveProjectId } from "@/lib/projects";
import { createPostedJournal, GL_CODES } from "@/lib/accounting";

const billLineSchema = z
  .object({
    description: z.string().trim().min(1),
    itemId: z.string().trim().min(1).optional(),
    quantity: z.number().finite().positive().optional(),
    unit: z.string().trim().optional(),
    unitCost: z.number().finite().nonnegative().optional(),
    total: z.number().finite().nonnegative().optional(),
    project: z.string().trim().optional(),
    grnItemId: z.string().trim().min(1).optional(),
  })
  .refine(
    (line) => {
      const hasQtyCost = typeof line.quantity === "number" && typeof line.unitCost === "number";
      const hasTotal = typeof line.total === "number";
      return hasQtyCost || hasTotal;
    },
    { message: "Each line must include either total or (quantity + unitCost)." }
  );

const vendorBillUpdateSchema = z.object({
  billNumber: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1).optional(),
  projectRef: z.string().trim().min(1).optional(),
  billDate: z.string().trim().min(1).optional(),
  dueDate: z.string().trim().optional(),
  currency: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  lines: z.array(billLineSchema).min(1).optional(),
  action: z.enum(["SUBMIT", "APPROVE", "POST", "VOID"]).optional(),
  reason: z.string().trim().optional(),
  ignoreDuplicate: z.boolean().optional(),
});

async function findPotentialDuplicateBill(args: {
  vendorId: string;
  projectRef?: string | null;
  billDate: string;
  totalAmount: number;
  excludeId?: string;
}) {
  const billDate = new Date(args.billDate);
  const start = new Date(billDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(billDate);
  end.setHours(23, 59, 59, 999);
  return prisma.vendorBill.findFirst({
    where: {
      id: args.excludeId ? { not: args.excludeId } : undefined,
      vendorId: args.vendorId,
      projectRef: args.projectRef || null,
      billDate: { gte: start, lte: end },
      totalAmount: new Prisma.Decimal(args.totalAmount.toFixed(2)),
      status: { not: "VOID" },
    },
    select: { id: true, billNumber: true, status: true },
  });
}

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
      projectRef: bill.projectRef,
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
        itemId: l.itemId,
        quantity: l.quantity ? Number(l.quantity) : null,
        unit: l.unit,
        unitCost: l.unitCost ? Number(l.unitCost) : null,
        total: Number(l.total),
        project: l.project,
        grnItemId: l.grnItemId,
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
      const { canApprove, reason } = await canUserApprove(session.user.id, { module: "procurement", amount });
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
      const totalAmount = Number(existing.totalAmount);
      if (totalAmount <= 0) {
        return NextResponse.json({ success: false, error: "Cannot post a zero-value vendor bill." }, { status: 400 });
      }

      const posted = await prisma.$transaction(async (tx) => {
        const updated = await tx.vendorBill.update({ where: { id }, data: { status: "POSTED" } });
        const project = existing.projectRef
          ? await tx.project.findFirst({
              where: {
                OR: [
                  { id: existing.projectRef },
                  { projectId: existing.projectRef },
                  { name: existing.projectRef },
                ],
              },
              select: { id: true },
            })
          : null;

        const debitByCode = new Map<string, number>();
        for (const line of existing.lines) {
          const lineTotal = Number(line.total || 0);
          if (lineTotal <= 0) continue;
          const code = line.itemId ? GL_CODES.INVENTORY_ASSET : GL_CODES.PURCHASE_EXPENSE;
          debitByCode.set(code, (debitByCode.get(code) || 0) + lineTotal);
        }

        const debitLines = Array.from(debitByCode.entries()).map(([glCode, amount]) => ({
          glCode,
          debit: amount,
          projectId: project?.id || null,
          partyId: existing.vendorId,
        }));

        await createPostedJournal(tx, {
          sourceType: "VENDOR_BILL",
          sourceId: id,
          documentDate: new Date(existing.billDate),
          postingDate: new Date(existing.billDate),
          createdById: session.user.id,
          postedById: session.user.id,
          voucherPrefix: "VB",
          memo: `Vendor Bill ${existing.billNumber}`,
          lines: [
            ...debitLines,
            {
              glCode: GL_CODES.AP_CONTROL,
              credit: totalAmount,
              projectId: project?.id || null,
              partyId: existing.vendorId,
            },
          ],
        });

        return updated;
      });
      if (posted.projectRef) {
        await recalculateProjectFinancials(posted.projectRef);
      }
      await logAudit({
        action: "POST_VENDOR_BILL",
        entity: "VendorBill",
        entityId: id,
        oldValue: existing.status,
        newValue: posted.status,
        reason: parsed.data.reason || null,
        userId: session.user.id,
      });
      return NextResponse.json({ success: true, data: posted });
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
    await logAudit({
      action: "BLOCK_EDIT_NON_DRAFT",
      entity: "VendorBill",
      entityId: id,
      oldValue: existing.status,
      newValue: existing.status,
      reason: "Attempted field edit when status is not DRAFT (Phase 1 immutability).",
      userId: session.user.id,
    });
    return NextResponse.json({ success: false, error: "Only DRAFT bills can be edited." }, { status: 400 });
  }

  const effectiveProjectRefRaw = parsed.data.projectRef ?? existing.projectRef;
  const effectiveProjectRef = effectiveProjectRefRaw ? await resolveProjectId(effectiveProjectRefRaw) : null;
  if (effectiveProjectRefRaw && !effectiveProjectRef) {
    return NextResponse.json({ success: false, error: "Project not found." }, { status: 400 });
  }

  const nextLines = parsed.data.lines;
  const normalizedLines = nextLines
    ? nextLines.map((line) => {
        const total =
          typeof line.quantity === "number" && typeof line.unitCost === "number"
            ? line.quantity * line.unitCost
            : Number(line.total || 0);
        return { ...line, total };
      })
    : null;

  const totalAmount = Number(
    (normalizedLines?.reduce((sum, line) => sum + Number(line.total), 0) ?? Number(existing.totalAmount)).toFixed(2)
  );

  if (!parsed.data.ignoreDuplicate) {
    const effectiveVendorId = parsed.data.vendorId ?? existing.vendorId;
    const effectiveBillDate = parsed.data.billDate ?? existing.billDate.toISOString();
    const duplicate = await findPotentialDuplicateBill({
      vendorId: effectiveVendorId,
      projectRef: effectiveProjectRef,
      billDate: effectiveBillDate,
      totalAmount,
      excludeId: id,
    });
    if (duplicate) {
      await logAudit({
        action: "BLOCK_POTENTIAL_DUPLICATE_VENDOR_BILL",
        entity: "VendorBill",
        entityId: duplicate.id,
        userId: session.user.id,
        reason: "Potential duplicate vendor bill detected on update.",
        newValue: JSON.stringify({
          duplicateBillNumber: duplicate.billNumber,
          vendorId: effectiveVendorId,
          projectRef: effectiveProjectRef,
          billDate: effectiveBillDate,
          totalAmount,
        }),
      });
      return NextResponse.json(
        {
          success: false,
          error: `Potential duplicate vendor bill found (${duplicate.billNumber}). Use ignoreDuplicate=true to proceed if intentional.`,
          duplicateBillId: duplicate.id,
          duplicateBillNumber: duplicate.billNumber,
        },
        { status: 409 }
      );
    }
  }

  try {
    if (nextLines) {
      const grnItemIds = nextLines.map((l) => l.grnItemId).filter(Boolean) as string[];
      const incomingQtyByGrnItem = new Map<string, number>();
      for (const line of nextLines) {
        if (!line.grnItemId) continue;
        if (!(typeof line.quantity === "number" && line.quantity > 0)) {
          return NextResponse.json(
            {
              success: false,
              error: "GRN-linked bill lines require quantity for quantity-cap control.",
            },
            { status: 400 }
          );
        }
        incomingQtyByGrnItem.set(
          line.grnItemId,
          (incomingQtyByGrnItem.get(line.grnItemId) || 0) + line.quantity
        );
      }
      if (grnItemIds.length > 0) {
        const grnItems = await prisma.goodsReceiptItem.findMany({
          where: { id: { in: grnItemIds } },
          include: { goodsReceipt: { include: { purchaseOrder: true } } },
        });
        const byId = new Map(grnItems.map((i) => [i.id, i]));
        const effectiveVendorId = parsed.data.vendorId ?? existing.vendorId;
        for (const ref of grnItemIds) {
          const item = byId.get(ref);
          if (!item) {
            return NextResponse.json({ success: false, error: "Invalid GRN item reference on bill line." }, { status: 400 });
          }
          if ((item.goodsReceipt.status || "").toUpperCase() === "VOID") {
            return NextResponse.json({ success: false, error: "Cannot bill against a VOID GRN." }, { status: 400 });
          }
          const grnProjectRaw = item.goodsReceipt.projectRef || item.goodsReceipt.purchaseOrder?.projectRef || null;
          const grnProject = grnProjectRaw ? await resolveProjectId(grnProjectRaw) : null;
          if (effectiveProjectRef) {
            if (grnProject !== effectiveProjectRef) {
              return NextResponse.json({ success: false, error: "GRN project does not match Vendor Bill project." }, { status: 400 });
            }
          } else if (grnProject) {
            return NextResponse.json(
              { success: false, error: "This GRN is project-linked. Select that project on the vendor bill." },
              { status: 400 }
            );
          }
          const poVendorId = item.goodsReceipt.purchaseOrder?.vendorId;
          if (poVendorId && poVendorId !== effectiveVendorId) {
            return NextResponse.json({ success: false, error: "GRN vendor does not match Vendor Bill vendor." }, { status: 400 });
          }
        }

        const existingLines = await prisma.vendorBillLine.findMany({
          where: {
            grnItemId: { in: Array.from(incomingQtyByGrnItem.keys()) },
            vendorBillId: { not: id },
            vendorBill: { status: { not: "VOID" } },
          },
          select: { grnItemId: true, quantity: true },
        });
        const existingQtyByGrnItem = new Map<string, number>();
        existingLines.forEach((line) => {
          if (!line.grnItemId) return;
          existingQtyByGrnItem.set(
            line.grnItemId,
            (existingQtyByGrnItem.get(line.grnItemId) || 0) + Number(line.quantity || 0)
          );
        });

        for (const [grnItemId, incomingQty] of incomingQtyByGrnItem.entries()) {
          const grnItem = byId.get(grnItemId);
          if (!grnItem) continue;
          const alreadyBilledQty = existingQtyByGrnItem.get(grnItemId) || 0;
          const maxQty = Number(grnItem.quantity || 0);
          if (alreadyBilledQty + incomingQty > maxQty + 0.00001) {
            return NextResponse.json(
              {
                success: false,
                error: `Billing quantity exceeds received quantity for GRN item ${grnItem.itemName}.`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (nextLines) {
        await tx.vendorBillLine.deleteMany({ where: { vendorBillId: id } });
        await tx.vendorBillLine.createMany({
          data: (normalizedLines || []).map((line) => ({
            vendorBillId: id,
            description: line.description,
            itemId: line.itemId || null,
            quantity: typeof line.quantity === "number" ? new Prisma.Decimal(line.quantity) : null,
            unit: line.unit || null,
            unitCost: typeof line.unitCost === "number" ? new Prisma.Decimal(line.unitCost) : null,
            total: new Prisma.Decimal(line.total),
            project: effectiveProjectRef,
            grnItemId: line.grnItemId || null,
          })),
        });
      }

      return tx.vendorBill.update({
        where: { id },
        data: {
          billNumber: parsed.data.billNumber,
          vendorId: parsed.data.vendorId,
          projectRef: effectiveProjectRef,
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
