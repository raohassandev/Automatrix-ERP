"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";

type ExpenseRow = {
  id: string;
  date: string | Date;
  description: string;
  amount: number;
  approvalLevel?: string | null;
};

type IncomeRow = {
  id: string;
  date: string | Date;
  source: string;
  amount: number;
  approvalLevel?: string | null;
};

export default function ApprovalsTable({
  expenses,
  income,
}: {
  expenses: ExpenseRow[];
  income: IncomeRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function submitApproval(
    type: "EXPENSE" | "INCOME",
    id: string,
    action: "APPROVE" | "REJECT" | "PARTIAL",
    opts?: { approvedAmount?: number; reason?: string }
  ) {
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, action, ...opts }),
    });
    router.refresh();
  }

  function handleReject(type: "EXPENSE" | "INCOME", id: string) {
    const reason = window.prompt("Reason for rejection (optional):") || undefined;
    startTransition(() => submitApproval(type, id, "REJECT", { reason }));
  }

  function handlePartial(id: string) {
    const raw = window.prompt("Approved amount:");
    if (!raw) return;
    const amount = Number(raw);
    if (Number.isNaN(amount) || amount <= 0) {
      window.alert("Enter a valid amount.");
      return;
    }
    const reason = window.prompt("Reason for partial approval (optional):") || undefined;
    startTransition(() => submitApproval("EXPENSE", id, "PARTIAL", { approvedAmount: amount, reason }));
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Pending Expenses</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Date</th>
                <th className="py-2">Description</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Level</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b">
                  <td className="py-2">{new Date(expense.date).toLocaleDateString()}</td>
                  <td className="py-2">{expense.description}</td>
                  <td className="py-2">{formatMoney(expense.amount)}</td>
                  <td className="py-2">{expense.approvalLevel || "-"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-md bg-black px-3 py-1 text-white"
                        disabled={pending}
                        onClick={() => startTransition(() => submitApproval("EXPENSE", expense.id, "APPROVE"))}
                      >
                        Approve
                      </button>
                      <button
                        className="rounded-md border px-3 py-1"
                        disabled={pending}
                        onClick={() => handleReject("EXPENSE", expense.id)}
                      >
                        Reject
                      </button>
                      <button
                        className="rounded-md border px-3 py-1"
                        disabled={pending}
                        onClick={() => handlePartial(expense.id)}
                      >
                        Partial
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Pending Income</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Date</th>
                <th className="py-2">Source</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Level</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {income.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-2">{entry.source}</td>
                  <td className="py-2">{formatMoney(entry.amount)}</td>
                  <td className="py-2">{entry.approvalLevel || "-"}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        className="rounded-md bg-black px-3 py-1 text-white"
                        disabled={pending}
                        onClick={() => startTransition(() => submitApproval("INCOME", entry.id, "APPROVE"))}
                      >
                        Approve
                      </button>
                      <button
                        className="rounded-md border px-3 py-1"
                        disabled={pending}
                        onClick={() => handleReject("INCOME", entry.id)}
                      >
                        Reject
                      </button>
                    </div>
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
