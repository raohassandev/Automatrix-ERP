import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/rbac';
import { postExpenseApprovalJournal } from '@/lib/accounting';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const canMarkAsPaid = await requirePermission(session.user.id, 'expenses.mark_paid');
  if (!canMarkAsPaid) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const expense = await prisma.expense.findUnique({
    where: { id: params.id },
  });

  if (!expense) {
    return NextResponse.json({ success: false, error: 'Expense not found' }, { status: 404 });
  }

  if (expense.status !== 'APPROVED') {
    return NextResponse.json(
      { success: false, error: `Cannot mark as paid expense with status: ${expense.status}` },
      { status: 400 }
    );
  }

  const updatedExpense = await prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: params.id },
      data: { status: 'PAID' },
    });

    await postExpenseApprovalJournal(tx, {
      expenseId: updated.id,
      amount: Number(updated.approvedAmount || updated.amount),
      expenseDate: updated.date,
      paymentSource: updated.paymentSource,
      companyAccountId: updated.companyAccountId,
      projectRef: updated.project,
      userId: session.user.id,
      memo: 'Expense mark-as-paid posting',
    });

    return updated;
  });

  await logAudit({
    action: 'UPDATE',
    entity: 'Expense',
    entityId: updatedExpense.id,
    field: 'status',
    oldValue: 'APPROVED',
    newValue: 'PAID',
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updatedExpense });
}
