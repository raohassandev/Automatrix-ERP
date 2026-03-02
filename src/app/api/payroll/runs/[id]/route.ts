import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payrollRunUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";

type VariableComponent = {
  sourceType: "INCENTIVE" | "COMMISSION";
  sourceId: string;
  projectRef: string | null;
  description: string;
  amount: number;
};

function getPreviousMonthRange(now: Date) {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

async function collectAndSettleVariablePay(params: {
  tx: Prisma.TransactionClient;
  payrollRunId: string;
  payrollEntryId: string;
  employeeId: string;
  periodEnd: Date;
}) {
  const { tx, payrollRunId, payrollEntryId, employeeId, periodEnd } = params;
  const now = new Date();

  const [unsettledIncentives, settledIncentives, unsettledCommissions, settledCommissions] = await Promise.all([
    tx.incentiveEntry.findMany({
      where: {
        employeeId,
        status: "APPROVED",
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        createdAt: { lte: periodEnd },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, projectRef: true, amount: true, reason: true },
    }),
    tx.incentiveEntry.findMany({
      where: {
        employeeId,
        settledInPayrollEntryId: payrollEntryId,
        settlementStatus: "SETTLED",
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, projectRef: true, amount: true, reason: true },
    }),
    tx.commissionEntry.findMany({
      where: {
        employeeId,
        payeeType: "EMPLOYEE",
        status: "APPROVED",
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        createdAt: { lte: periodEnd },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, projectRef: true, amount: true, reason: true },
    }),
    tx.commissionEntry.findMany({
      where: {
        employeeId,
        settledInPayrollEntryId: payrollEntryId,
        settlementStatus: "SETTLED",
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, projectRef: true, amount: true, reason: true },
    }),
  ]);

  if (unsettledIncentives.length > 0) {
    await tx.incentiveEntry.updateMany({
      where: { id: { in: unsettledIncentives.map((row) => row.id) } },
      data: {
        settlementStatus: "SETTLED",
        settledInPayrollRunId: payrollRunId,
        settledInPayrollEntryId: payrollEntryId,
        settledAt: now,
      },
    });
  }

  if (unsettledCommissions.length > 0) {
    await tx.commissionEntry.updateMany({
      where: { id: { in: unsettledCommissions.map((row) => row.id) } },
      data: {
        settlementStatus: "SETTLED",
        settledInPayrollRunId: payrollRunId,
        settledInPayrollEntryId: payrollEntryId,
        settledAt: now,
      },
    });
  }

  const allIncentives = [...settledIncentives, ...unsettledIncentives];
  const allCommissions = [...settledCommissions, ...unsettledCommissions];

  const components: VariableComponent[] = [
    ...allIncentives.map((row) => ({
      sourceType: "INCENTIVE" as const,
      sourceId: row.id,
      projectRef: row.projectRef || null,
      description: row.reason || `Project incentive (${row.projectRef || "No project"})`,
      amount: Number(row.amount || 0),
    })),
    ...allCommissions.map((row) => ({
      sourceType: "COMMISSION" as const,
      sourceId: row.id,
      projectRef: row.projectRef || null,
      description: row.reason || `Commission (${row.projectRef || "No project"})`,
      amount: Number(row.amount || 0),
    })),
  ].filter((row) => Number.isFinite(row.amount) && row.amount > 0);

  const total = Number(components.reduce((sum, row) => sum + row.amount, 0).toFixed(2));
  return { components, total };
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
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.periodStart) data.periodStart = new Date(parsed.data.periodStart);
  if (parsed.data.periodEnd) data.periodEnd = new Date(parsed.data.periodEnd);
  if (parsed.data.periodStart || parsed.data.periodEnd) {
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

      const run = await tx.payrollRun.update({
        where: { id },
        data,
        include: { entries: true },
      });

      if (run.status === "APPROVED") {
        for (const entry of run.entries) {
          const employee = await tx.employee.findUnique({ where: { id: entry.employeeId } });
          if (!employee) continue;

          const variablePay = await collectAndSettleVariablePay({
            tx,
            payrollRunId: run.id,
            payrollEntryId: entry.id,
            employeeId: entry.employeeId,
            periodEnd: run.periodEnd,
          });

          const entryIncentive = Number(entry.incentiveTotal || 0);
          if (entryIncentive + 0.01 < variablePay.total) {
            throw new Error(
              `Incentive total for ${employee.name} is lower than approved payroll-linked variable pay. Reload policy before approval.`,
            );
          }

          const manualVariableAdjustment = Number((entryIncentive - variablePay.total).toFixed(2));
          const payrollExpenseAmount = Number((Number(entry.netPay) - variablePay.total).toFixed(2));
          if (payrollExpenseAmount < -0.01) {
            throw new Error(`Payroll expense amount became negative for ${employee.name}.`);
          }

          let expenseId = entry.expenseId;
          if (!expenseId && payrollExpenseAmount > 0) {
            const periodLabel = `${run.periodStart.toISOString().slice(0, 10)} to ${run.periodEnd.toISOString().slice(0, 10)}`;
            const expense = await tx.expense.create({
              data: {
                date: run.periodEnd,
                description: `Salary for ${employee.name} (${periodLabel})`,
                category: "Salary",
                amount: new Prisma.Decimal(payrollExpenseAmount),
                paymentMode: "Payroll Transfer",
                paymentSource: "COMPANY_ACCOUNT",
                expenseType: "COMPANY",
                status: "APPROVED",
                approvalLevel: "PAYROLL",
                submittedById: session.user.id,
                approvedById: session.user.id,
                approvedAmount: new Prisma.Decimal(payrollExpenseAmount),
                remarks:
                  entry.deductionReason ||
                  (variablePay.total > 0
                    ? `Variable pay settled via payroll: ${variablePay.total.toFixed(2)}`
                    : undefined),
              },
            });
            expenseId = expense.id;
          }

          let walletLedgerId = entry.walletLedgerId;
          if (!walletLedgerId) {
            const newBalance = Number(employee.walletBalance) + Number(entry.netPay);
            const ledger = await tx.walletLedger.create({
              data: {
                date: new Date(),
                employeeId: entry.employeeId,
                type: "CREDIT",
                amount: new Prisma.Decimal(entry.netPay),
                reference: `PAYROLL:${run.id}:${entry.id}`,
                balance: new Prisma.Decimal(newBalance),
                sourceType: "PAYROLL",
                sourceId: entry.id,
                postedById: session.user.id,
                postedAt: new Date(),
              },
            });
            walletLedgerId = ledger.id;
            await tx.employee.update({
              where: { id: entry.employeeId },
              data: { walletBalance: new Prisma.Decimal(newBalance) },
            });
          }

          await tx.payrollEntry.update({
            where: { id: entry.id },
            data: {
              walletLedgerId,
              expenseId: expenseId || null,
              approvedById: entry.approvedById || session.user.id,
              status: "PAID",
            },
          });

          const componentRows: Array<{
            payrollEntryId: string;
            componentType: string;
            sourceType?: string;
            sourceId?: string;
            projectRef?: string;
            description: string;
            amount: Prisma.Decimal;
            metadataJson?: string;
          }> = [];

          componentRows.push({
            payrollEntryId: entry.id,
            componentType: "BASE",
            description: "Base salary",
            amount: new Prisma.Decimal(entry.baseSalary),
          });

          for (const variable of variablePay.components) {
            componentRows.push({
              payrollEntryId: entry.id,
              componentType: variable.sourceType,
              sourceType: variable.sourceType,
              sourceId: variable.sourceId,
              projectRef: variable.projectRef || undefined,
              description: variable.description,
              amount: new Prisma.Decimal(variable.amount),
            });
          }

          if (manualVariableAdjustment > 0) {
            componentRows.push({
              payrollEntryId: entry.id,
              componentType: "ADJUSTMENT",
              description: "Manual incentive adjustment",
              amount: new Prisma.Decimal(manualVariableAdjustment),
            });
          }

          if (Number(entry.deductions) > 0) {
            componentRows.push({
              payrollEntryId: entry.id,
              componentType: "DEDUCTION",
              description: entry.deductionReason || "Deductions",
              amount: new Prisma.Decimal(entry.deductions),
              metadataJson: JSON.stringify({ direction: "DEBIT_FROM_EMPLOYEE" }),
            });
          }

          await tx.payrollComponentLine.deleteMany({ where: { payrollEntryId: entry.id } });
          if (componentRows.length > 0) {
            await tx.payrollComponentLine.createMany({ data: componentRows });
          }

          if (Number(entry.deductions) > 0) {
            let remaining = Number(entry.deductions);
            const advances = await tx.salaryAdvance.findMany({
              where: {
                employeeId: entry.employeeId,
                status: "APPROVED",
                createdAt: { lte: run.periodEnd },
              },
              orderBy: { createdAt: "asc" },
            });
            for (const adv of advances) {
              if (remaining <= 0) break;
              remaining -= Number(adv.amount || 0);
              await tx.salaryAdvance.update({
                where: { id: adv.id },
                data: { status: "PAID" },
              });
            }
          }
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
