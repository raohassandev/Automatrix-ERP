import { describe, expect, test } from "vitest";
import { maskControlRegistersSummary, type ControlRegistersSummary } from "@/lib/control-registers";

const sample: ControlRegistersSummary = {
  generatedAt: "2026-03-13T00:00:00.000Z",
  payroll: { count: 4, totalNetPay: 1000, totalOverdue: 1 },
  variablePay: { count: 3, unsettledAmount: 500 },
  settlements: { employees: 2, netCompanyPayable: 700, reimbursementDue: 100, advanceOutstanding: 50 },
  projects: { count: 2, pendingRecovery: 300, grossMargin: 900 },
  procurement: { rows: 2, outstanding: 250, blocked: 1 },
  taskApprovals: { items: 5, overdue: 2 },
};

describe("maskControlRegistersSummary", () => {
  test("keeps financial values for authorized viewers", () => {
    const out = maskControlRegistersSummary(sample, true);
    expect(out.maskedFinancials).toBe(false);
    expect(out.payroll.totalNetPay).toBe(1000);
    expect(out.procurement.outstanding).toBe(250);
  });

  test("masks financial values for restricted viewers", () => {
    const out = maskControlRegistersSummary(sample, false);
    expect(out.maskedFinancials).toBe(true);
    expect(out.payroll.totalNetPay).toBeNull();
    expect(out.variablePay.unsettledAmount).toBeNull();
    expect(out.settlements.netCompanyPayable).toBeNull();
    expect(out.projects.pendingRecovery).toBeNull();
    expect(out.procurement.outstanding).toBeNull();
  });
});
