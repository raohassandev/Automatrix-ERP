import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commissionSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { computeProjectFinancialSnapshot, recalculateProjectFinancials, resolveProjectId } from "@/lib/projects";

type ResolvedCommissionAmount = {
  amount: number;
  basisAmount: number | null;
  percent: number | null;
  basisType: string | null;
};

async function resolveCommissionAmount(args: {
  project: {
    id: string;
    projectId: string;
    name: string;
    contractValue: Prisma.Decimal;
    status: string;
  };
  amount?: number;
  basisType?: string;
  basisAmount?: number;
  percent?: number;
}): Promise<ResolvedCommissionAmount> {
  const basisType = args.basisType ? sanitizeString(args.basisType).toUpperCase() : null;
  const amount = typeof args.amount === "number" && Number.isFinite(args.amount) ? args.amount : null;
  const percent = typeof args.percent === "number" && Number.isFinite(args.percent) ? args.percent : null;
  const basisAmount =
    typeof args.basisAmount === "number" && Number.isFinite(args.basisAmount) ? args.basisAmount : null;

  if (amount !== null && amount > 0) {
    return {
      amount,
      basisAmount: basisAmount ?? null,
      percent: percent ?? null,
      basisType,
    };
  }

  if (percent !== null && percent > 0) {
    let resolvedBasis = basisAmount;
    if (basisType === "PROFIT") {
      const snapshot = await computeProjectFinancialSnapshot(args.project);
      resolvedBasis = Number(snapshot.projectProfit || 0);
    }

    if (resolvedBasis === null || resolvedBasis < 0) {
      throw new Error("Basis amount is required for percentage commission.");
    }

    const computed = Number(((resolvedBasis * percent) / 100).toFixed(2));
    if (!Number.isFinite(computed) || computed <= 0) {
      throw new Error("Computed commission amount must be positive.");
    }

    return {
      amount: computed,
      basisAmount: resolvedBasis,
      percent,
      basisType: basisType || "PERCENT",
    };
  }

  throw new Error("Amount is required or provide percent + basis amount.");
}

async function nextMiddlemanBillNumber(tx: Prisma.TransactionClient) {
  const prefix = `MB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  const existingCount = await tx.vendorBill.count({
    where: { billNumber: { startsWith: `${prefix}-` } },
  });
  return `${prefix}-${String(existingCount + 1).padStart(4, "0")}`;
}

async function applyCommissionApproval(
  tx: Prisma.TransactionClient,
  commission: {
    id: string;
    employeeId?: string | null;
    vendorId?: string | null;
    payeeType: string;
    amount: Prisma.Decimal;
    projectRef?: string | null;
    payoutMode: string;
    reason?: string | null;
    expenseId?: string | null;
    walletLedgerId?: string | null;
    payableBillId?: string | null;
  },
  approvedById: string,
) {
  if (commission.payeeType === "MIDDLEMAN") {
    if (!commission.vendorId) {
      throw new Error("Vendor is required for middleman commission.");
    }

    if (commission.payableBillId) {
      return {
        expenseId: commission.expenseId || null,
        walletLedgerId: commission.walletLedgerId || null,
        payableBillId: commission.payableBillId,
        settlementStatus: "UNSETTLED",
        settledAt: null,
      };
    }

    const projectRef = commission.projectRef || null;
    if (!projectRef) {
      throw new Error("Project reference is required for middleman commission.");
    }

    const billNumber = await nextMiddlemanBillNumber(tx);
    const billDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    if (String(commission.payoutMode || "AP").toUpperCase() !== "AP") {
      throw new Error("Middleman commission must use AP payout mode.");
    }

    const bill = await tx.vendorBill.create({
      data: {
        billNumber,
        vendorId: commission.vendorId,
        projectRef,
        billDate,
        dueDate,
        status: "SUBMITTED",
        currency: "PKR",
        totalAmount: new Prisma.Decimal(commission.amount),
        notes: commission.reason || "Middleman commission payable",
        lines: {
          create: [
            {
              description: `Middleman commission (${projectRef})`,
              total: new Prisma.Decimal(commission.amount),
              project: projectRef,
            },
          ],
        },
      },
      include: { lines: true },
    });

    return {
      expenseId: null,
      walletLedgerId: null,
      payableBillId: bill.id,
      settlementStatus: "UNSETTLED",
      settledAt: null,
    };
  }

  if (!commission.employeeId) {
    throw new Error("Employee is required for employee commission.");
  }

  let expenseId = commission.expenseId || null;
  let walletLedgerId = commission.walletLedgerId || null;
  const payoutMode = String(commission.payoutMode || "PAYROLL").toUpperCase();
  if (payoutMode === "PAYROLL") {
    return {
      expenseId: expenseId || null,
      walletLedgerId: walletLedgerId || null,
      payableBillId: null,
      settlementStatus: "UNSETTLED",
      settledAt: null,
    };
  }
  if (payoutMode === "WALLET" && !walletLedgerId) {
    const employee = await tx.employee.findUnique({ where: { id: commission.employeeId } });
    if (!employee) {
      throw new Error("Employee not found");
    }

    const newBalance = Number(employee.walletBalance) + Number(commission.amount);
    const ledger = await tx.walletLedger.create({
      data: {
        date: new Date(),
        employeeId: employee.id,
        type: "CREDIT",
        amount: new Prisma.Decimal(commission.amount),
        reference: `COMMISSION:${commission.id}`,
        balance: new Prisma.Decimal(newBalance),
        sourceType: "COMMISSION",
        sourceId: commission.id,
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
    payableBillId: null,
    settlementStatus: settled ? "SETTLED" : "UNSETTLED",
    settledAt: settled ? new Date() : null,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "commissions.view_all");
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

  const data = await prisma.commissionEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { employee: true, vendor: true },
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "commissions.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = commissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const canApprove = await requirePermission(session.user.id, "commissions.approve");

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

  const payeeType = parsed.data.payeeType ? sanitizeString(parsed.data.payeeType) : "EMPLOYEE";
  const payoutMode =
    parsed.data.payoutMode
      ? sanitizeString(parsed.data.payoutMode)
      : payeeType === "MIDDLEMAN"
      ? "AP"
      : "PAYROLL";

  if (payeeType === "EMPLOYEE" && !parsed.data.employeeId) {
    return NextResponse.json({ success: false, error: "Employee is required for employee commission" }, { status: 400 });
  }
  if (payeeType === "EMPLOYEE" && payoutMode === "AP") {
    return NextResponse.json({ success: false, error: "Employee commission cannot use AP payout mode." }, { status: 400 });
  }
  if (payeeType === "MIDDLEMAN") {
    if (payoutMode !== "AP") {
      return NextResponse.json({ success: false, error: "Middleman commission must use AP payout mode." }, { status: 400 });
    }
    if (!parsed.data.vendorId) {
      return NextResponse.json({ success: false, error: "Middleman vendor is required" }, { status: 400 });
    }
    const vendor = await prisma.vendor.findUnique({ where: { id: parsed.data.vendorId }, select: { id: true } });
    if (!vendor) {
      return NextResponse.json({ success: false, error: "Middleman vendor not found" }, { status: 400 });
    }
  }

  let amountResolved: ResolvedCommissionAmount;
  try {
    amountResolved = await resolveCommissionAmount({
      project,
      amount: parsed.data.amount,
      basisType: parsed.data.basisType,
      basisAmount: parsed.data.basisAmount,
      percent: parsed.data.percent,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to resolve commission amount" },
      { status: 400 },
    );
  }

  const status = parsed.data.status ? sanitizeString(parsed.data.status) : "PENDING";

  const created = await prisma.$transaction(async (tx) => {
    const entry = await tx.commissionEntry.create({
      data: {
        employeeId: payeeType === "EMPLOYEE" ? sanitizeString(parsed.data.employeeId || "") : null,
        vendorId: payeeType === "MIDDLEMAN" ? sanitizeString(parsed.data.vendorId || "") : null,
        payeeType,
        projectRef: resolvedProject,
        basisType: amountResolved.basisType,
        basisAmount:
          amountResolved.basisAmount !== null ? new Prisma.Decimal(amountResolved.basisAmount) : null,
        percent: amountResolved.percent !== null ? new Prisma.Decimal(amountResolved.percent) : null,
        payoutMode,
        amount: new Prisma.Decimal(amountResolved.amount),
        settlementStatus: "UNSETTLED",
        status: status === "APPROVED" && canApprove ? "APPROVED" : "PENDING",
        reason: parsed.data.reason ? sanitizeString(parsed.data.reason) : null,
        approvedById: status === "APPROVED" && canApprove ? session.user.id : null,
      },
      include: { employee: true, vendor: true },
    });

    if (entry.status === "APPROVED") {
      const approval = await applyCommissionApproval(tx, entry, session.user.id);
      return tx.commissionEntry.update({
        where: { id: entry.id },
        data: {
          expenseId: approval.expenseId,
          walletLedgerId: approval.walletLedgerId,
          payableBillId: approval.payableBillId,
          settlementStatus: approval.settlementStatus,
          settledAt: approval.settledAt,
        },
        include: { employee: true, vendor: true },
      });
    }

    return entry;
  });

  if (created.projectRef && created.status === "APPROVED") {
    await recalculateProjectFinancials(created.projectRef);
  }

  await logAudit({
    action: "CREATE_COMMISSION",
    entity: "CommissionEntry",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
