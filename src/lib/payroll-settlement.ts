import { Prisma } from "@prisma/client";
import { postPayrollDisbursementJournal } from "@/lib/accounting";
import { toMonthKey } from "@/lib/lifecycle";

type TransactionClient = Prisma.TransactionClient;

export type VariableComponent = {
  sourceType: "INCENTIVE" | "COMMISSION";
  sourceId: string;
  projectRef: string | null;
  description: string;
  amount: number;
};

export async function collectAndSettleVariablePay(params: {
  tx: TransactionClient;
  payrollRunId: string;
  payrollEntryId: string;
  employeeId: string;
  payrollMonthKey: string;
  runPeriodStart: Date;
  runPeriodEnd: Date;
}) {
  const { tx, payrollRunId, payrollEntryId, employeeId, payrollMonthKey, runPeriodStart, runPeriodEnd } = params;
  const now = new Date();

  const [unsettledIncentives, settledIncentives, unsettledCommissions, settledCommissions] = await Promise.all([
    tx.incentiveEntry.findMany({
      where: {
        employeeId,
        status: "APPROVED",
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        OR: [
          { scheduledPayrollMonth: { lte: payrollMonthKey } },
          { scheduledPayrollMonth: null, earningDate: { lte: runPeriodEnd } },
          { scheduledPayrollMonth: null, earningDate: null, createdAt: { lte: runPeriodEnd } },
        ],
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
        OR: [
          { scheduledPayrollMonth: { lte: payrollMonthKey } },
          { scheduledPayrollMonth: null, earningDate: { lte: runPeriodEnd } },
          { scheduledPayrollMonth: null, earningDate: null, createdAt: { lte: runPeriodEnd } },
        ],
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
        settledMonth: payrollMonthKey,
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
        settledMonth: payrollMonthKey,
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

export async function settlePayrollEntry(params: {
  tx: TransactionClient;
  payrollRunId: string;
  payrollEntryId: string;
  postedById: string;
  paymentMode?: string | null;
  companyAccountId?: string | null;
  paymentReference?: string | null;
}) {
  const { tx, payrollRunId, payrollEntryId, postedById } = params;
  const paymentMode = String(params.paymentMode || "BANK_TRANSFER").trim().toUpperCase();
  const companyAccountId = params.companyAccountId ? String(params.companyAccountId).trim() : null;
  const paymentReference = params.paymentReference ? String(params.paymentReference).trim() : null;

  const run = await tx.payrollRun.findUnique({
    where: { id: payrollRunId },
    select: { id: true, periodStart: true, periodEnd: true, status: true },
  });
  if (!run) {
    throw new Error("Payroll run not found.");
  }

  const entry = await tx.payrollEntry.findFirst({
    where: { id: payrollEntryId, payrollRunId },
    select: {
      id: true,
      employeeId: true,
      baseSalary: true,
      incentiveTotal: true,
      deductions: true,
      deductionReason: true,
      netPay: true,
      walletLedgerId: true,
      expenseId: true,
      companyAccountId: true,
      paidById: true,
      paidAt: true,
      approvedById: true,
      status: true,
    },
  });
  if (!entry) {
    throw new Error("Payroll entry not found.");
  }
  if (String(entry.status || "").toUpperCase() === "PAID") {
    throw new Error("Payroll entry is already paid.");
  }

  const employee = await tx.employee.findUnique({
    where: { id: entry.employeeId },
    select: { id: true, name: true },
  });
  if (!employee) {
    throw new Error("Employee not found for payroll entry.");
  }

  const variablePay = await collectAndSettleVariablePay({
    tx,
    payrollRunId: run.id,
    payrollEntryId: entry.id,
    employeeId: entry.employeeId,
    payrollMonthKey: toMonthKey(run.periodEnd),
    runPeriodStart: run.periodStart,
    runPeriodEnd: run.periodEnd,
  });

  const entryIncentive = Number(entry.incentiveTotal || 0);
  if (entryIncentive + 0.01 < variablePay.total) {
    throw new Error(
      `Incentive total for ${employee.name} is lower than approved payroll-linked variable pay. Reload policy before payment.`,
    );
  }

  const manualVariableAdjustment = Number((entryIncentive - variablePay.total).toFixed(2));
  const payrollExpenseAmount = Number((Number(entry.netPay) - variablePay.total).toFixed(2));
  if (payrollExpenseAmount < -0.01) {
    throw new Error(`Payroll expense amount became negative for ${employee.name}.`);
  }

  if (!companyAccountId) {
    throw new Error("Company account is required to settle payroll payment.");
  }
  const account = await tx.companyAccount.findUnique({
    where: { id: companyAccountId },
    select: { id: true, isActive: true },
  });
  if (!account || !account.isActive) {
    throw new Error("Invalid or inactive company account for payroll payment.");
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
        paymentMode,
        paymentSource: "COMPANY_ACCOUNT",
        companyAccountId,
        expenseType: "COMPANY",
        status: "APPROVED",
        approvalLevel: "PAYROLL",
        submittedById: postedById,
        approvedById: postedById,
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

  await postPayrollDisbursementJournal(tx, {
    payrollEntryId: entry.id,
    amount: Number(entry.netPay),
    paymentDate: new Date(),
    companyAccountId,
    userId: postedById,
    memo: paymentReference ? `Payroll payment ref: ${paymentReference}` : undefined,
  });

  const updatedEntry = await tx.payrollEntry.update({
    where: { id: entry.id },
    data: {
      companyAccountId,
      paymentMode,
      paymentReference,
      expenseId: expenseId || null,
      approvedById: entry.approvedById || postedById,
      paidById: postedById,
      paidAt: new Date(),
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

  if (Number(entry.deductions) > 0 && /advance/i.test(String(entry.deductionReason || ""))) {
    const advances = await tx.salaryAdvance.findMany({
      where: {
        employeeId: entry.employeeId,
        status: { in: ["PAID", "PARTIALLY_RECOVERED"] },
        OR: [{ paidAt: { lte: run.periodEnd } }, { paidAt: null, createdAt: { lte: run.periodEnd } }],
      },
      orderBy: { createdAt: "asc" },
    });
    let remaining = Number(entry.deductions);
    for (const adv of advances) {
      if (remaining <= 0) break;
      const issuedAmount = Number(adv.issuedAmount || adv.amount || 0);
      const recoveredAmount = Number(adv.recoveredAmount || 0);
      const storedOutstanding = Number(adv.outstandingAmount || 0);
      const derivedOutstanding = Number((issuedAmount - recoveredAmount).toFixed(2));
      const outstanding = Math.max(0, storedOutstanding > 0 ? storedOutstanding : derivedOutstanding);
      if (outstanding <= 0.01) continue;

      let cap = outstanding;
      if (String(adv.recoveryMode || "FULL_NEXT_PAYROLL").toUpperCase() === "INSTALLMENT") {
        const installment = Number(adv.installmentAmount || 0);
        if (installment > 0) cap = Math.min(cap, installment);
      }
      const recoveryAmount = Number(Math.min(remaining, cap).toFixed(2));
      if (recoveryAmount <= 0.01) continue;

      const nextRecovered = Number((recoveredAmount + recoveryAmount).toFixed(2));
      const nextOutstanding = Number(Math.max(0, issuedAmount - nextRecovered).toFixed(2));
      const nextStatus = nextOutstanding <= 0.01 ? "RECOVERED" : "PARTIALLY_RECOVERED";

      await tx.salaryAdvanceRecovery.create({
        data: {
          salaryAdvanceId: adv.id,
          payrollEntryId: entry.id,
          amount: new Prisma.Decimal(recoveryAmount),
          postedById,
          note: `Recovered in payroll run ${run.id}`,
        },
      });
      await tx.salaryAdvance.update({
        where: { id: adv.id },
        data: {
          recoveredAmount: new Prisma.Decimal(nextRecovered),
          outstandingAmount: new Prisma.Decimal(nextOutstanding),
          status: nextStatus,
          closedAt: nextStatus === "RECOVERED" ? new Date() : null,
        },
      });
      remaining = Number((remaining - recoveryAmount).toFixed(2));
    }
  }

  const remainingUnpaid = await tx.payrollEntry.count({
    where: { payrollRunId, status: { not: "PAID" } },
  });
  const runStatus = remainingUnpaid === 0 ? "POSTED" : run.status;
  if (remainingUnpaid === 0 && run.status !== "POSTED") {
    await tx.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: "POSTED" },
    });
  }

  return { entry: updatedEntry, runStatus };
}
