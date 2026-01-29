'use client';

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

export default function ProjectProfitabilityChart({
  data,
}: ProjectProfitabilityChartProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Project Profitability</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(value) => formatMoney(value, 'PKR ')} />
          <Tooltip
            formatter={(value: number) => [formatMoney(value, 'PKR '), null]}
          />
          <Legend />
          <Bar dataKey="income" fill="#82ca9d" />
          <Bar dataKey="expense" fill="#8884d8" />
          <Bar dataKey="profit" fill="#ffc658" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
