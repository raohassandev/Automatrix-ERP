"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import CategoryAutoComplete from "./CategoryAutoComplete";
import PaymentModeAutoComplete from "./PaymentModeAutoComplete"; // Import the new component

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
    project: "",
    receiptUrl: "",
    receiptFileId: "",
  });
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateItems, setDuplicateItems] = useState<DuplicateExpense[]>([]);

  async function submit(ignoreDuplicate = false) {
    // ... (rest of the submit function)
  }

  function renderDuplicates(): React.ReactNode {
    // ... (rest of the renderDuplicates function)
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
        <input
          className="rounded-md border px-3 py-2"
          placeholder="Project"
          value={form.project}
          onChange={(e) => setForm({ ...form, project: e.target.value })}
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
