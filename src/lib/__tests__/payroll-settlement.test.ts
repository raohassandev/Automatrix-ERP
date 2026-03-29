import { describe, expect, test, vi } from "vitest";
import { collectAndSettleVariablePay } from "@/lib/payroll-settlement";

describe("collectAndSettleVariablePay", () => {
  test("settles only month-scoped rows and stamps settledMonth", async () => {
    const tx = {
      incentiveEntry: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ id: "inc1", projectRef: "P-1", amount: 1200, reason: "Incentive test" }])
          .mockResolvedValueOnce([]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      commissionEntry: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    };

    const periodStart = new Date("2026-02-01T00:00:00.000Z");
    const periodEnd = new Date("2026-02-28T23:59:59.999Z");

    const result = await collectAndSettleVariablePay({
      tx: tx as never,
      payrollRunId: "run1",
      payrollEntryId: "entry1",
      employeeId: "emp1",
      payrollMonthKey: "2026-02",
      runPeriodStart: periodStart,
      runPeriodEnd: periodEnd,
    });

    expect(result.total).toBe(1200);
    expect(result.components).toHaveLength(1);
    expect(tx.incentiveEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settlementStatus: "SETTLED",
          settledMonth: "2026-02",
        }),
      }),
    );

    const unsettledIncentiveWhere = tx.incentiveEntry.findMany.mock.calls[0][0]?.where;
    expect(unsettledIncentiveWhere.OR).toEqual([
      { scheduledPayrollMonth: { lte: "2026-02" } },
      { scheduledPayrollMonth: null, earningDate: { lte: periodEnd } },
      { scheduledPayrollMonth: null, earningDate: null, createdAt: { lte: periodEnd } },
    ]);
  });
});
