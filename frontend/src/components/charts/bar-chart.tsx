'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BarChartData {
  name: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  horizontal?: boolean;
  formatValue?: (value: number) => string;
  barSize?: number;
}

export function BarChart({
  data,
  height = 300,
  showLegend = false,
  showGrid = true,
  horizontal = false,
  formatValue = (v) => v.toString(),
  barSize = 40,
}: BarChartProps) {
  const defaultColors = [
    '#3b82f6',
    '#22c55e',
    '#eab308',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.5}
          />
        )}
        {horizontal ? (
          <>
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={formatValue}
              stroke="hsl(var(--border))"
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              width={100}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={formatValue}
              stroke="hsl(var(--border))"
            />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [formatValue(value), 'Value']}
        />
        {showLegend && <Legend />}
        <Bar dataKey="value" barSize={barSize} radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={entry.color || defaultColors[index % defaultColors.length]}
            />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
