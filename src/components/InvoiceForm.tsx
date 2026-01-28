"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function InvoiceForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    invoiceNo: "",
    projectId: "",
    date: "",
    amount: "",
    dueDate: "",
    status: "DRAFT",
    notes: "",
  });

  async function submit() {
    await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
      }),
    });
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Create Invoice</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Invoice No"
          value={form.invoiceNo}
          onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Project ID"
          value={form.projectId}
          onChange={(e) => setForm({ ...form, projectId: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2"
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
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
          placeholder="Status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        />
        <input
          className="rounded-md border px-3 py-2 md:col-span-2"
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
