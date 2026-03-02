"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type FiscalPeriod = {
  id: string;
  code: string;
  startDate: string | Date;
  endDate: string | Date;
  status: string;
  closeReason: string | null;
  closedAt: string | Date | null;
};

export default function FiscalPeriodsManager({
  periods,
  canManage,
}: {
  periods: FiscalPeriod[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    code: "",
    startDate: "",
    endDate: "",
  });
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  function createPeriod(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/accounting/fiscal-periods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to create period");
        toast.success("Fiscal period created");
        setForm({ code: "", startDate: "", endDate: "" });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create period");
      }
    });
  }

  function updateStatus(period: FiscalPeriod, action: "CLOSE" | "REOPEN") {
    if (!canManage) return;
    startTransition(async () => {
      try {
        const reason = reasonById[period.id] || "";
        const res = await fetch(`/api/accounting/fiscal-periods/${period.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.success) {
          const issues = Array.isArray(payload?.data?.blockingIssues)
            ? payload.data.blockingIssues.slice(0, 3).join(" ")
            : "";
          const message = [payload.error || "Failed to update period", issues].filter(Boolean).join(" ");
          throw new Error(message);
        }
        toast.success(`Period ${action === "CLOSE" ? "closed" : "reopened"}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update period");
      }
    });
  }

  return (
    <div className="grid gap-4">
      {canManage ? (
        <form onSubmit={createPeriod} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <input
              required
              placeholder="Code (e.g. 2026-03)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="rounded-md border px-3 py-2 text-sm"
            />
            <input
              required
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="rounded-md border px-3 py-2 text-sm"
            />
            <input
              required
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="rounded-md border px-3 py-2 text-sm"
            />
            <button disabled={pending} className="rounded-md border px-3 py-2 text-sm font-medium">
              {pending ? "Saving..." : "Create Period"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Code</th>
                <th className="py-2">Start</th>
                <th className="py-2">End</th>
                <th className="py-2">Status</th>
                <th className="py-2">Reason</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2 font-medium">{p.code}</td>
                  <td className="py-2">{new Date(p.startDate).toISOString().slice(0, 10)}</td>
                  <td className="py-2">{new Date(p.endDate).toISOString().slice(0, 10)}</td>
                  <td className="py-2">{p.status}</td>
                  <td className="py-2">
                    <input
                      value={reasonById[p.id] || ""}
                      onChange={(e) => setReasonById({ ...reasonById, [p.id]: e.target.value })}
                      placeholder={p.closeReason || "Reason (optional)"}
                      className="w-full rounded-md border px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-2">
                    {canManage ? (
                      p.status === "OPEN" ? (
                        <button
                          disabled={pending}
                          onClick={() => updateStatus(p, "CLOSE")}
                          className="rounded-md border px-2 py-1 text-xs"
                        >
                          Close
                        </button>
                      ) : (
                        <button
                          disabled={pending}
                          onClick={() => updateStatus(p, "REOPEN")}
                          className="rounded-md border px-2 py-1 text-xs"
                        >
                          Reopen
                        </button>
                      )
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
