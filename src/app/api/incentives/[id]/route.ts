import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incentiveUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { computeProjectFinancialSnapshot, recalculateProjectFinancials, resolveProjectId } from "@/lib/projects";
import { toMonthKey } from "@/lib/lifecycle";

type ResolvedIncentiveAmount = {
  amount: number;
  formulaType: "FIXED" | "PERCENT_PROFIT" | "PERCENT_AMOUNT";
  basisAmount: number | null;
  percent: number | null;
};

function isProjectClosedStatus(status: string | null | undefined) {
  const value = String(status || "").toLowerCase();
  return value.includes("complete") || value.includes("closed") || value.includes("done");
}

async function resolveIncentiveAmount(args: {
  project: {
    id: string;
    projectId: string;
    name: string;
    contractValue: Prisma.Decimal;
    status: string;
  };
  amount?: number;
  formulaType?: string;
  basisAmount?: number;
  percent?: number;
}): Promise<ResolvedIncentiveAmount> {
  const formulaType = (args.formulaType || "").trim().toUpperCase();
  const amount = typeof args.amount === "number" && Number.isFinite(args.amount) ? args.amount : null;
  const percent = typeof args.percent === "number" && Number.isFinite(args.percent) ? args.percent : null;
  const basisAmount =
    typeof args.basisAmount === "number" && Number.isFinite(args.basisAmount) ? args.basisAmount : null;

  if (amount !== null && amount > 0 && (!formulaType || formulaType === "FIXED")) {
    return {
      amount,
      formulaType: "FIXED",
      basisAmount: null,
      percent: null,
    };
  }

  if (percent !== null && percent > 0 && (formulaType === "PERCENT_PROFIT" || formulaType === "PERCENT_AMOUNT")) {
    if (formulaType === "PERCENT_PROFIT") {
      const snapshot = await computeProjectFinancialSnapshot(args.project);
      const projectProfit = Number(snapshot.projectProfit || 0);
      const computed = Number(((projectProfit * percent) / 100).toFixed(2));
      if (!Number.isFinite(computed) || computed <= 0) {
        throw new Error("Computed incentive from project profit is not positive.");
      }
      return {
        amount: computed,
        formulaType: "PERCENT_PROFIT",
        basisAmount: projectProfit,
        percent,
      };
    }

    if (basisAmount === null || basisAmount < 0) {
      throw new Error("Basis amount is required for percent-of-amount incentive.");
    }
    const computed = Number(((basisAmount * percent) / 100).toFixed(2));
    if (!Number.isFinite(computed) || computed <= 0) {
      throw new Error("Computed incentive amount must be positive.");
    }
    return {
      amount: computed,
      formulaType: "PERCENT_AMOUNT",
      basisAmount,
      percent,
    };
  }

  if (amount !== null && amount > 0) {
    return {
      amount,
      formulaType: "FIXED",
      basisAmount: null,
      percent: null,
    };
  }

  throw new Error("Provide amount, or percent with valid basis.");
}

async function applyIncentiveApproval(
  tx: Prisma.TransactionClient,
  incentive: {
    id: string;
    employeeId: string;
    amount: Prisma.Decimal;
    projectRef?: string | null;
    payoutMode: string;
    reason?: string | null;
    expenseId?: string | null;
    walletLedgerId?: string | null;
  },
  approvedById: string,
) {
  const expenseId = incentive.expenseId || null;
  let walletLedgerId = incentive.walletLedgerId || null;

  const payoutMode = String(incentive.payoutMode || "PAYROLL").toUpperCase();
  if (payoutMode === "PAYROLL") {
    return {
      expenseId: expenseId || null,
      walletLedgerId: walletLedgerId || null,
      settlementStatus: "UNSETTLED",
      settledAt: null,
      settledMonth: null,
    };
  }

  if (payoutMode === "WALLET" && !walletLedgerId) {
    const employee = await tx.employee.findUnique({ where: { id: incentive.employeeId } });
    if (!employee) {
      throw new Error("Employee not found");
    }

    const newBalance = Number(employee.walletBalance) + Number(incentive.amount);
    const ledger = await tx.walletLedger.create({
      data: {
        date: new Date(),
        employeeId: employee.id,
        type: "CREDIT",
        amount: new Prisma.Decimal(incentive.amount),
        reference: `INCENTIVE:${incentive.id}`,
        balance: new Prisma.Decimal(newBalance),
        sourceType: "INCENTIVE",
        sourceId: incentive.id,
        postedById: approvedById,
        postedAt: new Date(),
      },
    });
    await tx.employee.update({
      where: { id: employee.id },
      data: { walletBalance: new Prisma.Decimal(newBalance) },
    });
    walletLedgerId = ledger.id;
  }

  const settled = payoutMode === "WALLET" || Boolean(walletLedgerId);
  return {
    expenseId,
    walletLedgerId,
    settlementStatus: settled ? "SETTLED" : "UNSETTLED",
    settledAt: settled ? new Date() : null,
    settledMonth: settled ? toMonthKey(new Date()) : null,
  };
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
      { status: 400 },
    );
  }

  const nextProjectRefRaw =
    parsed.data.projectRef !== undefined ? sanitizeString(parsed.data.projectRef || "") : existing.projectRef || "";
  if (!nextProjectRefRaw) {
    return NextResponse.json({ success: false, error: "Project reference is required" }, { status: 400 });
  }
  const resolvedProject = await resolveProjectId(nextProjectRefRaw);
  if (!resolvedProject) {
    return NextResponse.json({ success: false, error: "Invalid project reference" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { projectId: resolvedProject },
    select: { id: true, projectId: true, name: true, status: true, contractValue: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  if (!isProjectClosedStatus(project.status)) {
    return NextResponse.json(
      { success: false, error: "Incentives can only be recorded for completed projects" },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {
    projectRef: resolvedProject,
  };
  if (parsed.data.employeeId) data.employeeId = sanitizeString(parsed.data.employeeId);
  if (parsed.data.reason !== undefined) {
    data.reason = parsed.data.reason ? sanitizeString(parsed.data.reason) : null;
  }
  if (parsed.data.earningDate !== undefined) {
    const value = parsed.data.earningDate ? new Date(parsed.data.earningDate) : null;
    if (value && Number.isNaN(value.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid earning date" }, { status: 400 });
    }
    data.earningDate = value;
  }
  if (parsed.data.payoutMode !== undefined) {
    data.payoutMode = sanitizeString(parsed.data.payoutMode).toUpperCase();
  }
  const nextPayoutMode = String((data.payoutMode as string | undefined) || existing.payoutMode || "PAYROLL").toUpperCase();
  const nextEarningDate =
    (data.earningDate as Date | null | undefined) || existing.earningDate || new Date(existing.createdAt);

  if (nextPayoutMode === "PAYROLL") {
    data.scheduledPayrollMonth = parsed.data.scheduledPayrollMonth || existing.scheduledPayrollMonth || toMonthKey(nextEarningDate);
    data.dueDate = null;
  } else {
    data.scheduledPayrollMonth = null;
    if (parsed.data.dueDate !== undefined) {
      const due = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
      if (due && Number.isNaN(due.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid due date" }, { status: 400 });
      }
      data.dueDate = due;
    } else if (existing.payoutMode !== nextPayoutMode) {
      data.dueDate = null;
    }
  }

  const amountInput = parsed.data.amount !== undefined ? parsed.data.amount : Number(existing.amount || 0);
  const formulaTypeInput = parsed.data.formulaType !== undefined ? parsed.data.formulaType : existing.formulaType || "FIXED";
  const basisAmountInput =
    parsed.data.basisAmount !== undefined
      ? parsed.data.basisAmount
      : existing.basisAmount !== null
      ? Number(existing.basisAmount)
      : undefined;
  const percentInput =
    parsed.data.percent !== undefined
      ? parsed.data.percent
      : existing.percent !== null
      ? Number(existing.percent)
      : undefined;

  let amountResolved: ResolvedIncentiveAmount;
  try {
    amountResolved = await resolveIncentiveAmount({
      project,
      amount: amountInput,
      formulaType: formulaTypeInput || undefined,
      basisAmount: basisAmountInput,
      percent: percentInput,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to resolve incentive amount" },
      { status: 400 },
    );
  }

  data.amount = new Prisma.Decimal(amountResolved.amount);
  data.formulaType = amountResolved.formulaType;
  data.basisAmount = amountResolved.basisAmount !== null ? new Prisma.Decimal(amountResolved.basisAmount) : null;
  data.percent = amountResolved.percent !== null ? new Prisma.Decimal(amountResolved.percent) : null;

  if (parsed.data.status) {
    const nextStatus = sanitizeString(parsed.data.status).toUpperCase();
    if (nextStatus === "APPROVED" && !canApprove) {
      return NextResponse.json({ success: false, error: "Approval permission required" }, { status: 403 });
    }
    data.status = nextStatus;
    data.approvedById = nextStatus === "APPROVED" ? session.user.id : null;
    data.approvedAt = nextStatus === "APPROVED" ? new Date() : null;
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
          settlementStatus: approval.settlementStatus,
          settledMonth: approval.settledMonth,
          settledAt: approval.settledAt,
        },
        include: { employee: true },
      });
    }

    return entry;
  });

  if (updated.projectRef && updated.status === "APPROVED") {
    await recalculateProjectFinancials(updated.projectRef);
  }

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

  if (String(existing.status || "").toUpperCase() !== "PENDING") {
    await logAudit({
      action: "BLOCK_DELETE_INCENTIVE_NON_PENDING",
      entity: "IncentiveEntry",
      entityId: id,
      reason: `Delete blocked for status=${existing.status}`,
      userId: session.user.id,
    });
    return NextResponse.json(
      { success: false, error: "Only PENDING incentives can be deleted. Use correction workflow for approved entries." },
      { status: 400 },
    );
  }

  if ((existing.settlementStatus || "UNSETTLED") === "SETTLED") {
    return NextResponse.json(
      { success: false, error: "Settled incentives cannot be deleted." },
      { status: 400 },
    );
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
