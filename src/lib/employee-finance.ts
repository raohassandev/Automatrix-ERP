import { prisma } from "@/lib/prisma";
import { findUserByEmailInsensitive } from "@/lib/identity";

export type FinanceTimelineModule = "WALLET" | "EXPENSE" | "ADVANCE" | "PAYROLL" | "INCENTIVE" | "COMMISSION";

export type EmployeeFinanceFilters = {
  employeeId: string;
  from?: string;
  to?: string;
  search?: string;
  event?: string;
  category?: string;
  paymentSource?: string;
  project?: string;
};

export type EmployeeFinanceTimelineRow = {
  id: string;
  date: Date;
  module: FinanceTimelineModule;
  impact: "IN" | "OUT" | "INFO";
  amount: number;
  status: string;
  note: string;
  reference: string;
  href: string;
  category: string | null;
  paymentSource: string | null;
  project: string | null;
  sourceType: string | null;
  runningBalance: number | null;
};

export type EmployeeFinanceStatement = {
  openingBalance: number;
  closingBalance: number;
  currentBalance: number;
  currentHold: number;
  currentAvailable: number;
  issuedAmount: number;
  consumedAmount: number;
  expenseBooked: number;
  expenseApproved: number;
  expensePayable: number;
  reimbursedAmount: number;
  advanceIssued: number;
  advanceOutstanding: number;
  payrollPaid: number;
  payrollDue: number;
  variablePaid: number;
  variablePayDue: number;
  netCompanyPayable: number;
};

export type EmployeeFinanceExpenseRow = {
  id: string;
  date: Date;
  description: string;
  category: string;
  paymentSource: string | null;
  project: string | null;
  status: string;
  amount: number;
  approvedAmount: number;
  href: string;
};

export type EmployeeFinanceCategoryRow = {
  category: string;
  claims: number;
  total: number;
  pocket: number;
  wallet: number;
  company: number;
  averageClaim: number;
};

export type EmployeeFinanceMonthlyRow = {
  month: string;
  issued: number;
  consumed: number;
  expenseApproved: number;
  pocketPayable: number;
  reimbursed: number;
  advanceIssued: number;
  payrollPaid: number;
  variablePaid: number;
  claims: number;
  averageClaim: number;
};

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function asMoney(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
}

export function normalizeExpenseAmount(expense: {
  status: string;
  amount: { toString(): string } | number;
  approvedAmount: { toString(): string } | number | null;
}) {
  if (
    (expense.status === "APPROVED" || expense.status === "PARTIALLY_APPROVED" || expense.status === "PAID") &&
    expense.approvedAmount !== null
  ) {
    return Number(expense.approvedAmount);
  }
  return Number(expense.amount);
}

export async function getEmployeeFinanceWorkspaceData(filters: EmployeeFinanceFilters) {
  const employee = await prisma.employee.findUnique({
    where: { id: filters.employeeId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      walletBalance: true,
      walletHold: true,
    },
  });

  if (!employee) {
    return null;
  }

  const search = (filters.search || "").trim().toLowerCase();
  const moduleFilter = (filters.event || "").trim().toUpperCase();
  const categoryFilter = (filters.category || "").trim();
  const paymentSourceFilter = (filters.paymentSource || "").trim();
  const projectFilter = (filters.project || "").trim();

  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const parsedFrom = parseDate(filters.from) || defaultFrom;
  const parsedTo = parseDate(filters.to) || today;
  const rangeFrom = parsedFrom <= parsedTo ? parsedFrom : parsedTo;
  const rangeTo = parsedTo >= parsedFrom ? parsedTo : parsedFrom;

  const linkedUser = await findUserByEmailInsensitive(employee.email, { select: { id: true } });

  const [openingBalanceRow, closingBalanceRow, walletRows, expenseRowsRaw, advanceRows, payrollRows, incentiveRows, commissionRows] =
    await Promise.all([
      prisma.walletLedger.findFirst({
        where: { employeeId: employee.id, date: { lt: rangeFrom } },
        orderBy: { date: "desc" },
        select: { balance: true },
      }),
      prisma.walletLedger.findFirst({
        where: { employeeId: employee.id, date: { lte: rangeTo } },
        orderBy: { date: "desc" },
        select: { balance: true },
      }),
      prisma.walletLedger.findMany({
        where: { employeeId: employee.id, date: { gte: rangeFrom, lte: rangeTo } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        include: {
          companyAccount: { select: { name: true } },
          postedBy: { select: { name: true, email: true } },
        },
      }),
      linkedUser?.id
        ? prisma.expense.findMany({
            where: { submittedById: linkedUser.id, date: { gte: rangeFrom, lte: rangeTo } },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              date: true,
              amount: true,
              approvedAmount: true,
              status: true,
              description: true,
              category: true,
              project: true,
              paymentSource: true,
            },
          })
        : Promise.resolve([]),
      prisma.salaryAdvance.findMany({
        where: { employeeId: employee.id, createdAt: { gte: rangeFrom, lte: rangeTo } },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          amount: true,
          outstandingAmount: true,
          status: true,
          reason: true,
          recoveryMode: true,
          createdAt: true,
        },
      }),
      prisma.payrollEntry.findMany({
        where: { employeeId: employee.id, createdAt: { gte: rangeFrom, lte: rangeTo } },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          netPay: true,
          status: true,
          createdAt: true,
          payrollRun: { select: { periodStart: true, periodEnd: true } },
        },
      }),
      prisma.incentiveEntry.findMany({
        where: { employeeId: employee.id, createdAt: { gte: rangeFrom, lte: rangeTo } },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          amount: true,
          status: true,
          settlementStatus: true,
          payoutMode: true,
          projectRef: true,
          createdAt: true,
        },
      }),
      prisma.commissionEntry.findMany({
        where: { employeeId: employee.id, payeeType: "EMPLOYEE", createdAt: { gte: rangeFrom, lte: rangeTo } },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          amount: true,
          status: true,
          settlementStatus: true,
          payoutMode: true,
          projectRef: true,
          createdAt: true,
        },
      }),
    ]);

  const openingBalance = asMoney(openingBalanceRow?.balance || 0);
  const closingBalance = asMoney(closingBalanceRow?.balance || 0);
  const currentBalance = asMoney(employee.walletBalance || 0);
  const currentHold = asMoney(employee.walletHold || 0);
  const currentAvailable = asMoney(currentBalance - currentHold);

  const issuedAmount = asMoney(
    walletRows.filter((row) => row.type === "CREDIT").reduce((sum, row) => sum + Number(row.amount || 0), 0),
  );
  const consumedAmount = asMoney(
    walletRows.filter((row) => row.type === "DEBIT").reduce((sum, row) => sum + Number(row.amount || 0), 0),
  );

  const expenseRows = expenseRowsRaw.map((row) => ({
    ...row,
    amountNumber: asMoney(row.amount),
    approvedAmountNumber: asMoney(normalizeExpenseAmount(row)),
  }));

  const expenseBooked = asMoney(expenseRows.reduce((sum, row) => sum + row.amountNumber, 0));
  const expenseApproved = asMoney(expenseRows.reduce((sum, row) => sum + row.approvedAmountNumber, 0));
  const expensePayable = asMoney(
    expenseRows
      .filter(
        (row) =>
          row.paymentSource === "EMPLOYEE_POCKET" &&
          (row.status === "APPROVED" || row.status === "PARTIALLY_APPROVED"),
      )
      .reduce((sum, row) => sum + row.approvedAmountNumber, 0),
  );
  const reimbursedAmount = asMoney(
    expenseRows
      .filter((row) => row.paymentSource === "EMPLOYEE_POCKET" && row.status === "PAID")
      .reduce((sum, row) => sum + row.approvedAmountNumber, 0),
  );

  const issuedAdvanceStatuses = new Set(["PAID", "PARTIALLY_RECOVERED", "RECOVERED"]);
  const advanceIssued = asMoney(
    advanceRows
      .filter((row) => issuedAdvanceStatuses.has(String(row.status || "").toUpperCase()))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0),
  );
  const advanceOutstanding = asMoney(
    advanceRows.reduce((sum, row) => sum + Number(row.outstandingAmount || 0), 0),
  );

  const payrollPaid = asMoney(
    payrollRows
      .filter((row) => String(row.status || "").toUpperCase() === "PAID")
      .reduce((sum, row) => sum + Number(row.netPay || 0), 0),
  );
  const payrollDue = asMoney(
    payrollRows
      .filter((row) => String(row.status || "").toUpperCase() !== "PAID")
      .reduce((sum, row) => sum + Number(row.netPay || 0), 0),
  );

  const variablePaid = asMoney(
    [
      ...incentiveRows.filter((row) => String(row.settlementStatus || "").toUpperCase() === "SETTLED"),
      ...commissionRows.filter((row) => String(row.settlementStatus || "").toUpperCase() === "SETTLED"),
    ].reduce((sum, row) => sum + Number(row.amount || 0), 0),
  );
  const variablePayDue = asMoney(
    [
      ...incentiveRows.filter(
        (row) => String(row.status || "").toUpperCase() === "APPROVED" && String(row.settlementStatus || "").toUpperCase() !== "SETTLED",
      ),
      ...commissionRows.filter(
        (row) => String(row.status || "").toUpperCase() === "APPROVED" && String(row.settlementStatus || "").toUpperCase() !== "SETTLED",
      ),
    ].reduce((sum, row) => sum + Number(row.amount || 0), 0),
  );

  const statement: EmployeeFinanceStatement = {
    openingBalance,
    closingBalance,
    currentBalance,
    currentHold,
    currentAvailable,
    issuedAmount,
    consumedAmount,
    expenseBooked,
    expenseApproved,
    expensePayable,
    reimbursedAmount,
    advanceIssued,
    advanceOutstanding,
    payrollPaid,
    payrollDue,
    variablePaid,
    variablePayDue,
    netCompanyPayable: asMoney(payrollDue + variablePayDue + expensePayable - advanceOutstanding),
  };

  const filteredExpenseRows = expenseRows.filter((row) => {
    if (categoryFilter && row.category !== categoryFilter) return false;
    if (paymentSourceFilter && row.paymentSource !== paymentSourceFilter) return false;
    if (projectFilter && row.project !== projectFilter) return false;
    if (search) {
      const haystack = [row.description, row.category, row.paymentSource, row.project, row.status].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const categoryMap = new Map<string, EmployeeFinanceCategoryRow>();
  filteredExpenseRows.forEach((row) => {
    const key = row.category || "Uncategorized";
    const entry = categoryMap.get(key) || {
      category: key,
      claims: 0,
      total: 0,
      pocket: 0,
      wallet: 0,
      company: 0,
      averageClaim: 0,
    };
    entry.claims += 1;
    entry.total += row.approvedAmountNumber;
    if (row.paymentSource === "EMPLOYEE_POCKET") entry.pocket += row.approvedAmountNumber;
    else if (row.paymentSource === "EMPLOYEE_WALLET") entry.wallet += row.approvedAmountNumber;
    else entry.company += row.approvedAmountNumber;
    categoryMap.set(key, entry);
  });
  const categorySummary = Array.from(categoryMap.values())
    .map((row) => ({ ...row, averageClaim: row.claims > 0 ? asMoney(row.total / row.claims) : 0 }))
    .sort((a, b) => b.total - a.total);

  const monthlyMap = new Map<string, EmployeeFinanceMonthlyRow>();
  const getMonthlyEntry = (label: string) => {
    const existing = monthlyMap.get(label);
    if (existing) return existing;
    const next: EmployeeFinanceMonthlyRow = {
      month: label,
      issued: 0,
      consumed: 0,
      expenseApproved: 0,
      pocketPayable: 0,
      reimbursed: 0,
      advanceIssued: 0,
      payrollPaid: 0,
      variablePaid: 0,
      claims: 0,
      averageClaim: 0,
    };
    monthlyMap.set(label, next);
    return next;
  };

  walletRows.forEach((row) => {
    const entry = getMonthlyEntry(monthLabel(new Date(row.date)));
    if (row.type === "CREDIT") entry.issued += Number(row.amount || 0);
    if (row.type === "DEBIT") entry.consumed += Number(row.amount || 0);
  });
  filteredExpenseRows.forEach((row) => {
    const entry = getMonthlyEntry(monthLabel(new Date(row.date)));
    entry.expenseApproved += row.approvedAmountNumber;
    entry.claims += 1;
    if (row.paymentSource === "EMPLOYEE_POCKET" && (row.status === "APPROVED" || row.status === "PARTIALLY_APPROVED")) {
      entry.pocketPayable += row.approvedAmountNumber;
    }
    if (row.paymentSource === "EMPLOYEE_POCKET" && row.status === "PAID") {
      entry.reimbursed += row.approvedAmountNumber;
    }
  });
  advanceRows.forEach((row) => {
    const entry = getMonthlyEntry(monthLabel(new Date(row.createdAt)));
    if (issuedAdvanceStatuses.has(String(row.status || "").toUpperCase())) {
      entry.advanceIssued += Number(row.amount || 0);
    }
  });
  payrollRows.forEach((row) => {
    if (String(row.status || "").toUpperCase() !== "PAID") return;
    const entry = getMonthlyEntry(monthLabel(new Date(row.createdAt)));
    entry.payrollPaid += Number(row.netPay || 0);
  });
  [...incentiveRows, ...commissionRows].forEach((row) => {
    if (String(row.settlementStatus || "").toUpperCase() !== "SETTLED") return;
    const entry = getMonthlyEntry(monthLabel(new Date(row.createdAt)));
    entry.variablePaid += Number(row.amount || 0);
  });

  const monthlySummary = Array.from(monthlyMap.values())
    .map((row) => ({
      ...row,
      issued: asMoney(row.issued),
      consumed: asMoney(row.consumed),
      expenseApproved: asMoney(row.expenseApproved),
      pocketPayable: asMoney(row.pocketPayable),
      reimbursed: asMoney(row.reimbursed),
      advanceIssued: asMoney(row.advanceIssued),
      payrollPaid: asMoney(row.payrollPaid),
      variablePaid: asMoney(row.variablePaid),
      averageClaim: row.claims > 0 ? asMoney(row.expenseApproved / row.claims) : 0,
    }))
    .sort((a, b) => new Date(`01 ${b.month}`).getTime() - new Date(`01 ${a.month}`).getTime());

  const expenseDetailRows: EmployeeFinanceExpenseRow[] = filteredExpenseRows.map((row) => ({
    id: row.id,
    date: new Date(row.date),
    description: row.description,
    category: row.category,
    paymentSource: row.paymentSource,
    project: row.project,
    status: row.status,
    amount: row.amountNumber,
    approvedAmount: row.approvedAmountNumber,
    href: `/expenses?submittedById=${linkedUser?.id || ""}&from=${rangeFrom.toISOString()}&to=${rangeTo.toISOString()}${categoryFilter ? `&category=${encodeURIComponent(categoryFilter)}` : ""}${paymentSourceFilter ? `&paymentSource=${encodeURIComponent(paymentSourceFilter)}` : ""}${projectFilter ? `&project=${encodeURIComponent(projectFilter)}` : ""}`,
  }));

  const hasExpenseSlice = Boolean(categoryFilter || paymentSourceFilter || projectFilter);
  const timelineBase: EmployeeFinanceTimelineRow[] = [
    ...walletRows.map((row) => ({
      id: `wallet-${row.id}`,
      date: new Date(row.date),
      module: "WALLET" as const,
      impact: (row.type === "CREDIT" ? "IN" : "OUT") as EmployeeFinanceTimelineRow["impact"],
      amount: asMoney(row.amount),
      status: row.type,
      note: [row.sourceType, row.reference, row.companyAccount?.name, row.postedBy?.name || row.postedBy?.email]
        .filter(Boolean)
        .join(" • "),
      reference: row.reference || row.id,
      href: `/wallets?employeeId=${employee.id}&from=${rangeFrom.toISOString()}&to=${rangeTo.toISOString()}`,
      category: null,
      paymentSource: null,
      project: null,
      sourceType: row.sourceType || null,
      runningBalance: asMoney(row.balance),
    })),
    ...expenseRows.map((row) => ({
      id: `expense-${row.id}`,
      date: new Date(row.date),
      module: "EXPENSE" as const,
      impact: (row.status === "PAID" ? "OUT" : "INFO") as EmployeeFinanceTimelineRow["impact"],
      amount: row.approvedAmountNumber,
      status: row.status,
      note: row.description,
      reference: row.id,
      href: `/expenses?submittedById=${linkedUser?.id || ""}&from=${rangeFrom.toISOString()}&to=${rangeTo.toISOString()}${row.category ? `&category=${encodeURIComponent(row.category)}` : ""}${row.paymentSource ? `&paymentSource=${encodeURIComponent(row.paymentSource)}` : ""}${row.project ? `&project=${encodeURIComponent(row.project)}` : ""}`,
      category: row.category,
      paymentSource: row.paymentSource,
      project: row.project,
      sourceType: null,
      runningBalance: null,
    })),
    ...advanceRows.map((row) => ({
      id: `advance-${row.id}`,
      date: new Date(row.createdAt),
      module: "ADVANCE" as const,
      impact: (issuedAdvanceStatuses.has(String(row.status || "").toUpperCase()) ? "IN" : "INFO") as EmployeeFinanceTimelineRow["impact"],
      amount: asMoney(row.amount),
      status: row.status,
      note: `${row.reason} • ${row.recoveryMode} • Outstanding ${asMoney(row.outstandingAmount)}`,
      reference: row.id,
      href: `/salary-advances?employeeId=${employee.id}&from=${rangeFrom.toISOString()}&to=${rangeTo.toISOString()}`,
      category: null,
      paymentSource: null,
      project: null,
      sourceType: row.recoveryMode,
      runningBalance: null,
    })),
    ...payrollRows.map((row) => ({
      id: `payroll-${row.id}`,
      date: new Date(row.createdAt),
      module: "PAYROLL" as const,
      impact: (String(row.status || "").toUpperCase() === "PAID" ? "IN" : "INFO") as EmployeeFinanceTimelineRow["impact"],
      amount: asMoney(row.netPay),
      status: row.status,
      note: row.payrollRun
        ? `${new Date(row.payrollRun.periodStart).toLocaleDateString()} - ${new Date(row.payrollRun.periodEnd).toLocaleDateString()}`
        : "Payroll run",
      reference: row.id,
      href: "/payroll",
      category: null,
      paymentSource: null,
      project: null,
      sourceType: null,
      runningBalance: null,
    })),
    ...incentiveRows.map((row) => ({
      id: `incentive-${row.id}`,
      date: new Date(row.createdAt),
      module: "INCENTIVE" as const,
      impact: (String(row.settlementStatus || "").toUpperCase() === "SETTLED" ? "IN" : "INFO") as EmployeeFinanceTimelineRow["impact"],
      amount: asMoney(row.amount),
      status: `${row.status}/${row.settlementStatus}`,
      note: [row.projectRef, row.payoutMode].filter(Boolean).join(" • ") || "Incentive",
      reference: row.id,
      href: `/incentives?employeeId=${employee.id}`,
      category: null,
      paymentSource: row.payoutMode || null,
      project: row.projectRef || null,
      sourceType: row.payoutMode || null,
      runningBalance: null,
    })),
    ...commissionRows.map((row) => ({
      id: `commission-${row.id}`,
      date: new Date(row.createdAt),
      module: "COMMISSION" as const,
      impact: (String(row.settlementStatus || "").toUpperCase() === "SETTLED" ? "IN" : "INFO") as EmployeeFinanceTimelineRow["impact"],
      amount: asMoney(row.amount),
      status: `${row.status}/${row.settlementStatus}`,
      note: [row.projectRef, row.payoutMode].filter(Boolean).join(" • ") || "Commission",
      reference: row.id,
      href: `/commissions?search=${encodeURIComponent(employee.name)}`,
      category: null,
      paymentSource: row.payoutMode || null,
      project: row.projectRef || null,
      sourceType: row.payoutMode || null,
      runningBalance: null,
    })),
  ];

  const timeline = timelineBase
    .filter((row) => (moduleFilter ? row.module === moduleFilter : true))
    .filter((row) => {
      if (row.module === "EXPENSE") {
        if (categoryFilter && row.category !== categoryFilter) return false;
        if (paymentSourceFilter && row.paymentSource !== paymentSourceFilter) return false;
        if (projectFilter && row.project !== projectFilter) return false;
      } else if (hasExpenseSlice && !moduleFilter) {
        return false;
      }
      if (!search) return true;
      const haystack = [
        row.module,
        row.status,
        row.note,
        row.reference,
        row.category,
        row.paymentSource,
        row.project,
        row.sourceType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    employee,
    linkedUserId: linkedUser?.id || null,
    rangeFrom,
    rangeTo,
    filters: {
      search,
      moduleFilter,
      categoryFilter,
      paymentSourceFilter,
      projectFilter,
      hasExpenseSlice,
    },
    statement,
    timeline,
    expenseDetailRows,
    categorySummary,
    monthlySummary,
    options: {
      categories: Array.from(new Set(expenseRows.map((row) => row.category).filter(Boolean) as string[])).sort(),
      paymentSources: Array.from(new Set(expenseRows.map((row) => row.paymentSource).filter(Boolean) as string[])).sort(),
      projects: Array.from(
        new Set([
          ...(expenseRows.map((row) => row.project).filter(Boolean) as string[]),
          ...(incentiveRows.map((row) => row.projectRef).filter(Boolean) as string[]),
          ...(commissionRows.map((row) => row.projectRef).filter(Boolean) as string[]),
        ]),
      ).sort(),
    },
  };
}
