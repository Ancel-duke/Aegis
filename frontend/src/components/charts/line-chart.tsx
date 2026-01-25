'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TimeSeriesData } from '@/types';
import { formatDate } from '@/lib/utils';

interface LineChartProps {
  data: TimeSeriesData[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  xAxisKey?: string;
  yAxisLabel?: string;
  formatYAxis?: (value: number) => string;
}

export function LineChart({
  data,
  height = 300,
  showLegend = true,
  showGrid = true,
  xAxisKey = 'timestamp',
  yAxisLabel,
  formatYAxis = (v) => v.toString(),
}: LineChartProps) {
  // Transform data for Recharts
  const chartData = data[0]?.data.map((point, index) => {
    const item: Record<string, unknown> = {
      [xAxisKey]: point.timestamp,
    };
    data.forEach((series) => {
      item[series.name] = series.data[index]?.value ?? 0;
    });
    return item;
  }) || [];

  const colors = data.map((series) => series.color || '#3b82f6');

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.5}
          />
        )}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(value) => {
            const date = new Date(value);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }}
          stroke="hsl(var(--border))"
        />
        <YAxis
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={formatYAxis}
          stroke="hsl(var(--border))"
          label={
            yAxisLabel
              ? {
                  value: yAxisLabel,
                  angle: -90,
                  position: 'insideLeft',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 12,
                }
              : undefined
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelFormatter={(value) => formatDate(value as string)}
          formatter={(value: number, name: string) => [formatYAxis(value), name]}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
          />
        )}
        {data.map((series, index) => (
          <Line
            key={series.name}
            type="monotone"
            dataKey={series.name}
            stroke={colors[index]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
