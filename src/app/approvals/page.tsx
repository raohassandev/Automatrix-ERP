import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import { getPendingApprovalsForUser } from "@/lib/approval-engine";
import { prisma } from "@/lib/prisma";
import ApprovalQueue from "@/components/ApprovalQueue";
import { Expense, Income } from "@prisma/client";

// Types matching ApprovalQueue component expectations
interface Approval {
  id: string;
  date: Date;
  category: string;
  description: string;
  remarks?: string | null;
  categoryRequest?: string | null;
  amount: number | string;
  project?: string;
  submittedBy: { id: string; email: string; name?: string | null };
  walletBalance: number | string;
  walletHold: number | string;
  categoryLimit?: number | null;
  categoryStrict?: boolean;
  requiredApprovalLevel: string;
  status: string;
}

interface HistoryItem {
  id: string;
  date: Date;
  category: string;
  amount: number | string;
  status: string;
  submittedBy: { email: string; name?: string | null };
  approvedBy: { email: string; name?: string | null } | null;
  updatedAt: Date;
}

export default async function ApprovalsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check if user can view approvals
  const canApprove =
    (await requirePermission(session.user.id, "expenses.approve_low")) ||
    (await requirePermission(session.user.id, "expenses.approve_medium")) ||
    (await requirePermission(session.user.id, "expenses.approve_high")) ||
    (await requirePermission(session.user.id, "approvals.approve_low")) ||
    (await requirePermission(session.user.id, "approvals.approve_high")) ||
    (await requirePermission(session.user.id, "approvals.partial_approve"));
  if (!canApprove) {
    redirect("/dashboard?error=forbidden");
  }

  let approvalsWithWalletInfo: Approval[] = [];
  let recentHistory: HistoryItem[] = [];

  try {
    const expenseCategories = await prisma.category.findMany({
      where: { type: "expense" },
      select: { name: true, maxAmount: true, enforceStrict: true },
    });
    const categoryMap = new Map(
      expenseCategories.map((cat) => [cat.name, { maxAmount: cat.maxAmount, enforceStrict: cat.enforceStrict }])
    );

    // Fetch pending approvals for this user using our approval engine
    const pendingApprovals = await getPendingApprovalsForUser(session.user.id);

    // Fetch employee wallet balances for each expense
    const expensesWithWalletInfo = await Promise.all(
      pendingApprovals.expenses.map(async (expense: Expense) => {
        const submitter = await prisma.user.findUnique({
          where: { id: expense.submittedById },
          select: { email: true },
        });
        
        const employee = submitter ? await prisma.employee.findUnique({
          where: { email: submitter.email },
          select: { walletBalance: true, walletHold: true },
        }) : null;
        const categoryMeta = categoryMap.get(expense.category);

          return {
            id: expense.id,
            date: expense.date,
            category: expense.category,
            description: expense.description,
            remarks: expense.remarks,
            categoryRequest: expense.categoryRequest,
            amount: parseFloat(expense.amount.toString()),
            project: expense.project || undefined,
            submittedBy: { 
              id: expense.submittedById, 
              email: submitter?.email || '', 
              name: submitter?.email?.split('@')[0] || null 
            },
          walletBalance: employee?.walletBalance ? parseFloat(employee.walletBalance.toString()) : 0,
          walletHold: employee?.walletHold ? parseFloat(employee.walletHold.toString()) : 0,
          categoryLimit: categoryMeta?.maxAmount ? parseFloat(categoryMeta.maxAmount.toString()) : null,
          categoryStrict: categoryMeta?.enforceStrict || false,
          requiredApprovalLevel: 'MANAGER', // This should come from approval logic
          status: expense.status,
        };
      })
    );

    // Combine expenses and income for display (income doesn't need wallet balance)
    const incomeApprovals = pendingApprovals.income.map((income: Income) => ({
      id: income.id,
      date: income.date,
      category: income.category,
      description: income.source, // Use source as description for income
      remarks: null,
      categoryRequest: null,
      amount: parseFloat(income.amount.toString()),
      project: income.project || undefined,
      submittedBy: { 
        id: income.addedById, 
        email: 'income@example.com', // This should be fetched from user
        name: 'Income User' 
      },
      walletBalance: 0,
      walletHold: 0,
      categoryLimit: null,
      categoryStrict: false,
      requiredApprovalLevel: 'MANAGER',
      status: income.status,
    }));

    approvalsWithWalletInfo = [
      ...expensesWithWalletInfo,
      ...incomeApprovals,
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

    // Convert to HistoryItem format for component compatibility
    recentHistory = recentHistoryRaw.map((item) => ({
      id: item.id,
      date: item.date,
      category: item.category,
      amount: parseFloat(item.amount.toString()),
      status: item.status,
      submittedBy: { 
        email: item.submittedBy?.email || '', 
        name: item.submittedBy?.name || null 
      },
      approvedBy: item.approvedBy ? {
        email: item.approvedBy.email || '',
        name: item.approvedBy.name || null
      } : null,
      updatedAt: item.updatedAt,
    }));
  } catch (error) {
    console.error("Error fetching approvals data:", error);
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border bg-card p-8 shadow-sm">
            <h1 className="text-3xl font-bold text-foreground">Pending Approvals</h1>
            <p className="mt-2 text-muted-foreground">Error loading approvals data. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Pending Approvals</h1>
          <p className="mt-2 text-muted-foreground">
            Review and approve expenses that require your authorization
          </p>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-card p-4 shadow">
            <div className="text-sm font-medium text-muted-foreground">Total Pending</div>
            <div className="mt-2 text-3xl font-bold text-foreground">
              {approvalsWithWalletInfo.length}
            </div>
          </div>
          <div className="rounded-lg bg-card p-4 shadow">
            <div className="text-sm font-medium text-muted-foreground">Total Amount</div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {formatMoney(
                approvalsWithWalletInfo.reduce(
                  (sum: number, exp: Approval) => sum + Number(exp.amount),
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
                  (exp: Approval) => exp.requiredApprovalLevel === "MANAGER"
                ).length
              }
            </div>
          </div>
          <div className="rounded-lg bg-card p-4 shadow">
            <div className="text-sm font-medium text-muted-foreground">Requires CEO</div>
            <div className="mt-2 text-3xl font-bold text-red-600">
              {
                approvalsWithWalletInfo.filter(
                  (exp: Approval) => exp.requiredApprovalLevel === "CEO"
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
