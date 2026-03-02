import { PrismaClient } from "@prisma/client";

export type PayrollPolicyEntry = {
  employeeId: string;
  baseSalary: number;
  incentiveTotal: number;
  deductions: number;
  deductionReason: string;
};

type AttendancePolicy = {
  latePenalty: number;
  halfDayFactor: number;
};

const DEFAULT_POLICY: AttendancePolicy = {
  latePenalty: 500,
  halfDayFactor: 0.5,
};

export async function buildPayrollEntriesByPolicy(
  prisma: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
): Promise<PayrollPolicyEntry[]> {
  const daysInPeriod = Math.max(
    1,
    Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1,
  );
  const policy = DEFAULT_POLICY;

  const [employees, compensations, incentives, commissions, advances, attendance] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.employeeCompensation.findMany({
      select: { employeeId: true, baseSalary: true },
    }),
    prisma.incentiveEntry.findMany({
      where: {
        status: "APPROVED",
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        createdAt: { lte: periodEnd },
      },
      select: { employeeId: true, amount: true, projectRef: true },
    }),
    prisma.commissionEntry.findMany({
      where: {
        payeeType: "EMPLOYEE",
        status: "APPROVED",
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        createdAt: { lte: periodEnd },
      },
      select: { employeeId: true, amount: true, projectRef: true },
    }),
    prisma.salaryAdvance.findMany({
      where: {
        status: "PAID",
        createdAt: { lte: periodEnd },
      },
      select: { employeeId: true, amount: true },
    }),
    prisma.attendanceEntry.findMany({
      where: {
        date: { gte: periodStart, lte: periodEnd },
      },
      select: { employeeId: true, status: true },
    }),
  ]);

  const baseByEmployee = new Map(
    compensations.map((row) => [row.employeeId, Number(row.baseSalary || 0)]),
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
    const current = map.get(row.employeeId) || 0;
    map.set(row.employeeId, current + Number(row.amount || 0));
    return map;
  }, new Map<string, number>());

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
    const baseSalary = Number((baseByEmployee.get(employee.id) || 0).toFixed(2));
    const dailyRate = baseSalary / daysInPeriod;
    const attendanceRow = attendanceAgg.get(employee.id) || { absent: 0, halfDay: 0, late: 0 };

    const absenceDeduction = dailyRate * attendanceRow.absent;
    const halfDayDeduction = dailyRate * policy.halfDayFactor * attendanceRow.halfDay;
    const lateDeduction = policy.latePenalty * attendanceRow.late;
    const advanceDeduction = advanceByEmployee.get(employee.id) || 0;
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
    if (advanceDeduction > 0) reasons.push(`Salary advance recovery`);
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
