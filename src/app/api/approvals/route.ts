import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approvalSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { getUserRoleName, requirePermission } from "@/lib/rbac";
import {
  canApproveExpense,
  canApproveIncome,
  isPendingExpenseStatus,
  isPendingIncomeStatus,
} from "@/lib/approvals";
import { createNotification } from "@/lib/notifications";
import { applyWalletTransactionByEmail } from "@/lib/wallet";
import { recalculateProjectFinancials } from "@/lib/projects";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canApproveAny =
    (await requirePermission(session.user.id, "approvals.approve_high")) ||
    (await requirePermission(session.user.id, "approvals.approve_low")) ||
    (await requirePermission(session.user.id, "approvals.view_all"));

  if (!canApproveAny) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = approvalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, action, id, reason, approvedAmount } = parsed.data;
  const role = await getUserRoleName(session.user.id);

  if (type === "EXPENSE") {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { submittedBy: true },
    });
    if (!expense) {
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }

    if (!isPendingExpenseStatus(expense.status)) {
      return NextResponse.json({ success: false, error: "Expense already processed" }, { status: 400 });
    }

    if (!canApproveExpense(role, Number(expense.amount))) {
      return NextResponse.json({ success: false, error: "Insufficient approval authority" }, { status: 403 });
    }

    if (action === "PARTIAL" && !approvedAmount) {
      return NextResponse.json({ success: false, error: "Approved amount required" }, { status: 400 });
    }

    if (approvedAmount && approvedAmount > Number(expense.amount)) {
      return NextResponse.json({ success: false, error: "Approved amount cannot exceed expense amount" }, { status: 400 });
    }

    const isPartial = action === "PARTIAL" && approvedAmount && approvedAmount < Number(expense.amount);
    const status = action === "REJECT" ? "REJECTED" : isPartial ? "PARTIALLY_APPROVED" : "APPROVED";

    const approvedValue = isPartial && approvedAmount ? approvedAmount : Number(expense.amount);

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        status,
        approvedById: session.user.id,
        approvedAmount: new Prisma.Decimal(approvedValue),
      },
    });

    await prisma.approval.create({
      data: {
        type: "EXPENSE",
        status: status === "REJECTED" ? "REJECTED" : status === "PARTIALLY_APPROVED" ? "PARTIALLY_APPROVED" : "APPROVED",
        amount: expense.amount,
        approvedAmount: new Prisma.Decimal(approvedValue),
        reason,
        expenseId: expense.id,
        approvedById: session.user.id,
      },
    });

    if (status !== "REJECTED" && expense.submittedBy?.email) {
      const walletResult = await applyWalletTransactionByEmail({
        email: expense.submittedBy.email,
        type: "DEBIT",
        amount: approvedValue,
        reference: `Expense ${expense.id} approved`,
      });

      if (walletResult.applied) {
        await logAudit({
          action: "WALLET_TRANSACTION",
          entity: "Employee",
          entityId: walletResult.updated.id,
          newValue: JSON.stringify({ amount: approvedValue, reference: expense.id }),
          userId: session.user.id,
        });
      }
    }

    await logAudit({
      action: status === "REJECTED" ? "REJECT_EXPENSE" : "APPROVE_EXPENSE",
      entity: "Expense",
      entityId: expense.id,
      newValue: JSON.stringify({ status, approvedAmount, reason }),
      userId: session.user.id,
    });

    if (expense.submittedById) {
      await createNotification({
        userId: expense.submittedById,
        type: "EXPENSE_APPROVAL",
        message: `Expense ${expense.description} was ${status.toLowerCase()}.`,
      });
    }

    if (status !== "REJECTED" && expense.project) {
      await recalculateProjectFinancials(expense.project);
    }

    return NextResponse.json({ success: true, data: updated });
  }

  const income = await prisma.income.findUnique({
    where: { id },
    include: { addedBy: true },
  });
  if (!income) {
    return NextResponse.json({ success: false, error: "Income not found" }, { status: 404 });
  }

  if (!isPendingIncomeStatus(income.status)) {
    return NextResponse.json({ success: false, error: "Income already processed" }, { status: 400 });
  }

  if (!canApproveIncome(role, Number(income.amount))) {
    return NextResponse.json({ success: false, error: "Insufficient approval authority" }, { status: 403 });
  }

  const status = action === "REJECT" ? "REJECTED" : "APPROVED";
  const updated = await prisma.income.update({
    where: { id },
    data: {
      status,
      approvedById: session.user.id,
    },
  });

  await prisma.approval.create({
    data: {
      type: "INCOME",
      status: status === "REJECTED" ? "REJECTED" : "APPROVED",
      amount: income.amount,
      approvedAmount: income.amount,
      reason,
      incomeId: income.id,
      approvedById: session.user.id,
    },
  });

  await logAudit({
    action: status === "REJECTED" ? "REJECT_INCOME" : "APPROVE_INCOME",
    entity: "Income",
    entityId: income.id,
    newValue: JSON.stringify({ status, reason }),
    userId: session.user.id,
  });

  if (income.addedById) {
    await createNotification({
      userId: income.addedById,
      type: "INCOME_APPROVAL",
      message: `Income ${income.source} was ${status.toLowerCase()}.`,
    });
  }

  if (status !== "REJECTED" && income.project) {
    await recalculateProjectFinancials(income.project);
  }

  return NextResponse.json({ success: true, data: updated });
}
