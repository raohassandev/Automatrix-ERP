"use client";

import { formatMoney } from "@/lib/format";
import ApprovalActions from "@/components/ApprovalActions";
import ApprovalTableSection from "@/components/ApprovalTableSection";

type ExpenseRow = {
  id: string;
  date: string | Date;
  description: string;
  amount: number;
  approvalLevel?: string | null;
  status?: string; // Add status to ExpenseRow
};

type IncomeRow = {
  id: string;
  date: string | Date;
  source: string;
  amount: number;
  approvalLevel?: string | null;
  status?: string; // Add status to IncomeRow
};

export default function ApprovalsTable({
  expenses,
  income,
}: {
  expenses: ExpenseRow[];
  income: IncomeRow[];
}) {
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
                expenseId={expense.id}
                amount={expense.amount}
                employeeName="Unknown" // Placeholder
                currentBalance={0} // Placeholder
                afterBalance={0} // Placeholder
                status={expense.status || "PENDING"} // Ensure status is passed
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
                expenseId={entry.id}
                amount={entry.amount}
                employeeName="Unknown" // Placeholder
                currentBalance={0} // Placeholder
                afterBalance={0} // Placeholder
                status={entry.status || "PENDING"} // Ensure status is passed
              />
            </td>
          </tr>
        )}
      />
    </div>
  );
}
