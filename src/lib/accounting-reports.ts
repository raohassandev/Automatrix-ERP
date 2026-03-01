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
