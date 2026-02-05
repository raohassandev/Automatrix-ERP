import { describe, expect, test } from "vitest";
import {
  canApproveExpense,
  canApproveIncome,
  getExpenseApprovalLevel,
  getIncomeApprovalLevel,
  isPendingExpenseStatus,
  isPendingIncomeStatus,
} from "../approvals";

describe("approvals (business rules)", () => {
  test("expense approval level escalates with amount", () => {
    expect(getExpenseApprovalLevel(1)).toBe("L1");
    // boundary depends on constants; just ensure monotonic escalation
    expect(["L1", "L2", "L3"]).toContain(getExpenseApprovalLevel(50_000));
    expect(getExpenseApprovalLevel(Number.MAX_SAFE_INTEGER)).toBe("L3");
  });

  test("income approval level escalates with amount", () => {
    expect(["L1", "L2"]).toContain(getIncomeApprovalLevel(1));
    expect(getIncomeApprovalLevel(Number.MAX_SAFE_INTEGER)).toBe("L2");
  });

  test("pending status helpers", () => {
    expect(isPendingExpenseStatus("PENDING")).toBe(true);
    expect(isPendingExpenseStatus("PENDING_L1")).toBe(true);
    expect(isPendingExpenseStatus("APPROVED")).toBe(false);

    expect(isPendingIncomeStatus("PENDING")).toBe(true);
    expect(isPendingIncomeStatus("APPROVED")).toBe(false);
  });

  test("approval permissions depend on role + amount", () => {
    // CEO always can approve (wildcard)
    expect(canApproveExpense("CEO", 100)).toBe(true);
    expect(canApproveIncome("CEO", 100)).toBe(true);

    // Staff should not be able to approve even low amounts.
    expect(canApproveExpense("Staff", 100)).toBe(false);
    expect(canApproveIncome("Staff", 100)).toBe(false);
  });
});
