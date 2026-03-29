import { describe, expect, test, vi } from "vitest";
import { buildPayrollEntriesByPolicy } from "@/lib/payroll-policy";

function makeFakePrisma() {
  return {
    employee: {
      findMany: vi.fn(async () => [{ id: "emp1", name: "Employee One" }]),
    },
    employeeCompensation: {
      findMany: vi.fn(async () => [{ employeeId: "emp1", baseSalary: 100000 }]),
    },
    payrollEntry: {
      findMany: vi.fn(async () => []),
    },
    incentiveEntry: {
      findMany: vi.fn<(_: { where: unknown }) => Promise<unknown[]>>().mockResolvedValue([]),
    },
    commissionEntry: {
      findMany: vi.fn<(_: { where: unknown }) => Promise<unknown[]>>().mockResolvedValue([]),
    },
    salaryAdvance: {
      findMany: vi.fn(async () => []),
    },
    attendanceEntry: {
      findMany: vi.fn(async () => []),
    },
  };
}

describe("payroll policy month-aware selection", () => {
  test("queries incentives and commissions for the selected payroll month", async () => {
    const prisma = makeFakePrisma();
    const periodStart = new Date("2026-02-01T00:00:00.000Z");
    const periodEnd = new Date("2026-02-28T23:59:59.999Z");

    await buildPayrollEntriesByPolicy(prisma as never, periodStart, periodEnd, { payrollMonthKey: "2026-02" });

    const incentiveWhere = prisma.incentiveEntry.findMany.mock.calls[0]?.[0]?.where as {
      status: string;
      payoutMode: string;
      settlementStatus: string;
      OR: unknown[];
    };
    const commissionWhere = prisma.commissionEntry.findMany.mock.calls[0]?.[0]?.where as {
      status: string;
      payoutMode: string;
      settlementStatus: string;
      OR: unknown[];
    };

    expect(incentiveWhere.status).toBe("APPROVED");
    expect(incentiveWhere.payoutMode).toBe("PAYROLL");
    expect(incentiveWhere.settlementStatus).toBe("UNSETTLED");
    expect(incentiveWhere.OR).toEqual([
      { scheduledPayrollMonth: { lte: "2026-02" } },
      { scheduledPayrollMonth: null, earningDate: { lte: periodEnd } },
      { scheduledPayrollMonth: null, earningDate: null, createdAt: { lte: periodEnd } },
    ]);

    expect(commissionWhere.status).toBe("APPROVED");
    expect(commissionWhere.payoutMode).toBe("PAYROLL");
    expect(commissionWhere.settlementStatus).toBe("UNSETTLED");
    expect(commissionWhere.OR).toEqual([
      { scheduledPayrollMonth: { lte: "2026-02" } },
      { scheduledPayrollMonth: null, earningDate: { lte: periodEnd } },
      { scheduledPayrollMonth: null, earningDate: null, createdAt: { lte: periodEnd } },
    ]);
  });
});
