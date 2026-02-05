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
    include: { entries: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Payroll run not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = payrollRunUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.periodStart) data.periodStart = new Date(parsed.data.periodStart);
  if (parsed.data.periodEnd) data.periodEnd = new Date(parsed.data.periodEnd);
  if (parsed.data.periodStart || parsed.data.periodEnd) {
    const periodStart = parsed.data.periodStart ? new Date(parsed.data.periodStart) : existing.periodStart;
    const periodEnd = parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : existing.periodEnd;
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
  }
  if (parsed.data.notes !== undefined) {
    data.notes = parsed.data.notes ? sanitizeString(parsed.data.notes) : null;
  }
  if (parsed.data.status) {
    const nextStatus = sanitizeString(parsed.data.status);
    if (nextStatus === "APPROVED" && !canApprove) {
      return NextResponse.json({ success: false, error: "Approval permission required" }, { status: 403 });
    }
    data.status = nextStatus;
  }

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.entries && parsed.data.entries.length > 0) {
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

    const run = await tx.payrollRun.update({
      where: { id },
      data,
      include: { entries: true },
    });

    if (run.status === "APPROVED") {
      for (const entry of run.entries) {
        if (entry.walletLedgerId) continue;
        const employee = await tx.employee.findUnique({ where: { id: entry.employeeId } });
        if (!employee) continue;
        const newBalance = Number(employee.walletBalance) + Number(entry.netPay);
        const ledger = await tx.walletLedger.create({
          data: {
            date: new Date(),
            employeeId: entry.employeeId,
            type: "CREDIT",
            amount: new Prisma.Decimal(entry.netPay),
            reference: `PAYROLL:${run.id}:${entry.id}`,
            balance: new Prisma.Decimal(newBalance),
          },
        });
        await tx.employee.update({
          where: { id: entry.employeeId },
          data: { walletBalance: new Prisma.Decimal(newBalance) },
        });
        await tx.payrollEntry.update({
          where: { id: entry.id },
          data: {
            walletLedgerId: ledger.id,
            approvedById: entry.approvedById || session.user.id,
            status: "PAID",
          },
        });
      }
    }

      return run;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update payroll run.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  await logAudit({
    action: "UPDATE_PAYROLL_RUN",
    entity: "PayrollRun",
    entityId: id,
    newValue: JSON.stringify(parsed.data),
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
  const existing = await prisma.payrollRun.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Payroll run not found" }, { status: 404 });
  }

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
