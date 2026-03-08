"use client";

import clsx from "clsx";

function normalizeStatus(status: string) {
  return (status || "").trim().toUpperCase();
}

export function StatusBadge({ status }: { status: string }) {
  const key = normalizeStatus(status);
  const style = (() => {
    if (["APPROVED", "POSTED", "PAID", "ACTIVE", "COMPLETED", "RECOVERED"].includes(key)) {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    }
    if (["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3", "SUBMITTED", "SENT"].includes(key)) {
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    }
    if (["REJECTED", "CANCELLED", "VOID", "OVERDUE", "INACTIVE", "CLOSED"].includes(key)) {
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    }
    if (["DRAFT", "ON_HOLD", "UPCOMING", "NOT_STARTED"].includes(key)) {
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    }
    return "border-border bg-muted/40 text-muted-foreground";
  })();

  return (
    <span className={clsx("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", style)}>
      {status || "N/A"}
    </span>
  );
}
