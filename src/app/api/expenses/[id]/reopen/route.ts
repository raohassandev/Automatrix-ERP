import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function PUT(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canReopen = await requirePermission(session.user.id, "expenses.reopen_approved");
  if (!canReopen) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) {
    return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
  }

  if (!["APPROVED", "PARTIALLY_APPROVED"].includes(expense.status)) {
    return NextResponse.json(
      { success: false, error: `Only approved expenses can be reopened. Current status: ${expense.status}` },
      { status: 400 },
    );
  }
  if (expense.paymentSource !== "EMPLOYEE_POCKET") {
    return NextResponse.json(
      { success: false, error: "Only own-pocket payable expenses can be reopened safely." },
      { status: 400 },
    );
  }

  const nextPendingStatus =
    expense.approvalLevel === "L1"
      ? "PENDING_L1"
      : expense.approvalLevel === "L2"
      ? "PENDING_L2"
      : "PENDING_L3";

  await prisma.expense.update({
    where: { id },
    data: {
      status: nextPendingStatus,
      approvedById: null,
      approvedAmount: null,
    },
  });

  await logAudit({
    action: "REOPEN_EXPENSE_FOR_EDIT",
    entity: "Expense",
    entityId: id,
    oldValue: expense.status,
    newValue: nextPendingStatus,
    reason: "Reopened from approved state for correction.",
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
