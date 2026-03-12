import { describe, expect, test } from "vitest";
import {
  isExpenseApprovedStatus,
  isExpensePendingStatus,
  isExpenseSettledStatus,
  toMonthKey,
  toPostingStatusFromWorkflow,
  toSettlementStatusFromWorkflow,
} from "@/lib/lifecycle";

describe("lifecycle helpers", () => {
  test("expense status groups resolve correctly", () => {
    expect(isExpensePendingStatus("PENDING_L1")).toBe(true);
    expect(isExpensePendingStatus("APPROVED")).toBe(false);

    expect(isExpenseApprovedStatus("APPROVED")).toBe(true);
    expect(isExpenseApprovedStatus("PARTIALLY_APPROVED")).toBe(true);
    expect(isExpenseApprovedStatus("PAID")).toBe(false);

    expect(isExpenseSettledStatus("PAID")).toBe(true);
    expect(isExpenseSettledStatus("APPROVED")).toBe(false);
  });

  test("posting and settlement mapping is stable", () => {
    expect(toPostingStatusFromWorkflow("POSTED")).toBe("POSTED");
    expect(toPostingStatusFromWorkflow("RECEIVED")).toBe("POSTED");
    expect(toPostingStatusFromWorkflow("DRAFT")).toBe("UNPOSTED");
    expect(toPostingStatusFromWorkflow("REVERSED")).toBe("REVERSED");

    expect(toSettlementStatusFromWorkflow("PAID")).toBe("SETTLED");
    expect(toSettlementStatusFromWorkflow("PARTIALLY_RECOVERED")).toBe("PARTIALLY_SETTLED");
    expect(toSettlementStatusFromWorkflow("PENDING")).toBe("UNSETTLED");
  });

  test("month key normalization", () => {
    expect(toMonthKey(new Date("2026-03-12T00:00:00Z"))).toBe("2026-03");
    expect(toMonthKey("2026-11-01")).toBe("2026-11");
    expect(toMonthKey("not-a-date")).toBe("");
  });
});

