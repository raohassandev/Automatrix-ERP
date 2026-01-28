"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function IncomeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    date: "",
    source: "",
    category: "",
    amount: "",
    paymentMode: "",
    project: "",
    receiptUrl: "",
    receiptFileId: "",
    invoiceId: "",
  });

  async function submit() {
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

    if (res.ok) {
      setForm({
        date: "",
        source: "",
        category: "",
        amount: "",
        paymentMode: "",
        project: "",
        receiptUrl: "",
        receiptFileId: "",
        invoiceId: "",
      });
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Log Income</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border px-3 py-2"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Source"
          value={form.source}
          onChange={(e) => setForm({ ...form, source: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Payment Mode"
          value={form.paymentMode}
          onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Project"
          value={form.project}
          onChange={(e) => setForm({ ...form, project: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Invoice ID"
          value={form.invoiceId}
          onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
        />
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
        className="mt-4 rounded-md bg-black px-4 py-2 text-white"
        onClick={() => startTransition(submit)}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
