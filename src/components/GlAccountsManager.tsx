"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type GlAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
  normalSide: string | null;
  isPosting: boolean;
  isActive: boolean;
  parent?: { id: string; code: string; name: string } | null;
};

export default function GlAccountsManager({
  initialAccounts,
  canManage,
}: {
  initialAccounts: GlAccount[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "ASSET",
    normalSide: "DEBIT",
  });
  const [search, setSearch] = useState("");

  const accounts = useMemo(() => {
    if (!search.trim()) return initialAccounts;
    const q = search.trim().toLowerCase();
    return initialAccounts.filter((a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [initialAccounts, search]);

  function createAccount(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/accounting/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to create account");
        toast.success("GL account created");
        setForm({ code: "", name: "", type: "ASSET", normalSide: "DEBIT" });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create account");
      }
    });
  }

  function toggleActive(account: GlAccount) {
    if (!canManage) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/accounting/accounts/${account.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !account.isActive }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to update account");
        toast.success(`Account ${account.isActive ? "deactivated" : "activated"}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update account");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code or name..."
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {canManage ? (
        <form onSubmit={createAccount} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-5">
            <input
              required
              placeholder="Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="rounded-md border px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-md border px-3 py-2 text-sm md:col-span-2"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option>ASSET</option>
              <option>LIABILITY</option>
              <option>EQUITY</option>
              <option>INCOME</option>
              <option>EXPENSE</option>
            </select>
            <div className="flex items-center gap-2">
              <select
                value={form.normalSide}
                onChange={(e) => setForm({ ...form, normalSide: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option>DEBIT</option>
                <option>CREDIT</option>
              </select>
              <button disabled={pending} className="rounded-md border px-3 py-2 text-sm font-medium">
                {pending ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Code</th>
                <th className="py-2">Name</th>
                <th className="py-2">Type</th>
                <th className="py-2">Normal</th>
                <th className="py-2">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id} className="border-b">
                  <td className="py-2 font-medium">{acc.code}</td>
                  <td className="py-2">{acc.name}</td>
                  <td className="py-2">{acc.type}</td>
                  <td className="py-2">{acc.normalSide || "-"}</td>
                  <td className="py-2">{acc.isActive ? "ACTIVE" : "INACTIVE"}</td>
                  <td className="py-2">
                    {canManage ? (
                      <button
                        disabled={pending}
                        onClick={() => toggleActive(acc)}
                        className="rounded-md border px-2 py-1 text-xs"
                      >
                        {acc.isActive ? "Deactivate" : "Activate"}
                      </button>
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
