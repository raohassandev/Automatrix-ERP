export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const TASK_INTERVAL_TYPES = ["DAILY", "WEEKLY", "MONTHLY"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskIntervalType = (typeof TASK_INTERVAL_TYPES)[number];

export function toTaskStatus(value: unknown): TaskStatus {
  const normalized = String(value || "").trim().toUpperCase();
  if ((TASK_STATUSES as readonly string[]).includes(normalized)) return normalized as TaskStatus;
  return "TODO";
}

export function toTaskPriority(value: unknown): TaskPriority {
  const normalized = String(value || "").trim().toUpperCase();
  if ((TASK_PRIORITIES as readonly string[]).includes(normalized)) return normalized as TaskPriority;
  return "MEDIUM";
}

export function toIntervalType(value: unknown): TaskIntervalType {
  const normalized = String(value || "").trim().toUpperCase();
  if ((TASK_INTERVAL_TYPES as readonly string[]).includes(normalized)) return normalized as TaskIntervalType;
  return "WEEKLY";
}

export function parseWeekdays(raw: string | null | undefined) {
  const values = String(raw || "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function dateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(base: Date, months: number) {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

function sameOrAfter(a: Date, b: Date) {
  return a.getTime() >= b.getTime();
}

export function computeNextTemplateRun(args: {
  intervalType: string;
  intervalValue: number;
  startDate: Date;
  fromDate?: Date;
  weekdays?: string | null;
  dayOfMonth?: number | null;
}) {
  const intervalType = toIntervalType(args.intervalType);
  const intervalValue = Math.max(1, Number(args.intervalValue || 1));
  const startDate = dateOnly(args.startDate);
  const cursor = dateOnly(args.fromDate || startDate);

  if (intervalType === "DAILY") {
    const base = sameOrAfter(cursor, startDate) ? cursor : startDate;
    return addDays(base, intervalValue);
  }

  if (intervalType === "WEEKLY") {
    const weekdays = parseWeekdays(args.weekdays);
    const allowedWeekdays = weekdays.length > 0 ? weekdays : [startDate.getDay()];
    const start = sameOrAfter(cursor, startDate) ? cursor : startDate;

    for (let i = 1; i <= 370; i += 1) {
      const candidate = addDays(start, i);
      if (!allowedWeekdays.includes(candidate.getDay())) continue;
      const daysFromStart = Math.floor((dateOnly(candidate).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekOffset = Math.floor(daysFromStart / 7);
      if (weekOffset % intervalValue === 0) {
        return candidate;
      }
    }
    return addDays(start, intervalValue * 7);
  }

  const dayOfMonth = Math.min(31, Math.max(1, Number(args.dayOfMonth || startDate.getDate())));
  const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const from = sameOrAfter(cursor, startDate) ? cursor : startDate;
  const fromMonth = new Date(from.getFullYear(), from.getMonth(), 1);

  const monthDiff =
    (fromMonth.getFullYear() - startMonth.getFullYear()) * 12 + (fromMonth.getMonth() - startMonth.getMonth());
  const nextStep = Math.ceil(Math.max(0, monthDiff) / intervalValue) * intervalValue;

  for (let i = 0; i < 120; i += 1) {
    const month = addMonths(startMonth, nextStep + i * intervalValue);
    const maxDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const candidate = new Date(month.getFullYear(), month.getMonth(), Math.min(dayOfMonth, maxDay));
    if (candidate.getTime() > from.getTime()) return candidate;
  }

  return addMonths(from, intervalValue);
}

export function isTaskOverdue(status: string, dueDate?: Date | null) {
  const s = toTaskStatus(status);
  if (!dueDate) return false;
  if (s === "DONE" || s === "CANCELLED") return false;
  return dateOnly(dueDate).getTime() < dateOnly(new Date()).getTime();
}

export function taskPriorityClasses(priority: string) {
  const value = toTaskPriority(priority);
  if (value === "CRITICAL") return "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200";
  if (value === "HIGH") return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200";
  if (value === "LOW") return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200";
  return "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200";
}

export function taskStatusClasses(status: string) {
  const value = toTaskStatus(status);
  if (value === "DONE") return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200";
  if (value === "IN_PROGRESS") return "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200";
  if (value === "BLOCKED") return "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200";
  if (value === "CANCELLED") return "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300";
  return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200";
}
