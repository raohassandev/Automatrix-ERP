import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commissionUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { computeProjectFinancialSnapshot, recalculateProjectFinancials, resolveProjectId } from "@/lib/projects";
import { createPostedJournal, GL_CODES } from "@/lib/accounting";

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

    const bill = await tx.vendorBill.create({
      data: {
        billNumber,
        vendorId: commission.vendorId,
        projectRef,
        billDate,
        dueDate,
        status: "POSTED",
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

    const projectDb = await tx.project.findFirst({
      where: {
        OR: [{ id: projectRef }, { projectId: projectRef }, { name: projectRef }],
      },
      select: { id: true },
    });

    await createPostedJournal(tx, {
      sourceType: "MIDDLEMAN_COMMISSION",
      sourceId: bill.id,
      documentDate: billDate,
      postingDate: billDate,
      createdById: approvedById,
      postedById: approvedById,
      voucherPrefix: "MC",
      memo: `Middleman commission ${bill.billNumber}`,
      lines: [
        {
          glCode: GL_CODES.OPERATING_EXPENSE,
          debit: Number(commission.amount),
          projectId: projectDb?.id || null,
          partyId: commission.vendorId,
        },
        {
          glCode: GL_CODES.AP_CONTROL,
          credit: Number(commission.amount),
          projectId: projectDb?.id || null,
          partyId: commission.vendorId,
        },
      ],
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

  if (!expenseId) {
    const projectRef = commission.projectRef || null;
    const expense = await tx.expense.create({
      data: {
        date: new Date(),
        description: `Commission for ${projectRef || "sales"}`,
        category: "Commission",
        amount: new Prisma.Decimal(commission.amount),
        paymentMode: commission.payoutMode === "WALLET" ? "Wallet Credit" : "Payroll Settlement",
        paymentSource: "COMPANY_ACCOUNT",
        expenseType: "COMPANY",
        project: projectRef || undefined,
        status: "APPROVED",
        approvalLevel: "COMMISSION",
        submittedById: approvedById,
        approvedById,
        approvedAmount: new Prisma.Decimal(commission.amount),
        remarks: commission.reason || undefined,
      },
    });
    expenseId = expense.id;
  }

  if (commission.payoutMode === "WALLET" && !walletLedgerId) {
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

  const settled = commission.payoutMode === "WALLET" || Boolean(walletLedgerId);
  return {
    expenseId,
    walletLedgerId,
    payableBillId: null,
    settlementStatus: settled ? "SETTLED" : "UNSETTLED",
    settledAt: settled ? new Date() : null,
  };
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

  const payeeType = parsed.data.payeeType
    ? sanitizeString(parsed.data.payeeType)
    : existing.payeeType || "EMPLOYEE";
  const payoutMode =
    parsed.data.payoutMode !== undefined
      ? sanitizeString(parsed.data.payoutMode)
      : existing.payoutMode || (payeeType === "MIDDLEMAN" ? "AP" : "PAYROLL");

  if (payeeType === "EMPLOYEE") {
    const employeeId = parsed.data.employeeId !== undefined ? parsed.data.employeeId : existing.employeeId;
    if (!employeeId) {
      return NextResponse.json({ success: false, error: "Employee is required for employee commission" }, { status: 400 });
    }
  }

  if (payeeType === "MIDDLEMAN") {
    const vendorId = parsed.data.vendorId !== undefined ? parsed.data.vendorId : existing.vendorId;
    if (!vendorId) {
      return NextResponse.json({ success: false, error: "Middleman vendor is required" }, { status: 400 });
    }
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) {
      return NextResponse.json({ success: false, error: "Middleman vendor not found" }, { status: 400 });
    }
  }

  const amountInput = parsed.data.amount !== undefined ? parsed.data.amount : Number(existing.amount || 0);
  const basisTypeInput = parsed.data.basisType !== undefined ? parsed.data.basisType : existing.basisType || undefined;
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

  let amountResolved: ResolvedCommissionAmount;
  try {
    amountResolved = await resolveCommissionAmount({
      project,
      amount: amountInput,
      basisType: basisTypeInput,
      basisAmount: basisAmountInput,
      percent: percentInput,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to resolve commission amount" },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {
    payeeType,
    payoutMode,
    projectRef: resolvedProject,
    basisType: amountResolved.basisType,
    basisAmount: amountResolved.basisAmount !== null ? new Prisma.Decimal(amountResolved.basisAmount) : null,
    percent: amountResolved.percent !== null ? new Prisma.Decimal(amountResolved.percent) : null,
    amount: new Prisma.Decimal(amountResolved.amount),
  };

  if (payeeType === "EMPLOYEE") {
    data.employeeId = sanitizeString((parsed.data.employeeId || existing.employeeId || "") as string);
    data.vendorId = null;
  } else {
    data.vendorId = sanitizeString((parsed.data.vendorId || existing.vendorId || "") as string);
    data.employeeId = null;
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

  if (updated.projectRef && updated.status === "APPROVED") {
    await recalculateProjectFinancials(updated.projectRef);
  }

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

  const status = String(existing.status || "").toUpperCase();
  if (status !== "PENDING") {
    await logAudit({
      action: "BLOCK_DELETE_COMMISSION_NON_PENDING",
      entity: "CommissionEntry",
      entityId: id,
      reason: `Delete blocked for status=${existing.status}`,
      userId: session.user.id,
    });
    return NextResponse.json(
      { success: false, error: "Only PENDING commissions can be deleted. Use correction workflow for approved entries." },
      { status: 400 },
    );
  }

  if ((existing.settlementStatus || "UNSETTLED") === "SETTLED") {
    return NextResponse.json(
      { success: false, error: "Settled commissions cannot be deleted." },
      { status: 400 },
    );
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
