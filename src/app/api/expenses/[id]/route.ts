import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expenseUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { getExpenseApprovalLevel, isPendingExpenseStatus } from "@/lib/approvals";
import { Prisma } from "@prisma/client";
import { resolveProjectId } from "@/lib/projects";
import { getOrganizationDefaults } from "@/lib/organization-settings";

const STOCK_KEYS_BLOCKED_IN_EXPENSES = [
  "addToInventory",
  "inventoryItemId",
  "inventoryQuantity",
  "inventoryUnitCost",
] as const;

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "expenses.view_all");
  const canViewOwn = await requirePermission(session.user.id, "expenses.view_own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      companyAccount: { select: { id: true, name: true, type: true } },
    },
  });
  if (!expense) {
    return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
  }

  if (!canViewAll && expense.submittedById !== session.user.id) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    data: {
      ...expense,
      amount: Number(expense.amount),
      approvedAmount: expense.approvedAmount ? Number(expense.approvedAmount) : null,
    },
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) {
    return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
  }

  // Legacy expenses that affected inventory must not be edited in Phase 1.
  if (expense.inventoryLedgerId) {
    return NextResponse.json(
      {
        success: false,
        error:
          "This is a legacy expense that affected inventory and cannot be edited. Use Procurement -> PO/GRN/Vendor Bill for stock purchases.",
      },
      { status: 400 },
    );
  }

  const canEdit = await requirePermission(session.user.id, "expenses.edit");
  const isOwner = expense.submittedById === session.user.id;
  if (!canEdit && !(isOwner && isPendingExpenseStatus(expense.status))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  if (!isPendingExpenseStatus(expense.status)) {
    return NextResponse.json({ success: false, error: "Only pending expenses can be edited" }, { status: 400 });
  }

  const body = await req.json();
  for (const key of STOCK_KEYS_BLOCKED_IN_EXPENSES) {
    if (key in body && body[key] != null && body[key] !== false && body[key] !== "") {
      await logAudit({
        action: "BLOCK_EXPENSE_STOCK_PAYLOAD",
        entity: "Expense",
        entityId: id,
        reason: `Blocked stock payload key: ${key}`,
        newValue: JSON.stringify({ key, value: body[key] }),
        userId: session.user.id,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            "Stock purchases are not allowed in Expenses (Phase 1). Use Procurement -> PO/GRN/Vendor Bill.",
        },
        { status: 400 },
      );
    }
  }
  const parsed = expenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.date) data.date = new Date(parsed.data.date);
  if (parsed.data.description) data.description = parsed.data.description;
  if (parsed.data.category) data.category = parsed.data.category;
  if (parsed.data.amount) data.amount = new Prisma.Decimal(parsed.data.amount);
  if (parsed.data.paymentMode) data.paymentMode = parsed.data.paymentMode;
  if (parsed.data.paymentSource) data.paymentSource = parsed.data.paymentSource;
  if (parsed.data.expenseType) data.expenseType = parsed.data.expenseType;
  if (parsed.data.project !== undefined) {
    if (parsed.data.project === null || parsed.data.project === "") {
      data.project = null;
    } else {
      const resolvedProjectId = await resolveProjectId(parsed.data.project);
      if (!resolvedProjectId) {
        return NextResponse.json(
          { success: false, error: "Invalid project reference" },
          { status: 400 }
        );
      }
      data.project = resolvedProjectId;
    }
  }
  if (parsed.data.receiptUrl) data.receiptUrl = parsed.data.receiptUrl;
  if (parsed.data.receiptFileId) data.receiptFileId = parsed.data.receiptFileId;
  if (parsed.data.remarks !== undefined) data.remarks = parsed.data.remarks;
  if (parsed.data.categoryRequest !== undefined) data.categoryRequest = parsed.data.categoryRequest;

  const nextPaymentSource = parsed.data.paymentSource || expense.paymentSource || "COMPANY_DIRECT";
  if (
    parsed.data.paymentSource &&
    parsed.data.paymentSource !== expense.paymentSource &&
    (parsed.data.paymentSource === "EMPLOYEE_WALLET" || expense.paymentSource === "EMPLOYEE_WALLET")
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Changing payment source to/from EMPLOYEE_WALLET is not allowed after submission.",
      },
      { status: 400 },
    );
  }
  if (nextPaymentSource === "COMPANY_ACCOUNT") {
    const candidateAccountId =
      parsed.data.companyAccountId?.trim() || expense.companyAccountId;
    if (!candidateAccountId) {
      return NextResponse.json(
        { success: false, error: "Company account is required when payment source is COMPANY_ACCOUNT" },
        { status: 400 }
      );
    }
    const account = await prisma.companyAccount.findUnique({
      where: { id: candidateAccountId },
      select: { id: true, isActive: true },
    });
    if (!account || !account.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid or inactive company account" },
        { status: 400 }
      );
    }
    data.companyAccountId = account.id;
  } else if (parsed.data.companyAccountId !== undefined || parsed.data.paymentSource !== undefined) {
    data.companyAccountId = null;
  }
  if (nextPaymentSource === "EMPLOYEE_POCKET") {
    const submitter = await prisma.user.findUnique({
      where: { id: expense.submittedById },
      select: { email: true },
    });
    if (submitter?.email) {
      const employee = await prisma.employee.findUnique({
        where: { email: submitter.email },
        select: { walletBalance: true, walletHold: true },
      });
      if (employee) {
        const availableAdvance = Number(employee.walletBalance) - Number(employee.walletHold || 0);
        if (availableAdvance > 0) {
          await logAudit({
            action: "BLOCK_EXPENSE_OWN_POCKET_WITH_ADVANCE",
            entity: "Expense",
            entityId: id,
            reason: `Blocked own-pocket source update while available advance exists: ${availableAdvance}`,
            userId: session.user.id,
            newValue: JSON.stringify({
              from: expense.paymentSource,
              to: nextPaymentSource,
              availableAdvance,
            }),
          });
          return NextResponse.json(
            {
              success: false,
              error: `Employee still has company advance available (PKR ${availableAdvance.toLocaleString()}). Keep this as Employee Wallet or settle advance first.`,
            },
            { status: 400 },
          );
        }
      }
    }
  }
  const nextAmount = parsed.data.amount ?? Number(expense.amount);

  if (expense.paymentSource === "EMPLOYEE_WALLET") {
    const nextCategory = parsed.data.category || expense.category;
    const category = await prisma.category.findFirst({
      where: { name: nextCategory, type: "expense" },
    });
    if (category?.enforceStrict && category.maxAmount) {
      if (nextAmount > Number(category.maxAmount)) {
        return NextResponse.json(
          {
            success: false,
            error: `Amount exceeds allowed limit for ${nextCategory} (max ${category.maxAmount}).`,
          },
          { status: 400 }
        );
      }
    }
  }
  const orgDefaults = await getOrganizationDefaults();
  const threshold = Number(orgDefaults.expenseReceiptThreshold || 0);
  const nextReceiptUrl = parsed.data.receiptUrl !== undefined ? parsed.data.receiptUrl : expense.receiptUrl;
  const nextReceiptFileId =
    parsed.data.receiptFileId !== undefined ? parsed.data.receiptFileId : expense.receiptFileId;
  if (threshold > 0 && nextAmount >= threshold && !nextReceiptUrl && !nextReceiptFileId) {
    await logAudit({
      action: "BLOCK_EXPENSE_MISSING_RECEIPT",
      entity: "Expense",
      entityId: id,
      reason: `Receipt required for amounts >= ${threshold}`,
      userId: session.user.id,
    });
    return NextResponse.json(
      {
        success: false,
        error: `Receipt is required for expenses of PKR ${threshold.toLocaleString()} or above.`,
      },
      { status: 400 }
    );
  }

  if (parsed.data.amount) {
    const approvalLevel = getExpenseApprovalLevel(parsed.data.amount);
    data.approvalLevel = approvalLevel;
    data.status = approvalLevel === "L1" ? "PENDING_L1" : approvalLevel === "L2" ? "PENDING_L2" : "PENDING_L3";
  }

  let updated = expense;
  try {
    await prisma.$transaction(async (tx) => {
      if (expense.paymentSource === "EMPLOYEE_WALLET" && parsed.data.amount !== undefined) {
        const user = await tx.user.findUnique({
          where: { id: expense.submittedById },
          select: { email: true },
        });
        if (user?.email) {
          const employee = await tx.employee.findFirst({
            where: { email: { equals: user.email, mode: "insensitive" } },
          });
          if (employee) {
            const delta = Number(parsed.data.amount) - Number(expense.amount);
            if (delta > 0) {
              const available = Number(employee.walletBalance) - Number(employee.walletHold || 0);
              if (available < delta) {
                throw new Error("Insufficient available wallet balance to increase expense.");
              }
            }
            await tx.employee.update({
              where: { id: employee.id },
              data: { walletHold: new Prisma.Decimal(Number(employee.walletHold || 0) + delta) },
            });
          }
        }
      }

      updated = await tx.expense.update({
        where: { id },
        data,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update expense" },
      { status: 400 }
    );
  }

  await logAudit({
    action: "UPDATE_EXPENSE",
    entity: "Expense",
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

  const { id } = await context.params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) {
    return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
  }

  // Legacy expenses that affected inventory must not be deleted in Phase 1.
  if (expense.inventoryLedgerId) {
    return NextResponse.json(
      {
        success: false,
        error:
          "This is a legacy expense that affected inventory and cannot be deleted. Use Procurement -> PO/GRN/Vendor Bill for stock purchases.",
      },
      { status: 400 },
    );
  }

  const canEdit = await requirePermission(session.user.id, "expenses.edit");
  const isOwner = expense.submittedById === session.user.id;
  if (!canEdit && !(isOwner && isPendingExpenseStatus(expense.status))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  if (!isPendingExpenseStatus(expense.status)) {
    return NextResponse.json({ success: false, error: "Only pending expenses can be deleted" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (expense.paymentSource === "EMPLOYEE_WALLET") {
      const user = await tx.user.findUnique({
        where: { id: expense.submittedById },
        select: { email: true },
      });
      if (user?.email) {
        const employee = await tx.employee.findFirst({
          where: { email: { equals: user.email, mode: "insensitive" } },
        });
        if (employee) {
          const currentHold = Number(employee.walletHold || 0);
          const nextHold = Math.max(0, currentHold - Number(expense.amount));
          await tx.employee.update({
            where: { id: employee.id },
            data: { walletHold: new Prisma.Decimal(nextHold) },
          });
        }
      }
    }

    await tx.expense.delete({ where: { id } });
  });

  await logAudit({
    action: "DELETE_EXPENSE",
    entity: "Expense",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
