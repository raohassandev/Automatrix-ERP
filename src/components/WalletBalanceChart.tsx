'use client';

import { useTheme } from 'next-themes';
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

const lightColor = 'hsl(200 60% 50%)';
const darkColor = 'hsl(205 70% 65%)';

export default function WalletBalanceChart({ data }: WalletBalanceChartProps) {
  const { theme } = useTheme();
  const chartColor = theme === 'dark' ? darkColor : lightColor;
  const tickColor = theme === 'dark' ? 'hsl(210 40% 98%)' : 'hsl(222.2 47.4% 11.2%)';
  const tooltipBackgroundColor = theme === 'dark' ? 'hsl(222 47% 11%)' : '#fff';
  const tooltipBorderColor = theme === 'dark' ? 'hsl(217 33% 20%)' : 'hsl(214.3 31.8% 91.4%)';

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Wallet Balance Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.8} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme === 'dark' ? 'hsl(217 33% 20%)' : 'hsl(214.3 31.8% 91.4%)'}
            strokeOpacity={0.5}
          />
          <XAxis dataKey="date" tick={{ fill: tickColor }} />
          <YAxis tickFormatter={(value) => formatMoney(value, 'PKR ')} tick={{ fill: tickColor }} />
          <Tooltip
            formatter={(value: number | undefined) => [formatMoney(value || 0, 'PKR '), 'Balance']}
            contentStyle={{
              backgroundColor: tooltipBackgroundColor,
              borderColor: tooltipBorderColor,
              color: tickColor,
              borderRadius: 'var(--radius-md)',
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={chartColor}
            fillOpacity={1}
            fill="url(#colorBalance)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
