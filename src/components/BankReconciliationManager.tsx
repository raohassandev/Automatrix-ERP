"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
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

type StatementLine = {
  id: string;
  statementDate: string;
  description: string | null;
  reference: string | null;
  debit: number;
  credit: number;
  amount: number;
  runningBalance: number | null;
  status: string;
  matchedSourceType: string | null;
  matchedSourceId: string | null;
};

type Dataset = {
  accounts: Account[];
  selectedAccountId: string | null;
  asOfDate: string;
  bookBalance: number;
  statementBalance: number | null;
  difference: number | null;
  canManage: boolean;
  statementLines: StatementLine[];
  exceptionCount: number;
  matchedCount: number;
  excludedCount: number;
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
  const [file, setFile] = useState<File | null>(null);

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
    setData((prev) => ({
      ...json.data,
      canManage: prev.canManage,
      statementLines: (json.data.statementLines || []).map((row: StatementLine) => ({
        ...row,
        debit: Number((row as unknown as { debit: number | string }).debit || 0),
        credit: Number((row as unknown as { credit: number | string }).credit || 0),
        amount: Number((row as unknown as { amount: number | string }).amount || 0),
        runningBalance:
          (row as unknown as { runningBalance: number | string | null }).runningBalance === null
            ? null
            : Number((row as unknown as { runningBalance: number | string | null }).runningBalance || 0),
      })),
    }));
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

  const importStatement = async () => {
    if (!file || !form.companyAccountId) {
      toast.error("Select account and statement file first.");
      return;
    }
    const body = new FormData();
    body.append("companyAccountId", form.companyAccountId);
    body.append("file", file);
    const res = await fetch("/api/reports/accounting/bank-reconciliation/import", {
      method: "POST",
      body,
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Statement import failed.");
      return;
    }
    toast.success(`Imported ${json.data.importedRows} statement lines.`);
    setFile(null);
    await load(form.companyAccountId, form.asOfDate, form.statementBalance);
    router.refresh();
  };

  const runAutoMatch = async () => {
    if (!form.companyAccountId) {
      toast.error("Select account first.");
      return;
    }
    const res = await fetch("/api/reports/accounting/bank-reconciliation/auto-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyAccountId: form.companyAccountId, asOfDate: form.asOfDate }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Auto-match failed.");
      return;
    }
    toast.success(`Auto-match complete. Matched ${json.data.matched} lines.`);
    await load(form.companyAccountId, form.asOfDate, form.statementBalance);
    router.refresh();
  };

  const closeReconciliation = async (forceClose: boolean) => {
    if (!form.companyAccountId || !form.statementBalance) {
      toast.error("Account and statement balance are required.");
      return;
    }
    const res = await fetch("/api/reports/accounting/bank-reconciliation/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyAccountId: form.companyAccountId,
        asOfDate: form.asOfDate,
        statementBalance: Number(form.statementBalance),
        notes: form.notes || undefined,
        forceClose,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Close failed.");
      return;
    }
    toast.success(`Reconciliation closed: ${json.data.status}`);
    await load(form.companyAccountId, form.asOfDate, form.statementBalance);
    router.refresh();
  };

  const updateLine = async (lineId: string, action: "EXCLUDE" | "UNMATCH") => {
    const res = await fetch(`/api/reports/accounting/bank-reconciliation/line/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Line update failed.");
      return;
    }
    toast.success("Line updated.");
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
            <DateField
              value={form.asOfDate}
              onChange={(value) => setForm({ ...form, asOfDate: value })}
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
        {data.canManage ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Import Statement (CSV/XLSX)</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" disabled={pending || !file} onClick={() => startTransition(importStatement)}>
                {pending ? "Importing..." : "Import Statement"}
              </Button>
            </div>
            <div className="flex items-end">
              <Button variant="outline" disabled={pending} onClick={() => startTransition(runAutoMatch)}>
                {pending ? "Matching..." : "Auto Match"}
              </Button>
            </div>
          </div>
        ) : null}

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
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4">
            <div className="text-sm text-rose-700">Exceptions (Unmatched)</div>
            <div className="text-xl font-semibold text-rose-800">{data.exceptionCount}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="text-sm text-emerald-700">Matched</div>
            <div className="text-xl font-semibold text-emerald-800">{data.matchedCount}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-sm text-slate-700">Excluded</div>
            <div className="text-xl font-semibold text-slate-800">{data.excludedCount}</div>
          </div>
        </div>

        {data.canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => startTransition(saveSnapshot)}>
              {pending ? "Saving..." : "Save Snapshot"}
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => startTransition(() => closeReconciliation(false))}>
              Close Reconciliation
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => startTransition(() => closeReconciliation(true))}>
              Force Close
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Statement Lines and Exceptions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Description</th>
                <th className="py-2">Reference</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2">Matched Source</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.statementLines.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{new Date(row.statementDate).toLocaleDateString()}</td>
                  <td className="py-2">{row.description || "-"}</td>
                  <td className="py-2">{row.reference || "-"}</td>
                  <td className="py-2">{formatMoney(Number(row.amount || 0))}</td>
                  <td className="py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-2">
                    {row.matchedSourceType && row.matchedSourceId
                      ? `${row.matchedSourceType}:${row.matchedSourceId}`
                      : "-"}
                  </td>
                  <td className="py-2">
                    {data.canManage ? (
                      <div className="flex flex-wrap gap-2">
                        {row.status === "UNMATCHED" ? (
                          <Button size="sm" variant="outline" onClick={() => startTransition(() => updateLine(row.id, "EXCLUDE"))}>
                            Exclude
                          </Button>
                        ) : null}
                        {row.status !== "UNMATCHED" ? (
                          <Button size="sm" variant="outline" onClick={() => startTransition(() => updateLine(row.id, "UNMATCH"))}>
                            Unmatch
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.statementLines.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No statement lines available.</div>
        ) : null}
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
