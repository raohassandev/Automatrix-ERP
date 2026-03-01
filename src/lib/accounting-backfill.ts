import { prisma } from "@/lib/prisma";
import { createPostedJournal, GL_CODES, postExpenseApprovalJournal, postIncomeApprovalJournal, postInvoiceJournal } from "@/lib/accounting";

type BackfillInput = {
  dryRun?: boolean;
  limitPerModule?: number;
  userId: string;
};

type BackfillModuleResult = {
  candidates: number;
  created: number;
  skipped: number;
  errors: string[];
};

export type AccountingBackfillResult = {
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  modules: {
    incomes: BackfillModuleResult;
    invoices: BackfillModuleResult;
    expenses: BackfillModuleResult;
    vendorBills: BackfillModuleResult;
    vendorPayments: BackfillModuleResult;
  };
  totals: {
    candidates: number;
    created: number;
    skipped: number;
    errorCount: number;
  };
};

function emptyModuleResult(): BackfillModuleResult {
  return { candidates: 0, created: 0, skipped: 0, errors: [] };
}

async function getMissingSourceIds(sourceType: string, sourceIds: string[]) {
  if (sourceIds.length === 0) return new Set<string>();
  const batches = await prisma.postingBatch.findMany({
    where: { sourceType, sourceId: { in: sourceIds } },
    select: { sourceId: true },
  });
  const posted = new Set(batches.map((b) => b.sourceId));
  return new Set(sourceIds.filter((id) => !posted.has(id)));
}

export async function runAccountingBackfill(input: BackfillInput): Promise<AccountingBackfillResult> {
  const dryRun = input.dryRun !== false;
  const limit = Math.max(1, Math.min(input.limitPerModule ?? 500, 5000));
  const startedAt = new Date();

  const modules = {
    incomes: emptyModuleResult(),
    invoices: emptyModuleResult(),
    expenses: emptyModuleResult(),
    vendorBills: emptyModuleResult(),
    vendorPayments: emptyModuleResult(),
  };

  const incomes = await prisma.income.findMany({
    where: { status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] } },
    orderBy: { date: "asc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      date: true,
      companyAccountId: true,
      invoiceId: true,
      project: true,
    },
  });
  const missingIncomes = await getMissingSourceIds("INCOME", incomes.map((i) => i.id));
  modules.incomes.candidates = missingIncomes.size;
  for (const income of incomes) {
    if (!missingIncomes.has(income.id)) continue;
    const amount = Number(income.amount || 0);
    if (amount <= 0 || !income.companyAccountId) {
      modules.incomes.skipped += 1;
      if (!income.companyAccountId) modules.incomes.errors.push(`Income ${income.id}: missing company account`);
      continue;
    }
    if (dryRun) continue;
    try {
      await prisma.$transaction(async (tx) => {
        await postIncomeApprovalJournal(tx, {
          incomeId: income.id,
          amount,
          incomeDate: income.date,
          companyAccountId: income.companyAccountId!,
          invoiceId: income.invoiceId || null,
          projectRef: income.project || null,
          userId: input.userId,
          memo: "Backfill: income posting",
        });
      });
      modules.incomes.created += 1;
    } catch (error) {
      modules.incomes.skipped += 1;
      modules.incomes.errors.push(`Income ${income.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const invoices = await prisma.invoice.findMany({
    where: { status: { not: "DRAFT" } },
    orderBy: { date: "asc" },
    take: limit,
    select: { id: true, amount: true, date: true, projectId: true },
  });
  const missingInvoices = await getMissingSourceIds("INVOICE", invoices.map((i) => i.id));
  modules.invoices.candidates = missingInvoices.size;
  for (const invoice of invoices) {
    if (!missingInvoices.has(invoice.id)) continue;
    const amount = Number(invoice.amount || 0);
    if (amount <= 0) {
      modules.invoices.skipped += 1;
      continue;
    }
    if (dryRun) continue;
    try {
      await prisma.$transaction(async (tx) => {
        await postInvoiceJournal(tx, {
          invoiceId: invoice.id,
          amount,
          invoiceDate: invoice.date,
          projectRef: invoice.projectId,
          userId: input.userId,
          memo: "Backfill: invoice posting",
        });
      });
      modules.invoices.created += 1;
    } catch (error) {
      modules.invoices.skipped += 1;
      modules.invoices.errors.push(`Invoice ${invoice.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const expenses = await prisma.expense.findMany({
    where: { status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] } },
    orderBy: { date: "asc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      approvedAmount: true,
      date: true,
      paymentSource: true,
      companyAccountId: true,
      project: true,
    },
  });
  const missingExpenses = await getMissingSourceIds("EXPENSE", expenses.map((e) => e.id));
  modules.expenses.candidates = missingExpenses.size;
  for (const expense of expenses) {
    if (!missingExpenses.has(expense.id)) continue;
    const amount = Number(expense.approvedAmount ?? expense.amount ?? 0);
    if (amount <= 0) {
      modules.expenses.skipped += 1;
      continue;
    }
    if (dryRun) continue;
    try {
      await prisma.$transaction(async (tx) => {
        await postExpenseApprovalJournal(tx, {
          expenseId: expense.id,
          amount,
          expenseDate: expense.date,
          paymentSource: expense.paymentSource,
          companyAccountId: expense.companyAccountId,
          projectRef: expense.project,
          userId: input.userId,
          memo: "Backfill: expense posting",
        });
      });
      modules.expenses.created += 1;
    } catch (error) {
      modules.expenses.skipped += 1;
      modules.expenses.errors.push(`Expense ${expense.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const vendorBills = await prisma.vendorBill.findMany({
    where: { status: "POSTED" },
    orderBy: { billDate: "asc" },
    take: limit,
    select: {
      id: true,
      billDate: true,
      totalAmount: true,
      projectRef: true,
      lines: { select: { total: true, itemId: true } },
    },
  });
  const missingVendorBills = await getMissingSourceIds("VENDOR_BILL", vendorBills.map((b) => b.id));
  modules.vendorBills.candidates = missingVendorBills.size;
  for (const bill of vendorBills) {
    if (!missingVendorBills.has(bill.id)) continue;
    if (Number(bill.totalAmount || 0) <= 0) {
      modules.vendorBills.skipped += 1;
      continue;
    }
    if (dryRun) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const project = bill.projectRef?.trim();
        const projectDb = project
          ? await tx.project.findFirst({
              where: { OR: [{ id: project }, { projectId: project }, { name: project }] },
              select: { id: true },
            })
          : null;
        const projectId = projectDb?.id || null;
        const lines = bill.lines.map((line) => ({
          glCode: line.itemId ? GL_CODES.INVENTORY_ASSET : GL_CODES.PURCHASE_EXPENSE,
          debit: Number(line.total || 0),
          projectId,
        }));
        await createPostedJournal(tx, {
          sourceType: "VENDOR_BILL",
          sourceId: bill.id,
          documentDate: bill.billDate,
          postingDate: bill.billDate,
          createdById: input.userId,
          postedById: input.userId,
          voucherPrefix: "VB",
          memo: "Backfill: vendor bill posting",
          lines: [...lines, { glCode: GL_CODES.AP_CONTROL, credit: Number(bill.totalAmount || 0), projectId }],
        });
      });
      modules.vendorBills.created += 1;
    } catch (error) {
      modules.vendorBills.skipped += 1;
      modules.vendorBills.errors.push(`VendorBill ${bill.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const vendorPayments = await prisma.vendorPayment.findMany({
    where: { status: "POSTED" },
    orderBy: { paymentDate: "asc" },
    take: limit,
    select: { id: true, paymentDate: true, amount: true, companyAccountId: true, projectRef: true },
  });
  const missingVendorPayments = await getMissingSourceIds("VENDOR_PAYMENT", vendorPayments.map((p) => p.id));
  modules.vendorPayments.candidates = missingVendorPayments.size;
  for (const payment of vendorPayments) {
    if (!missingVendorPayments.has(payment.id)) continue;
    const amount = Number(payment.amount || 0);
    if (amount <= 0) {
      modules.vendorPayments.skipped += 1;
      continue;
    }
    if (dryRun) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const companyAccount = await tx.companyAccount.findUnique({
          where: { id: payment.companyAccountId },
          select: { type: true },
        });
        if (!companyAccount) {
          throw new Error("Company account not found.");
        }
        const project = payment.projectRef?.trim();
        const projectDb = project
          ? await tx.project.findFirst({
              where: { OR: [{ id: project }, { projectId: project }, { name: project }] },
              select: { id: true },
            })
          : null;
        const projectId = projectDb?.id || null;
        const cashCode = (companyAccount.type || "").toUpperCase() === "BANK" ? GL_CODES.BANK_MAIN : GL_CODES.CASH_ON_HAND;
        await createPostedJournal(tx, {
          sourceType: "VENDOR_PAYMENT",
          sourceId: payment.id,
          documentDate: payment.paymentDate,
          postingDate: payment.paymentDate,
          createdById: input.userId,
          postedById: input.userId,
          voucherPrefix: "VP",
          memo: "Backfill: vendor payment posting",
          lines: [
            { glCode: GL_CODES.AP_CONTROL, debit: amount, projectId },
            { glCode: cashCode, credit: amount, projectId },
          ],
        });
      });
      modules.vendorPayments.created += 1;
    } catch (error) {
      modules.vendorPayments.skipped += 1;
      modules.vendorPayments.errors.push(`VendorPayment ${payment.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const totals = {
    candidates:
      modules.incomes.candidates +
      modules.invoices.candidates +
      modules.expenses.candidates +
      modules.vendorBills.candidates +
      modules.vendorPayments.candidates,
    created:
      modules.incomes.created +
      modules.invoices.created +
      modules.expenses.created +
      modules.vendorBills.created +
      modules.vendorPayments.created,
    skipped:
      modules.incomes.skipped +
      modules.invoices.skipped +
      modules.expenses.skipped +
      modules.vendorBills.skipped +
      modules.vendorPayments.skipped,
    errorCount:
      modules.incomes.errors.length +
      modules.invoices.errors.length +
      modules.expenses.errors.length +
      modules.vendorBills.errors.length +
      modules.vendorPayments.errors.length,
  };

  return {
    dryRun,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    modules,
    totals,
  };
}
