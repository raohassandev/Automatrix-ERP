import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expenseUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { RECEIPT_REQUIRED_THRESHOLD } from "@/lib/constants";
import { getExpenseApprovalLevel, isPendingExpenseStatus } from "@/lib/approvals";
import { Prisma } from "@prisma/client";

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
  if (parsed.data.project !== undefined) data.project = parsed.data.project;
  if (parsed.data.receiptUrl) data.receiptUrl = parsed.data.receiptUrl;
  if (parsed.data.receiptFileId) data.receiptFileId = parsed.data.receiptFileId;

  const nextAmount = parsed.data.amount ?? Number(expense.amount);
  if (
    nextAmount >= RECEIPT_REQUIRED_THRESHOLD &&
    !parsed.data.receiptUrl &&
    !parsed.data.receiptFileId &&
    !expense.receiptUrl &&
    !expense.receiptFileId
  ) {
    return NextResponse.json(
      { success: false, error: "Receipt required for this amount" },
      { status: 400 }
    );
  }

  if (parsed.data.amount) {
    const approvalLevel = getExpenseApprovalLevel(parsed.data.amount);
    data.approvalLevel = approvalLevel;
    data.status = approvalLevel === "L1" ? "PENDING_L1" : approvalLevel === "L2" ? "PENDING_L2" : "PENDING_L3";
  }

  const updated = await prisma.expense.update({
    where: { id },
    data,
  });

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

  await prisma.expense.delete({ where: { id } });

  await logAudit({
    action: "DELETE_EXPENSE",
    entity: "Expense",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
