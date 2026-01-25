'use client';

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TimeSeriesData } from '@/types';
import { formatDate } from '@/lib/utils';

interface AreaChartProps {
  data: TimeSeriesData[];
  height?: number;
  showGrid?: boolean;
  stacked?: boolean;
  formatYAxis?: (value: number) => string;
  gradient?: boolean;
}

export function AreaChart({
  data,
  height = 300,
  showGrid = true,
  stacked = false,
  formatYAxis = (v) => v.toString(),
  gradient = true,
}: AreaChartProps) {
  // Transform data for Recharts
  const chartData = data[0]?.data.map((point, index) => {
    const item: Record<string, unknown> = {
      timestamp: point.timestamp,
    };
    data.forEach((series) => {
      item[series.name] = series.data[index]?.value ?? 0;
    });
    return item;
  }) || [];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {gradient && (
          <defs>
            {data.map((series, index) => (
              <linearGradient
                key={series.name}
                id={`gradient-${index}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={series.color || '#3b82f6'}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={series.color || '#3b82f6'}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
        )}
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.5}
          />
        )}
        <XAxis
          dataKey="timestamp"
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
        {data.map((series, index) => (
          <Area
            key={series.name}
            type="monotone"
            dataKey={series.name}
            stackId={stacked ? 'stack' : undefined}
            stroke={series.color || '#3b82f6'}
            strokeWidth={2}
            fill={gradient ? `url(#gradient-${index})` : series.color || '#3b82f6'}
            fillOpacity={gradient ? 1 : 0.3}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
