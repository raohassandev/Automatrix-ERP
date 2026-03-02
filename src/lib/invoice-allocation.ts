import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type AllocationParams = {
  invoiceId?: string | null;
  receiptAmount: number;
  excludeIncomeId?: string | null;
  projectRef?: string | null;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function assertInvoiceReceiptWithinOutstanding(tx: Tx, params: AllocationParams) {
  const invoiceId = (params.invoiceId || "").trim();
  if (!invoiceId) return { invoice: null, outstandingBefore: null };

  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, invoiceNo: true, projectId: true, status: true, amount: true },
  });
  if (!invoice) {
    throw new Error("Invalid invoice selected for receipt allocation.");
  }
  if (invoice.status === "DRAFT") {
    throw new Error("Cannot allocate receipt to a draft invoice.");
  }

  if (params.projectRef && String(params.projectRef).trim() !== String(invoice.projectId).trim()) {
    throw new Error("Income project must match the selected invoice project.");
  }

  const where: Prisma.IncomeWhereInput = {
    invoiceId: invoice.id,
    status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
  };
  const excludeIncomeId = (params.excludeIncomeId || "").trim();
  if (excludeIncomeId) {
    where.id = { not: excludeIncomeId };
  }

  const receivedAgg = await tx.income.aggregate({
    where,
    _sum: { amount: true },
  });

  const invoiceAmount = Number(invoice.amount || 0);
  const received = Number(receivedAgg._sum.amount || 0);
  const outstandingBefore = round2(Math.max(0, invoiceAmount - received));
  const receiptAmount = round2(Number(params.receiptAmount || 0));

  if (receiptAmount <= 0) {
    throw new Error("Receipt amount must be greater than zero.");
  }
  if (receiptAmount - outstandingBefore > 0.01) {
    throw new Error(
      `Receipt exceeds invoice outstanding. Outstanding before receipt: PKR ${outstandingBefore.toFixed(2)}.`,
    );
  }

  return { invoice, outstandingBefore };
}
