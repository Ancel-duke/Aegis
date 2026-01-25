'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart } from '@/components/charts/line-chart';
import { BarChart } from '@/components/charts/bar-chart';
import { AreaChart } from '@/components/charts/area-chart';
import { SkeletonChart, SkeletonCard } from '@/components/ui/skeleton';
import { useAIStore } from '@/stores/ai-store';
import { formatRelativeTime, formatPercentage, cn } from '@/lib/utils';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Activity,
  Zap,
  RefreshCw,
  Calendar,
  Filter,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

const timeRangeOptions = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

const metricOptions = [
  { label: 'All Metrics', value: '' },
  { label: 'CPU', value: 'cpu' },
  { label: 'Memory', value: 'memory' },
  { label: 'Latency', value: 'latency' },
  { label: 'Error Rate', value: 'error_rate' },
];

export default function AIInsightsPage() {
  const {
    predictions,
    insights,
    healingActions,
    anomalyTrends,
    severityHeatmap,
    filters,
    isLoading,
    fetchPredictions,
    fetchInsights,
    fetchHealingActions,
    fetchAnomalyTrends,
    fetchSeverityHeatmap,
    setFilters,
  } = useAIStore();

  const [timeRange, setTimeRange] = useState('24h');
  const [selectedMetric, setSelectedMetric] = useState('');

  useEffect(() => {
    fetchPredictions();
    fetchInsights();
    fetchHealingActions();
    fetchAnomalyTrends();
    fetchSeverityHeatmap();
  }, []);

  useEffect(() => {
    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    setFilters({
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      metric: selectedMetric || undefined,
    });
  }, [timeRange, selectedMetric]);

  // Stats calculations
  const totalAnomalies = predictions.filter((p) => p.isAnomaly).length;
  const criticalAnomalies = predictions.filter(
    (p) => p.isAnomaly && p.severity === 'critical'
  ).length;
  const avgAnomalyScore =
    predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.anomalyScore, 0) / predictions.length
      : 0;
  const completedActions = healingActions.filter(
    (a) => a.status === 'completed'
  ).length;

  // Severity distribution for bar chart
  const severityDistribution = [
    {
      name: 'Critical',
      value: predictions.filter((p) => p.severity === 'critical').length,
      color: '#ef4444',
    },
    {
      name: 'High',
      value: predictions.filter((p) => p.severity === 'high').length,
      color: '#f97316',
    },
    {
      name: 'Medium',
      value: predictions.filter((p) => p.severity === 'medium').length,
      color: '#eab308',
    },
    {
      name: 'Low',
      value: predictions.filter((p) => p.severity === 'low').length,
      color: '#22c55e',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" />
            AI Insights
          </h1>
          <p className="text-muted-foreground">
            Anomaly detection and intelligent recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex rounded-lg border overflow-hidden">
            {timeRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  timeRange === option.value
                    ? 'bg-primary-600 text-white'
                    : 'hover:bg-muted'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Metric filter */}
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {metricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchPredictions();
              fetchAnomalyTrends();
            }}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Anomalies</p>
                    <p className="text-3xl font-bold">{totalAnomalies}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Critical</p>
                    <p className="text-3xl font-bold">{criticalAnomalies}</p>
                  </div>
                  <Zap className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Score</p>
                    <p className="text-3xl font-bold">
                      {formatPercentage(avgAnomalyScore)}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Auto-Healed</p>
                    <p className="text-3xl font-bold">{completedActions}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Anomaly Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Anomaly Trends</CardTitle>
            <CardDescription>Anomalies detected over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonChart />
            ) : (
              <AreaChart
                data={anomalyTrends}
                height={250}
                formatYAxis={(v) => v.toString()}
              />
            )}
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
            <CardDescription>Anomalies by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonChart />
            ) : (
              <BarChart
                data={severityDistribution}
                height={250}
                formatValue={(v) => v.toString()}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Predictions & Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Anomalies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Anomalies</CardTitle>
              <CardDescription>Latest detected anomalies</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {predictions.filter((p) => p.isAnomaly).slice(0, 5).map((prediction) => (
                <div
                  key={prediction.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <div
                    className={cn(
                      'w-3 h-3 rounded-full',
                      prediction.severity === 'critical' && 'bg-red-500',
                      prediction.severity === 'high' && 'bg-orange-500',
                      prediction.severity === 'medium' && 'bg-yellow-500',
                      prediction.severity === 'low' && 'bg-green-500'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{prediction.metric}</p>
                    <p className="text-sm text-muted-foreground">
                      Score: {formatPercentage(prediction.anomalyScore)} •{' '}
                      {formatRelativeTime(prediction.timestamp)}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {prediction.severity}
                  </Badge>
                </div>
              ))}

              {predictions.filter((p) => p.isAnomaly).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No anomalies detected</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>AI Recommendations</CardTitle>
            <CardDescription>Suggested actions based on analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.slice(0, 5).map((insight) => (
                <div
                  key={insight.id}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        insight.severity === 'critical' && 'bg-red-500/10',
                        insight.severity === 'high' && 'bg-orange-500/10',
                        insight.severity === 'medium' && 'bg-yellow-500/10',
                        insight.severity === 'low' && 'bg-green-500/10',
                        insight.severity === 'info' && 'bg-blue-500/10'
                      )}
                    >
                      {insight.type === 'anomaly' && <AlertTriangle className="h-4 w-4" />}
                      {insight.type === 'trend' && <TrendingUp className="h-4 w-4" />}
                      {insight.type === 'prediction' && <Brain className="h-4 w-4" />}
                      {insight.type === 'recommendation' && <Zap className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {insight.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatRelativeTime(insight.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {insights.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No insights available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Healing Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Self-Healing Actions</CardTitle>
            <CardDescription>Recent automated remediation actions</CardDescription>
          </div>
          <Link href="/health">
            <Button variant="ghost" size="sm">
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Action</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Target</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Triggered</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Duration</th>
                </tr>
              </thead>
              <tbody>
                {healingActions.slice(0, 5).map((action) => (
                  <tr key={action.id} className="border-b last:border-0">
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="capitalize">
                        {action.type.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm">{action.target}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          action.status === 'completed'
                            ? 'success'
                            : action.status === 'failed'
                            ? 'destructive'
                            : action.status === 'in_progress'
                            ? 'warning'
                            : 'secondary'
                        }
                        className="capitalize"
                      >
                        {action.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {formatRelativeTime(action.triggeredAt)}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {action.completedAt
                        ? `${Math.round(
                            (new Date(action.completedAt).getTime() -
                              new Date(action.triggeredAt).getTime()) /
                              1000
                          )}s`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {healingActions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No healing actions recorded</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
