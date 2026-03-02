"use client";

import clsx from "clsx";

function normalizeStatus(status: string) {
  return (status || "").trim().toUpperCase();
}

export function StatusBadge({ status }: { status: string }) {
  const key = normalizeStatus(status);
  const style = (() => {
    if (["APPROVED", "POSTED", "PAID", "ACTIVE", "COMPLETED"].includes(key)) {
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    }
    if (["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3", "SUBMITTED", "SENT"].includes(key)) {
      return "border-amber-300 bg-amber-50 text-amber-700";
    }
    if (["REJECTED", "CANCELLED", "VOID", "OVERDUE", "INACTIVE", "CLOSED"].includes(key)) {
      return "border-rose-300 bg-rose-50 text-rose-700";
    }
    if (["DRAFT", "ON_HOLD", "UPCOMING", "NOT_STARTED"].includes(key)) {
      return "border-sky-300 bg-sky-50 text-sky-700";
    }
    return "border-slate-300 bg-slate-50 text-slate-700";
  })();

  return (
    <span className={clsx("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", style)}>
      {status || "N/A"}
    </span>
  );
}
