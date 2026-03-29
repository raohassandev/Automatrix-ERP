import { Prisma } from "@prisma/client";

export type ExpenseQueryFilters = {
  search?: string | null;
  category?: string | null;
  status?: string | null;
  expenseType?: string | null;
  paymentSource?: string | null;
  paymentMode?: string | null;
  submittedById?: string | null;
  project?: string | null;
  from?: string | null;
  to?: string | null;
};

function clean(value: string | null | undefined) {
  return (value || "").trim();
}

export function normalizeExpenseQueryFilters(filters: ExpenseQueryFilters) {
  return {
    search: clean(filters.search),
    category: clean(filters.category),
    status: clean(filters.status),
    expenseType: clean(filters.expenseType),
    paymentSource: clean(filters.paymentSource),
    paymentMode: clean(filters.paymentMode),
    submittedById: clean(filters.submittedById),
    project: clean(filters.project),
    from: clean(filters.from),
    to: clean(filters.to),
  };
}

export function readExpenseQueryFilters(searchParams: URLSearchParams): ReturnType<typeof normalizeExpenseQueryFilters> {
  return normalizeExpenseQueryFilters({
    search: searchParams.get("search"),
    category: searchParams.get("category"),
    status: searchParams.get("status"),
    expenseType: searchParams.get("expenseType"),
    paymentSource: searchParams.get("paymentSource"),
    paymentMode: searchParams.get("paymentMode"),
    submittedById: searchParams.get("submittedById"),
    project: searchParams.get("project"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
}

export function buildExpenseWhere(
  filters: ExpenseQueryFilters,
  options: {
    canViewAll: boolean;
    sessionUserId: string;
  },
): Prisma.ExpenseWhereInput {
  const normalized = normalizeExpenseQueryFilters(filters);
  const where: Prisma.ExpenseWhereInput = {};

  if (!options.canViewAll) {
    where.submittedById = options.sessionUserId;
  }

  if (normalized.search) {
    where.OR = [
      { description: { contains: normalized.search, mode: "insensitive" } },
      { category: { contains: normalized.search, mode: "insensitive" } },
      { project: { contains: normalized.search, mode: "insensitive" } },
      { submittedBy: { name: { contains: normalized.search, mode: "insensitive" } } },
      { submittedBy: { email: { contains: normalized.search, mode: "insensitive" } } },
    ];
  }

  if (normalized.category) {
    where.category = normalized.category;
  }
  if (normalized.status) {
    where.status = normalized.status;
  }
  if (normalized.expenseType) {
    where.expenseType = normalized.expenseType;
  }
  if (normalized.paymentSource) {
    where.paymentSource = normalized.paymentSource;
  }
  if (normalized.paymentMode) {
    where.paymentMode = normalized.paymentMode;
  }
  if (normalized.submittedById && options.canViewAll) {
    where.submittedById = normalized.submittedById;
  }
  if (normalized.project) {
    where.project = normalized.project;
  }
  if (normalized.from || normalized.to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (normalized.from) range.gte = new Date(normalized.from);
    if (normalized.to) range.lte = new Date(normalized.to);
    where.date = range;
  }

  return where;
}

export function expenseExportQueryParams(filters: ExpenseQueryFilters) {
  const normalized = normalizeExpenseQueryFilters(filters);
  return new URLSearchParams(
    Object.fromEntries(
      Object.entries(normalized).filter(([, value]) => Boolean(value)),
    ),
  ).toString();
}
