import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { canUserApprove } from "@/lib/approval-engine";
import { resolveProjectId } from "@/lib/projects";
import { createPostedJournal, GL_CODES } from "@/lib/accounting";

const allocationSchema = z.object({
  vendorBillId: z.string().trim().min(1),
  amount: z.number().finite().nonnegative(),
});

const vendorPaymentUpdateSchema = z.object({
  paymentNumber: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1).optional(),
  projectRef: z.string().trim().min(1).optional(),
  paymentDate: z.string().trim().min(1).optional(),
  companyAccountId: z.string().trim().min(1).optional(),
  method: z.string().trim().optional(),
  amount: z.number().finite().nonnegative().optional(),
  notes: z.string().trim().optional(),
  allocations: z.array(allocationSchema).optional(),
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

  // Vendor payments are finance/AP only (Phase 1).
  const canView = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const payment = await prisma.vendorPayment.findUnique({
    where: { id },
    include: { vendor: true, companyAccount: true, allocations: true },
  });
  if (!payment) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const allocated = payment.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  const amount = Number(payment.amount);

  return NextResponse.json({
    success: true,
    data: {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      vendorId: payment.vendorId,
      projectRef: payment.projectRef,
      paymentDate: payment.paymentDate.toISOString(),
      companyAccountId: payment.companyAccountId,
      method: payment.method,
      amount,
      status: payment.status,
      notes: payment.notes,
      vendor: { id: payment.vendor.id, name: payment.vendor.name },
      companyAccount: { id: payment.companyAccount.id, name: payment.companyAccount.name },
      allocations: payment.allocations.map((a) => ({ id: a.id, vendorBillId: a.vendorBillId, amount: Number(a.amount) })),
      allocatedAmount: allocated,
      unallocatedAmount: Math.max(0, amount - allocated),
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Vendor payments are finance/AP only (Phase 1).
  const canEdit = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const canApproveAny =
    (await requirePermission(session.user.id, "approvals.approve_low")) ||
    (await requirePermission(session.user.id, "approvals.approve_high")) ||
    (await requirePermission(session.user.id, "expenses.approve_low")) ||
    (await requirePermission(session.user.id, "expenses.approve_medium")) ||
    (await requirePermission(session.user.id, "expenses.approve_high"));

  const { id } = await context.params;
  const existing = await prisma.vendorPayment.findUnique({
    where: { id },
    include: { allocations: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = vendorPaymentUpdateSchema.safeParse(body);
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
        return NextResponse.json({ success: false, error: "Only DRAFT payments can be submitted." }, { status: 400 });
      }
      if (!existing.projectRef) {
        return NextResponse.json(
          { success: false, error: "Project is required on Vendor Payments (Phase 1). Please set a project before submitting." },
          { status: 400 }
        );
      }
      const updated = await prisma.vendorPayment.update({ where: { id }, data: { status: "SUBMITTED" } });
      await logAudit({
        action: "SUBMIT_VENDOR_PAYMENT",
        entity: "VendorPayment",
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
        return NextResponse.json({ success: false, error: "Only SUBMITTED payments can be approved." }, { status: 400 });
      }
      const amount = Number(existing.amount);
      const { canApprove, reason } = await canUserApprove(session.user.id, { module: "procurement", amount });
      if (!canApprove) {
        return NextResponse.json({ success: false, error: reason || "Not allowed to approve this amount." }, { status: 403 });
      }
      const updated = await prisma.vendorPayment.update({ where: { id }, data: { status: "APPROVED" } });
      await logAudit({
        action: "APPROVE_VENDOR_PAYMENT",
        entity: "VendorPayment",
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
        return NextResponse.json({ success: false, error: "Only APPROVED payments can be posted." }, { status: 400 });
      }
      const paymentAmount = Number(existing.amount);
      if (paymentAmount <= 0) {
        return NextResponse.json({ success: false, error: "Cannot post a zero-value vendor payment." }, { status: 400 });
      }

      // Enforce allocation does not overpay bills (considering only POSTED payments as "real").
      const allocations = await prisma.vendorPaymentAllocation.findMany({
        where: { vendorPaymentId: id },
      });

      const billIds = Array.from(new Set(allocations.map((a) => a.vendorBillId)));
      if (billIds.length > 0) {
        const paymentProject = existing.projectRef ? await resolveProjectId(existing.projectRef) : null;
        if (!paymentProject) {
          return NextResponse.json(
            { success: false, error: "Project is required on Vendor Payments (Phase 1)." },
            { status: 400 }
          );
        }

        const bills = await prisma.vendorBill.findMany({
          where: { id: { in: billIds } },
          select: { id: true, status: true, totalAmount: true, vendorId: true, projectRef: true },
        });
        const billMap = new Map(bills.map((b) => [b.id, b]));

        for (const alloc of allocations) {
          const bill = billMap.get(alloc.vendorBillId);
          if (!bill) {
            return NextResponse.json({ success: false, error: "Allocation references missing bill." }, { status: 400 });
          }
          if (bill.status !== "POSTED") {
            return NextResponse.json(
              { success: false, error: "Payments can only be posted against POSTED bills." },
              { status: 400 }
            );
          }
          if (bill.vendorId !== existing.vendorId) {
            return NextResponse.json(
              { success: false, error: "Payment allocations must match the payment vendor." },
              { status: 400 }
            );
          }
          const billProject = bill.projectRef ? await resolveProjectId(bill.projectRef) : null;
          if (!billProject || billProject !== paymentProject) {
            return NextResponse.json(
              { success: false, error: "Payment allocations must match the payment project (Phase 1)." },
              { status: 400 }
            );
          }

          const alreadyPaid = await prisma.vendorPaymentAllocation.aggregate({
            where: {
              vendorBillId: bill.id,
              vendorPayment: { status: "POSTED" },
            },
            _sum: { amount: true },
          });
          const paid = Number(alreadyPaid._sum.amount || 0);
          const newPaid = paid + Number(alloc.amount);
          if (newPaid > Number(bill.totalAmount) + 0.00001) {
            return NextResponse.json(
              { success: false, error: `Allocation exceeds outstanding for bill ${bill.id}.` },
              { status: 400 }
            );
          }
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const payment = await tx.vendorPayment.update({ where: { id }, data: { status: "POSTED" } });
        await tx.vendorPaymentAllocation.updateMany({
          where: { vendorPaymentId: id },
          data: {
            sourceType: "VENDOR_PAYMENT",
            sourceId: id,
            postedById: session.user.id,
            postedAt: payment.paymentDate,
          },
        });

        const companyAccount = await tx.companyAccount.findUnique({
          where: { id: payment.companyAccountId },
          select: { type: true },
        });
        if (!companyAccount) {
          throw new Error("Company account not found for vendor payment posting.");
        }

        const project = payment.projectRef
          ? await tx.project.findFirst({
              where: {
                OR: [{ id: payment.projectRef }, { projectId: payment.projectRef }, { name: payment.projectRef }],
              },
              select: { id: true },
            })
          : null;

        const cashCode = (companyAccount.type || "").toUpperCase() === "BANK" ? GL_CODES.BANK_MAIN : GL_CODES.CASH_ON_HAND;
        await createPostedJournal(tx, {
          sourceType: "VENDOR_PAYMENT",
          sourceId: id,
          documentDate: new Date(payment.paymentDate),
          postingDate: new Date(payment.paymentDate),
          createdById: session.user.id,
          postedById: session.user.id,
          voucherPrefix: "VP",
          memo: `Vendor Payment ${payment.paymentNumber}`,
          lines: [
            {
              glCode: GL_CODES.AP_CONTROL,
              debit: paymentAmount,
              projectId: project?.id || null,
              partyId: payment.vendorId,
            },
            {
              glCode: cashCode,
              credit: paymentAmount,
              projectId: project?.id || null,
              partyId: payment.vendorId,
            },
          ],
        });
        return payment;
      });
      await logAudit({
        action: "POST_VENDOR_PAYMENT",
        entity: "VendorPayment",
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
        return NextResponse.json(
          { success: false, error: "Posted payments cannot be voided (use reversal later)." },
          { status: 400 }
        );
      }
      const updated = await prisma.vendorPayment.update({ where: { id }, data: { status: "VOID" } });
      await logAudit({
        action: "VOID_VENDOR_PAYMENT",
        entity: "VendorPayment",
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
      entity: "VendorPayment",
      entityId: id,
      oldValue: existing.status,
      newValue: existing.status,
      reason: "Attempted field edit when status is not DRAFT (Phase 1 immutability).",
      userId: session.user.id,
    });
    return NextResponse.json({ success: false, error: "Only DRAFT payments can be edited." }, { status: 400 });
  }

  const effectiveVendorId = parsed.data.vendorId ?? existing.vendorId;
  const effectiveProjectRefRaw = parsed.data.projectRef ?? existing.projectRef;
  const effectiveProjectRef = effectiveProjectRefRaw ? await resolveProjectId(effectiveProjectRefRaw) : null;
  if (!effectiveProjectRef) {
    return NextResponse.json(
      { success: false, error: "Project is required on Vendor Payments (Phase 1)." },
      { status: 400 }
    );
  }

  const nextAllocations = parsed.data.allocations;

  const nextAmount = typeof parsed.data.amount === "number" ? parsed.data.amount : Number(existing.amount);
  const allocationSum =
    nextAllocations?.reduce((sum, a) => sum + Number(a.amount), 0) ??
    existing.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  if (allocationSum > nextAmount) {
    return NextResponse.json(
      { success: false, error: "Allocation total cannot exceed payment amount." },
      { status: 400 }
    );
  }

  try {
    const allocationsToCheck = (nextAllocations
      ? nextAllocations
      : existing.allocations.map((a) => ({ vendorBillId: a.vendorBillId, amount: Number(a.amount) }))
    ).filter((a) => a.amount > 0);

    if (allocationsToCheck.length > 0) {
      const billIds = Array.from(new Set(allocationsToCheck.map((a) => a.vendorBillId)));
      const bills = await prisma.vendorBill.findMany({
        where: { id: { in: billIds } },
        select: { id: true, vendorId: true, status: true, projectRef: true },
      });
      const byId = new Map(bills.map((b) => [b.id, b]));
      for (const alloc of allocationsToCheck) {
        const bill = byId.get(alloc.vendorBillId);
        if (!bill) {
          return NextResponse.json({ success: false, error: "Invalid vendor bill allocation." }, { status: 400 });
        }
        if (bill.vendorId !== effectiveVendorId) {
          return NextResponse.json({ success: false, error: "Allocations must match the selected vendor." }, { status: 400 });
        }
        if (bill.status !== "POSTED") {
          return NextResponse.json({ success: false, error: "Allocations are allowed only against POSTED bills." }, { status: 400 });
        }
        const billProject = bill.projectRef ? await resolveProjectId(bill.projectRef) : null;
        if (!billProject || billProject !== effectiveProjectRef) {
          return NextResponse.json({ success: false, error: "Allocations must match the payment project (Phase 1)." }, { status: 400 });
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (nextAllocations) {
        await tx.vendorPaymentAllocation.deleteMany({ where: { vendorPaymentId: id } });
        const rows = nextAllocations.filter((a) => a.amount > 0);
        if (rows.length > 0) {
          await tx.vendorPaymentAllocation.createMany({
            data: rows.map((a) => ({
              vendorPaymentId: id,
              vendorBillId: a.vendorBillId,
              amount: new Prisma.Decimal(a.amount),
              sourceType: "VENDOR_PAYMENT",
              sourceId: id,
            })),
          });
        }
      }

      return tx.vendorPayment.update({
        where: { id },
        data: {
          paymentNumber: parsed.data.paymentNumber,
          vendorId: parsed.data.vendorId,
          projectRef: effectiveProjectRef,
          paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : undefined,
          companyAccountId: parsed.data.companyAccountId,
          method: parsed.data.method,
          amount: typeof parsed.data.amount === "number" ? new Prisma.Decimal(parsed.data.amount) : undefined,
          notes: parsed.data.notes,
        },
        include: { allocations: true },
      });
    });

    await logAudit({
      action: "UPDATE_VENDOR_PAYMENT",
      entity: "VendorPayment",
      entityId: id,
      oldValue: JSON.stringify({ ...existing, amount: Number(existing.amount) }),
      newValue: JSON.stringify(parsed.data),
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Payment number already exists" },
        { status: 400 }
      );
    }
    console.error("Error updating vendor payment:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Vendor payments are finance/AP only (Phase 1).
  const canEdit = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const payment = await prisma.vendorPayment.findUnique({ where: { id }, include: { allocations: true } });
  if (!payment) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (payment.status !== "DRAFT") {
    return NextResponse.json({ success: false, error: "Only DRAFT payments can be deleted." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorPaymentAllocation.deleteMany({ where: { vendorPaymentId: id } });
    await tx.vendorPayment.delete({ where: { id } });
  });

  await logAudit({
    action: "DELETE_VENDOR_PAYMENT",
    entity: "VendorPayment",
    entityId: id,
    oldValue: JSON.stringify({ status: payment.status, paymentNumber: payment.paymentNumber }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
