import { prisma } from "./prisma";
import { auth } from "./auth";
import { requirePermission } from "./rbac";

async function getDashboardAccess() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const canViewDashboard = await requirePermission(userId, "dashboard.view");
  if (!canViewDashboard) return null;

  const canViewAllMetrics = await requirePermission(userId, "dashboard.view_all_metrics");
  const canViewInventory = await requirePermission(userId, "inventory.view");
  const canViewWallet =
    (await requirePermission(userId, "employees.view_all")) ||
    (await requirePermission(userId, "employees.view_own"));

  return {
    userId,
    canViewAllMetrics,
    canViewInventory,
    canViewWallet,
  };
}

export async function getChartData() {
  const access = await getDashboardAccess();
  if (!access) return [];

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
      const incomeWhere = access.canViewAllMetrics ? {} : { addedById: access.userId };
      const expenseWhere = access.canViewAllMetrics ? {} : { submittedById: access.userId };
      const income = await prisma.income.aggregate({
        _sum: { amount: true },
        where: {
          date: {
            gte: m.startDate,
            lte: m.endDate,
          },
          ...incomeWhere,
        },
      });
      const expense = await prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          date: {
            gte: m.startDate,
            lte: m.endDate,
          },
          ...expenseWhere,
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

export async function getDashboardDataEnhanced(
  dateRange = 'ALL_TIME',
  customStartDate: Date | null = null,
  customEndDate: Date | null = null
) {
  const access = await getDashboardAccess();
  if (!access) {
    return null;
  }
  const { userId, canViewAllMetrics, canViewInventory } = access;

  // Prefer session email (works for dev-bypass users that do not exist in the User table).
  const session = await auth();
  let email: string | null = (session?.user as { email?: string | null } | undefined)?.email ?? null;

  if (!email) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    email = user?.email ?? null;
  }

  if (!email) {
    return null;
  }

  const employee = await prisma.employee.findUnique({
    where: { email },
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

  const expenseWhere = canViewAllMetrics ? {} : { submittedById: userId };
  const incomeWhere = canViewAllMetrics ? {} : { addedById: userId };

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
      where: { ...dateFilter, ...expenseWhere },
    }),
    prisma.income.aggregate({ 
      _sum: { amount: true },
      where: { ...dateFilter, ...incomeWhere },
    }),
    prisma.expense.count({ 
      where: { 
        status: { in: ["PENDING", "PENDING_L1", "PENDING_L2", "PENDING_L3"] },
        ...dateFilter,
        ...expenseWhere,
      } 
    }),
    prisma.income.count({ 
      where: { 
        status: "PENDING",
        ...dateFilter,
        ...incomeWhere,
      } 
    }),
    canViewAllMetrics || canViewInventory
      ? prisma.inventoryItem.findMany({
          where: { minStock: { gt: 0 } },
          select: { quantity: true, minStock: true },
        })
      : Promise.resolve([]),
    canViewAllMetrics
      ? prisma.project.aggregate({ _sum: { pendingRecovery: true } })
      : Promise.resolve({ _sum: { pendingRecovery: 0 } }),
    prisma.expense.aggregate({ 
      where: { 
        status: "APPROVED",
        ...dateFilter,
        ...expenseWhere,
      }, 
      _sum: { amount: true } 
    }),
    prisma.expense.aggregate({ 
      where: { 
        status: "REJECTED",
        ...dateFilter,
        ...expenseWhere,
      }, 
      _sum: { amount: true } 
    }),
    prisma.expense.count({ where: { ...dateFilter, ...expenseWhere } }),
    prisma.income.count({ where: { ...dateFilter, ...incomeWhere } }),
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
  const access = await getDashboardAccess();
  if (!access) return [];
  const where = access.canViewAllMetrics ? {} : { submittedById: access.userId };

  const data = await prisma.expense.groupBy({
    by: ['category'],
    _sum: {
      amount: true,
    },
    where,
  });

  return data.map((item) => ({
    name: item.category,
    value: Number(item._sum.amount),
  }));
}

export async function getProjectProfitabilityData() {
  const access = await getDashboardAccess();
  if (!access) return [];

  let projects = [];
  if (access.canViewAllMetrics) {
    projects = await prisma.project.findMany();
  } else {
    const [expenseProjects, incomeProjects] = await Promise.all([
      prisma.expense.findMany({
        where: { submittedById: access.userId, project: { not: null } },
        select: { project: true },
      }),
      prisma.income.findMany({
        where: { addedById: access.userId, project: { not: null } },
        select: { project: true },
      }),
    ]);
    const refs = Array.from(
      new Set(
        [...expenseProjects, ...incomeProjects]
          .map((p) => p.project)
          .filter((p): p is string => Boolean(p))
      )
    );
    if (refs.length === 0) return [];
    projects = await prisma.project.findMany({
      where: {
        OR: [{ projectId: { in: refs } }, { name: { in: refs } }],
      },
    });
  }

  const projectData = await Promise.all(
    projects.map(async (project) => {
      const incomeWhere = access.canViewAllMetrics
        ? {}
        : { addedById: access.userId };
      const expenseWhere = access.canViewAllMetrics
        ? {}
        : { submittedById: access.userId };
      const incomes = await prisma.income.aggregate({
        _sum: { amount: true },
        where: { project: { in: [project.projectId, project.name] }, status: 'APPROVED', ...incomeWhere },
      });
      const expenses = await prisma.expense.aggregate({
        _sum: { amount: true },
        where: { project: { in: [project.projectId, project.name] }, status: 'APPROVED', ...expenseWhere },
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
  const access = await getDashboardAccess();
  if (!access?.userId || !access.canViewWallet) {
    return [];
  }
  const userId = access.userId;
  const session = await auth();

  // Prefer session email (works for dev-bypass users that do not exist in the User table).
  let email: string | null = (session?.user as { email?: string | null } | undefined)?.email ?? null;

  if (!email) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    email = user?.email ?? null;
  }

  if (!email) {
    return [];
  }

  const employee = await prisma.employee.findUnique({
    where: { email },
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
