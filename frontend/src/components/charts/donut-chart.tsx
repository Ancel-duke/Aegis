'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface DonutChartData {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: {
    value: string | number;
    label: string;
  };
}

export function DonutChart({
  data,
  height = 300,
  showLegend = true,
  innerRadius = 60,
  outerRadius = 80,
  centerLabel,
}: DonutChartProps) {
  const defaultColors = [
    '#22c55e', // green
    '#eab308', // yellow
    '#ef4444', // red
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#06b6d4', // cyan
  ];

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={entry.color || defaultColors[index % defaultColors.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => [
              `${value} (${((value / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value) => (
                <span className="text-muted-foreground">{value}</span>
              )}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center label */}
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold">{centerLabel.value}</div>
            <div className="text-xs text-muted-foreground">{centerLabel.label}</div>
          </div>
        </div>
      )}
    </div>
  );
}
