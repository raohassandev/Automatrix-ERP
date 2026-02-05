import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commissionUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { resolveProjectId } from "@/lib/projects";

async function applyCommissionApproval(
  tx: Prisma.TransactionClient,
  commission: {
    id: string;
    employeeId: string;
    amount: Prisma.Decimal;
    projectRef?: string | null;
    expenseId?: string | null;
    walletLedgerId?: string | null;
  },
  approvedById: string
) {
  if (commission.expenseId || commission.walletLedgerId) {
    return { expenseId: commission.expenseId, walletLedgerId: commission.walletLedgerId };
  }

  const employee = await tx.employee.findUnique({ where: { id: commission.employeeId } });
  if (!employee) {
    throw new Error("Employee not found");
  }

  const projectRef = commission.projectRef || null;
  const expense = await tx.expense.create({
    data: {
      date: new Date(),
      description: `Commission for ${projectRef || "sales"}`,
      category: "Commission",
      amount: new Prisma.Decimal(commission.amount),
      paymentMode: "Wallet Credit",
      paymentSource: "COMPANY_ACCOUNT",
      expenseType: "COMPANY",
      project: projectRef || undefined,
      status: "APPROVED",
      approvalLevel: "COMMISSION",
      submittedById: approvedById,
      approvedById,
      approvedAmount: new Prisma.Decimal(commission.amount),
    },
  });

  const newBalance = Number(employee.walletBalance) + Number(commission.amount);
  const ledger = await tx.walletLedger.create({
    data: {
      date: new Date(),
      employeeId: employee.id,
      type: "CREDIT",
      amount: new Prisma.Decimal(commission.amount),
      reference: `COMMISSION:${commission.id}`,
      balance: new Prisma.Decimal(newBalance),
    },
  });
  await tx.employee.update({
    where: { id: employee.id },
    data: { walletBalance: new Prisma.Decimal(newBalance) },
  });

  return { expenseId: expense.id, walletLedgerId: ledger.id };
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "commissions.edit");
  const canApprove = await requirePermission(session.user.id, "commissions.approve");
  if (!canEdit && !canApprove) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.commissionEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Commission not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = commissionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.employeeId) data.employeeId = sanitizeString(parsed.data.employeeId);
  if (parsed.data.projectRef !== undefined) {
    const projectRef = parsed.data.projectRef ? sanitizeString(parsed.data.projectRef) : "";
    if (!projectRef) {
      return NextResponse.json({ success: false, error: "Project reference is required" }, { status: 400 });
    }
    const resolvedProject = await resolveProjectId(projectRef);
    if (!resolvedProject) {
      return NextResponse.json({ success: false, error: "Invalid project reference" }, { status: 400 });
    }
    data.projectRef = resolvedProject;
  }
  if (parsed.data.basisType !== undefined) {
    data.basisType = parsed.data.basisType ? sanitizeString(parsed.data.basisType) : null;
  }
  if (parsed.data.basisAmount !== undefined) {
    data.basisAmount =
      parsed.data.basisAmount !== null && parsed.data.basisAmount !== undefined
        ? new Prisma.Decimal(parsed.data.basisAmount)
        : null;
  }
  if (parsed.data.percent !== undefined) {
    data.percent =
      parsed.data.percent !== null && parsed.data.percent !== undefined
        ? new Prisma.Decimal(parsed.data.percent)
        : null;
  }
  if (parsed.data.amount !== undefined) {
    data.amount = new Prisma.Decimal(parsed.data.amount);
  } else if (parsed.data.basisAmount !== undefined && parsed.data.percent !== undefined) {
    const computed = (parsed.data.basisAmount ?? 0) * (parsed.data.percent ?? 0) / 100;
    data.amount = new Prisma.Decimal(computed);
  }
  if (parsed.data.reason !== undefined) {
    data.reason = parsed.data.reason ? sanitizeString(parsed.data.reason) : null;
  }
  if (parsed.data.status) {
    const nextStatus = sanitizeString(parsed.data.status);
    if (nextStatus === "APPROVED" && !canApprove) {
      return NextResponse.json({ success: false, error: "Approval permission required" }, { status: 403 });
    }
    data.status = nextStatus;
    data.approvedById = nextStatus === "APPROVED" ? session.user.id : null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const entry = await tx.commissionEntry.update({
      where: { id },
      data,
    });

    if (entry.status === "APPROVED") {
      const approval = await applyCommissionApproval(tx, entry, session.user.id);
      return tx.commissionEntry.update({
        where: { id: entry.id },
        data: {
          expenseId: approval.expenseId,
          walletLedgerId: approval.walletLedgerId,
        },
      });
    }

    return entry;
  });

  await logAudit({
    action: "UPDATE_COMMISSION",
    entity: "CommissionEntry",
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

  const canEdit = await requirePermission(session.user.id, "commissions.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.commissionEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Commission not found" }, { status: 404 });
  }

  await prisma.commissionEntry.delete({ where: { id } });

  await logAudit({
    action: "DELETE_COMMISSION",
    entity: "CommissionEntry",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
