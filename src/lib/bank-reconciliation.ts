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
