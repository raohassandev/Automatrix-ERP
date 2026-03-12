export const EXPENSE_PENDING_STATUSES = ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] as const;
export const EXPENSE_APPROVED_STATUSES = ["APPROVED", "PARTIALLY_APPROVED"] as const;
export const EXPENSE_SETTLED_STATUSES = ["PAID"] as const;

export const PAYROLL_RUN_WORKFLOW_STATUSES = ["DRAFT", "APPROVED", "POSTED", "CANCELLED"] as const;
export const PAYROLL_ENTRY_SETTLEMENT_STATUSES = ["PENDING", "PAID"] as const;

export const PROCUREMENT_WORKFLOW_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "POSTED",
  "RECEIVED",
  "PARTIAL",
  "PARTIALLY_RECEIVED",
  "VOID",
] as const;

export const POSTING_STATUSES = ["UNPOSTED", "POSTED", "REVERSED"] as const;
export const SETTLEMENT_STATUSES = ["UNSETTLED", "PARTIALLY_SETTLED", "SETTLED"] as const;

export type PostingStatus = (typeof POSTING_STATUSES)[number];
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

function normalize(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function isExpensePendingStatus(status: unknown) {
  const s = normalize(status);
  return (EXPENSE_PENDING_STATUSES as readonly string[]).includes(s);
}

export function isExpenseApprovedStatus(status: unknown) {
  const s = normalize(status);
  return (EXPENSE_APPROVED_STATUSES as readonly string[]).includes(s);
}

export function isExpenseSettledStatus(status: unknown) {
  const s = normalize(status);
  return (EXPENSE_SETTLED_STATUSES as readonly string[]).includes(s);
}

export function toPostingStatusFromWorkflow(status: unknown): PostingStatus {
  const s = normalize(status);
  if (s === "POSTED" || s === "PAID" || s === "RECEIVED" || s === "PARTIAL") return "POSTED";
  if (s === "REVERSED") return "REVERSED";
  return "UNPOSTED";
}

export function toSettlementStatusFromWorkflow(status: unknown): SettlementStatus {
  const s = normalize(status);
  if (s === "PAID" || s === "SETTLED" || s === "RECOVERED") return "SETTLED";
  if (s === "PARTIALLY_RECOVERED" || s === "PARTIALLY_APPROVED") return "PARTIALLY_SETTLED";
  return "UNSETTLED";
}

export function toMonthKey(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
}

