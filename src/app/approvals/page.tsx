import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ApprovalsTable from "@/components/ApprovalsTable";
import { getUserRoleName } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { canApproveExpense, canApproveIncome, isPendingExpenseStatus, isPendingIncomeStatus } from "@/lib/approvals";

export default async function ApprovalsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
      return (
      redirect("/login")
      );
    }

  const role = await getUserRoleName(userId);

  const [pendingExpenses, pendingIncome] = await Promise.all([
    prisma.expense.findMany({
      where: { status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.income.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const expenseList = pendingExpenses
    .filter((expense) => isPendingExpenseStatus(expense.status) && canApproveExpense(role, Number(expense.amount)))
    .map((expense) => ({
      id: expense.id,
      date: expense.date,
      description: expense.description,
      amount: Number(expense.amount),
      approvalLevel: expense.approvalLevel,
    }));

  const incomeList = pendingIncome
    .filter((entry) => isPendingIncomeStatus(entry.status) && canApproveIncome(role, Number(entry.amount)))
    .map((entry) => ({
      id: entry.id,
      date: entry.date,
      source: entry.source,
      amount: Number(entry.amount),
      approvalLevel: entry.approvalLevel,
    }));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="mt-2 text-gray-600">Pending items awaiting your action.</p>
      </div>
      <ApprovalsTable expenses={expenseList} income={incomeList} />
    </div>
  );
}
