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
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "payroll.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const url = new URL(req.url);
  const forceDelete = ["1", "true", "yes"].includes(
    String(url.searchParams.get("force") || "").toLowerCase(),
  );
  const confirmToken = String(url.searchParams.get("confirm") || "");

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

  if (paidEntries.length > 0 && !forceDelete) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Cannot delete payroll run because one or more entries are already paid. Use force=1&confirm=FORCE_DELETE_PAYROLL with owner-level authority to reverse postings and delete.",
      },
      { status: 400 },
    );
  }

  if (paidEntries.length > 0 && forceDelete) {
    const [canApprove, canManageAccounting] = await Promise.all([
      requirePermission(session.user.id, "payroll.approve"),
      requirePermission(session.user.id, "accounting.manage"),
    ]);

    if (!canApprove || !canManageAccounting) {
      return NextResponse.json(
        {
          success: false,
          error: "Force delete of paid payroll is restricted. payroll.approve + accounting.manage required.",
        },
        { status: 403 },
      );
    }

    if (confirmToken !== "FORCE_DELETE_PAYROLL") {
      return NextResponse.json(
        {
          success: false,
          error: "Force delete confirmation missing. Send confirm=FORCE_DELETE_PAYROLL.",
        },
        { status: 400 },
      );
    }

    const advanceRecoveryRows = paidEntries.filter((entry) => {
      const deduction = Number(entry.deductions || 0);
      if (deduction <= 0) return false;
      return /advance/i.test(String(entry.deductionReason || ""));
    });

    if (advanceRecoveryRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot force delete this payroll run because one or more paid entries include advance-recovery deductions. Reopen those recovery records first, then retry.",
        },
        { status: 400 },
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        const entryIds = paidEntries.map((entry) => entry.id);

        // Unsettle variable-pay records that were settled in this payroll run.
        await tx.incentiveEntry.updateMany({
          where: {
            settledInPayrollRunId: id,
            settledInPayrollEntryId: { in: entryIds },
          },
          data: {
            settlementStatus: "UNSETTLED",
            settledInPayrollRunId: null,
            settledInPayrollEntryId: null,
            settledAt: null,
          },
        });
        await tx.commissionEntry.updateMany({
          where: {
            settledInPayrollRunId: id,
            settledInPayrollEntryId: { in: entryIds },
          },
          data: {
            settlementStatus: "UNSETTLED",
            settledInPayrollRunId: null,
            settledInPayrollEntryId: null,
            settledAt: null,
          },
        });

        for (const entry of paidEntries) {
          const walletLedger =
            entry.walletLedgerId
              ? await tx.walletLedger.findUnique({
                  where: { id: entry.walletLedgerId },
                  select: { id: true, employeeId: true, amount: true },
                })
              : await tx.walletLedger.findFirst({
                  where: { sourceType: "PAYROLL", sourceId: entry.id },
                  select: { id: true, employeeId: true, amount: true },
                });

          if (walletLedger) {
            const employee = await tx.employee.findUnique({
              where: { id: walletLedger.employeeId },
              select: { id: true, walletBalance: true },
            });
            if (!employee) {
              throw new Error(`Employee not found for wallet reversal (${walletLedger.employeeId}).`);
            }
            const currentBalance = Number(employee.walletBalance || 0);
            const rollbackAmount = Number(walletLedger.amount || 0);
            if (currentBalance + 0.0001 < rollbackAmount) {
              throw new Error(
                `Cannot reverse payroll wallet posting for employee ${walletLedger.employeeId}: current wallet balance is lower than credited payroll amount.`,
              );
            }
            await tx.employee.update({
              where: { id: employee.id },
              data: { walletBalance: new Prisma.Decimal(Number((currentBalance - rollbackAmount).toFixed(2))) },
            });
            await tx.walletLedger.delete({ where: { id: walletLedger.id } });
          }

          if (entry.expenseId) {
            await tx.expense.deleteMany({
              where: { id: entry.expenseId },
            });
          }
        }

        await tx.payrollComponentLine.deleteMany({ where: { payrollEntry: { payrollRunId: id } } });
        await tx.payrollEntry.deleteMany({ where: { payrollRunId: id } });
        await tx.payrollRun.delete({ where: { id } });
      });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Failed to force-delete payroll run." },
        { status: 400 },
      );
    }

    await logAudit({
      action: "FORCE_DELETE_PAYROLL_RUN",
      entity: "PayrollRun",
      entityId: id,
      userId: session.user.id,
      oldValue: JSON.stringify({
        status: existing.status,
        paidEntries: paidEntries.length,
        forceDelete: true,
      }),
    });

    return NextResponse.json({ success: true, forced: true, reversedEntries: paidEntries.length });
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
