import { Prisma, type PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const GL_CODES = {
  CASH_ON_HAND: "1000",
  BANK_MAIN: "1100",
  AR_CONTROL: "1200",
  INVENTORY_ASSET: "1300",
  AP_CONTROL: "2000",
  REVENUE_MAIN: "4000",
  PURCHASE_EXPENSE: "5000",
  OPERATING_EXPENSE: "5100",
  PAYROLL_EXPENSE: "5200",
  PAYROLL_PAYABLE: "2200",
  WALLET_CLEARING: "1400",
} as const;

type SeedAccount = {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  normalSide: "DEBIT" | "CREDIT";
};

const DEFAULT_GL_ACCOUNTS: SeedAccount[] = [
  { code: GL_CODES.CASH_ON_HAND, name: "Cash On Hand", type: "ASSET", normalSide: "DEBIT" },
  { code: GL_CODES.BANK_MAIN, name: "Bank Current Account", type: "ASSET", normalSide: "DEBIT" },
  { code: GL_CODES.AR_CONTROL, name: "Accounts Receivable Control", type: "ASSET", normalSide: "DEBIT" },
  { code: GL_CODES.INVENTORY_ASSET, name: "Inventory Asset", type: "ASSET", normalSide: "DEBIT" },
  { code: GL_CODES.WALLET_CLEARING, name: "Wallet Clearing", type: "ASSET", normalSide: "DEBIT" },
  { code: GL_CODES.AP_CONTROL, name: "Accounts Payable Control", type: "LIABILITY", normalSide: "CREDIT" },
  { code: GL_CODES.PAYROLL_PAYABLE, name: "Payroll Payable", type: "LIABILITY", normalSide: "CREDIT" },
  { code: GL_CODES.REVENUE_MAIN, name: "Sales Revenue", type: "INCOME", normalSide: "CREDIT" },
  { code: GL_CODES.PURCHASE_EXPENSE, name: "Purchase Expense", type: "EXPENSE", normalSide: "DEBIT" },
  { code: GL_CODES.OPERATING_EXPENSE, name: "Operating Expense", type: "EXPENSE", normalSide: "DEBIT" },
  { code: GL_CODES.PAYROLL_EXPENSE, name: "Payroll Expense", type: "EXPENSE", normalSide: "DEBIT" },
];

export async function ensureDefaultGlAccounts(prisma: PrismaClient) {
  await prisma.glAccount.createMany({
    data: DEFAULT_GL_ACCOUNTS.map((acc) => ({
      code: acc.code,
      name: acc.name,
      type: acc.type,
      normalSide: acc.normalSide,
      currency: "PKR",
      isPosting: true,
      isActive: true,
    })),
    skipDuplicates: true,
  });
}

export async function ensureOpenFiscalPeriod(tx: Tx, postingDate: Date) {
  const period = await tx.fiscalPeriod.findFirst({
    where: {
      startDate: { lte: postingDate },
      endDate: { gte: postingDate },
    },
    orderBy: { startDate: "desc" },
  });

  if (period) return period;

  const year = postingDate.getUTCFullYear();
  const month = postingDate.getUTCMonth();
  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const code = `${year}-${String(month + 1).padStart(2, "0")}`;

  return tx.fiscalPeriod.upsert({
    where: { code },
    update: {},
    create: {
      code,
      startDate,
      endDate,
      status: "OPEN",
    },
  });
}

type LineInput = {
  glCode: string;
  debit?: number;
  credit?: number;
  projectId?: string | null;
  employeeId?: string | null;
  partyId?: string | null;
  memo?: string | null;
};

type CreatePostedJournalInput = {
  sourceType: string;
  sourceId: string;
  documentDate: Date;
  postingDate: Date;
  createdById?: string | null;
  postedById?: string | null;
  memo?: string | null;
  voucherPrefix?: string;
  lines: LineInput[];
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function assertBalanced(lines: LineInput[]) {
  const debit = round2(lines.reduce((sum, l) => sum + Number(l.debit || 0), 0));
  const credit = round2(lines.reduce((sum, l) => sum + Number(l.credit || 0), 0));
  if (debit <= 0 || credit <= 0) {
    throw new Error("Journal must include positive debit and credit totals.");
  }
  if (Math.abs(debit - credit) > 0.01) {
    throw new Error(`Unbalanced journal: debit=${debit.toFixed(2)} credit=${credit.toFixed(2)}.`);
  }
}

async function resolveAccountIds(tx: Tx, codes: string[]) {
  const accounts = await tx.glAccount.findMany({
    where: { code: { in: codes }, isActive: true },
    select: { id: true, code: true },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of codes) {
    if (!byCode.has(code)) {
      throw new Error(`Missing GL account code: ${code}`);
    }
  }
  return byCode;
}

async function nextVoucherNo(tx: Tx, prefix: string) {
  const stamp = Date.now().toString().slice(-8);
  const seq = await tx.journalEntry.count({
    where: {
      voucherNo: { startsWith: `${prefix}-${stamp.slice(0, 6)}` },
    },
  });
  return `${prefix}-${stamp}-${String(seq + 1).padStart(3, "0")}`;
}

export async function createPostedJournal(tx: Tx, input: CreatePostedJournalInput) {
  assertBalanced(input.lines);

  const existingBatch = await tx.postingBatch.findUnique({
    where: { sourceType_sourceId: { sourceType: input.sourceType, sourceId: input.sourceId } },
    include: { journals: true },
  });
  if (existingBatch?.journals?.length) {
    return existingBatch.journals[0];
  }

  const batch =
    existingBatch ||
    (await tx.postingBatch.create({
      data: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        postedById: input.postedById || null,
      },
    }));

  const fiscalPeriod = await ensureOpenFiscalPeriod(tx, input.postingDate);
  if (fiscalPeriod.status !== "OPEN") {
    throw new Error(`Fiscal period ${fiscalPeriod.code} is closed.`);
  }

  const uniqueCodes = Array.from(new Set(input.lines.map((l) => l.glCode)));
  const accountMap = await resolveAccountIds(tx, uniqueCodes);
  const voucherNo = await nextVoucherNo(tx, input.voucherPrefix || "JV");

  const journal = await tx.journalEntry.create({
    data: {
      voucherNo,
      documentDate: input.documentDate,
      postingDate: input.postingDate,
      status: "POSTED",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      memo: input.memo || null,
      fiscalPeriodId: fiscalPeriod.id,
      batchId: batch.id,
      createdById: input.createdById || null,
      postedById: input.postedById || null,
      postedAt: new Date(),
      lines: {
        create: input.lines
          .map((line) => ({
            glAccountId: accountMap.get(line.glCode)!,
            debit: new Prisma.Decimal(round2(Number(line.debit || 0))),
            credit: new Prisma.Decimal(round2(Number(line.credit || 0))),
            projectId: line.projectId || null,
            employeeId: line.employeeId || null,
            partyId: line.partyId || null,
            memo: line.memo || null,
          }))
          .filter((line) => Number(line.debit) > 0 || Number(line.credit) > 0),
      },
    },
    include: { lines: true },
  });

  return journal;
}

async function resolveProjectDbId(tx: Tx, projectRef?: string | null) {
  const raw = (projectRef || "").trim();
  if (!raw) return null;
  const project = await tx.project.findFirst({
    where: {
      OR: [{ id: raw }, { projectId: raw }, { name: raw }],
    },
    select: { id: true },
  });
  return project?.id || null;
}

async function resolveCompanyAccountCashCode(tx: Tx, companyAccountId: string) {
  const account = await tx.companyAccount.findUnique({
    where: { id: companyAccountId },
    select: { id: true, type: true },
  });
  if (!account) {
    throw new Error("Company account not found for posting.");
  }
  return (account.type || "").toUpperCase() === "BANK" ? GL_CODES.BANK_MAIN : GL_CODES.CASH_ON_HAND;
}

export async function postIncomeApprovalJournal(
  tx: Tx,
  input: {
    incomeId: string;
    amount: number;
    incomeDate: Date;
    companyAccountId: string;
    invoiceId?: string | null;
    projectRef?: string | null;
    userId?: string | null;
    memo?: string | null;
  },
) {
  const amount = round2(Number(input.amount || 0));
  if (amount <= 0) {
    throw new Error("Income posting amount must be greater than zero.");
  }
  const projectId = await resolveProjectDbId(tx, input.projectRef);
  const cashCode = await resolveCompanyAccountCashCode(tx, input.companyAccountId);
  const creditCode = input.invoiceId ? GL_CODES.AR_CONTROL : GL_CODES.REVENUE_MAIN;

  return createPostedJournal(tx, {
    sourceType: "INCOME",
    sourceId: input.incomeId,
    documentDate: input.incomeDate,
    postingDate: input.incomeDate,
    createdById: input.userId || null,
    postedById: input.userId || null,
    voucherPrefix: "RC",
    memo: input.memo || "Income approval posting",
    lines: [
      { glCode: cashCode, debit: amount, projectId },
      { glCode: creditCode, credit: amount, projectId },
    ],
  });
}

export async function postInvoiceJournal(
  tx: Tx,
  input: {
    invoiceId: string;
    amount: number;
    invoiceDate: Date;
    projectRef?: string | null;
    userId?: string | null;
    memo?: string | null;
  },
) {
  const amount = round2(Number(input.amount || 0));
  if (amount <= 0) {
    throw new Error("Invoice posting amount must be greater than zero.");
  }
  const projectId = await resolveProjectDbId(tx, input.projectRef);
  return createPostedJournal(tx, {
    sourceType: "INVOICE",
    sourceId: input.invoiceId,
    documentDate: input.invoiceDate,
    postingDate: input.invoiceDate,
    createdById: input.userId || null,
    postedById: input.userId || null,
    voucherPrefix: "INV",
    memo: input.memo || "Invoice posting",
    lines: [
      { glCode: GL_CODES.AR_CONTROL, debit: amount, projectId },
      { glCode: GL_CODES.REVENUE_MAIN, credit: amount, projectId },
    ],
  });
}

export async function postExpenseApprovalJournal(
  tx: Tx,
  input: {
    expenseId: string;
    amount: number;
    expenseDate: Date;
    paymentSource?: string | null;
    companyAccountId?: string | null;
    projectRef?: string | null;
    userId?: string | null;
    memo?: string | null;
  },
) {
  const amount = round2(Number(input.amount || 0));
  if (amount <= 0) {
    throw new Error("Expense posting amount must be greater than zero.");
  }

  const projectId = await resolveProjectDbId(tx, input.projectRef);
  const source = (input.paymentSource || "").toUpperCase();
  let creditCode: string = GL_CODES.CASH_ON_HAND;
  if (source === "EMPLOYEE_WALLET") {
    creditCode = GL_CODES.WALLET_CLEARING;
  } else if (input.companyAccountId) {
    creditCode = await resolveCompanyAccountCashCode(tx, input.companyAccountId);
  }

  return createPostedJournal(tx, {
    sourceType: "EXPENSE",
    sourceId: input.expenseId,
    documentDate: input.expenseDate,
    postingDate: input.expenseDate,
    createdById: input.userId || null,
    postedById: input.userId || null,
    voucherPrefix: "EXP",
    memo: input.memo || "Expense approval posting",
    lines: [
      { glCode: GL_CODES.OPERATING_EXPENSE, debit: amount, projectId },
      { glCode: creditCode, credit: amount, projectId },
    ],
  });
}
