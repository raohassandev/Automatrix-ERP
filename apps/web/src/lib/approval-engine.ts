/**
 * Approval Workflow Engine for AutoMatrix ERP
 * Handles threshold-based routing and approval logic
 */

import { prisma } from './prisma';
import { createAuditLog } from './audit';

// Approval thresholds in PKR
export const APPROVAL_THRESHOLDS = {
  AUTO_APPROVE: 0, // < 10,000: Auto-approve or Manager
  MANAGER: 10000, // 10,000-50,000: Manager approval required
  FINANCE_MANAGER: 50000, // 50,000-200,000: Finance Manager approval
  CEO: 200000, // > 200,000: CEO/Owner approval required
} as const;

export type ApprovalLevel = 'AUTO' | 'MANAGER' | 'FINANCE_MANAGER' | 'CEO';
export type ApprovalAction = 'APPROVE' | 'REJECT' | 'PARTIAL_APPROVE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

/**
 * Determine required approval level based on amount
 */
export function getRequiredApprovalLevel(amount: number): ApprovalLevel {
  if (amount < APPROVAL_THRESHOLDS.MANAGER) {
    return 'AUTO';
  } else if (amount < APPROVAL_THRESHOLDS.FINANCE_MANAGER) {
    return 'MANAGER';
  } else if (amount < APPROVAL_THRESHOLDS.CEO) {
    return 'FINANCE_MANAGER';
  } else {
    return 'CEO';
  }
}

/**
 * Get required role name for approval level
 */
export function getRequiredRoleForLevel(level: ApprovalLevel): string[] {
  switch (level) {
    case 'AUTO':
      return ['Manager', 'Finance Manager', 'CEO', 'Owner'];
    case 'MANAGER':
      return ['Manager', 'Finance Manager', 'CEO', 'Owner'];
    case 'FINANCE_MANAGER':
      return ['Finance Manager', 'CEO', 'Owner'];
    case 'CEO':
      return ['CEO', 'Owner'];
    default:
      return [];
  }
}

/**
 * Check if user can approve based on role and amount
 */
export async function canUserApprove(
  userId: string,
  amount: number,
): Promise<{ canApprove: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || !user.role) {
    return { canApprove: false, reason: 'User or role not found' };
  }

  const requiredLevel = getRequiredApprovalLevel(amount);
  const allowedRoles = getRequiredRoleForLevel(requiredLevel);

  if (!allowedRoles.includes(user.role.name)) {
    return {
      canApprove: false,
      reason: `Amount ${amount} requires approval from: ${allowedRoles.join(' or ')}`,
    };
  }

  return { canApprove: true };
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
  const { expenseId, approverId, reason, approvedAmount } = params;

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

  if (expense.status !== 'PENDING') {
    throw new Error(`Cannot approve expense with status: ${expense.status}`);
  }

  // Check if user can approve this amount
  const finalAmount = approvedAmount || parseFloat(expense.amount.toString());
  const { canApprove, reason: approvalReason } = await canUserApprove(
    approverId,
    finalAmount,
  );

  if (!canApprove) {
    throw new Error(approvalReason || 'User cannot approve this expense');
  }

  // Get employee
  const employee = await prisma.employee.findUnique({
    where: { email: expense.submittedBy.email },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  // Check wallet balance
  const currentBalance = parseFloat(employee.walletBalance.toString());
  if (currentBalance < finalAmount) {
    throw new Error(
      `Insufficient wallet balance. Available: ${currentBalance}, Required: ${finalAmount}`,
    );
  }

  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update expense status
    const updatedExpense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
      },
    });

    // Deduct from wallet
    const newBalance = currentBalance - finalAmount;
    await tx.employee.update({
      where: { id: employee.id },
      data: { walletBalance: newBalance },
    });

    // Create wallet ledger entry (DEBIT)
    const walletEntry = await tx.walletLedger.create({
      data: {
        employeeId: employee.id,
        type: 'DEBIT',
        amount: finalAmount,
        date: new Date(),
        reference: expenseId,
        balance: newBalance,
      },
    });

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      entityType: 'Expense',
      entityId: expenseId,
      userId: approverId,
      changes: {
        status: { from: 'PENDING', to: 'APPROVED' },
        approvedAmount: finalAmount,
        walletDeduction: finalAmount,
        newWalletBalance: newBalance,
      },
    });

    // Create notification for submitter
    await tx.notification.create({
      data: {
        userId: expense.submittedById,
        type: 'SUCCESS',
        message: `Your expense of PKR  ${finalAmount} has been approved and deducted from your wallet.`,
        status: 'UNREAD',
      },
    });

    return { updatedExpense, walletEntry, newBalance };
  });

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

  if (expense.status !== 'PENDING') {
    throw new Error(`Cannot reject expense with status: ${expense.status}`);
  }

  // Check if user can approve (same permission for reject)
  const amount = parseFloat(expense.amount.toString());
  const { canApprove } = await canUserApprove(approverId, amount);

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
  const { incomeId, approverId, reason, approvedAmount } = params;

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

  // Check if user can approve this amount
  const finalAmount = approvedAmount || parseFloat(income.amount.toString());
  const { canApprove, reason: approvalReason } = await canUserApprove(
    approverId,
    finalAmount,
  );

  if (!canApprove) {
    throw new Error(approvalReason || 'User cannot approve this income');
  }

  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update income status
    const updatedIncome = await tx.income.update({
      where: { id: incomeId },
      data: {
        status: 'APPROVED',
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
  const { canApprove } = await canUserApprove(approverId, amount);

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
export async function getPendingApprovalsForUser(userId: string): Promise<{
  expenses: Array<any>;
  income: Array<any>;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || !user.role) {
    return { expenses: [], income: [] };
  }

  // Get all pending expenses
  const pendingExpenses = await prisma.expense.findMany({
    where: { status: 'PENDING' },
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
  const approvableExpenses = pendingExpenses.filter((expense) => {
    const amount = parseFloat(expense.amount.toString());
    const requiredLevel = getRequiredApprovalLevel(amount);
    const allowedRoles = getRequiredRoleForLevel(requiredLevel);
    return allowedRoles.includes(user.role!.name);
  });

  const approvableIncome = pendingIncome.filter((income) => {
    const amount = parseFloat(income.amount.toString());
    const requiredLevel = getRequiredApprovalLevel(amount);
    const allowedRoles = getRequiredRoleForLevel(requiredLevel);
    return allowedRoles.includes(user.role!.name);
  });

  return {
    expenses: approvableExpenses.map((expense) => ({
      ...expense,
      requiredApprovalLevel: getRequiredApprovalLevel(
        parseFloat(expense.amount.toString()),
      ),
    })),
    income: approvableIncome.map((income) => ({
      ...income,
      requiredApprovalLevel: getRequiredApprovalLevel(
        parseFloat(income.amount.toString()),
      ),
    })),
  };
}

/**
 * Get approval statistics
 */
export async function getApprovalStats() {
  const [pending, approved, rejected, total] = await Promise.all([
    prisma.expense.count({ where: { status: 'PENDING' } }),
    prisma.expense.count({ where: { status: 'APPROVED' } }),
    prisma.expense.count({ where: { status: 'REJECTED' } }),
    prisma.expense.count(),
  ]);

  const avgApprovalTime = await prisma.$queryRaw<{ avg: number }[]>`
    SELECT AVG(EXTRACT(EPOCH FROM ("approvedAt" - "createdAt")) / 3600) as avg
    FROM "Expense"
    WHERE "approvedAt" IS NOT NULL
  `;

  return {
    pending,
    approved,
    rejected,
    total,
    approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : '0',
    avgApprovalTimeHours: avgApprovalTime[0]?.avg?.toFixed(1) || '0',
  };
}
