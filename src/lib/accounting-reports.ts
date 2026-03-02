import { prisma } from "@/lib/prisma";

type DateRangeInput = {
  from?: string | null;
  to?: string | null;
};

function buildPostingDateRange(input: DateRangeInput) {
  const range: { gte?: Date; lte?: Date } = {};
  if (input.from) range.gte = new Date(input.from);
  if (input.to) range.lte = new Date(input.to);
  return range;
}

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
};

export async function getTrialBalanceRows(input: DateRangeInput = {}) {
  const range = buildPostingDateRange(input);
  const grouped = await prisma.journalLine.groupBy({
    by: ["glAccountId"],
    where: {
      journalEntry: {
        status: "POSTED",
        ...(input.from || input.to ? { postingDate: range } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });

  const accountIds = grouped.map((g) => g.glAccountId);
  const accounts =
    accountIds.length === 0
      ? []
      : await prisma.glAccount.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, code: true, name: true, type: true },
        });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  return grouped
    .map((g) => {
      const account = accountMap.get(g.glAccountId);
      const debit = Number(g._sum.debit || 0);
      const credit = Number(g._sum.credit || 0);
      return {
        accountId: g.glAccountId,
        code: account?.code || "N/A",
        name: account?.name || "Unknown Account",
        type: account?.type || "UNKNOWN",
        debit,
        credit,
        balance: debit - credit,
      } satisfies TrialBalanceRow;
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function getProfitAndLoss(input: DateRangeInput = {}) {
  const rows = await getTrialBalanceRows(input);
  const revenueRows = rows
    .filter((r) => r.type === "INCOME")
    .map((r) => ({ ...r, amount: Number((r.credit - r.debit).toFixed(2)) }));
  const expenseRows = rows
    .filter((r) => r.type === "EXPENSE")
    .map((r) => ({ ...r, amount: Number((r.debit - r.credit).toFixed(2)) }));

  const totalRevenue = Number(revenueRows.reduce((sum, r) => sum + r.amount, 0).toFixed(2));
  const totalExpense = Number(expenseRows.reduce((sum, r) => sum + r.amount, 0).toFixed(2));
  const netProfit = Number((totalRevenue - totalExpense).toFixed(2));

  return {
    rows,
    revenueRows,
    expenseRows,
    totals: {
      totalRevenue,
      totalExpense,
      netProfit,
    },
  };
}

export async function getBalanceSheet(input: DateRangeInput = {}) {
  const rows = await getTrialBalanceRows(input);
  const assetRows = rows
    .filter((r) => r.type === "ASSET")
    .map((r) => ({ ...r, amount: Number((r.debit - r.credit).toFixed(2)) }));
  const liabilityRows = rows
    .filter((r) => r.type === "LIABILITY")
    .map((r) => ({ ...r, amount: Number((r.credit - r.debit).toFixed(2)) }));
  const equityRows = rows
    .filter((r) => r.type === "EQUITY")
    .map((r) => ({ ...r, amount: Number((r.credit - r.debit).toFixed(2)) }));

  const totalAssets = Number(assetRows.reduce((sum, r) => sum + r.amount, 0).toFixed(2));
  const totalLiabilities = Number(liabilityRows.reduce((sum, r) => sum + r.amount, 0).toFixed(2));
  const totalEquity = Number(equityRows.reduce((sum, r) => sum + r.amount, 0).toFixed(2));

  return {
    rows,
    assetRows,
    liabilityRows,
    equityRows,
    totals: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      liabilitiesPlusEquity: Number((totalLiabilities + totalEquity).toFixed(2)),
      difference: Number((totalAssets - (totalLiabilities + totalEquity)).toFixed(2)),
    },
  };
}

export type CashPositionRow = {
  companyAccountId: string;
  companyAccountName: string;
  accountType: string;
  opening: number;
  inflow: number;
  outflow: number;
  closing: number;
};

export async function getCashPosition(input: DateRangeInput = {}) {
  const from = input.from ? new Date(input.from) : new Date();
  if (!input.from) {
    from.setHours(0, 0, 0, 0);
  }
  const to = input.to ? new Date(input.to) : new Date();
  if (!input.to) {
    to.setHours(23, 59, 59, 999);
  }

  const [accounts, incomes, vendorPayments, expenses, walletEntries] = await Promise.all([
    prisma.companyAccount.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true, openingBalance: true },
      orderBy: { name: "asc" },
    }),
    prisma.income.findMany({
      where: {
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
        companyAccountId: { not: null },
      },
      select: { companyAccountId: true, date: true, amount: true },
    }),
    prisma.vendorPayment.findMany({
      where: { status: "POSTED" },
      select: { companyAccountId: true, paymentDate: true, amount: true },
    }),
    prisma.expense.findMany({
      where: {
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
        paymentSource: "COMPANY_ACCOUNT",
        companyAccountId: { not: null },
      },
      select: { companyAccountId: true, date: true, amount: true, approvedAmount: true },
    }),
    prisma.walletLedger.findMany({
      where: { companyAccountId: { not: null } },
      select: { companyAccountId: true, date: true, type: true, amount: true },
    }),
  ]);

  const rows: CashPositionRow[] = accounts.map((account) => {
    let inflowBefore = 0;
    let outflowBefore = 0;
    let inflow = 0;
    let outflow = 0;
    const accountId = account.id;

    for (const entry of incomes) {
      if (entry.companyAccountId !== accountId) continue;
      const amount = Number(entry.amount || 0);
      if (entry.date < from) inflowBefore += amount;
      else if (entry.date <= to) inflow += amount;
    }

    for (const payment of vendorPayments) {
      if (payment.companyAccountId !== accountId) continue;
      const amount = Number(payment.amount || 0);
      if (payment.paymentDate < from) outflowBefore += amount;
      else if (payment.paymentDate <= to) outflow += amount;
    }

    for (const expense of expenses) {
      if (expense.companyAccountId !== accountId) continue;
      const amount = Number(expense.approvedAmount ?? expense.amount ?? 0);
      if (expense.date < from) outflowBefore += amount;
      else if (expense.date <= to) outflow += amount;
    }

    for (const wallet of walletEntries) {
      if (wallet.companyAccountId !== accountId) continue;
      const amount = Number(wallet.amount || 0);
      const isOutflow = String(wallet.type).toUpperCase() === "DEBIT";
      if (wallet.date < from) {
        if (isOutflow) outflowBefore += amount;
        else inflowBefore += amount;
      } else if (wallet.date <= to) {
        if (isOutflow) outflow += amount;
        else inflow += amount;
      }
    }

    const opening = Number((Number(account.openingBalance || 0) + inflowBefore - outflowBefore).toFixed(2));
    const closing = Number((opening + inflow - outflow).toFixed(2));
    return {
      companyAccountId: account.id,
      companyAccountName: account.name,
      accountType: account.type,
      opening,
      inflow: Number(inflow.toFixed(2)),
      outflow: Number(outflow.toFixed(2)),
      closing,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.opening += row.opening;
      acc.inflow += row.inflow;
      acc.outflow += row.outflow;
      acc.closing += row.closing;
      return acc;
    },
    { opening: 0, inflow: 0, outflow: 0, closing: 0 },
  );

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
    totals: {
      opening: Number(totals.opening.toFixed(2)),
      inflow: Number(totals.inflow.toFixed(2)),
      outflow: Number(totals.outflow.toFixed(2)),
      closing: Number(totals.closing.toFixed(2)),
    },
  };
}

export type AraRow = {
  invoiceId: string;
  invoiceNo: string;
  projectId: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueDays: number;
  bucket: "CURRENT" | "1-30" | "31-60" | "61-90" | "90+";
};

function getArBucket(overdueDays: number): AraRow["bucket"] {
  if (overdueDays <= 0) return "CURRENT";
  if (overdueDays <= 30) return "1-30";
  if (overdueDays <= 60) return "31-60";
  if (overdueDays <= 90) return "61-90";
  return "90+";
}

export async function getArAging(input: { asOf?: string | null } = {}) {
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  asOf.setHours(23, 59, 59, 999);

  const [invoices, receiptSums] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        invoiceNo: true,
        projectId: true,
        date: true,
        dueDate: true,
        amount: true,
      },
    }),
    prisma.income.groupBy({
      by: ["invoiceId"],
      where: {
        invoiceId: { not: null },
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
        date: { lte: asOf },
      },
      _sum: { amount: true },
    }),
  ]);

  const paidByInvoice = new Map(
    receiptSums
      .filter((row) => row.invoiceId)
      .map((row) => [row.invoiceId!, Number(row._sum.amount || 0)]),
  );

  const rows: AraRow[] = invoices
    .map((invoice) => {
      const totalAmount = Number(invoice.amount || 0);
      const paidAmount = Number(paidByInvoice.get(invoice.id) || 0);
      const outstandingAmount = Number(Math.max(0, totalAmount - paidAmount).toFixed(2));
      const dueDate = invoice.dueDate || invoice.date;
      const overdueDays =
        outstandingAmount <= 0 ? 0 : Math.max(0, Math.floor((asOf.getTime() - dueDate.getTime()) / 86400000));
      return {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        projectId: invoice.projectId,
        invoiceDate: invoice.date.toISOString().slice(0, 10),
        dueDate: dueDate.toISOString().slice(0, 10),
        totalAmount: Number(totalAmount.toFixed(2)),
        paidAmount: Number(paidAmount.toFixed(2)),
        outstandingAmount,
        overdueDays,
        bucket: getArBucket(overdueDays),
      } satisfies AraRow;
    })
    .filter((row) => row.outstandingAmount > 0);

  const totals = rows.reduce(
    (acc, row) => {
      acc.total += row.totalAmount;
      acc.paid += row.paidAmount;
      acc.outstanding += row.outstandingAmount;
      acc[row.bucket] += row.outstandingAmount;
      return acc;
    },
    {
      total: 0,
      paid: 0,
      outstanding: 0,
      CURRENT: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
    },
  );

  return {
    asOf: asOf.toISOString(),
    rows,
    totals: {
      total: Number(totals.total.toFixed(2)),
      paid: Number(totals.paid.toFixed(2)),
      outstanding: Number(totals.outstanding.toFixed(2)),
      current: Number(totals.CURRENT.toFixed(2)),
      bucket1to30: Number(totals["1-30"].toFixed(2)),
      bucket31to60: Number(totals["31-60"].toFixed(2)),
      bucket61to90: Number(totals["61-90"].toFixed(2)),
      bucket90Plus: Number(totals["90+"].toFixed(2)),
    },
  };
}

export async function getCashForecast(input: { asOf?: string | null } = {}) {
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  asOf.setHours(23, 59, 59, 999);

  const day14 = new Date(asOf);
  day14.setDate(day14.getDate() + 14);
  const day30 = new Date(asOf);
  day30.setDate(day30.getDate() + 30);

  const [ar, bills, allocations] = await Promise.all([
    getArAging({ asOf: asOf.toISOString() }),
    prisma.vendorBill.findMany({
      where: { status: "POSTED" },
      select: { id: true, dueDate: true, billDate: true, totalAmount: true },
    }),
    prisma.vendorPaymentAllocation.groupBy({
      by: ["vendorBillId"],
      where: { vendorPayment: { status: "POSTED" } },
      _sum: { amount: true },
    }),
  ]);

  const paidByBill = new Map(allocations.map((row) => [row.vendorBillId, Number(row._sum.amount || 0)]));

  let receipts14 = 0;
  let receipts30 = 0;
  for (const row of ar.rows) {
    const due = new Date(row.dueDate);
    if (due <= day14) receipts14 += row.outstandingAmount;
    if (due <= day30) receipts30 += row.outstandingAmount;
  }

  let disbursements14 = 0;
  let disbursements30 = 0;
  for (const bill of bills) {
    const due = bill.dueDate || bill.billDate;
    const outstanding = Math.max(0, Number(bill.totalAmount || 0) - Number(paidByBill.get(bill.id) || 0));
    if (outstanding <= 0) continue;
    if (due <= day14) disbursements14 += outstanding;
    if (due <= day30) disbursements30 += outstanding;
  }

  return {
    asOf: asOf.toISOString(),
    windows: [
      {
        days: 14,
        expectedReceipts: Number(receipts14.toFixed(2)),
        plannedDisbursements: Number(disbursements14.toFixed(2)),
        netForecast: Number((receipts14 - disbursements14).toFixed(2)),
      },
      {
        days: 30,
        expectedReceipts: Number(receipts30.toFixed(2)),
        plannedDisbursements: Number(disbursements30.toFixed(2)),
        netForecast: Number((receipts30 - disbursements30).toFixed(2)),
      },
    ],
  };
}

type O2cRangeInput = {
  from?: string | null;
  to?: string | null;
  asOf?: string | null;
};

type O2cInvoiceStatus = "OPEN" | "OVERDUE" | "PAID" | "OVERALLOCATED";
type O2cReceiptExceptionType = "UNALLOCATED_RECEIPT" | "ORPHAN_ALLOCATION" | "PROJECT_MISMATCH";

export type O2cInvoiceRow = {
  invoiceId: string;
  invoiceNo: string;
  projectId: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  overAllocatedAmount: number;
  receiptCount: number;
  overdueDays: number;
  status: O2cInvoiceStatus;
};

export type O2cReceiptExceptionRow = {
  incomeId: string;
  date: string;
  source: string;
  invoiceId: string | null;
  project: string | null;
  amount: number;
  type: O2cReceiptExceptionType;
  message: string;
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export async function getO2cReconciliation(input: O2cRangeInput = {}) {
  const asOfDate = endOfDay(input.asOf ? new Date(input.asOf) : new Date());
  const fromDate = input.from ? startOfDay(new Date(input.from)) : null;
  const toDate = input.to ? endOfDay(new Date(input.to)) : asOfDate;

  const invoiceDateWhere: { gte?: Date; lte: Date } = { lte: toDate };
  if (fromDate) invoiceDateWhere.gte = fromDate;

  const receiptDateWhere: { gte?: Date; lte: Date } = { lte: toDate };
  if (fromDate) receiptDateWhere.gte = fromDate;

  const [invoices, receipts] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { not: "DRAFT" },
        date: invoiceDateWhere,
      },
      orderBy: [{ date: "asc" }, { invoiceNo: "asc" }],
      select: {
        id: true,
        invoiceNo: true,
        projectId: true,
        date: true,
        dueDate: true,
        amount: true,
      },
    }),
    prisma.income.findMany({
      where: {
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
        date: receiptDateWhere,
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        source: true,
        invoiceId: true,
        project: true,
        amount: true,
      },
    }),
  ]);

  const invoiceIdsReferencedByReceipts = Array.from(
    new Set(receipts.map((receipt) => receipt.invoiceId).filter((value): value is string => Boolean(value))),
  );
  const knownInvoiceIds = new Set(invoices.map((invoice) => invoice.id));
  const missingInvoiceIds = invoiceIdsReferencedByReceipts.filter((id) => !knownInvoiceIds.has(id));
  const extraInvoices =
    missingInvoiceIds.length === 0
      ? []
      : await prisma.invoice.findMany({
          where: { id: { in: missingInvoiceIds } },
          select: { id: true, projectId: true, amount: true },
        });
  const allInvoiceMap = new Map<
    string,
    {
      id: string;
      projectId: string;
      amount: unknown;
      invoiceNo: string;
      date: Date;
      dueDate: Date;
    }
  >();
  for (const invoice of invoices) {
    allInvoiceMap.set(invoice.id, invoice);
  }
  for (const invoice of extraInvoices) {
    allInvoiceMap.set(invoice.id, {
      ...invoice,
      invoiceNo: invoice.id,
      date: new Date(0),
      dueDate: new Date(0),
    });
  }

  const receiptTotalsByInvoice = new Map<string, { amount: number; count: number }>();
  const exceptions: O2cReceiptExceptionRow[] = [];

  for (const receipt of receipts) {
    const amount = Number(receipt.amount || 0);
    if (!receipt.invoiceId) {
      exceptions.push({
        incomeId: receipt.id,
        date: receipt.date.toISOString().slice(0, 10),
        source: receipt.source,
        invoiceId: null,
        project: receipt.project || null,
        amount: Number(amount.toFixed(2)),
        type: "UNALLOCATED_RECEIPT",
        message: "Approved receipt is not linked to any invoice.",
      });
      continue;
    }

    const linkedInvoice = allInvoiceMap.get(receipt.invoiceId);
    if (!linkedInvoice) {
      exceptions.push({
        incomeId: receipt.id,
        date: receipt.date.toISOString().slice(0, 10),
        source: receipt.source,
        invoiceId: receipt.invoiceId,
        project: receipt.project || null,
        amount: Number(amount.toFixed(2)),
        type: "ORPHAN_ALLOCATION",
        message: "Receipt references an invoice that does not exist.",
      });
      continue;
    }

    if (receipt.project && linkedInvoice.projectId && receipt.project !== linkedInvoice.projectId) {
      exceptions.push({
        incomeId: receipt.id,
        date: receipt.date.toISOString().slice(0, 10),
        source: receipt.source,
        invoiceId: receipt.invoiceId,
        project: receipt.project || null,
        amount: Number(amount.toFixed(2)),
        type: "PROJECT_MISMATCH",
        message: `Receipt project (${receipt.project}) does not match invoice project (${linkedInvoice.projectId}).`,
      });
    }

    const existing = receiptTotalsByInvoice.get(receipt.invoiceId) || { amount: 0, count: 0 };
    existing.amount += amount;
    existing.count += 1;
    receiptTotalsByInvoice.set(receipt.invoiceId, existing);
  }

  const rows: O2cInvoiceRow[] = invoices.map((invoice) => {
    const receiptTotal = receiptTotalsByInvoice.get(invoice.id) || { amount: 0, count: 0 };
    const totalAmount = Number(invoice.amount || 0);
    const receivedAmount = Number(receiptTotal.amount.toFixed(2));
    const outstandingAmount = Number(Math.max(0, totalAmount - receivedAmount).toFixed(2));
    const overAllocatedAmount = Number(Math.max(0, receivedAmount - totalAmount).toFixed(2));
    const dueDate = invoice.dueDate || invoice.date;
    const overdueDays =
      outstandingAmount <= 0 ? 0 : Math.max(0, Math.floor((asOfDate.getTime() - dueDate.getTime()) / 86400000));
    const status: O2cInvoiceStatus =
      overAllocatedAmount > 0 ? "OVERALLOCATED" : outstandingAmount <= 0 ? "PAID" : overdueDays > 0 ? "OVERDUE" : "OPEN";

    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      projectId: invoice.projectId,
      invoiceDate: invoice.date.toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      totalAmount: Number(totalAmount.toFixed(2)),
      receivedAmount,
      outstandingAmount,
      overAllocatedAmount,
      receiptCount: receiptTotal.count,
      overdueDays,
      status,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.invoiced += row.totalAmount;
      acc.received += row.receivedAmount;
      acc.outstanding += row.outstandingAmount;
      acc.overAllocated += row.overAllocatedAmount;
      if (row.status === "OVERDUE") acc.overdueCount += 1;
      if (row.status === "OPEN") acc.openCount += 1;
      if (row.status === "PAID") acc.paidCount += 1;
      if (row.status === "OVERALLOCATED") acc.overAllocatedCount += 1;
      return acc;
    },
    {
      invoiced: 0,
      received: 0,
      outstanding: 0,
      overAllocated: 0,
      openCount: 0,
      overdueCount: 0,
      paidCount: 0,
      overAllocatedCount: 0,
    },
  );

  return {
    range: {
      from: fromDate ? fromDate.toISOString() : null,
      to: toDate.toISOString(),
      asOf: asOfDate.toISOString(),
    },
    rows,
    receiptExceptions: exceptions,
    totals: {
      invoiced: Number(totals.invoiced.toFixed(2)),
      received: Number(totals.received.toFixed(2)),
      outstanding: Number(totals.outstanding.toFixed(2)),
      overAllocated: Number(totals.overAllocated.toFixed(2)),
      openCount: totals.openCount,
      overdueCount: totals.overdueCount,
      paidCount: totals.paidCount,
      overAllocatedCount: totals.overAllocatedCount,
      unallocatedReceiptCount: exceptions.filter((row) => row.type === "UNALLOCATED_RECEIPT").length,
      orphanAllocationCount: exceptions.filter((row) => row.type === "ORPHAN_ALLOCATION").length,
      projectMismatchCount: exceptions.filter((row) => row.type === "PROJECT_MISMATCH").length,
      exceptionCount:
        totals.overAllocatedCount +
        exceptions.filter((row) => row.type === "UNALLOCATED_RECEIPT").length +
        exceptions.filter((row) => row.type === "ORPHAN_ALLOCATION").length +
        exceptions.filter((row) => row.type === "PROJECT_MISMATCH").length,
    },
  };
}

export async function getPeriodCloseChecklist(periodId: string) {
  const period = await prisma.fiscalPeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      code: true,
      status: true,
      startDate: true,
      endDate: true,
      closedAt: true,
      closeReason: true,
    },
  });
  if (!period) {
    throw new Error("Fiscal period not found.");
  }

  const from = period.startDate.toISOString().slice(0, 10);
  const to = period.endDate.toISOString().slice(0, 10);
  const [tbRows, bs, unpostedJournalCount, bankExceptionCount, o2c] = await Promise.all([
    getTrialBalanceRows({ from, to }),
    getBalanceSheet({ to }),
    prisma.journalEntry.count({
      where: {
        fiscalPeriodId: period.id,
        status: { not: "POSTED" },
      },
    }),
    prisma.bankStatementLine.count({
      where: {
        statementDate: { gte: period.startDate, lte: period.endDate },
        status: "UNMATCHED",
      },
    }),
    getO2cReconciliation({ from, to, asOf: period.endDate.toISOString() }),
  ]);

  const tbTotals = tbRows.reduce(
    (acc, row) => {
      acc.debit += row.debit;
      acc.credit += row.credit;
      return acc;
    },
    { debit: 0, credit: 0 },
  );
  const tbDiff = Number((tbTotals.debit - tbTotals.credit).toFixed(2));
  const trialBalanceBalanced = Math.abs(tbDiff) <= 0.01;
  const balanceSheetBalanced = Math.abs(bs.totals.difference) <= 0.01;

  const blockingIssues: string[] = [];
  if (!trialBalanceBalanced) {
    blockingIssues.push(`Trial balance is not balanced (difference ${tbDiff.toFixed(2)}).`);
  }
  if (!balanceSheetBalanced) {
    blockingIssues.push(`Balance sheet is not balanced (difference ${bs.totals.difference.toFixed(2)}).`);
  }
  if (unpostedJournalCount > 0) {
    blockingIssues.push(`${unpostedJournalCount} journal entries are still draft/reversed in this period.`);
  }
  if (bankExceptionCount > 0) {
    blockingIssues.push(`${bankExceptionCount} unmatched bank statement lines exist in this period.`);
  }
  if (o2c.totals.exceptionCount > 0) {
    blockingIssues.push(`${o2c.totals.exceptionCount} O2C allocation/reconciliation exceptions are unresolved.`);
  }

  return {
    period: {
      ...period,
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      closedAt: period.closedAt ? period.closedAt.toISOString() : null,
    },
    checks: {
      trialBalance: {
        debit: Number(tbTotals.debit.toFixed(2)),
        credit: Number(tbTotals.credit.toFixed(2)),
        difference: tbDiff,
        balanced: trialBalanceBalanced,
      },
      balanceSheet: {
        totalAssets: bs.totals.totalAssets,
        liabilitiesPlusEquity: bs.totals.liabilitiesPlusEquity,
        difference: bs.totals.difference,
        balanced: balanceSheetBalanced,
      },
      journals: {
        unpostedCount: unpostedJournalCount,
      },
      bankReconciliation: {
        unmatchedCount: bankExceptionCount,
      },
      o2cReconciliation: {
        exceptionCount: o2c.totals.exceptionCount,
        unallocatedReceipts: o2c.totals.unallocatedReceiptCount,
        orphanAllocations: o2c.totals.orphanAllocationCount,
        projectMismatches: o2c.totals.projectMismatchCount,
        overAllocatedInvoices: o2c.totals.overAllocatedCount,
      },
    },
    canClose: blockingIssues.length === 0,
    blockingIssues,
  };
}
