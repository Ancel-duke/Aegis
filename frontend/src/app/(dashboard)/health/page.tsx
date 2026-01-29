'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/dashboard/stat-card';
import { LineChart } from '@/components/charts/line-chart';
import { AreaChart } from '@/components/charts/area-chart';
import { DonutChart } from '@/components/charts/donut-chart';
import { SkeletonChart, SkeletonCard } from '@/components/ui/skeleton';
import { useMetricsStore } from '@/stores/metrics-store';
import { useWebSocket, WS_EVENTS } from '@/lib/websocket';
import { formatRelativeTime, formatBytes, formatPercentage, cn } from '@/lib/utils';
import { TimeSeriesData } from '@/types';
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency: number;
  lastCheck: string;
}

interface PodMetrics {
  running?: number;
  pending?: number;
  failed?: number;
  total?: number;
}

interface MetricValue {
  current?: number;
  max?: number;
  min?: number;
  average?: number;
}

interface NetworkMetrics {
  bytesIn?: number;
  bytesOut?: number;
}

interface CurrentMetricsShape {
  cpu?: MetricValue;
  memory?: MetricValue;
  disk?: MetricValue;
  network?: NetworkMetrics;
  pods?: PodMetrics;
}

// Chart data shape the health page expects (store exposes historical as array; use empty when not object shape)
const emptyChartData: { cpu: TimeSeriesData[]; memory: TimeSeriesData[]; network: TimeSeriesData[]; requests: TimeSeriesData[]; errors: TimeSeriesData[] } = {
  cpu: [],
  memory: [],
  network: [],
  requests: [],
  errors: [],
};

export default function SystemHealthPage() {
  const {
    current: currentMetrics,
    historical,
    isLoading,
    lastFetched: lastUpdated,
    fetchCurrent: fetchCurrentMetrics,
    fetchHistorical: fetchHistoricalMetrics,
  } = useMetricsStore();

  const [timeRange, setTimeRange] = useState('24h');
  const m = currentMetrics as CurrentMetricsShape | null;
  const historicalMetrics =
    typeof historical === 'object' && historical !== null && !Array.isArray(historical)
      ? (historical as typeof emptyChartData)
      : emptyChartData;

  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Backend API', status: 'healthy', latency: 45, lastCheck: new Date().toISOString() },
    { name: 'AI Engine', status: 'healthy', latency: 120, lastCheck: new Date().toISOString() },
    { name: 'Executor', status: 'healthy', latency: 35, lastCheck: new Date().toISOString() },
    { name: 'PostgreSQL', status: 'healthy', latency: 5, lastCheck: new Date().toISOString() },
    { name: 'Redis', status: 'healthy', latency: 2, lastCheck: new Date().toISOString() },
    { name: 'Prometheus', status: 'healthy', latency: 15, lastCheck: new Date().toISOString() },
  ]);

  // WebSocket for real-time metrics
  const { isConnected } = useWebSocket({
    url: `${process.env.NEXT_PUBLIC_WS_URL}/ws/metrics`,
    onMessage: (message) => {
      if (message.type === WS_EVENTS.METRICS_UPDATE) {
        fetchCurrentMetrics();
      }
    },
  });

  useEffect(() => {
    fetchCurrentMetrics();
    fetchHistoricalMetrics();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchCurrentMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Pod status data for donut chart
  const pods = m?.pods;
  const podStatusData = pods
    ? [
        { name: 'Running', value: pods.running ?? 0, color: '#22c55e' },
        { name: 'Pending', value: pods.pending ?? 0, color: '#eab308' },
        { name: 'Failed', value: pods.failed ?? 0, color: '#ef4444' },
      ]
    : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="success">Healthy</Badge>;
      case 'degraded':
        return <Badge variant="warning">Degraded</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive">Unhealthy</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            System Health
          </h1>
          <p className="text-muted-foreground">
            Monitor infrastructure and service health
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
            isConnected
              ? 'bg-green-500/10 text-green-600'
              : 'bg-yellow-500/10 text-yellow-600'
          )}>
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4" />
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Time range selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchCurrentMetrics();
              fetchHistoricalMetrics();
            }}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Resource stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading && !m ? (
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
              value={`${m?.cpu?.current?.toFixed(1) ?? 0}%`}
              description={`Max: ${m?.cpu?.max?.toFixed(1) ?? 0}%`}
              icon={<Cpu className="h-6 w-6 text-blue-500" />}
              variant={
                (m?.cpu?.current ?? 0) > 80
                  ? 'error'
                  : (m?.cpu?.current ?? 0) > 60
                  ? 'warning'
                  : 'success'
              }
            />
            <StatCard
              title="Memory Usage"
              value={`${m?.memory?.current?.toFixed(1) ?? 0}%`}
              description={`Max: ${m?.memory?.max?.toFixed(1) ?? 0}%`}
              icon={<MemoryStick className="h-6 w-6 text-purple-500" />}
              variant={
                (m?.memory?.current ?? 0) > 85
                  ? 'error'
                  : (m?.memory?.current ?? 0) > 70
                  ? 'warning'
                  : 'success'
              }
            />
            <StatCard
              title="Disk Usage"
              value={`${m?.disk?.current?.toFixed(1) ?? 0}%`}
              description={`Max: ${m?.disk?.max?.toFixed(1) ?? 0}%`}
              icon={<HardDrive className="h-6 w-6 text-orange-500" />}
              variant={
                (m?.disk?.current ?? 0) > 90
                  ? 'error'
                  : (m?.disk?.current ?? 0) > 75
                  ? 'warning'
                  : 'success'
              }
            />
            <StatCard
              title="Network I/O"
              value={formatBytes(
                (m?.network?.bytesIn || 0) +
                  (m?.network?.bytesOut || 0)
              )}
              description={`In: ${formatBytes((m?.network?.bytesIn ?? 0))}`}
              icon={<Network className="h-6 w-6 text-green-500" />}
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
            <CardTitle>Resource Usage</CardTitle>
            <CardDescription>CPU and memory usage over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
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

        {/* Network Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Network Traffic</CardTitle>
            <CardDescription>Inbound and outbound traffic</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonChart />
            ) : (
              <LineChart
                data={historicalMetrics.network || []}
                height={250}
                formatYAxis={(v) => formatBytes(v)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Services and Pods */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Service Health */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Service Health
            </CardTitle>
            <CardDescription>Status of core platform services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Last check: {formatRelativeTime(service.lastCheck)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Latency</p>
                      <p className="font-mono">{service.latency}ms</p>
                    </div>
                    {getStatusBadge(service.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pod Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Pod Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonChart />
            ) : (
              <>
                <DonutChart
                  data={podStatusData}
                  height={200}
                  centerLabel={{
                    value: pods?.total ?? 0,
                    label: 'Total Pods',
                  }}
                />
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500" />
                      Running
                    </span>
                    <span className="font-medium">
                      {pods?.running ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500" />
                      Pending
                    </span>
                    <span className="font-medium">
                      {pods?.pending ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                      Failed
                    </span>
                    <span className="font-medium">
                      {pods?.failed ?? 0}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request metrics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Request Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Request Rate</CardTitle>
            <CardDescription>API requests per second</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonChart />
            ) : (
              <LineChart
                data={historicalMetrics.requests || []}
                height={250}
                formatYAxis={(v) => `${v}/s`}
              />
            )}
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
            <CardDescription>API errors per second</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonChart />
            ) : (
              <AreaChart
                data={historicalMetrics.errors || []}
                height={250}
                formatYAxis={(v) => `${v}/s`}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-sm text-muted-foreground text-center">
          Last updated: {formatRelativeTime(lastUpdated)}
        </p>
      )}
    </div>
  );
}
