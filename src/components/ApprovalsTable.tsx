"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import ApprovalActions from "@/components/ApprovalActions";
import ApprovalTableSection from "@/components/ApprovalTableSection";

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
      <ApprovalTableSection
        title="Pending Expenses"
        columns={["Date", "Description", "Amount", "Level", "Actions"]}
        rows={expenses}
        renderRow={(expense) => (
          <tr key={expense.id} className="border-b">
            <td className="py-2">{new Date(expense.date).toLocaleDateString()}</td>
            <td className="py-2">{expense.description}</td>
            <td className="py-2">{formatMoney(expense.amount)}</td>
            <td className="py-2">{expense.approvalLevel || "-"}</td>
            <td className="py-2">
              <ApprovalActions
                pending={pending}
                onApprove={() => submitApproval("EXPENSE", expense.id, "APPROVE")}
                onReject={() => handleReject("EXPENSE", expense.id)}
                onPartial={() => handlePartial(expense.id)}
              />
            </td>
          </tr>
        )}
      />

      <ApprovalTableSection
        title="Pending Income"
        columns={["Date", "Source", "Amount", "Level", "Actions"]}
        rows={income}
        renderRow={(entry) => (
          <tr key={entry.id} className="border-b">
            <td className="py-2">{new Date(entry.date).toLocaleDateString()}</td>
            <td className="py-2">{entry.source}</td>
            <td className="py-2">{formatMoney(entry.amount)}</td>
            <td className="py-2">{entry.approvalLevel || "-"}</td>
            <td className="py-2">
              <ApprovalActions
                pending={pending}
                onApprove={() => submitApproval("INCOME", entry.id, "APPROVE")}
                onReject={() => handleReject("INCOME", entry.id)}
              />
            </td>
          </tr>
        )}
      />
    </div>
  );
}
