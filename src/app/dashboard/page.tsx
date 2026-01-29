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
  const data = await getDashboardDataEnhanced();
  const chartData = await getChartData();
  const expenseByCategoryData = await getExpenseByCategoryData();
  const projectProfitabilityData = await getProjectProfitabilityData();
  const walletBalanceData = await getWalletBalanceData();

  if (!data) {
    return redirect('/login');
  }

  const {
    // ... (rest of the data destructuring)
  } = data;

  return (
    <div className="grid gap-6">
      {/* ... (header) */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {/* ... (KPI cards) */}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <IncomeExpenseChart data={chartData} />
        <ExpenseByCategoryChart data={expenseByCategoryData} />
      </div>
      <ProjectProfitabilityChart data={projectProfitabilityData} />
      <WalletBalanceChart data={walletBalanceData} />
    </div>
  );
}
