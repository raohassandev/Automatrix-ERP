import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import { getPendingApprovalsForUser } from "@/lib/approval-engine";
import { prisma } from "@/lib/prisma";
import ApprovalQueue from "@/components/ApprovalQueue";
import { Expense, Income } from "@prisma/client";

export default async function ApprovalsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check if user can view approvals
  const canApprove = await requirePermission(session.user.id, "expenses.approve");
  if (!canApprove) {
    redirect("/dashboard?error=forbidden");
  }

  // Fetch pending approvals for this user using our approval engine
  const pendingApprovals = await getPendingApprovalsForUser(session.user.id);

  // Fetch employee wallet balances for each expense
  const expensesWithWalletInfo = await Promise.all(
    pendingApprovals.expenses.map(async (expense: any) => {
      const submitter = await prisma.user.findUnique({
        where: { id: expense.submittedById },
        select: { email: true },
      });
      
      const employee = submitter ? await prisma.employee.findUnique({
        where: { email: submitter.email },
        select: { walletBalance: true },
      }) : null;

      return {
        ...expense,
        currentWalletBalance: employee?.walletBalance ? parseFloat(employee.walletBalance.toString()) : 0,
      };
    })
  );

  // Combine expenses and income for display (income doesn't need wallet balance)
  const approvalsWithWalletInfo = [
    ...expensesWithWalletInfo,
    ...pendingApprovals.income.map((income: any) => ({
      ...income,
      currentWalletBalance: null, // Income doesn't affect wallet
    })),
  ];

  // Fetch recent approval history (last 10 approved/rejected)
  const recentHistoryRaw = await prisma.expense.findMany({
    where: {
      status: { in: ['APPROVED', 'REJECTED'] },
      approvedById: session.user.id,
    },
    include: {
      submittedBy: { select: { id: true, email: true, name: true } },
      approvedBy: { select: { id: true, email: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  // Convert Decimal to number for component compatibility
  const recentHistory = recentHistoryRaw.map((item) => ({
    ...item,
    amount: parseFloat(item.amount.toString()),
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="mt-2 text-muted-foreground">
            Review and approve expenses that require your authorization
          </p>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-card p-4 shadow">
            <div className="text-sm font-medium text-muted-foreground">Total Pending</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {approvalsWithWalletInfo.length}
            </div>
          </div>
          <div className="rounded-lg bg-card p-4 shadow">
            <div className="text-sm font-medium text-muted-foreground">Total Amount</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {formatMoney(
                approvalsWithWalletInfo.reduce(
                  (sum: number, exp: any) => sum + parseFloat(exp.amount.toString()),
                  0
                )
              )}
            </div>
          </div>
          <div className="rounded-lg bg-card p-4 shadow">
            <div className="text-sm font-medium text-muted-foreground">Requires Manager</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">
              {
                approvalsWithWalletInfo.filter(
                  (exp: any) => exp.requiredApprovalLevel === "MANAGER"
                ).length
              }
            </div>
          </div>
          <div className="rounded-lg bg-card p-4 shadow">
            <div className="text-sm font-medium text-muted-foreground">Requires CEO</div>
            <div className="mt-2 text-3xl font-bold text-red-600">
              {
                approvalsWithWalletInfo.filter(
                  (exp: any) => exp.requiredApprovalLevel === "CEO"
                ).length
              }
            </div>
          </div>
        </div>

        {/* Approval Queue with Bulk Operations */}
        <ApprovalQueue 
          approvals={approvalsWithWalletInfo}
          history={recentHistory}
        />
      </div>
    </div>
  );
}
