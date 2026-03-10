import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payrollRunSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";

function getPreviousMonthRange(now: Date) {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

function findDuplicateEmployeeId(entries: Array<{ employeeId: string }>) {
  const seen = new Set<string>();
  for (const row of entries) {
    const employeeId = sanitizeString(row.employeeId || "");
    if (!employeeId) continue;
    if (seen.has(employeeId)) return employeeId;
    seen.add(employeeId);
  }
  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "payroll.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.payrollRun.findMany({
    orderBy: { periodStart: "desc" },
    include: { entries: { include: { employee: true } } },
  });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "payroll.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = payrollRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const periodStart = new Date(parsed.data.periodStart);
  const periodEnd = new Date(parsed.data.periodEnd);
  const prev = getPreviousMonthRange(new Date());
  if (
    periodStart.toDateString() !== prev.start.toDateString() ||
    periodEnd.toDateString() !== prev.end.toDateString()
  ) {
    return NextResponse.json(
      { success: false, error: "Payroll runs must be for the previous month only." },
      { status: 400 }
    );
  }

  const overlap = await prisma.payrollRun.findFirst({
    where: {
      periodStart,
      periodEnd,
    },
    select: { id: true },
  });
  if (overlap) {
    return NextResponse.json(
      { success: false, error: "A payroll run already exists for this period." },
      { status: 400 }
    );
  }

  const duplicateEmployeeId = findDuplicateEmployeeId(parsed.data.entries);
  if (duplicateEmployeeId) {
    return NextResponse.json(
      { success: false, error: `Duplicate employee entry found in payroll run: ${duplicateEmployeeId}` },
      { status: 400 },
    );
  }

  const employeeIds = Array.from(
    new Set(parsed.data.entries.map((row) => sanitizeString(row.employeeId)).filter(Boolean)),
  );
  const knownEmployees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true },
  });
  if (knownEmployees.length !== employeeIds.length) {
    return NextResponse.json(
      { success: false, error: "One or more payroll entries reference unknown employees." },
      { status: 400 },
    );
  }

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      return tx.payrollRun.create({
      data: {
        periodStart,
        periodEnd,
        // Creation is always draft; approval flow settles linked variable pay and posts wallet credits.
        status: "DRAFT",
        notes: parsed.data.notes ? sanitizeString(parsed.data.notes) : undefined,
        entries: {
          create: parsed.data.entries.map((entry) => {
            const incentiveTotal = entry.incentiveTotal ?? 0;
            const deductions = entry.deductions ?? 0;
            if (deductions > 0 && !entry.deductionReason) {
              throw new Error("Deduction reason is required when deductions are applied.");
            }
            const netPay = entry.baseSalary + incentiveTotal - deductions;
            return {
              employeeId: sanitizeString(entry.employeeId),
              baseSalary: new Prisma.Decimal(entry.baseSalary),
              incentiveTotal: new Prisma.Decimal(incentiveTotal),
              deductions: new Prisma.Decimal(deductions),
              deductionReason: entry.deductionReason ? sanitizeString(entry.deductionReason) : null,
              netPay: new Prisma.Decimal(netPay),
            };
          }),
        },
      },
      include: { entries: true },
    });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payroll run.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  await logAudit({
    action: "CREATE_PAYROLL_RUN",
    entity: "PayrollRun",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
