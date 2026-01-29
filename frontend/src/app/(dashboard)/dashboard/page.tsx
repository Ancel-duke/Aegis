'use client';

import { useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/stat-card';
import { LineChart } from '@/components/charts/line-chart';
import { AreaChart } from '@/components/charts/area-chart';
import { DonutChart } from '@/components/charts/donut-chart';
import { SkeletonCard, SkeletonChart } from '@/components/ui/skeleton';
import { TimeSeriesData } from '@/types';
import { useMetricsStore } from '@/stores/metrics-store';
import { useAlertsStore } from '@/stores/alerts-store';
import { useAIStore } from '@/stores/ai-store';
import { formatRelativeTime, formatPercentage, getSeverityColor } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  Brain,
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  Shield,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const {
    current,
    historical,
    isLoading: metricsLoading,
    fetchCurrent,
    fetchHistorical,
    refresh,
  } = useMetricsStore();

  const {
    alerts,
    isLoading: alertsLoading,
    fetchAlerts,
  } = useAlertsStore();

  const {
    anomalies,
    isLoading: aiLoading,
    fetchAnomalies,
  } = useAIStore();

  // Fetch data on mount
  useEffect(() => {
    fetchCurrent();
    fetchHistorical();
    fetchAlerts();
    fetchAnomalies();

    // Refresh metrics every 30 seconds
    const interval = setInterval(() => {
      fetchCurrent();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchCurrent, fetchHistorical, fetchAlerts, fetchAnomalies]);

  // Calculate stats
  const activeAlerts = alerts.filter((a) => !a.resolved);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical');
  const recentAnomalies = anomalies.filter((p) => p.isAnomaly);

  // Prepare chart data from historical metrics for TimeSeriesData format
  const historicalChartData: TimeSeriesData[] = [
    {
      name: 'Alerts',
      data: historical.map((h) => ({
        timestamp: h.date,
        value: h.count,
        label: h.severity,
      })),
      color: '#3b82f6',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            System overview and real-time monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              refresh();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              title="Open Alerts"
              value={current?.openAlerts || 0}
              description={`${criticalAlerts.length} critical`}
              icon={<AlertTriangle className="h-6 w-6 text-yellow-600" />}
              variant={
                criticalAlerts.length > 0
                  ? 'error'
                  : (current?.openAlerts || 0) > 5
                  ? 'warning'
                  : 'success'
              }
            />
            <StatCard
              title="Anomalies Detected"
              value={recentAnomalies.length}
              description="Last 24 hours"
              icon={<Brain className="h-6 w-6 text-purple-600" />}
              variant={recentAnomalies.length > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="System Health"
              value="Healthy"
              description="All systems operational"
              icon={<Shield className="h-6 w-6 text-green-600" />}
              variant="success"
            />
            <StatCard
              title="Last Updated"
              value={current?.timestamp ? new Date(current.timestamp).toLocaleTimeString() : 'Never'}
              description="Metrics refresh"
              icon={<Activity className="h-6 w-6 text-primary-600" />}
              variant="default"
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CPU & Memory Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Resources
            </CardTitle>
            <CardDescription>CPU and memory usage over time</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <SkeletonChart />
            ) : historicalChartData[0]?.data.length > 0 ? (
              <AreaChart
                data={historicalChartData}
                height={250}
                formatYAxis={(v) => `${v}`}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No historical data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Latency Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              API Latency
            </CardTitle>
            <CardDescription>Request latency percentiles</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <SkeletonChart />
            ) : historicalChartData[0]?.data.length > 0 ? (
              <LineChart
                data={historicalChartData}
                height={250}
                formatYAxis={(v) => `${v}`}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No historical data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Alert Severity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <SkeletonChart />
            ) : historical.length > 0 ? (
              <DonutChart
                data={historical.map((h) => ({
                  name: h.severity,
                  value: h.count,
                }))}
                height={200}
                centerLabel={{
                  value: activeAlerts.length,
                  label: 'Total Alerts',
                }}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Recent Alerts
              </CardTitle>
            </div>
            <Link href="/alerts">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : activeAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No active alerts</p>
                </div>
              ) : (
                activeAlerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <Badge
                      variant={alert.severity as 'critical' | 'high' | 'medium' | 'low'}
                      className="capitalize"
                    >
                      {alert.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Insights
              </CardTitle>
            </div>
            <Link href="/ai-insights">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentAnomalies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No anomalies detected</p>
                </div>
              ) : (
                recentAnomalies.slice(0, 4).map((prediction) => (
                  <div
                    key={prediction.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        prediction.severity === 'critical'
                          ? 'bg-red-500'
                          : prediction.severity === 'high'
                          ? 'bg-orange-500'
                          : 'bg-yellow-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {prediction.metric}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Score: {(prediction.anomalyScore * 100).toFixed(0)}% •{' '}
                        {formatRelativeTime(prediction.timestamp)}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {prediction.severity}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
