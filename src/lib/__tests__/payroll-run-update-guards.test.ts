import { describe, expect, test } from "vitest";
import { hasPayrollRunNonStatusMutations } from "@/lib/payroll-run-update-guards";

describe("hasPayrollRunNonStatusMutations", () => {
  test("returns false for status-only updates", () => {
    expect(hasPayrollRunNonStatusMutations({ status: "APPROVED" })).toBe(false);
  });

  test("returns true when notes are changed", () => {
    expect(hasPayrollRunNonStatusMutations({ status: "APPROVED", notes: "freeze month" })).toBe(true);
  });

  test("returns true when entry rows are replaced", () => {
    expect(
      hasPayrollRunNonStatusMutations({
        entries: [{ employeeId: "emp1", baseSalary: 50000 }],
      }),
    ).toBe(true);
  });
});

