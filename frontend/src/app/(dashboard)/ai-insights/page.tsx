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
import { AnomalyPrediction } from '@/types';
import { useWebSocket } from '@/lib/websocket';
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
    anomalies,
    insights,
    severityTrends,
    isLoading,
    fetchAnomalies,
    fetchInsights,
    addAnomalyFromWebSocket,
  } = useAIStore();

  const [timeRange, setTimeRange] = useState('24h');
  const [selectedMetric, setSelectedMetric] = useState('');

  // WebSocket connection for real-time anomalies
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://localhost:3000';
  const { isConnected } = useWebSocket({
    url: `${wsUrl}/ws`,
    onMessage: (message) => {
      if (message.type === 'anomaly' && message.payload) {
        addAnomalyFromWebSocket(message.payload as AnomalyPrediction);
      }
    },
  });

  useEffect(() => {
    fetchAnomalies();
    fetchInsights();
  }, [fetchAnomalies, fetchInsights]);

  // Stats calculations
  const totalAnomalies = anomalies.filter((p) => p.isAnomaly).length;
  const criticalAnomalies = anomalies.filter(
    (p) => p.isAnomaly && p.severity === 'critical'
  ).length;
  const avgAnomalyScore =
    anomalies.length > 0
      ? anomalies.reduce((sum, p) => sum + p.anomalyScore, 0) / anomalies.length
      : 0;

  // Severity distribution for bar chart
  const severityDistribution = [
    {
      name: 'Critical',
      value: severityTrends.critical || 0,
      color: '#ef4444',
    },
    {
      name: 'High',
      value: severityTrends.high || 0,
      color: '#f97316',
    },
    {
      name: 'Medium',
      value: severityTrends.medium || 0,
      color: '#eab308',
    },
    {
      name: 'Low',
      value: severityTrends.low || 0,
      color: '#22c55e',
    },
  ];

  // Prepare trend data for charts in TimeSeriesData format
  const anomalyTrendsData: TimeSeriesData[] = [
    {
      name: 'Anomalies',
      data: anomalies
        .filter((a) => a.isAnomaly)
        .map((a) => ({
          timestamp: a.timestamp,
          value: a.anomalyScore,
          label: a.severity,
        })),
      color: '#ef4444',
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
              fetchAnomalies();
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
                    <p className="text-sm text-muted-foreground">Total Predictions</p>
                    <p className="text-3xl font-bold">{anomalies.length}</p>
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
                data={anomalyTrendsData}
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
              {anomalies.filter((p) => p.isAnomaly).slice(0, 5).map((prediction) => (
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

              {anomalies.filter((p) => p.isAnomaly).length === 0 && (
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

    </div>
  );
}
