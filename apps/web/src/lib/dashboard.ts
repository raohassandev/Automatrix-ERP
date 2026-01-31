import { prisma } from "./prisma";
import { auth } from "./auth";

export async function getChartData() {
  // Development bypass: return mock data if no database
  const session = await auth();
  if (process.env.NODE_ENV === 'development' && session?.user?.id === 'dev-admin-id') {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear();
    }).reverse();
    
    return months.map((name, i) => ({
      name,
      income: Math.floor(Math.random() * 20000) + 10000,
      expense: Math.floor(Math.random() * 15000) + 5000,
    }));
  }

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

export async function getDashboardDataEnhanced(dateRange = 'THIS_MONTH', customStartDate: Date | null = null, customEndDate: Date | null = null) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  // Development bypass: return mock data if no database
  if (process.env.NODE_ENV === 'development' && userId === 'dev-admin-id') {
    return {
      totalIncome: 150000,
      totalExpenses: 85000,
      netProfit: 65000,
      pendingApprovals: 5,
      pendingRecovery: 12000,
      lowStockCount: 3,
      approvedExpenses: 75000,
      rejectedExpenses: 5000,
      expenseCount: 42,
      incomeCount: 18,
      profitMargin: 43.33,
      walletBalance: 25000,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user || !user.email) {
    return null;
  }

  const employee = await prisma.employee.findUnique({
    where: { email: user.email },
    select: { walletBalance: true },
  });

  // Calculate date range based on filter
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (customStartDate && customEndDate) {
    startDate = customStartDate;
    endDate = customEndDate;
  } else {
    const now = new Date();
    switch (dateRange) {
      case 'TODAY':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'THIS_WEEK':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59);
        break;
      case 'THIS_MONTH':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'THIS_QUARTER':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
        break;
      case 'THIS_YEAR':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case 'ALL_TIME':
      default:
        // No date filtering
        break;
    }
  }

  // Build date filter for queries
  const dateFilter = startDate && endDate ? {
    date: {
      gte: startDate,
      lte: endDate,
    },
  } : {};

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
  ] = await Promise.all([
    prisma.expense.aggregate({ 
      _sum: { amount: true },
      where: dateFilter,
    }),
    prisma.income.aggregate({ 
      _sum: { amount: true },
      where: dateFilter,
    }),
    prisma.expense.count({ 
      where: { 
        status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] },
        ...dateFilter,
      } 
    }),
    prisma.income.count({ 
      where: { 
        status: "PENDING",
        ...dateFilter,
      } 
    }),
    prisma.inventoryItem.findMany({
      where: { minStock: { gt: 0 } },
      select: { quantity: true, minStock: true },
    }),
    prisma.project.aggregate({ _sum: { pendingRecovery: true } }),
    prisma.expense.aggregate({ 
      where: { 
        status: "APPROVED",
        ...dateFilter,
      }, 
      _sum: { amount: true } 
    }),
    prisma.expense.aggregate({ 
      where: { 
        status: "REJECTED",
        ...dateFilter,
      }, 
      _sum: { amount: true } 
    }),
    prisma.expense.count({ where: dateFilter }),
    prisma.income.count({ where: dateFilter }),
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
  const walletBalance = Number(employee?.walletBalance || 0);


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
  // Development bypass: return mock data if no database
  const session = await auth();
  if (process.env.NODE_ENV === 'development' && session?.user?.id === 'dev-admin-id') {
    return [
      { name: 'Salaries', value: 45000 },
      { name: 'Office Supplies', value: 12000 },
      { name: 'Travel', value: 8000 },
      { name: 'Marketing', value: 15000 },
      { name: 'Utilities', value: 5000 },
    ];
  }

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
  // Development bypass: return mock data if no database
  const session = await auth();
  if (process.env.NODE_ENV === 'development' && session?.user?.id === 'dev-admin-id') {
    return [
      { name: 'Project Alpha', profit: 25000, income: 50000, expense: 25000 },
      { name: 'Project Beta', profit: 15000, income: 40000, expense: 25000 },
      { name: 'Project Gamma', profit: -5000, income: 20000, expense: 25000 },
    ];
  }

  const projects = await prisma.project.findMany(); // Fetch projects first

  const projectData = await Promise.all(
    projects.map(async (project) => {
      const incomes = await prisma.income.aggregate({
        _sum: { amount: true },
        where: { project: project.name, status: 'APPROVED' },
      });
      const expenses = await prisma.expense.aggregate({
        _sum: { amount: true },
        where: { project: project.name, status: 'APPROVED' },
      });

      const totalIncome = Number(incomes._sum.amount || 0);
      const totalExpense = Number(expenses._sum.amount || 0);

      return {
        name: project.name,
        profit: totalIncome - totalExpense,
        income: totalIncome,
        expense: totalExpense,
      };
    })
  );
  return projectData;
}

export async function getWalletBalanceData() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return [];
  }

  // Development bypass: return mock data if no database
  if (process.env.NODE_ENV === 'development' && userId === 'dev-admin-id') {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return {
        date: d.toLocaleDateString(),
        balance: 20000 + Math.floor(Math.random() * 10000),
      };
    });
    return last30Days;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    return [];
  }

  const employee = await prisma.employee.findUnique({
    where: { email: user.email },
    include: {
      wallets: {
        orderBy: {
          date: 'asc',
        },
        take: 100,
      },
    },
  });

  if (!employee || !employee.wallets) {
    return [];
  }

  return employee.wallets.map((entry) => ({
    date: new Date(entry.date).toLocaleDateString(),
    balance: Number(entry.balance),
  }));
}
