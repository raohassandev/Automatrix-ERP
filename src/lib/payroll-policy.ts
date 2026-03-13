import { PrismaClient } from "@prisma/client";
import { toMonthKey } from "@/lib/lifecycle";

export type PayrollPolicyEntry = {
  employeeId: string;
  baseSalary: number;
  incentiveTotal: number;
  deductions: number;
  deductionReason: string;
};

type AdvanceDeductionSummary = {
  total: number;
  lines: Array<{ id: string; amount: number; mode: string }>;
};

type AttendancePolicy = {
  latePenalty: number;
  halfDayFactor: number;
};

const DEFAULT_POLICY: AttendancePolicy = {
  latePenalty: 500,
  halfDayFactor: 0.5,
};

function computeAdvanceOutstanding(row: {
  amount: unknown;
  issuedAmount: unknown;
  recoveredAmount: unknown;
  outstandingAmount: unknown;
}) {
  const amount = Number(row.amount || 0);
  const issued = Number(row.issuedAmount || amount || 0);
  const recovered = Number(row.recoveredAmount || 0);
  const storedOutstanding = Number(row.outstandingAmount || 0);
  const derivedOutstanding = Number((issued - recovered).toFixed(2));
  const outstanding = storedOutstanding > 0 ? storedOutstanding : derivedOutstanding;
  return Math.max(0, Number(outstanding.toFixed(2)));
}

function computeAdvanceDeduction(rows: Array<{
  id: string;
  amount: unknown;
  issuedAmount: unknown;
  recoveredAmount: unknown;
  outstandingAmount: unknown;
  recoveryMode: string | null;
  installmentAmount: unknown;
}>): AdvanceDeductionSummary {
  const lines: Array<{ id: string; amount: number; mode: string }> = [];
  let total = 0;
  for (const row of rows) {
    const mode = String(row.recoveryMode || "FULL_NEXT_PAYROLL").toUpperCase();
    const outstanding = computeAdvanceOutstanding(row);
    if (outstanding <= 0.01) continue;
    let recoverable = outstanding;
    if (mode === "INSTALLMENT") {
      const installment = Number(row.installmentAmount || 0);
      if (installment > 0) recoverable = Math.min(outstanding, installment);
    }
    recoverable = Number(recoverable.toFixed(2));
    if (recoverable <= 0.01) continue;
    lines.push({ id: row.id, amount: recoverable, mode });
    total += recoverable;
  }
  return { total: Number(total.toFixed(2)), lines };
}

export async function buildPayrollEntriesByPolicy(
  prisma: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
  options?: { payrollMonthKey?: string },
): Promise<PayrollPolicyEntry[]> {
  const payrollMonthKey = options?.payrollMonthKey || toMonthKey(periodEnd);
  const daysInPeriod = Math.max(
    1,
    Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1,
  );
  const policy = DEFAULT_POLICY;

  const [employees, compensations, previousPayrollBase, incentives, commissions, advances, attendance] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.employeeCompensation.findMany({
      select: { employeeId: true, baseSalary: true },
    }),
    prisma.payrollEntry.findMany({
      distinct: ["employeeId"],
      orderBy: { createdAt: "desc" },
      select: { employeeId: true, baseSalary: true },
    }),
    prisma.incentiveEntry.findMany({
      where: {
        status: "APPROVED",
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        OR: [
          { scheduledPayrollMonth: payrollMonthKey },
          { scheduledPayrollMonth: null, earningDate: { gte: periodStart, lte: periodEnd } },
          { scheduledPayrollMonth: null, earningDate: null, createdAt: { gte: periodStart, lte: periodEnd } },
        ],
      },
      select: { employeeId: true, amount: true, projectRef: true },
    }),
    prisma.commissionEntry.findMany({
      where: {
        payeeType: "EMPLOYEE",
        status: "APPROVED",
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        OR: [
          { scheduledPayrollMonth: payrollMonthKey },
          { scheduledPayrollMonth: null, earningDate: { gte: periodStart, lte: periodEnd } },
          { scheduledPayrollMonth: null, earningDate: null, createdAt: { gte: periodStart, lte: periodEnd } },
        ],
      },
      select: { employeeId: true, amount: true, projectRef: true },
    }),
    prisma.salaryAdvance.findMany({
      where: {
        status: { in: ["PAID", "PARTIALLY_RECOVERED"] },
        OR: [{ paidAt: { lte: periodEnd } }, { paidAt: null, createdAt: { lte: periodEnd } }],
      },
      select: {
        id: true,
        employeeId: true,
        amount: true,
        issuedAmount: true,
        recoveredAmount: true,
        outstandingAmount: true,
        recoveryMode: true,
        installmentAmount: true,
      },
    }),
    prisma.attendanceEntry.findMany({
      where: {
        date: { gte: periodStart, lte: periodEnd },
      },
      select: { employeeId: true, status: true },
    }),
  ]);

  const compensationByEmployee = new Map(
    compensations.map((row) => [row.employeeId, Number(row.baseSalary || 0)]),
  );
  const previousPayrollByEmployee = new Map(
    previousPayrollBase.map((row) => [row.employeeId, Number(row.baseSalary || 0)]),
  );
  const incentiveByEmployee = incentives.reduce((map, row) => {
    const current = map.get(row.employeeId) || 0;
    map.set(row.employeeId, current + Number(row.amount || 0));
    return map;
  }, new Map<string, number>());
  const commissionByEmployee = commissions.reduce((map, row) => {
    const employeeId = row.employeeId || "";
    if (!employeeId) return map;
    const current = map.get(employeeId) || 0;
    map.set(employeeId, current + Number(row.amount || 0));
    return map;
  }, new Map<string, number>());

  const incentiveCountByEmployee = incentives.reduce((map, row) => {
    const current = map.get(row.employeeId) || 0;
    map.set(row.employeeId, current + 1);
    return map;
  }, new Map<string, number>());
  const commissionCountByEmployee = commissions.reduce((map, row) => {
    const employeeId = row.employeeId || "";
    if (!employeeId) return map;
    const current = map.get(employeeId) || 0;
    map.set(employeeId, current + 1);
    return map;
  }, new Map<string, number>());
  const advanceByEmployee = advances.reduce((map, row) => {
    const current = map.get(row.employeeId) || [];
    current.push(row);
    map.set(row.employeeId, current);
    return map;
  }, new Map<string, Array<(typeof advances)[number]>>());

  const attendanceAgg = attendance.reduce((map, row) => {
    const key = row.employeeId;
    const current = map.get(key) || { absent: 0, halfDay: 0, late: 0 };
    const status = String(row.status || "").toUpperCase();
    if (status === "ABSENT") current.absent += 1;
    if (status === "HALF_DAY") current.halfDay += 1;
    if (status === "LATE") current.late += 1;
    map.set(key, current);
    return map;
  }, new Map<string, { absent: number; halfDay: number; late: number }>());

  return employees.map((employee) => {
    const baseSalary = Number(
      (compensationByEmployee.get(employee.id) || previousPayrollByEmployee.get(employee.id) || 0).toFixed(2),
    );
    const dailyRate = baseSalary / daysInPeriod;
    const attendanceRow = attendanceAgg.get(employee.id) || { absent: 0, halfDay: 0, late: 0 };

    const absenceDeduction = dailyRate * attendanceRow.absent;
    const halfDayDeduction = dailyRate * policy.halfDayFactor * attendanceRow.halfDay;
    const lateDeduction = policy.latePenalty * attendanceRow.late;
    const advanceRows = advanceByEmployee.get(employee.id) || [];
    const advanceSummary = computeAdvanceDeduction(advanceRows);
    const advanceDeduction = advanceSummary.total;
    const deductions = Number(
      (absenceDeduction + halfDayDeduction + lateDeduction + advanceDeduction).toFixed(2),
    );
    const incentiveTotal = Number(
      ((incentiveByEmployee.get(employee.id) || 0) + (commissionByEmployee.get(employee.id) || 0)).toFixed(2),
    );

    const reasons: string[] = [];
    if (attendanceRow.absent > 0) reasons.push(`Absent: ${attendanceRow.absent} day(s)`);
    if (attendanceRow.halfDay > 0) reasons.push(`Half-day: ${attendanceRow.halfDay}`);
    if (attendanceRow.late > 0) reasons.push(`Late: ${attendanceRow.late}`);
    if (advanceDeduction > 0) reasons.push(`Salary advance recovery: ${advanceSummary.lines.length} line(s)`);
    const incentiveCount = incentiveCountByEmployee.get(employee.id) || 0;
    if (incentiveCount > 0) reasons.push(`Project incentives: ${incentiveCount}`);
    const commissionCount = commissionCountByEmployee.get(employee.id) || 0;
    if (commissionCount > 0) reasons.push(`Employee commissions: ${commissionCount}`);

    return {
      employeeId: employee.id,
      baseSalary,
      incentiveTotal,
      deductions,
      deductionReason: reasons.length > 0 ? reasons.join(" | ") : "Policy auto-calculation",
    };
  });
}
