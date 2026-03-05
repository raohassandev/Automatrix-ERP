import { Expense, Income, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { createAuditLog } from './audit';
import { getExpenseApprovalLevel, getIncomeApprovalLevel } from '@/lib/approvals';
import { recalculateProjectFinancials } from '@/lib/projects';
import { postExpenseApprovalJournal, postIncomeApprovalJournal } from '@/lib/accounting';
import { assertInvoiceReceiptWithinOutstanding } from '@/lib/invoice-allocation';
import {
  type ApprovalModule,
  getAllowedRolesForPolicy,
  getApprovalPolicyRoleMap,
} from '@/lib/approval-policies';

export type ApprovalLevel = 'L1' | 'L2' | 'L3';
export type ApprovalAction = 'APPROVE' | 'REJECT' | 'PARTIAL_APPROVE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

function normalizeApprovalLevel(level?: string | null): ApprovalLevel | null {
  if (level === 'L1' || level === 'L2' || level === 'L3') return level;
  return null;
}

function resolveApprovalLevel(
  module: ApprovalModule,
  amount: number,
  storedLevel?: string | null,
): ApprovalLevel {
  const normalized = normalizeApprovalLevel(storedLevel);
  if (normalized) return normalized;
  return module === 'income'
    ? getIncomeApprovalLevel(amount)
    : getExpenseApprovalLevel(amount);
}

/**
 * Check if user can approve based on role and amount
 */
export async function canUserApprove(
  userId: string,
  params: { module: ApprovalModule; amount: number; level?: ApprovalLevel },
): Promise<{ canApprove: boolean; reason?: string; requiredLevel: ApprovalLevel }> {
  const { module, amount, level } = params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || !user.role) {
    return { canApprove: false, reason: 'User or role not found', requiredLevel: 'L1' };
  }

  const requiredLevel = level ?? resolveApprovalLevel(module, amount);

  // Executive override for Phase 1 operations: top roles can always approve.
  if (["Owner", "CEO", "Admin"].includes(user.role.name)) {
    return { canApprove: true, requiredLevel };
  }

  const allowedRoles = await getAllowedRolesForPolicy(module, requiredLevel);

  if (!allowedRoles.includes(user.role.name)) {
    return {
      canApprove: false,
      reason: `Amount ${amount} requires approval from: ${allowedRoles.join(' or ')}`,
      requiredLevel,
    };
  }

  return { canApprove: true, requiredLevel };
}

/**
 * Approve an expense
 */
export async function approveExpense(params: {
  expenseId: string;
  approverId: string;
  reason?: string;
  approvedAmount?: number;
}) {
  const { expenseId, approverId, approvedAmount } = params;

  // Get expense with employee info
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      submittedBy: true,
    },
  });

  if (!expense) {
    throw new Error('Expense not found');
  }

  if (!expense.status.startsWith('PENDING')) {
    throw new Error(`Cannot approve expense with status: ${expense.status}`);
  }

  // Check if user can approve this amount
  const finalAmount = approvedAmount || parseFloat(expense.amount.toString());
  const requiredLevel = resolveApprovalLevel('expense', finalAmount, expense.approvalLevel);
  const { canApprove, reason: approvalReason } = await canUserApprove(
    approverId,
    { module: 'expense', amount: finalAmount, level: requiredLevel },
  );

  if (!canApprove) {
    throw new Error(approvalReason || 'User cannot approve this expense');
  }

  if (approvedAmount && approvedAmount > Number(expense.amount)) {
    throw new Error('Approved amount cannot exceed submitted amount');
  }

  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    const isEmployeePocket = expense.paymentSource === "EMPLOYEE_POCKET";
    const targetStatus =
      isEmployeePocket
        ? (finalAmount < Number(expense.amount) ? "PARTIALLY_APPROVED" : "APPROVED")
        : "PAID";

    // Update expense status
    const updatedExpense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        status: targetStatus,
        approvedById: approverId,
        approvedAmount: new Prisma.Decimal(finalAmount),
      },
    });

    let walletEntry = null;
    let newBalance = null;
    if (expense.paymentSource === 'EMPLOYEE_WALLET') {
      const employee = await tx.employee.findUnique({
        where: { email: expense.submittedBy.email },
      });
      if (!employee) {
        throw new Error('Employee not found');
      }

      const currentBalance = parseFloat(employee.walletBalance.toString());
      const currentHold = parseFloat(employee.walletHold?.toString() || '0');

      if (currentBalance < finalAmount) {
        throw new Error(
          `Insufficient wallet balance. Available: ${currentBalance}, Required: ${finalAmount}`,
        );
      }

      // Release hold and deduct approved amount
      newBalance = currentBalance - finalAmount;
      const newHold = Math.max(0, currentHold - Number(expense.amount));

      await tx.employee.update({
        where: { id: employee.id },
        data: {
          walletBalance: newBalance,
          walletHold: newHold,
        },
      });

      walletEntry = await tx.walletLedger.create({
        data: {
          employeeId: employee.id,
          type: 'DEBIT',
          amount: finalAmount,
          date: new Date(),
          reference: expenseId,
          balance: newBalance,
          sourceType: 'EXPENSE_SETTLEMENT',
          sourceId: expenseId,
          postedById: approverId,
          postedAt: new Date(),
        },
      });

      await tx.expense.update({
        where: { id: expenseId },
        data: { walletLedgerId: walletEntry.id },
      });
    }

    await postExpenseApprovalJournal(tx, {
      expenseId: expense.id,
      amount: finalAmount,
      expenseDate: expense.date,
      paymentSource: expense.paymentSource,
      companyAccountId: expense.companyAccountId,
      projectRef: expense.project,
      userId: approverId,
      memo: "Expense approval posting",
    });

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      entityType: 'Expense',
      entityId: expenseId,
      userId: approverId,
      changes: {
        status: { from: expense.status, to: targetStatus },
        approvedAmount: finalAmount,
        walletDeduction: expense.paymentSource === 'EMPLOYEE_WALLET' ? finalAmount : 0,
        newWalletBalance: newBalance ?? undefined,
      },
    });

    // Create notification for submitter
    await tx.notification.create({
      data: {
        userId: expense.submittedById,
        type: 'SUCCESS',
        message:
          expense.paymentSource === "EMPLOYEE_WALLET"
            ? `Your expense of PKR ${finalAmount} is approved and settled from your advance wallet.`
            : expense.paymentSource === "EMPLOYEE_POCKET"
            ? `Your expense of PKR ${finalAmount} is approved and pending company reimbursement.`
            : `Your expense of PKR ${finalAmount} is approved and marked paid.`,
        status: 'UNREAD',
      },
    });

    return { updatedExpense, walletEntry, newBalance };
  });

  if (expense.project) {
    await recalculateProjectFinancials(expense.project);
  }

  return result;
}

/**
 * Reject an expense
 */
export async function rejectExpense(params: {
  expenseId: string;
  approverId: string;
  reason: string;
}) {
  const { expenseId, approverId, reason } = params;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { submittedBy: true },
  });

  if (!expense) {
    throw new Error('Expense not found');
  }

  if (!expense.status.startsWith('PENDING')) {
    throw new Error(`Cannot reject expense with status: ${expense.status}`);
  }

  // Check if user can approve (same permission for reject)
  const amount = parseFloat(expense.amount.toString());
  const requiredLevel = resolveApprovalLevel('expense', amount, expense.approvalLevel);
  const { canApprove } = await canUserApprove(approverId, {
    module: 'expense',
    amount,
    level: requiredLevel,
  });

  if (!canApprove) {
    throw new Error('User cannot reject this expense');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update expense status
    const updatedExpense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        status: 'REJECTED',
        approvedById: approverId,
      },
    });

    if (expense.paymentSource === 'EMPLOYEE_WALLET') {
      const employee = await tx.employee.findUnique({
        where: { email: expense.submittedBy.email },
      });
      if (employee) {
        const currentHold = parseFloat(employee.walletHold?.toString() || '0');
        const newHold = Math.max(0, currentHold - Number(expense.amount));
        await tx.employee.update({
          where: { id: employee.id },
          data: { walletHold: newHold },
        });
      }
    }

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      entityType: 'Expense',
      entityId: expenseId,
      userId: approverId,
      changes: {
        status: { from: 'PENDING', to: 'REJECTED' },
        reason,
      },
    });

    // Create notification for submitter
    await tx.notification.create({
      data: {
        userId: expense.submittedById,
        type: 'ERROR',
        message: `Your expense of PKR  ${amount} has been rejected. Reason: ${reason}`,
        status: 'UNREAD',
      },
    });

    return updatedExpense;
  });

  return result;
}

/**
 * Approve an income entry
 */
export async function approveIncome(params: {
  incomeId: string;
  approverId: string;
  reason?: string;
  approvedAmount?: number;
}) {
  const { incomeId, approverId, approvedAmount } = params;

  // Get income entry
  const income = await prisma.income.findUnique({
    where: { id: incomeId },
    include: {
      addedBy: true,
    },
  });

  if (!income) {
    throw new Error('Income entry not found');
  }

  if (income.status !== 'PENDING') {
    throw new Error(`Cannot approve income with status: ${income.status}`);
  }
  if (!income.companyAccountId) {
    throw new Error('Income is missing company account for posting.');
  }

  // Check if user can approve this amount
  const finalAmount = approvedAmount || parseFloat(income.amount.toString());
  const requiredLevel = resolveApprovalLevel('income', finalAmount, income.approvalLevel);
  const { canApprove, reason: approvalReason } = await canUserApprove(
    approverId,
    { module: 'income', amount: finalAmount, level: requiredLevel },
  );

  if (!canApprove) {
    throw new Error(approvalReason || 'User cannot approve this income');
  }

  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    if (income.invoiceId) {
      await assertInvoiceReceiptWithinOutstanding(tx, {
        invoiceId: income.invoiceId,
        receiptAmount: finalAmount,
        excludeIncomeId: income.id,
        projectRef: income.project || null,
      });
    }
    const approvedAmount = new Prisma.Decimal(finalAmount);
    // Update income status
    const updatedIncome = await tx.income.update({
      where: { id: incomeId },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
        amount: approvedAmount,
      },
    });
    if (!updatedIncome.companyAccountId) {
      throw new Error('Income is missing company account for posting.');
    }

    await postIncomeApprovalJournal(tx, {
      incomeId: updatedIncome.id,
      amount: finalAmount,
      incomeDate: new Date(updatedIncome.date),
      companyAccountId: updatedIncome.companyAccountId,
      invoiceId: updatedIncome.invoiceId || null,
      projectRef: updatedIncome.project || null,
      userId: approverId,
      memo: `Income ${updatedIncome.id} approval`,
    });

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      entityType: 'Income',
      entityId: incomeId,
      userId: approverId,
      changes: {
        status: { from: 'PENDING', to: 'APPROVED' },
        approvedAmount: finalAmount,
      },
    });

    // Create notification for submitter
    await tx.notification.create({
      data: {
        userId: income.addedById,
        type: 'SUCCESS',
        message: `Your income entry of PKR ${finalAmount} has been approved.`,
        status: 'UNREAD',
      },
    });

    return { updatedIncome };
  });

  if (income.project) {
    await recalculateProjectFinancials(income.project);
  }

  return result;
}

/**
 * Reject an income entry
 */
export async function rejectIncome(params: {
  incomeId: string;
  approverId: string;
  reason: string;
}) {
  const { incomeId, approverId, reason } = params;

  const income = await prisma.income.findUnique({
    where: { id: incomeId },
    include: { addedBy: true },
  });

  if (!income) {
    throw new Error('Income entry not found');
  }

  if (income.status !== 'PENDING') {
    throw new Error(`Cannot reject income with status: ${income.status}`);
  }

  // Check if user can approve (same permission for reject)
  const amount = parseFloat(income.amount.toString());
  const requiredLevel = resolveApprovalLevel('income', amount, income.approvalLevel);
  const { canApprove } = await canUserApprove(approverId, {
    module: 'income',
    amount,
    level: requiredLevel,
  });

  if (!canApprove) {
    throw new Error('User cannot reject this income');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update income status
    const updatedIncome = await tx.income.update({
      where: { id: incomeId },
      data: {
        status: 'REJECTED',
        approvedById: approverId,
      },
    });

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      entityType: 'Income',
      entityId: incomeId,
      userId: approverId,
      changes: {
        status: { from: 'PENDING', to: 'REJECTED' },
        reason,
      },
    });

    // Create notification for submitter
    await tx.notification.create({
      data: {
        userId: income.addedById,
        type: 'ERROR',
        message: `Your income entry of PKR ${amount} has been rejected. Reason: ${reason}`,
        status: 'UNREAD',
      },
    });

    return updatedIncome;
  });

  return result;
}

/**
 * Get pending approvals for a user based on their role
 */
export async function getPendingApprovalsForUser(
  userId: string,
  options?: { viewAll?: boolean },
): Promise<{
  expenses: Expense[];
  income: Income[];
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || !user.role) {
    return { expenses: [], income: [] };
  }

  const viewAll = options?.viewAll ?? false;
  const roleName = user.role.name;
  const policyMap = await getApprovalPolicyRoleMap();
  const allowedRolesFor = (module: ApprovalModule, level: ApprovalLevel) =>
    policyMap[module]?.[level] ?? [];

  // Get all pending expenses
  const pendingExpenses = await prisma.expense.findMany({
    where: { status: { startsWith: 'PENDING' } },
    include: {
      submittedBy: { select: { id: true, email: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });

  // Get all pending income entries
  const pendingIncome = await prisma.income.findMany({
    where: { status: 'PENDING' },
    include: {
      addedBy: { select: { id: true, email: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });

  // Filter based on user's approval authority
  const approvableExpenses = viewAll
    ? pendingExpenses
    : pendingExpenses.filter((expense) => {
        const amount = parseFloat(expense.amount.toString());
        const requiredLevel = resolveApprovalLevel('expense', amount, expense.approvalLevel);
        const allowedRoles = allowedRolesFor('expense', requiredLevel);
        return allowedRoles.includes(roleName);
      });

  const approvableIncome = viewAll
    ? pendingIncome
    : pendingIncome.filter((income) => {
        const amount = parseFloat(income.amount.toString());
        const requiredLevel = resolveApprovalLevel('income', amount, income.approvalLevel);
        const allowedRoles = allowedRolesFor('income', requiredLevel);
        return allowedRoles.includes(roleName);
      });

  return {
    expenses: approvableExpenses.map((expense) => {
      const amount = parseFloat(expense.amount.toString());
      return {
        ...expense,
        requiredApprovalLevel: resolveApprovalLevel('expense', amount, expense.approvalLevel),
      };
    }),
    income: approvableIncome.map((income) => {
      const amount = parseFloat(income.amount.toString());
      return {
        ...income,
        requiredApprovalLevel: resolveApprovalLevel('income', amount, income.approvalLevel),
      };
    }),
  };
}

/**
 * Get approval statistics
 */
export async function getApprovalStats() {
  const now = Date.now();
  const slaByLevelHours: Record<ApprovalLevel, number> = {
    L1: 24,
    L2: 48,
    L3: 72,
  };
  const [pendingExpenseRows, pendingIncomeRows, approvedExpenses, approvedIncome, rejectedExpenses, rejectedIncome, totalExpenses, totalIncome, closedExpenseRows, closedIncomeRows] = await Promise.all([
    prisma.expense.findMany({
      where: { status: { startsWith: "PENDING" } },
      select: { createdAt: true, amount: true, approvalLevel: true },
    }),
    prisma.income.findMany({
      where: { status: "PENDING" },
      select: { createdAt: true, amount: true, approvalLevel: true },
    }),
    prisma.expense.count({ where: { status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] } } }),
    prisma.income.count({ where: { status: "APPROVED" } }),
    prisma.expense.count({ where: { status: "REJECTED" } }),
    prisma.income.count({ where: { status: "REJECTED" } }),
    prisma.expense.count(),
    prisma.income.count(),
    prisma.expense.findMany({
      where: { status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID", "REJECTED"] } },
      select: { createdAt: true, updatedAt: true },
      take: 1000,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.income.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      select: { createdAt: true, updatedAt: true },
      take: 1000,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const pending = pendingExpenseRows.length + pendingIncomeRows.length;
  const approved = approvedExpenses + approvedIncome;
  const rejected = rejectedExpenses + rejectedIncome;
  const total = totalExpenses + totalIncome;

  const overdueExpenses = pendingExpenseRows.filter((row) => {
    const amount = parseFloat(row.amount.toString());
    const level = resolveApprovalLevel("expense", amount, row.approvalLevel);
    const elapsedHours = (now - row.createdAt.getTime()) / (1000 * 60 * 60);
    return elapsedHours > slaByLevelHours[level];
  }).length;
  const overdueIncome = pendingIncomeRows.filter((row) => {
    const amount = parseFloat(row.amount.toString());
    const level = resolveApprovalLevel("income", amount, row.approvalLevel);
    const elapsedHours = (now - row.createdAt.getTime()) / (1000 * 60 * 60);
    return elapsedHours > slaByLevelHours[level];
  }).length;

  const approvalDurationsHours = [...closedExpenseRows, ...closedIncomeRows]
    .map((row) => (row.updatedAt.getTime() - row.createdAt.getTime()) / (1000 * 60 * 60))
    .filter((v) => Number.isFinite(v) && v >= 0);
  const avgHours =
    approvalDurationsHours.length > 0
      ? approvalDurationsHours.reduce((sum, v) => sum + v, 0) / approvalDurationsHours.length
      : 0;

  return {
    pending,
    approved,
    rejected,
    total,
    approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : '0',
    avgApprovalTimeHours: avgHours.toFixed(1),
    overdue: overdueExpenses + overdueIncome,
    overdueExpenses,
    overdueIncome,
  };
}
