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
