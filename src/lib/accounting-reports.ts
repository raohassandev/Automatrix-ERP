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
