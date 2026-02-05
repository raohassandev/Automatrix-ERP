import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commissionSchema } from "@/lib/validation";
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
  },
  approvedById: string
) {
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

  let where: Record<string, unknown> = {};
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
    include: { employee: true },
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
      { status: 400 }
    );
  }

  const canApprove = await requirePermission(session.user.id, "commissions.approve");

  const projectRefRaw = sanitizeString(parsed.data.projectRef);
  const resolvedProject = await resolveProjectId(projectRefRaw);
  if (!resolvedProject) {
    return NextResponse.json({ success: false, error: "Invalid project reference" }, { status: 400 });
  }

  const basisAmount = parsed.data.basisAmount ?? undefined;
  const percent = parsed.data.percent ?? undefined;
  const computedAmount =
    parsed.data.amount !== undefined
      ? parsed.data.amount
      : basisAmount !== undefined && percent !== undefined
      ? (basisAmount * percent) / 100
      : null;

  if (computedAmount === null) {
    return NextResponse.json(
      { success: false, error: "Amount is required or provide percent + basis amount" },
      { status: 400 }
    );
  }

  const status = parsed.data.status ? sanitizeString(parsed.data.status) : "PENDING";

  const created = await prisma.$transaction(async (tx) => {
    const entry = await tx.commissionEntry.create({
      data: {
        employeeId: sanitizeString(parsed.data.employeeId),
        projectRef: resolvedProject,
        basisType: parsed.data.basisType ? sanitizeString(parsed.data.basisType) : null,
        basisAmount: basisAmount !== undefined ? new Prisma.Decimal(basisAmount) : null,
        percent: percent !== undefined ? new Prisma.Decimal(percent) : null,
        amount: new Prisma.Decimal(computedAmount),
        status: status === "APPROVED" && canApprove ? "APPROVED" : "PENDING",
        reason: parsed.data.reason ? sanitizeString(parsed.data.reason) : null,
        approvedById: status === "APPROVED" && canApprove ? session.user.id : null,
      },
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
    action: "CREATE_COMMISSION",
    entity: "CommissionEntry",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
