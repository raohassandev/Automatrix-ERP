import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expenseUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { RECEIPT_REQUIRED_THRESHOLD } from "@/lib/constants";
import { getExpenseApprovalLevel, isPendingExpenseStatus } from "@/lib/approvals";
import { Prisma } from "@prisma/client";
import { resolveProjectId } from "@/lib/projects";

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

  const canEdit = await requirePermission(session.user.id, "expenses.edit");
  const isOwner = expense.submittedById === session.user.id;
  if (!canEdit && !(isOwner && isPendingExpenseStatus(expense.status))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  if (!isPendingExpenseStatus(expense.status)) {
    return NextResponse.json({ success: false, error: "Only pending expenses can be edited" }, { status: 400 });
  }

  const body = await req.json();
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

  const nextExpenseType = parsed.data.expenseType || expense.expenseType || "COMPANY";
  const nextProject =
    parsed.data.project !== undefined
      ? parsed.data.project
      : expense.project;
  if (nextExpenseType !== "OWNER_PERSONAL" && (!nextProject || nextProject === "")) {
    return NextResponse.json(
      { success: false, error: "Project is required for company expenses" },
      { status: 400 }
    );
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
  // TODO: This receipt validation is temporarily bypassed based on user request.
  // It should ideally be moved to the frontend, configured by an Admin,
  // to provide a better user experience and prevent unnecessary backend calls.
  // if (
  //   nextAmount >= RECEIPT_REQUIRED_THRESHOLD &&
  //   !parsed.data.receiptUrl &&
  //   !parsed.data.receiptFileId &&
  //   !expense.receiptUrl &&
  //   !expense.receiptFileId
  // ) {
  //   return NextResponse.json(
  //     { success: false, error: "Receipt required for this amount" },
  //     { status: 400 }
  //   );
  // }

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
          const employee = await tx.employee.findUnique({ where: { email: user.email } });
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
        const employee = await tx.employee.findUnique({ where: { email: user.email } });
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
