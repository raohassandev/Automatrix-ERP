import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { postExpenseApprovalJournal } from "@/lib/accounting";

const bulkSchema = z.object({
  expenseIds: z.array(z.string().min(1)).min(1).max(200),
});

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canMarkAsPaid = await requirePermission(session.user.id, "expenses.mark_paid");
  if (!canMarkAsPaid) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ids = Array.from(new Set(parsed.data.expenseIds));
  const expenses = await prisma.expense.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      approvedAmount: true,
      amount: true,
      date: true,
      paymentSource: true,
      companyAccountId: true,
      project: true,
    },
  });

  const byId = new Map(expenses.map((e) => [e.id, e]));
  const results = {
    markedPaid: [] as string[],
    skipped: [] as { id: string; reason: string }[],
  };

  for (const id of ids) {
    const expense = byId.get(id);
    if (!expense) {
      results.skipped.push({ id, reason: "Expense not found" });
      continue;
    }
    if (expense.status !== "APPROVED") {
      results.skipped.push({ id, reason: `Invalid status: ${expense.status}` });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: expense.id },
        data: { status: "PAID" },
      });
      await postExpenseApprovalJournal(tx, {
        expenseId: updated.id,
        amount: Number(updated.approvedAmount || updated.amount),
        expenseDate: updated.date,
        paymentSource: updated.paymentSource,
        companyAccountId: updated.companyAccountId,
        projectRef: updated.project,
        userId: session.user.id,
        memo: "Expense bulk mark-as-paid posting",
      });
    });

    await logAudit({
      action: "BULK_MARK_EXPENSE_PAID",
      entity: "Expense",
      entityId: expense.id,
      field: "status",
      oldValue: "APPROVED",
      newValue: "PAID",
      userId: session.user.id,
    });

    results.markedPaid.push(expense.id);
  }

  return NextResponse.json({ success: true, data: results });
}
