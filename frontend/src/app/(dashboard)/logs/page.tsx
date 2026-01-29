'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api/client';
import { useIsMobile } from '@/lib/use-is-mobile';
import { cn } from '@/lib/utils';
import {
  FileText,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface LogItem {
  timestamp: string;
  service: string;
  level: string;
  message: string;
  context: Record<string, unknown>;
}

interface LogsResponse {
  total: number;
  page: number;
  limit: number;
  logs: LogItem[];
}

const levelColors: Record<string, string> = {
  debug: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  warn: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  error: 'bg-red-500/10 text-red-600 dark:text-red-400',
  fatal: 'bg-red-700/10 text-red-700 dark:text-red-300',
};

export default function LogsPage() {
  const isMobile = useIsMobile();
  const [data, setData] = useState<LogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [level, setLevel] = useState('');
  const [service, setService] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (level) params.level = level;
      if (service) params.service = service;
      if (from) params.from = from; // ISO8601 from datetime-local
      if (to) params.to = to;
      const res = await api.get<LogsResponse>('/logs', params);
      setData(res);
    } catch {
      setData({ total: 0, page: 1, limit: 50, logs: [] });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, limit, level, service, from, to]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;
  const hasFilters = level || service || from || to;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 sm:text-3xl" id="logs-heading">
            <FileText className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
            Logs
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            View and filter application logs
          </p>
        </div>
        <Button
          variant="outline"
          size="default"
          onClick={() => fetchLogs()}
          disabled={isLoading}
          className="min-h-[44px] w-full sm:w-auto"
          aria-label="Refresh logs"
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="min-h-[44px] sm:min-h-[36px]"
                aria-expanded={showFilters}
                aria-controls="logs-filters"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasFilters && (
                  <Badge variant="default" className="ml-2">
                    {[level, service, from, to].filter(Boolean).length}
                  </Badge>
                )}
              </Button>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLevel('');
                    setService('');
                    setFrom('');
                    setTo('');
                  }}
                  className="min-h-[44px] sm:min-h-[36px]"
                >
                  Clear
                </Button>
              )}
            </div>
            {showFilters && (
              <div id="logs-filters" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t">
                <Input
                  label="Level"
                  placeholder="info, error"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  aria-label="Filter by log level"
                />
                <Input
                  label="Service"
                  placeholder="auth, executor"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  aria-label="Filter by service"
                />
                <Input
                  label="From (ISO 8601)"
                  type="datetime-local"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label="Filter from date"
                />
                <Input
                  label="To (ISO 8601)"
                  type="datetime-local"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label="Filter to date"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs list */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>
            Results {data && `(${data.total} total)`}
          </CardTitle>
          {data && data.total > 0 && (
            <span className="text-sm text-muted-foreground">
              Page {data.page} of {totalPages}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground"
              role="status"
              aria-label="No logs"
            >
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden />
              <p className="text-lg font-medium">No logs found</p>
              <p className="text-sm mt-1">Adjust filters or check back later</p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3" role="list">
              {data.logs.map((log, idx) => (
                <div
                  key={`${log.timestamp}-${idx}`}
                  className="rounded-lg border p-4 space-y-2 bg-card"
                  role="listitem"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn('capitalize', levelColors[log.level] || '')}
                    >
                      {log.level}
                    </Badge>
                    <span className="text-sm font-medium">{log.service}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm break-words">{log.message}</p>
                  {log.context && Object.keys(log.context).length > 0 && (
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.context)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin" role="region" aria-label="Logs table">
              <table className="w-full min-w-[640px]" aria-labelledby="logs-heading">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Level</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Service</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Message</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden lg:table-cell">Context</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log, idx) => (
                    <tr
                      key={`${log.timestamp}-${idx}`}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="py-3 px-2 text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-2">
                        <Badge
                          variant="outline"
                          className={cn('capitalize', levelColors[log.level] || '')}
                        >
                          {log.level}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-sm font-medium">{log.service}</td>
                      <td className="py-3 px-2 text-sm max-w-md truncate" title={log.message}>
                        {log.message}
                      </td>
                      <td className="py-3 px-2 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                        {log.context && Object.keys(log.context).length > 0
                          ? JSON.stringify(log.context)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.total > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="default"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="min-h-[44px]"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="default"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="min-h-[44px]"
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
