import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incentiveUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { resolveProjectId } from "@/lib/projects";

async function applyIncentiveApproval(
  tx: Prisma.TransactionClient,
  incentive: {
    id: string;
    employeeId: string;
    amount: Prisma.Decimal;
    projectRef?: string | null;
    expenseId?: string | null;
    walletLedgerId?: string | null;
  },
  approvedById: string
) {
  if (incentive.expenseId || incentive.walletLedgerId) {
    return { expenseId: incentive.expenseId, walletLedgerId: incentive.walletLedgerId };
  }

  const employee = await tx.employee.findUnique({ where: { id: incentive.employeeId } });
  if (!employee) {
    throw new Error("Employee not found");
  }

  const projectRef = incentive.projectRef || null;
  const expense = await tx.expense.create({
    data: {
      date: new Date(),
      description: `Incentive for ${projectRef || "project"}`,
      category: "Incentive",
      amount: new Prisma.Decimal(incentive.amount),
      paymentMode: "Wallet Credit",
      paymentSource: "COMPANY_ACCOUNT",
      expenseType: "COMPANY",
      project: projectRef || undefined,
      status: "APPROVED",
      approvalLevel: "INCENTIVE",
      submittedById: approvedById,
      approvedById,
      approvedAmount: new Prisma.Decimal(incentive.amount),
    },
  });

  const newBalance = Number(employee.walletBalance) + Number(incentive.amount);
  const ledger = await tx.walletLedger.create({
    data: {
      date: new Date(),
      employeeId: employee.id,
      type: "CREDIT",
      amount: new Prisma.Decimal(incentive.amount),
      reference: `INCENTIVE:${incentive.id}`,
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

  const canEdit = await requirePermission(session.user.id, "incentives.edit");
  const canApprove = await requirePermission(session.user.id, "incentives.approve");
  if (!canEdit && !canApprove) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.incentiveEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Incentive not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = incentiveUpdateSchema.safeParse(body);
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
    const project = await prisma.project.findFirst({
      where: { projectId: resolvedProject },
      select: { status: true },
    });
    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }
    const statusValue = (project.status || "").toLowerCase();
    if (!statusValue.includes("complete") && !statusValue.includes("closed") && !statusValue.includes("done")) {
      return NextResponse.json(
        { success: false, error: "Incentives can only be recorded for completed projects" },
        { status: 400 }
      );
    }
    data.projectRef = projectRef;
  }
  if (parsed.data.amount !== undefined) data.amount = new Prisma.Decimal(parsed.data.amount);
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
    const entry = await tx.incentiveEntry.update({
      where: { id },
      data,
      include: { employee: true },
    });

    if (entry.status === "APPROVED") {
      const approval = await applyIncentiveApproval(tx, entry, session.user.id);
      return tx.incentiveEntry.update({
        where: { id: entry.id },
        data: {
          expenseId: approval.expenseId,
          walletLedgerId: approval.walletLedgerId,
        },
        include: { employee: true },
      });
    }

    return entry;
  });

  await logAudit({
    action: "UPDATE_INCENTIVE",
    entity: "IncentiveEntry",
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

  const canEdit = await requirePermission(session.user.id, "incentives.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.incentiveEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Incentive not found" }, { status: 404 });
  }

  await prisma.incentiveEntry.delete({ where: { id } });

  await logAudit({
    action: "DELETE_INCENTIVE",
    entity: "IncentiveEntry",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
