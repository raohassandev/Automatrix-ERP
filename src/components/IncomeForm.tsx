"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import IncomeSourceAutoComplete from "./IncomeSourceAutoComplete";
import PaymentModeAutoComplete from "./PaymentModeAutoComplete";
import ProjectAutoComplete from "./ProjectAutoComplete";
import { ProjectFormDialog } from "./ProjectFormDialog";
import { toast } from "sonner";

export default function IncomeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [invoices, setInvoices] = useState<Array<{ id: string; invoiceNo: string; projectId: string; outstandingAmount: number }>>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    source: "",
    category: "",
    amount: "",
    paymentMode: "",
    companyAccountId: "",
    project: "",
    receiptUrl: "",
    receiptFileId: "",
    invoiceId: "",
  });

  useEffect(() => {
    fetch("/api/company-accounts")
      .then((r) => r.json())
      .then((json) => setAccounts(Array.isArray(json?.data) ? json.data : []))
      .catch(() => {});
    fetch("/api/invoices/outstanding")
      .then((r) => r.json())
      .then((json) => setInvoices(Array.isArray(json?.data) ? json.data : []))
      .catch(() => {});
  }, []);

  async function submit() {
    if (!form.date || !form.source.trim() || !form.category.trim() || !form.paymentMode.trim()) {
      toast.error("Date, source, category, and payment mode are required.");
      return;
    }
    if (!form.companyAccountId) {
      toast.error("Company account is required.");
      return;
    }
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }
    const res = await fetch("/api/income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        receiptUrl: form.receiptUrl || undefined,
        receiptFileId: form.receiptFileId || undefined,
        invoiceId: form.invoiceId || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(data?.error || "Failed to log income.");
      return;
    }

    if (res.ok) {
      toast.success("Income logged successfully.");
      setForm({
        date: new Date().toISOString().slice(0, 10),
        source: "",
        category: "",
        amount: "",
        paymentMode: "",
        companyAccountId: "",
        project: "",
        receiptUrl: "",
        receiptFileId: "",
        invoiceId: "",
      });
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Log Income</h2>
      <div className="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        For invoice receipt, pick invoice from dropdown. System prevents over-receiving.
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border px-3 py-2"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <IncomeSourceAutoComplete
          value={form.source}
          onChange={(value) => setForm({ ...form, source: value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <PaymentModeAutoComplete
          value={form.paymentMode}
          onChange={(value) => setForm({ ...form, paymentMode: value })}
        />
        <select
          className="rounded-md border px-3 py-2"
          value={form.companyAccountId}
          onChange={(e) => setForm({ ...form, companyAccountId: e.target.value })}
        >
          <option value="">Select company account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.type})
            </option>
          ))}
        </select>
        <ProjectAutoComplete
          value={form.project}
          onChange={(value) => setForm({ ...form, project: value })}
          placeholder="Select project (optional)"
          refreshKey={projectRefreshKey}
        />
        <button
          type="button"
          className="rounded-md border px-3 py-2"
          onClick={() => setProjectDialogOpen(true)}
        >
          Create Project
        </button>
        <select
          className="rounded-md border px-3 py-2"
          value={form.invoiceId}
          onChange={(e) => {
            const invoiceId = e.target.value;
            const selected = invoices.find((row) => row.id === invoiceId);
            setForm((prev) => ({
              ...prev,
              invoiceId,
              project: prev.project || selected?.projectId || "",
            }));
          }}
        >
          <option value="">Select outstanding invoice (optional)</option>
          {invoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.invoiceNo} | {invoice.projectId} | Outstanding PKR {invoice.outstandingAmount.toLocaleString()}
            </option>
          ))}
        </select>
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Amount"
          type="number"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Receipt URL"
          value={form.receiptUrl}
          onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2 md:col-span-2"
          placeholder="Receipt File ID (optional)"
          value={form.receiptFileId}
          onChange={(e) => setForm({ ...form, receiptFileId: e.target.value })}
        />
      </div>
      <button
        className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        onClick={() => startTransition(submit)}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </button>
      <ProjectFormDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onCreated={() => setProjectRefreshKey((prev) => prev + 1)}
      />
    </div>
  );
}
