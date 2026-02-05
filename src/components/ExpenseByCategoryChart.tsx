'use client';

import { useTheme } from 'next-themes';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatMoney } from '@/lib/format';

interface ChartData {
  name: string;
  value: number;
}

interface ExpenseByCategoryChartProps {
  data: ChartData[];
}

const lightColors = [
  'hsl(200 60% 50%)',
  'hsl(140 60% 50%)',
  'hsl(60 60% 50%)',
  'hsl(0 60% 50%)',
  'hsl(280 60% 50%)',
];

const darkColors = [
  'hsl(205 70% 65%)',
  'hsl(145 65% 55%)',
  'hsl(55 70% 60%)',
  'hsl(0 75% 70%)',
  'hsl(275 70% 70%)',
];

export default function ExpenseByCategoryChart({
  data,
}: ExpenseByCategoryChartProps) {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? darkColors : lightColors;
  const textColor = theme === 'dark' ? 'hsl(210 40% 98%)' : 'hsl(222.2 47.4% 11.2%)';
  const tooltipBackgroundColor = theme === 'dark' ? 'hsl(222 47% 11%)' : '#fff';
  const tooltipBorderColor = theme === 'dark' ? 'hsl(217 33% 20%)' : 'hsl(214.3 31.8% 91.4%)';

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Expense by Category</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            label={({
              cx,
              cy,
              midAngle,
              innerRadius,
              outerRadius,
              percent,
              index,
              name,
              value,
              textAnchor,
              dominantBaseline,
              ...rest
            }) => (
              <text
                x={rest.x}
                y={rest.y}
                fill={textColor}
                textAnchor={textAnchor}
                dominantBaseline="central"
                fontSize="0.75rem"
              >
                <tspan x={rest.x} dy="-0.6em">{name}</tspan>
                <tspan x={rest.x} dy="1.2em">{`(${formatMoney(value, '')})`}</tspan>
              </text>
            )}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | undefined) => [formatMoney(value || 0, 'PKR '), 'Value']}
            contentStyle={{
              backgroundColor: tooltipBackgroundColor,
              borderColor: tooltipBorderColor,
              color: textColor,
              borderRadius: 'var(--radius-md)',
            }}
          />
          <Legend wrapperStyle={{ color: textColor }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
