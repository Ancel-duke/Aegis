'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAlertsStore } from '@/stores/alerts-store';
import { useWebSocket, WS_EVENTS } from '@/lib/websocket';
import { useToast } from '@/components/ui/toaster';
import { formatRelativeTime, getSeverityColor, cn } from '@/lib/utils';
import { Alert, AlertSeverity } from '@/types';
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  X,
  Wifi,
  WifiOff,
} from 'lucide-react';

const severityOptions: AlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

export default function AlertsPage() {
  const {
    alerts,
    filteredAlerts,
    filters,
    isLoading,
    wsConnected,
    unreadCount,
    fetchAlerts,
    setFilters,
    clearFilters,
    resolveAlert,
    unresolveAlert,
    addAlert,
    updateAlert,
    setWsConnected,
    markAllAsRead,
  } = useAlertsStore();

  const { success, error: showError } = useToast();
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // WebSocket connection
  const { isConnected, isConnecting } = useWebSocket({
    url: `${process.env.NEXT_PUBLIC_WS_URL}/ws/alerts`,
    onOpen: () => {
      setWsConnected(true);
    },
    onClose: () => {
      setWsConnected(false);
    },
    onMessage: (message) => {
      switch (message.type) {
        case WS_EVENTS.ALERT_CREATED:
          addAlert(message.payload as Alert);
          break;
        case WS_EVENTS.ALERT_UPDATED:
        case WS_EVENTS.ALERT_RESOLVED:
          updateAlert(message.payload as Alert);
          break;
      }
    },
  });

  useEffect(() => {
    fetchAlerts();
    markAllAsRead();
  }, []);

  // Filter alerts by search query
  const displayedAlerts = filteredAlerts.filter((alert) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      alert.title.toLowerCase().includes(query) ||
      alert.message.toLowerCase().includes(query) ||
      alert.source.toLowerCase().includes(query)
    );
  });

  const handleResolve = async (id: string) => {
    try {
      await resolveAlert(id);
      success('Alert Resolved', 'The alert has been marked as resolved.');
    } catch {
      showError('Error', 'Failed to resolve alert.');
    }
  };

  const handleUnresolve = async (id: string) => {
    try {
      await unresolveAlert(id);
      success('Alert Reopened', 'The alert has been reopened.');
    } catch {
      showError('Error', 'Failed to reopen alert.');
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAlerts(newExpanded);
  };

  const toggleSeverityFilter = (severity: AlertSeverity) => {
    const currentSeverities = filters.severity || [];
    const newSeverities = currentSeverities.includes(severity)
      ? currentSeverities.filter((s) => s !== severity)
      : [...currentSeverities, severity];
    setFilters({ severity: newSeverities.length > 0 ? newSeverities : undefined });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Alerts
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage system alerts
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
            ) : isConnecting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Offline</span>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchAlerts()}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter toggles */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {(filters.severity?.length || filters.resolved !== undefined) && (
                  <Badge variant="default" className="ml-2">
                    {(filters.severity?.length || 0) + (filters.resolved !== undefined ? 1 : 0)}
                  </Badge>
                )}
              </Button>

              {/* Quick filters */}
              <Button
                variant={filters.resolved === false ? 'secondary' : 'outline'}
                size="sm"
                onClick={() =>
                  setFilters({
                    resolved: filters.resolved === false ? undefined : false,
                  })
                }
              >
                Active Only
              </Button>

              {filters.severity?.length || filters.resolved !== undefined ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Severity</label>
                  <div className="flex flex-wrap gap-2">
                    {severityOptions.map((severity) => (
                      <Button
                        key={severity}
                        variant={filters.severity?.includes(severity) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleSeverityFilter(severity)}
                        className="capitalize"
                      >
                        {severity}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-500">
              {alerts.filter((a) => a.severity === 'critical' && !a.resolved).length}
            </div>
            <div className="text-sm text-muted-foreground">Critical</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-500">
              {alerts.filter((a) => a.severity === 'high' && !a.resolved).length}
            </div>
            <div className="text-sm text-muted-foreground">High</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-500">
              {alerts.filter((a) => a.severity === 'medium' && !a.resolved).length}
            </div>
            <div className="text-sm text-muted-foreground">Medium</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">
              {alerts.filter((a) => a.resolved).length}
            </div>
            <div className="text-sm text-muted-foreground">Resolved</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts list */}
      <Card>
        <CardHeader>
          <CardTitle>
            All Alerts ({displayedAlerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : displayedAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No alerts found</p>
              <p className="text-sm">Adjust your filters or check back later</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'border rounded-lg transition-all',
                    alert.resolved && 'opacity-60',
                    expandedAlerts.has(alert.id) && 'ring-2 ring-primary-500/20'
                  )}
                >
                  {/* Alert header */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(alert.id)}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                    >
                      {expandedAlerts.has(alert.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>

                    <Badge
                      variant={alert.severity as 'critical' | 'high' | 'medium' | 'low'}
                      className="capitalize"
                    >
                      {alert.severity}
                    </Badge>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{alert.title}</p>
                        {alert.resolved && (
                          <Badge variant="success" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {alert.source} • {formatRelativeTime(alert.timestamp)}
                      </p>
                    </div>

                    <Button
                      variant={alert.resolved ? 'outline' : 'default'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        alert.resolved
                          ? handleUnresolve(alert.id)
                          : handleResolve(alert.id);
                      }}
                    >
                      {alert.resolved ? 'Reopen' : 'Resolve'}
                    </Button>
                  </div>

                  {/* Alert details (expanded) */}
                  {expandedAlerts.has(alert.id) && (
                    <div className="px-4 pb-4 pt-0 border-t bg-muted/30">
                      <div className="pt-4 space-y-4">
                        <div>
                          <h4 className="text-sm font-medium mb-1">Message</h4>
                          <p className="text-sm text-muted-foreground">
                            {alert.message}
                          </p>
                        </div>

                        {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-1">Metadata</h4>
                            <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                              {JSON.stringify(alert.metadata, null, 2)}
                            </pre>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>ID: {alert.id}</span>
                          {alert.resolvedAt && (
                            <span>
                              Resolved: {formatRelativeTime(alert.resolvedAt)}
                              {alert.resolvedBy && ` by ${alert.resolvedBy}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
