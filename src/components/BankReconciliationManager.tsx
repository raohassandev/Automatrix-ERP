"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";

type Account = {
  id: string;
  name: string;
  type: string;
};

type Snapshot = {
  id: string;
  asOfDate: string;
  bookBalance: number;
  statementBalance: number;
  difference: number;
  status: string;
  notes: string | null;
  createdBy: { id: string; name: string | null; email: string } | null;
  createdAt: string;
};

type Dataset = {
  accounts: Account[];
  selectedAccountId: string | null;
  asOfDate: string;
  bookBalance: number;
  statementBalance: number | null;
  difference: number | null;
  snapshots: Snapshot[];
};

export function BankReconciliationManager({ initialData }: { initialData: Dataset }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<Dataset>(initialData);
  const [form, setForm] = useState({
    companyAccountId: initialData.selectedAccountId || initialData.accounts[0]?.id || "",
    asOfDate: (searchParams.get("asOfDate") || "").trim() || new Date().toISOString().slice(0, 10),
    statementBalance: initialData.statementBalance?.toString() || "",
    notes: "",
  });

  const computedDifference = useMemo(() => {
    const statement = Number(form.statementBalance || 0);
    if (!Number.isFinite(statement)) return null;
    return Number((statement - Number(data.bookBalance || 0)).toFixed(2));
  }, [form.statementBalance, data.bookBalance]);

  const load = async (accountId: string, asOfDate: string, statementBalance?: string) => {
    const params = new URLSearchParams();
    params.set("companyAccountId", accountId);
    params.set("asOfDate", asOfDate);
    if (statementBalance && statementBalance.trim()) params.set("statementBalance", statementBalance.trim());
    const res = await fetch(`/api/reports/accounting/bank-reconciliation?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Failed to load reconciliation data.");
      return;
    }
    setData(json.data);
  };

  useEffect(() => {
    if (!form.companyAccountId) return;
    const timer = setTimeout(() => {
      startTransition(() => {
        load(form.companyAccountId, form.asOfDate, form.statementBalance);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [form.companyAccountId, form.asOfDate, form.statementBalance]);

  const saveSnapshot = async () => {
    if (!form.companyAccountId || !form.asOfDate || !form.statementBalance) {
      toast.error("Account, statement date, and statement balance are required.");
      return;
    }
    const statementBalance = Number(form.statementBalance);
    if (!Number.isFinite(statementBalance)) {
      toast.error("Statement balance must be a valid number.");
      return;
    }
    const res = await fetch("/api/reports/accounting/bank-reconciliation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyAccountId: form.companyAccountId,
        asOfDate: form.asOfDate,
        statementBalance,
        notes: form.notes || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Failed to save reconciliation snapshot.");
      return;
    }
    toast.success("Reconciliation snapshot saved.");
    setForm((prev) => ({ ...prev, notes: "" }));
    await load(form.companyAccountId, form.asOfDate, form.statementBalance);
    router.refresh();
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Reconciliation Workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Match statement balance with book balance and save month-end snapshots.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Cash/Bank Account</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.companyAccountId}
              onChange={(e) => setForm({ ...form, companyAccountId: e.target.value })}
            >
              {data.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Statement Date</Label>
            <Input
              type="date"
              value={form.asOfDate}
              onChange={(e) => setForm({ ...form, asOfDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Statement Closing Balance</Label>
            <Input
              type="number"
              step="0.01"
              value={form.statementBalance}
              onChange={(e) => setForm({ ...form, statementBalance: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Bank charges, uncleared cheques, etc."
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
            <div className="text-sm text-sky-700">Book Balance</div>
            <div className="text-xl font-semibold text-sky-800">{formatMoney(Number(data.bookBalance || 0))}</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="text-sm text-indigo-700">Statement Balance</div>
            <div className="text-xl font-semibold text-indigo-800">
              {form.statementBalance ? formatMoney(Number(form.statementBalance || 0)) : "-"}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <div className="text-sm text-amber-700">Difference</div>
            <div className="text-xl font-semibold text-amber-800">
              {computedDifference === null ? "-" : formatMoney(computedDifference)}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Button disabled={pending} onClick={() => startTransition(saveSnapshot)}>
            {pending ? "Saving..." : "Save Reconciliation Snapshot"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Recent Snapshots</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">As Of</th>
                <th className="py-2">Book</th>
                <th className="py-2">Statement</th>
                <th className="py-2">Difference</th>
                <th className="py-2">Status</th>
                <th className="py-2">By</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.snapshots.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{new Date(row.asOfDate).toLocaleDateString()}</td>
                  <td className="py-2">{formatMoney(Number(row.bookBalance))}</td>
                  <td className="py-2">{formatMoney(Number(row.statementBalance))}</td>
                  <td className="py-2">{formatMoney(Number(row.difference))}</td>
                  <td className="py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-2">{row.createdBy?.name || row.createdBy?.email || "-"}</td>
                  <td className="py-2">{row.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.snapshots.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No snapshots yet for this account.</div>
        ) : null}
      </div>
    </div>
  );
}
