export const RECEIPT_REQUIRED_THRESHOLD = 5000;
export const DUPLICATE_CHECK_DAYS = 3;
export const PROCUREMENT_SPIKE_THRESHOLD = 100000;

export const EXPENSE_APPROVAL_LEVELS = [
  { max: 5000, level: "L1" },
  { max: 50000, level: "L2" },
  { max: Number.POSITIVE_INFINITY, level: "L3" },
] as const;

export const INCOME_APPROVAL_LEVELS = [
  { max: 100000, level: "L1" },
  { max: Number.POSITIVE_INFINITY, level: "L2" },
] as const;
