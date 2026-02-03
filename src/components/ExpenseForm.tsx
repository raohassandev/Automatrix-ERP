"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import CategoryAutoComplete from "./CategoryAutoComplete";
import PaymentModeAutoComplete from "./PaymentModeAutoComplete";
import ProjectAutoComplete from "./ProjectAutoComplete";

type DuplicateExpense = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
};

export default function ExpenseForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    date: "",
    description: "",
    category: "",
    amount: "",
    paymentMode: "",
    paymentSource: "COMPANY_DIRECT" as "EMPLOYEE_WALLET" | "COMPANY_DIRECT" | "COMPANY_ACCOUNT",
    project: "",
    receiptUrl: "",
    receiptFileId: "",
  });
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateItems, setDuplicateItems] = useState<DuplicateExpense[]>([]);

  async function submit(ignoreDuplicate = false) {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        description: form.description,
        category: form.category,
        amount: parseFloat(form.amount),
        paymentMode: form.paymentMode,
        paymentSource: form.paymentSource,
        project: form.project || undefined,
        receiptUrl: form.receiptUrl || undefined,
        receiptFileId: form.receiptFileId || undefined,
        ignoreDuplicate,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      if (data.requiresConfirmation && data.duplicates) {
        setDuplicateItems(data.duplicates);
        setDuplicateModalOpen(true);
        return;
      }
      alert(data.error || "Failed to submit expense");
      return;
    }

    alert("Expense submitted successfully!");
    setForm({
      date: "",
      description: "",
      category: "",
      amount: "",
      paymentMode: "",
      paymentSource: "COMPANY_DIRECT",
      project: "",
      receiptUrl: "",
      receiptFileId: "",
    });
    router.refresh();
  }

  function renderDuplicates(): React.ReactNode {
    if (duplicateItems.length === 0) {
      return null; // Explicitly return null if no duplicates
    }

    return (
      <div className="mt-3 space-y-2 text-sm">
        {duplicateItems.map((dup) => (
          <div key={dup.id} className="rounded-md border px-3 py-2">
            <div className="font-medium">{dup.description}</div>
            <div className="text-gray-600">
              {new Date(dup.date).toLocaleDateString()} · {dup.amount} · {dup.status}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Submit Expense</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border px-3 py-2"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <CategoryAutoComplete
          value={form.category}
          onChange={(value) => setForm({ ...form, category: value })}
        />
        <PaymentModeAutoComplete
          value={form.paymentMode}
          onChange={(value) => setForm({ ...form, paymentMode: value })}
        />
        <select
          className="rounded-md border px-3 py-2"
          value={form.paymentSource}
          onChange={(e) => setForm({ ...form, paymentSource: e.target.value as "EMPLOYEE_WALLET" | "COMPANY_DIRECT" | "COMPANY_ACCOUNT" })}
        >
          <option value="COMPANY_DIRECT">Company Paid (Direct)</option>
          <option value="COMPANY_ACCOUNT">Company Paid (Account)</option>
          <option value="EMPLOYEE_WALLET">Employee Wallet</option>
        </select>
        <ProjectAutoComplete
          value={form.project}
          onChange={(value) => setForm({ ...form, project: value })}
          placeholder="Select project (optional)"
        />
        <input
          className="rounded-md border px-3 py-2 md:col-span-2"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
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
        onClick={() => startTransition(() => submit())}
        disabled={pending}
      >
        {pending ? "Submitting..." : "Submit"}
      </button>

      <Modal
        open={duplicateModalOpen}
        title="Possible duplicate expense"
        onClose={() => setDuplicateModalOpen(false)}
      >
        <p className="text-sm text-gray-600">
          We found similar expenses you submitted recently. Review them below.
        </p>
        {renderDuplicates()}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-md border px-4 py-2"
            onClick={() => setDuplicateModalOpen(false)}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-black px-4 py-2 text-white"
            onClick={() => {
              setDuplicateModalOpen(false);
              startTransition(() => submit(true));
            }}
          >
            Submit anyway
          </button>
        </div>
      </Modal>
    </div>
  );
}
