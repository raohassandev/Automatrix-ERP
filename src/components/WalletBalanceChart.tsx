'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatMoney } from '@/lib/format';

interface ChartData {
  date: string;
  balance: number;
}

interface WalletBalanceChartProps {
  data: ChartData[];
}

export default function WalletBalanceChart({ data }: WalletBalanceChartProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Wallet Balance Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis tickFormatter={(value) => formatMoney(value, 'PKR ')} />
          <Tooltip
            formatter={(value: number) => [formatMoney(value, 'PKR '), 'Balance']}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#8884d8"
            fill="#8884d8"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
