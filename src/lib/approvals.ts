import { EXPENSE_APPROVAL_LEVELS, INCOME_APPROVAL_LEVELS } from "@/lib/constants";
import { hasPermission, RoleName } from "@/lib/permissions";

export type ApprovalLevel = "L1" | "L2" | "L3";

export function getExpenseApprovalLevel(amount: number): ApprovalLevel {
  for (const level of EXPENSE_APPROVAL_LEVELS) {
    if (amount <= level.max) return level.level;
  }
  return "L3";
}

export function getIncomeApprovalLevel(amount: number): "L1" | "L2" {
  for (const level of INCOME_APPROVAL_LEVELS) {
    if (amount <= level.max) return level.level;
  }
  return "L2";
}

export function canApproveExpense(role: RoleName, amount: number) {
  const level = getExpenseApprovalLevel(amount);
  if (level === "L1") {
    return (
      hasPermission(role, "expenses.approve_low") ||
      hasPermission(role, "approvals.approve_low")
    );
  }
  if (level === "L2") {
    return (
      hasPermission(role, "expenses.approve_medium") ||
      hasPermission(role, "approvals.approve_high")
    );
  }
  return (
    hasPermission(role, "expenses.approve_high") ||
    hasPermission(role, "approvals.approve_high")
  );
}

export function canApproveIncome(role: RoleName, amount: number) {
  const level = getIncomeApprovalLevel(amount);
  if (level === "L1") {
    return (
      hasPermission(role, "income.approve_low") ||
      hasPermission(role, "approvals.approve_low")
    );
  }
  return (
    hasPermission(role, "income.approve_high") ||
    hasPermission(role, "approvals.approve_high")
  );
}

export function isPendingExpenseStatus(status: string) {
  return status === "PENDING" || status.startsWith("PENDING_");
}

export function isPendingIncomeStatus(status: string) {
  return status === "PENDING";
}
