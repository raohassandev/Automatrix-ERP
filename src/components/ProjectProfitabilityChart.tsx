'use client';

import { useTheme } from 'next-themes';
import {
  BarChart,
  Bar,
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
  profit: number;
  income: number;
  expense: number;
}

interface ProjectProfitabilityChartProps {
  data: ChartData[];
}

const lightColors = {
  income: 'hsl(140 60% 50%)',
  expense: 'hsl(200 60% 50%)',
  profit: 'hsl(60 60% 50%)',
};

const darkColors = {
  income: 'hsl(145 65% 55%)',
  expense: 'hsl(205 70% 65%)',
  profit: 'hsl(55 70% 60%)',
};

export default function ProjectProfitabilityChart({
  data,
}: ProjectProfitabilityChartProps) {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : lightColors;
  const tickColor = theme === 'dark' ? 'hsl(210 40% 98%)' : 'hsl(222.2 47.4% 11.2%)';
  const tooltipBackgroundColor = theme === 'dark' ? 'hsl(222 47% 11%)' : '#fff';
  const tooltipBorderColor = theme === 'dark' ? 'hsl(217 33% 20%)' : 'hsl(214.3 31.8% 91.4%)';

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Project Profitability</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
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
          <Bar dataKey="income" fill={colors.income} />
          <Bar dataKey="expense" fill={colors.expense} />
          <Bar dataKey="profit" fill={colors.profit} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
