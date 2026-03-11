import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payrollRunUpdateSchema } from "@/lib/validation";
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

function collectBaseSalaryOverrides(args: {
  entries: Array<{ employeeId: string; baseSalary: number }>;
  profileBaseByEmployee: Map<string, number>;
}) {
  const overrides: Array<{ employeeId: string; profileBase: number; enteredBase: number; delta: number }> = [];
  for (const row of args.entries) {
    const profileBase = Number(args.profileBaseByEmployee.get(row.employeeId) || 0);
    const enteredBase = Number(row.baseSalary || 0);
    const delta = Number((enteredBase - profileBase).toFixed(2));
    if (Math.abs(delta) > 0.01) {
      overrides.push({
        employeeId: row.employeeId,
        profileBase,
        enteredBase,
        delta,
      });
    }
  }
  return overrides;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "payroll.edit");
  const canApprove = await requirePermission(session.user.id, "payroll.approve");
  if (!canEdit && !canApprove) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.payrollRun.findUnique({
    where: { id },
    include: { entries: { select: { id: true, status: true } } },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Payroll run not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = payrollRunUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const hasPaidEntries = existing.entries.some((entry) => String(entry.status || "").toUpperCase() === "PAID");
  let baseSalaryOverrides: Array<{ employeeId: string; profileBase: number; enteredBase: number; delta: number }> = [];

  if (parsed.data.entries && parsed.data.entries.length > 0) {
    if (!canEdit) {
      return NextResponse.json({ success: false, error: "Edit permission required" }, { status: 403 });
    }
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Only DRAFT payroll runs can edit entry rows." },
        { status: 400 },
      );
    }

    const seen = new Set<string>();
    for (const row of parsed.data.entries) {
      const employeeId = sanitizeString(row.employeeId || "");
      if (!employeeId) continue;
      if (seen.has(employeeId)) {
        return NextResponse.json(
          { success: false, error: `Duplicate employee entry found in payroll run: ${employeeId}` },
          { status: 400 },
        );
      }
      seen.add(employeeId);
    }

    const employeeIds = Array.from(seen);
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
    const compensationRows = await prisma.employeeCompensation.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { employeeId: true, baseSalary: true },
    });
    const profileBaseByEmployee = new Map(
      compensationRows.map((row) => [row.employeeId, Number(row.baseSalary || 0)]),
    );
    baseSalaryOverrides = collectBaseSalaryOverrides({
      entries: parsed.data.entries.map((entry) => ({
        employeeId: sanitizeString(entry.employeeId),
        baseSalary: Number(entry.baseSalary || 0),
      })),
      profileBaseByEmployee,
    });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.periodStart) data.periodStart = new Date(parsed.data.periodStart);
  if (parsed.data.periodEnd) data.periodEnd = new Date(parsed.data.periodEnd);

  if (parsed.data.periodStart || parsed.data.periodEnd) {
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Only DRAFT payroll runs can change period dates." },
        { status: 400 },
      );
    }
    const periodStart = parsed.data.periodStart ? new Date(parsed.data.periodStart) : existing.periodStart;
    const periodEnd = parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : existing.periodEnd;
    const prev = getPreviousMonthRange(new Date());
    if (periodStart.toDateString() !== prev.start.toDateString() || periodEnd.toDateString() !== prev.end.toDateString()) {
      return NextResponse.json(
        { success: false, error: "Payroll runs must be for the previous month only." },
        { status: 400 },
      );
    }
  }

  if (parsed.data.notes !== undefined) {
    data.notes = parsed.data.notes ? sanitizeString(parsed.data.notes) : null;
  }

  if (parsed.data.status) {
    const nextStatus = sanitizeString(parsed.data.status).toUpperCase();

    if (nextStatus === "APPROVED" && !canApprove) {
      return NextResponse.json({ success: false, error: "Approval permission required" }, { status: 403 });
    }

    if (!["DRAFT", "APPROVED", "POSTED"].includes(nextStatus)) {
      return NextResponse.json({ success: false, error: "Unsupported payroll run status." }, { status: 400 });
    }

    if (nextStatus === "POSTED") {
      return NextResponse.json(
        { success: false, error: "POSTED status is set automatically when all payroll entries are marked paid." },
        { status: 400 },
      );
    }

    if (existing.status === "POSTED" && nextStatus !== "POSTED") {
      return NextResponse.json(
        { success: false, error: "Posted payroll runs cannot be moved back." },
        { status: 400 },
      );
    }

    if (existing.status !== "DRAFT" && nextStatus === "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Approved payroll runs cannot be moved back to draft." },
        { status: 400 },
      );
    }

    if (hasPaidEntries && nextStatus === "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Payroll run with paid entries cannot be reverted." },
        { status: 400 },
      );
    }

    data.status = nextStatus;
  }

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.entries && parsed.data.entries.length > 0) {
        await tx.payrollComponentLine.deleteMany({
          where: {
            payrollEntry: { payrollRunId: id },
          },
        });
        await tx.payrollEntry.deleteMany({ where: { payrollRunId: id } });
        await tx.payrollEntry.createMany({
          data: parsed.data.entries.map((entry) => {
            const incentiveTotal = entry.incentiveTotal ?? 0;
            const deductions = entry.deductions ?? 0;
            if (deductions > 0 && !entry.deductionReason) {
              throw new Error("Deduction reason is required when deductions are applied.");
            }
            const netPay = entry.baseSalary + incentiveTotal - deductions;
            return {
              payrollRunId: id,
              employeeId: sanitizeString(entry.employeeId),
              baseSalary: new Prisma.Decimal(entry.baseSalary),
              incentiveTotal: new Prisma.Decimal(incentiveTotal),
              deductions: new Prisma.Decimal(deductions),
              deductionReason: entry.deductionReason ? sanitizeString(entry.deductionReason) : null,
              netPay: new Prisma.Decimal(netPay),
            };
          }),
        });
      }

      return tx.payrollRun.update({
        where: { id },
        data,
        include: { entries: true },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update payroll run.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  await logAudit({
    action: "UPDATE_PAYROLL_RUN",
    entity: "PayrollRun",
    entityId: id,
    newValue: JSON.stringify({
      ...parsed.data,
      baseSalaryOverrides,
    }),
    reason:
      baseSalaryOverrides.length > 0
        ? `Base salary overridden for ${baseSalaryOverrides.length} employee(s) compared to compensation profile`
        : parsed.data.entries
        ? "Base salaries matched compensation profile"
        : undefined,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "payroll.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const existing = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      entries: {
        select: {
          id: true,
          employeeId: true,
          status: true,
          walletLedgerId: true,
          expenseId: true,
          deductions: true,
          deductionReason: true,
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Payroll run not found" }, { status: 404 });
  }

  const paidEntries = existing.entries.filter((entry) => String(entry.status || "").toUpperCase() === "PAID");
  if (paidEntries.length > 0) {
    await logAudit({
      action: "BLOCK_DELETE_PAYROLL_RUN_PAID",
      entity: "PayrollRun",
      entityId: id,
      userId: session.user.id,
      reason: `Blocked delete because payroll run has ${paidEntries.length} paid entries`,
    });
    return NextResponse.json(
      {
        success: false,
        error:
          "Cannot delete payroll run because one or more entries are already paid. Use payroll reversal/adjustment flow instead.",
      },
      { status: 400 },
    );
  }

  await prisma.payrollComponentLine.deleteMany({ where: { payrollEntry: { payrollRunId: id } } });
  await prisma.payrollEntry.deleteMany({ where: { payrollRunId: id } });
  await prisma.payrollRun.delete({ where: { id } });

  await logAudit({
    action: "DELETE_PAYROLL_RUN",
    entity: "PayrollRun",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
