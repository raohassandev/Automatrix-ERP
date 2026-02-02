import {
  getDashboardDataEnhanced,
  getChartData,
  getExpenseByCategoryData,
  getProjectProfitabilityData,
  getWalletBalanceData,
} from "@/lib/dashboard";
import { formatMoney } from "@/lib/format";
import { redirect } from 'next/navigation';
import IncomeExpenseChart from '@/components/IncomeExpenseChart';
import ExpenseByCategoryChart from '@/components/ExpenseByCategoryChart';
import ProjectProfitabilityChart from '@/components/ProjectProfitabilityChart';
import WalletBalanceChart from '@/components/WalletBalanceChart';

export default async function DashboardPage() {
  let data, chartData, expenseByCategoryData, projectProfitabilityData, walletBalanceData;
  
  try {
    data = await getDashboardDataEnhanced();
    
    if (!data) {
      return redirect('/login');
    }
    
    chartData = await getChartData();
    expenseByCategoryData = await getExpenseByCategoryData();
    projectProfitabilityData = await getProjectProfitabilityData();
    walletBalanceData = await getWalletBalanceData();
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Error loading dashboard data. Please try again later.</p>
      </div>
    );
  }

  const {
    totalIncome = 0,
    totalExpenses = 0,
    netProfit = 0,
    pendingApprovals = 0,
    pendingRecovery = 0,
    lowStockCount = 0,
    profitMargin = 0,
    walletBalance = 0,
  } = data || {};

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Overview of your business metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Income</div>
          <div className="mt-2 text-2xl font-bold">{formatMoney(totalIncome)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Expenses</div>
          <div className="mt-2 text-2xl font-bold">{formatMoney(totalExpenses)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Net Profit</div>
          <div className="mt-2 text-2xl font-bold">{formatMoney(netProfit)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Pending Approvals</div>
          <div className="mt-2 text-2xl font-bold">{pendingApprovals}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Wallet Balance</div>
          <div className="mt-2 text-2xl font-bold">{formatMoney(walletBalance)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Low Stock Items</div>
          <div className="mt-2 text-2xl font-bold">{lowStockCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Profit Margin</div>
          <div className="mt-2 text-2xl font-bold">{profitMargin.toFixed(1)}%</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Pending Recovery</div>
          <div className="mt-2 text-2xl font-bold">{formatMoney(pendingRecovery)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <IncomeExpenseChart data={chartData || []} />
        <ExpenseByCategoryChart data={expenseByCategoryData || []} />
      </div>
      <ProjectProfitabilityChart data={projectProfitabilityData || []} />
      <WalletBalanceChart data={walletBalanceData || []} />
    </div>
  );
}
