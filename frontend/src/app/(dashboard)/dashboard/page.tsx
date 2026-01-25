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
    currentMetrics,
    historicalMetrics,
    timeRange,
    isLoading: metricsLoading,
    fetchCurrentMetrics,
    fetchHistoricalMetrics,
    setTimeRange,
  } = useMetricsStore();

  const {
    alerts,
    filteredAlerts,
    isLoading: alertsLoading,
    fetchAlerts,
  } = useAlertsStore();

  const {
    healingActions,
    predictions,
    isLoading: aiLoading,
    fetchHealingActions,
    fetchPredictions,
  } = useAIStore();

  // Fetch data on mount
  useEffect(() => {
    fetchCurrentMetrics();
    fetchHistoricalMetrics();
    fetchAlerts();
    fetchHealingActions();
    fetchPredictions();

    // Refresh metrics every 30 seconds
    const interval = setInterval(() => {
      fetchCurrentMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Calculate stats
  const activeAlerts = alerts.filter((a) => !a.resolved);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical');
  const recentActions = healingActions.filter(
    (a) => new Date(a.triggeredAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const recentAnomalies = predictions.filter((p) => p.isAnomaly);

  // Pod status for donut chart
  const podStatusData = currentMetrics?.pods
    ? [
        { name: 'Running', value: currentMetrics.pods.running, color: '#22c55e' },
        { name: 'Pending', value: currentMetrics.pods.pending, color: '#eab308' },
        { name: 'Failed', value: currentMetrics.pods.failed, color: '#ef4444' },
      ]
    : [];

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
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchCurrentMetrics();
              fetchHistoricalMetrics();
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
              title="CPU Usage"
              value={`${currentMetrics?.cpu.current.toFixed(1) || 0}%`}
              description={`Avg: ${currentMetrics?.cpu.average.toFixed(1) || 0}%`}
              icon={<Cpu className="h-6 w-6 text-primary-600" />}
              variant={
                (currentMetrics?.cpu.current || 0) > 80
                  ? 'error'
                  : (currentMetrics?.cpu.current || 0) > 60
                  ? 'warning'
                  : 'default'
              }
            />
            <StatCard
              title="Memory Usage"
              value={`${currentMetrics?.memory.current.toFixed(1) || 0}%`}
              description={`Avg: ${currentMetrics?.memory.average.toFixed(1) || 0}%`}
              icon={<MemoryStick className="h-6 w-6 text-purple-600" />}
              variant={
                (currentMetrics?.memory.current || 0) > 85
                  ? 'error'
                  : (currentMetrics?.memory.current || 0) > 70
                  ? 'warning'
                  : 'default'
              }
            />
            <StatCard
              title="Active Alerts"
              value={activeAlerts.length}
              description={`${criticalAlerts.length} critical`}
              icon={<AlertTriangle className="h-6 w-6 text-yellow-600" />}
              variant={
                criticalAlerts.length > 0
                  ? 'error'
                  : activeAlerts.length > 5
                  ? 'warning'
                  : 'success'
              }
            />
            <StatCard
              title="Healing Actions (24h)"
              value={recentActions.length}
              description={`${recentActions.filter((a) => a.status === 'completed').length} completed`}
              icon={<Zap className="h-6 w-6 text-green-600" />}
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
            ) : (
              <AreaChart
                data={[
                  ...(historicalMetrics.cpu || []),
                  ...(historicalMetrics.memory || []),
                ]}
                height={250}
                formatYAxis={(v) => `${v}%`}
              />
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
            ) : (
              <LineChart
                data={historicalMetrics.latency || []}
                height={250}
                formatYAxis={(v) => `${v}ms`}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pod Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Pod Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <SkeletonChart />
            ) : (
              <DonutChart
                data={podStatusData}
                height={200}
                centerLabel={{
                  value: currentMetrics?.pods.total || 0,
                  label: 'Total Pods',
                }}
              />
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
