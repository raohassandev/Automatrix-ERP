'use client';

import { useTheme } from 'next-themes';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatMoney } from '@/lib/format';

interface ChartData {
  name: string;
  income: number;
  expense: number;
}

interface IncomeExpenseChartProps {
  data: ChartData[];
}

const lightColors = {
  income: 'hsl(200 60% 50%)',
  expense: 'hsl(140 60% 50%)',
};

const darkColors = {
  income: 'hsl(205 70% 65%)',
  expense: 'hsl(145 65% 55%)',
};

export default function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : lightColors;
  const tickColor = theme === 'dark' ? 'hsl(210 40% 98%)' : 'hsl(222.2 47.4% 11.2%)';
  const tooltipBackgroundColor = theme === 'dark' ? 'hsl(222 47% 11%)' : '#fff';
  const tooltipBorderColor = theme === 'dark' ? 'hsl(217 33% 20%)' : 'hsl(214.3 31.8% 91.4%)';

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Income vs Expense Trend</h3>
      <p className="mb-4 text-sm text-muted-foreground">Last 12 months</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme === 'dark' ? 'hsl(217 33% 20%)' : 'hsl(214.3 31.8% 91.4%)'}
            strokeOpacity={0.5}
          />
          <XAxis dataKey="name" tick={{ fill: tickColor }} />
          <YAxis tickFormatter={(value) => formatMoney(value, 'PKR ')} tick={{ fill: tickColor }} />
          <Tooltip
            formatter={(value: number | undefined) => [formatMoney(value || 0, 'PKR '), null]}
            contentStyle={{
              backgroundColor: tooltipBackgroundColor,
              borderColor: tooltipBorderColor,
              color: tickColor,
              borderRadius: 'var(--radius-md)',
            }}
          />
          <Legend wrapperStyle={{ color: tickColor }} />
          <Line
            type="monotone"
            dataKey="income"
            stroke={colors.income}
            activeDot={{ r: 8 }}
          />
          <Line type="monotone" dataKey="expense" stroke={colors.expense} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
