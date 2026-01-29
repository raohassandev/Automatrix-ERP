import { prisma } from "./prisma";
import { auth } from "./auth";

export async function getChartData() {
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      year: d.getFullYear(),
      startDate: new Date(d.getFullYear(), d.getMonth(), 1),
      endDate: new Date(d.getFullYear(), d.getMonth() + 1, 0),
    };
  }).reverse();

  const data = await Promise.all(
    months.map(async (m) => {
      const income = await prisma.income.aggregate({
        _sum: { amount: true },
        where: {
          date: {
            gte: m.startDate,
            lte: m.endDate,
          },
        },
      });
      const expense = await prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          date: {
            gte: m.startDate,
            lte: m.endDate,
          },
        },
      });
      return {
        name: `${m.month} ${m.year}`,
        income: Number(income._sum.amount || 0),
        expense: Number(expense._sum.amount || 0),
      };
    })
  );

  return data;
}

export async function getDashboardDataEnhanced(dateRange = 'THIS_MONTH', customStartDate = null, customEndDate = null) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  // TODO: Implement date range logic
  const [
    expenseSum,
    incomeSum,
    pendingExpenses,
    pendingIncome,
    inventoryItems,
    pendingRecoverySum,
    approvedExpensesSum,
    rejectedExpensesSum,
    expenseCount,
    incomeCount,
    user,
  ] = await Promise.all([
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.income.aggregate({ _sum: { amount: true } }),
    prisma.expense.count({ where: { status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] } } }),
    prisma.income.count({ where: { status: "PENDING" } }),
    prisma.inventoryItem.findMany({
      where: { minStock: { gt: 0 } },
      select: { quantity: true, minStock: true },
    }),
    prisma.project.aggregate({ _sum: { pendingRecovery: true } }),
    prisma.expense.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { status: "REJECTED" }, _sum: { amount: true } }),
    prisma.expense.count(),
    prisma.income.count(),
    prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } }),
  ]);

  const totalExpenses = Number(expenseSum._sum.amount || 0);
  const totalIncome = Number(incomeSum._sum.amount || 0);
  const netProfit = totalIncome - totalExpenses;
  const lowStockCount = inventoryItems.filter(
    (item) => Number(item.quantity) <= Number(item.minStock)
  ).length;
  const pendingRecovery = Number(pendingRecoverySum._sum.pendingRecovery || 0);
  const approvedExpenses = Number(approvedExpensesSum._sum.amount || 0);
  const rejectedExpenses = Number(rejectedExpensesSum._sum.amount || 0);
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
  const walletBalance = Number(user?.walletBalance || 0);


  return {
    totalIncome,
    totalExpenses,
    netProfit,
    pendingApprovals: pendingExpenses + pendingIncome,
    pendingRecovery,
    lowStockCount,
    approvedExpenses,
    rejectedExpenses,
    expenseCount,
    incomeCount,
    profitMargin,
    walletBalance,
  };
}

export async function getExpenseByCategoryData() {
  const data = await prisma.expense.groupBy({
    by: ['category'],
    _sum: {
      amount: true,
    },
  });

  return data.map((item) => ({
    name: item.category,
    value: Number(item._sum.amount),
  }));
}

export async function getProjectProfitabilityData() {
  const projects = await prisma.project.findMany({
    include: {
      incomes: {
        where: { status: 'APPROVED' },
      },
      expenses: {
        where: { status: 'APPROVED' },
      },
    },
  });

  return projects.map((project) => {
    const totalIncome = project.incomes.reduce(
      (sum, income) => sum + Number(income.amount),
      0
    );
    const totalExpense = project.expenses.reduce(
      (sum, expense) => sum + Number(expense.amount),
      0
    );
    return {
      name: project.name,
      profit: totalIncome - totalExpense,
      income: totalIncome,
      expense: totalExpense,
    };
  });
}

export async function getWalletBalanceData() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return [];
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: {
        include: {
          walletLedger: {
            orderBy: {
              date: 'asc',
            },
            take: 100,
          },
        },
      },
    },
  });

  if (!user?.employee) {
    return [];
  }

  return user.employee.walletLedger.map((entry) => ({
    date: new Date(entry.date).toLocaleDateString(),
    balance: Number(entry.balance),
  }));
}
