import { prisma } from "@/lib/prisma";

export async function getBookBalance(companyAccountId: string, asOfDate: Date) {
  const account = await prisma.companyAccount.findUnique({
    where: { id: companyAccountId },
    select: { openingBalance: true },
  });
  if (!account) {
    throw new Error("Company account not found.");
  }

  const [
    incomes,
    vendorPayments,
    expenses,
    walletEntries,
  ] = await Promise.all([
    prisma.income.aggregate({
      where: {
        companyAccountId,
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
        date: { lte: asOfDate },
      },
      _sum: { amount: true },
    }),
    prisma.vendorPayment.aggregate({
      where: {
        companyAccountId,
        status: "POSTED",
        paymentDate: { lte: asOfDate },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        companyAccountId,
        paymentSource: "COMPANY_ACCOUNT",
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
        date: { lte: asOfDate },
      },
      _sum: { approvedAmount: true, amount: true },
    }),
    prisma.walletLedger.findMany({
      where: {
        companyAccountId,
        date: { lte: asOfDate },
      },
      select: { type: true, amount: true },
    }),
  ]);

  const opening = Number(account.openingBalance || 0);
  const incomeTotal = Number(incomes._sum.amount || 0);
  const vendorPaymentTotal = Number(vendorPayments._sum.amount || 0);
  const expenseTotal = Number(expenses._sum.approvedAmount || expenses._sum.amount || 0);
  const walletNet = walletEntries.reduce((sum, row) => {
    const amount = Number(row.amount || 0);
    const isOut = String(row.type || "").toUpperCase() === "DEBIT";
    return sum + (isOut ? -amount : amount);
  }, 0);

  const bookBalance = opening + incomeTotal - vendorPaymentTotal - expenseTotal + walletNet;
  return Number(bookBalance.toFixed(2));
}

type Candidate = {
  sourceType: string;
  sourceId: string;
  date: Date;
  amount: number;
};

function nearDate(lineDate: Date, candidateDate: Date) {
  return Math.abs(lineDate.getTime() - candidateDate.getTime()) <= 3 * 86400000;
}

export async function autoMatchStatementLines(companyAccountId: string, asOfDate: Date) {
  const unmatched = await prisma.bankStatementLine.findMany({
    where: {
      companyAccountId,
      status: "UNMATCHED",
      statementDate: { lte: asOfDate },
    },
    orderBy: { statementDate: "asc" },
  });

  if (unmatched.length === 0) {
    return { matched: 0, reviewed: 0 };
  }

  const [incomes, vendorPayments, expenses, wallets] = await Promise.all([
    prisma.income.findMany({
      where: {
        companyAccountId,
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
        date: { lte: asOfDate },
      },
      select: { id: true, date: true, amount: true },
    }),
    prisma.vendorPayment.findMany({
      where: {
        companyAccountId,
        status: "POSTED",
        paymentDate: { lte: asOfDate },
      },
      select: { id: true, paymentDate: true, amount: true },
    }),
    prisma.expense.findMany({
      where: {
        companyAccountId,
        paymentSource: "COMPANY_ACCOUNT",
        status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
        date: { lte: asOfDate },
      },
      select: { id: true, date: true, amount: true, approvedAmount: true },
    }),
    prisma.walletLedger.findMany({
      where: { companyAccountId, date: { lte: asOfDate } },
      select: { id: true, date: true, type: true, amount: true },
    }),
  ]);

  const positives: Candidate[] = [
    ...incomes.map((i) => ({ sourceType: "INCOME", sourceId: i.id, date: i.date, amount: Number(i.amount || 0) })),
    ...wallets
      .filter((w) => String(w.type || "").toUpperCase() !== "DEBIT")
      .map((w) => ({ sourceType: "WALLET", sourceId: w.id, date: w.date, amount: Number(w.amount || 0) })),
  ];
  const negatives: Candidate[] = [
    ...vendorPayments.map((p) => ({ sourceType: "VENDOR_PAYMENT", sourceId: p.id, date: p.paymentDate, amount: Number(p.amount || 0) })),
    ...expenses.map((e) => ({
      sourceType: "EXPENSE",
      sourceId: e.id,
      date: e.date,
      amount: Number(e.approvedAmount ?? e.amount ?? 0),
    })),
    ...wallets
      .filter((w) => String(w.type || "").toUpperCase() === "DEBIT")
      .map((w) => ({ sourceType: "WALLET", sourceId: w.id, date: w.date, amount: Number(w.amount || 0) })),
  ];

  const used = new Set<string>();
  let matched = 0;
  let reviewed = 0;

  for (const line of unmatched) {
    const signed = Number(line.amount || 0);
    const amount = Math.abs(signed);
    if (amount <= 0) continue;

    const pool = signed >= 0 ? positives : negatives;
    const candidates = pool.filter((c) => {
      const key = `${c.sourceType}:${c.sourceId}`;
      if (used.has(key)) return false;
      return Math.abs(c.amount - amount) <= 0.01 && nearDate(line.statementDate, c.date);
    });
    if (candidates.length !== 1) {
      continue;
    }
    const selected = candidates[0];
    const key = `${selected.sourceType}:${selected.sourceId}`;
    used.add(key);
    await prisma.bankStatementLine.update({
      where: { id: line.id },
      data: {
        status: "MATCHED",
        matchedSourceType: selected.sourceType,
        matchedSourceId: selected.sourceId,
        matchedAt: new Date(),
      },
    });
    matched += 1;
    reviewed += 1;
  }

  return { matched, reviewed };
}
