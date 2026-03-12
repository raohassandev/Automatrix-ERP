import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incentiveSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { computeProjectFinancialSnapshot, recalculateProjectFinancials, resolveProjectId } from "@/lib/projects";

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
  let expenseId = incentive.expenseId || null;
  let walletLedgerId = incentive.walletLedgerId || null;

  const payoutMode = String(incentive.payoutMode || "PAYROLL").toUpperCase();
  if (payoutMode === "PAYROLL") {
    return {
      expenseId: expenseId || null,
      walletLedgerId: walletLedgerId || null,
      settlementStatus: "UNSETTLED",
      settledAt: null,
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
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "incentives.view_all");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, unknown> = {};
  if (!canViewAll) {
    if (!session.user.email) {
      return NextResponse.json({ success: false, error: "User email missing" }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json({ success: true, data: [] });
    }
    where.employeeId = employee.id;
  }

  const data = await prisma.incentiveEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { employee: true },
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "incentives.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = incentiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const status = parsed.data.status ? sanitizeString(parsed.data.status) : "PENDING";
  const payoutMode = parsed.data.payoutMode ? sanitizeString(parsed.data.payoutMode) : "PAYROLL";
  const canApprove = await requirePermission(session.user.id, "incentives.approve");

  const projectRefRaw = sanitizeString(parsed.data.projectRef);
  const resolvedProject = await resolveProjectId(projectRefRaw);
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

  let amountResolved: ResolvedIncentiveAmount;
  try {
    amountResolved = await resolveIncentiveAmount({
      project,
      amount: parsed.data.amount,
      formulaType: parsed.data.formulaType,
      basisAmount: parsed.data.basisAmount,
      percent: parsed.data.percent,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to resolve incentive amount" },
      { status: 400 },
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const entry = await tx.incentiveEntry.create({
      data: {
        employeeId: sanitizeString(parsed.data.employeeId),
        projectRef: resolvedProject,
        amount: new Prisma.Decimal(amountResolved.amount),
        formulaType: amountResolved.formulaType,
        basisAmount:
          amountResolved.basisAmount !== null ? new Prisma.Decimal(amountResolved.basisAmount) : null,
        percent: amountResolved.percent !== null ? new Prisma.Decimal(amountResolved.percent) : null,
        payoutMode,
        settlementStatus: "UNSETTLED",
        status: status === "APPROVED" && canApprove ? "APPROVED" : "PENDING",
        reason: parsed.data.reason ? sanitizeString(parsed.data.reason) : null,
        approvedById: status === "APPROVED" && canApprove ? session.user.id : null,
      },
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
          settledAt: approval.settledAt,
        },
        include: { employee: true },
      });
    }

    return entry;
  });

  if (created.projectRef && created.status === "APPROVED") {
    await recalculateProjectFinancials(created.projectRef);
  }

  await logAudit({
    action: "CREATE_INCENTIVE",
    entity: "IncentiveEntry",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
