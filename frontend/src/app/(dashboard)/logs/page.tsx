'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useLogsStore, logLevelColors } from '@/stores/logs-store';
import { useWebSocket } from '@/lib/websocket';
import { formatDate, cn } from '@/lib/utils';
import { LogEntry, LogLevel } from '@/types';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  Download,
  X,
  Wifi,
  WifiOff,
} from 'lucide-react';

const logLevelOptions: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

export default function LogsPage() {
  const {
    logs,
    selectedLog,
    filters,
    isLoading,
    availableServices,
    isStreaming,
    fetchLogs,
    fetchServices,
    setFilters,
    clearFilters,
    selectLog,
    addLog,
    setStreaming,
  } = useLogsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const logsEndRef = useRef<HTMLDivElement>(null);

  // WebSocket for real-time logs
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://localhost:3000';
  const { isConnected } = useWebSocket({
    url: `${wsUrl}/ws`,
    onMessage: (message) => {
      if (message.type === 'log' && isStreaming && message.payload) {
        addLog(message.payload as LogEntry);
      }
    },
  });

  useEffect(() => {
    fetchLogs();
    fetchServices();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      if (!isStreaming) {
        fetchLogs();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchLogs, fetchServices, isStreaming]);

  // Auto-scroll when streaming
  useEffect(() => {
    if (isStreaming && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isStreaming]);

  // Filter logs by search query
  const displayedLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(query) ||
      log.service.toLowerCase().includes(query) ||
      log.traceId?.toLowerCase().includes(query)
    );
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  const toggleLevelFilter = (level: LogLevel) => {
    const currentLevels = filters.level || [];
    const newLevels = currentLevels.includes(level)
      ? currentLevels.filter((l) => l !== level)
      : [...currentLevels, level];
    setFilters({ level: newLevels.length > 0 ? newLevels : undefined });
  };

  const toggleServiceFilter = (service: string) => {
    const currentServices = filters.service || [];
    const newServices = currentServices.includes(service)
      ? currentServices.filter((s) => s !== service)
      : [...currentServices, service];
    setFilters({ service: newServices.length > 0 ? newServices : undefined });
  };

  const downloadLogs = () => {
    const content = displayedLogs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toISOString();
        return `[${timestamp}] [${log.level.toUpperCase()}] [${log.service}] ${log.message}`;
      })
      .join('\n');
    
    // Add CSV header
    const csvContent = 'Timestamp,Level,Service,Message,TraceID\n' +
      displayedLogs.map((log) => {
        const timestamp = new Date(log.timestamp).toISOString();
        return `"${timestamp}","${log.level}","${log.service}","${log.message.replace(/"/g, '""')}","${log.traceId || ''}"`;
      }).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegis-logs-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelBadge = (level: LogLevel) => {
    const colors = {
      debug: 'bg-gray-500/10 text-gray-500',
      info: 'bg-blue-500/10 text-blue-500',
      warn: 'bg-yellow-500/10 text-yellow-500',
      error: 'bg-red-500/10 text-red-500',
      fatal: 'bg-red-700/10 text-red-700',
    };

    return (
      <Badge className={cn('uppercase font-mono text-xs', colors[level])}>
        {level}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Logs Viewer
          </h1>
          <p className="text-muted-foreground">
            View and search application logs
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
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Disconnected</span>
              </>
            )}
          </div>

          {/* Stream toggle */}
          <Button
            variant={isStreaming ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStreaming(!isStreaming)}
          >
            {isStreaming ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Stream
              </>
            )}
          </Button>

          <Button variant="outline" size="icon" onClick={downloadLogs}>
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchLogs()}
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
                placeholder="Search logs..."
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
                {(filters.level?.length || filters.service?.length) && (
                  <Badge variant="default" className="ml-2">
                    {(filters.level?.length || 0) + (filters.service?.length || 0)}
                  </Badge>
                )}
              </Button>

              {(filters.level?.length || filters.service?.length) && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Log levels */}
              <div>
                <label className="text-sm font-medium mb-2 block">Log Level</label>
                <div className="flex flex-wrap gap-2">
                  {logLevelOptions.map((level) => (
                    <Button
                      key={level}
                      variant={filters.level?.includes(level) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleLevelFilter(level)}
                      className="uppercase"
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Services */}
              <div>
                <label className="text-sm font-medium mb-2 block">Service</label>
                <div className="flex flex-wrap gap-2">
                  {availableServices.map((service) => (
                    <Button
                      key={service}
                      variant={filters.service?.includes(service) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleServiceFilter(service)}
                    >
                      {service}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs display */}
      <Card>
        <CardHeader>
          <CardTitle>Log Entries ({displayedLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && logs.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : displayedLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No logs found</p>
              <p className="text-sm">Adjust your filters or wait for new logs</p>
            </div>
          ) : (
            <div className="space-y-1 font-mono text-sm max-h-[600px] overflow-y-auto scrollbar-thin">
              {displayedLogs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'rounded hover:bg-muted/50 transition-colors',
                    expandedLogs.has(log.id) && 'bg-muted/50'
                  )}
                >
                  {/* Log line */}
                  <div
                    className="flex items-start gap-2 p-2 cursor-pointer"
                    onClick={() => toggleExpand(log.id)}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                    >
                      {expandedLogs.has(log.id) ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </Button>

                    <span className="text-muted-foreground flex-shrink-0 w-[180px]">
                      {formatDate(log.timestamp)}
                    </span>

                    {getLevelBadge(log.level)}

                    <span className="text-primary-500 flex-shrink-0 w-[100px]">
                      [{log.service}]
                    </span>

                    <span className="flex-1 break-all">
                      {log.message}
                    </span>
                  </div>

                  {/* Expanded details */}
                  {expandedLogs.has(log.id) && (
                    <div className="px-4 pb-4 pt-0 ml-7 space-y-3">
                      {log.traceId && (
                        <div>
                          <span className="text-muted-foreground">Trace ID: </span>
                          <span className="text-primary-500">{log.traceId}</span>
                        </div>
                      )}

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <span className="text-muted-foreground block mb-1">Metadata:</span>
                          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="fixed bottom-4 right-4 bg-primary-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
          Streaming logs...
        </div>
      )}
    </div>
  );
}
