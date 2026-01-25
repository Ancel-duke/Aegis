import { create } from 'zustand';
import { SystemMetrics, TimeSeriesData, ChartDataPoint } from '@/types';
import { api } from '@/lib/api/client';

interface MetricsState {
  currentMetrics: SystemMetrics | null;
  historicalMetrics: {
    cpu: TimeSeriesData[];
    memory: TimeSeriesData[];
    network: TimeSeriesData[];
    requests: TimeSeriesData[];
    errors: TimeSeriesData[];
    latency: TimeSeriesData[];
  };
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

interface MetricsActions {
  fetchCurrentMetrics: () => Promise<void>;
  fetchHistoricalMetrics: (range?: string) => Promise<void>;
  setTimeRange: (range: MetricsState['timeRange']) => void;
  clearError: () => void;
}

type MetricsStore = MetricsState & MetricsActions;

const initialState: MetricsState = {
  currentMetrics: null,
  historicalMetrics: {
    cpu: [],
    memory: [],
    network: [],
    requests: [],
    errors: [],
    latency: [],
  },
  timeRange: '1h',
  isLoading: false,
  error: null,
  lastUpdated: null,
};

export const useMetricsStore = create<MetricsStore>((set, get) => ({
  ...initialState,

  fetchCurrentMetrics: async () => {
    set({ isLoading: true, error: null });

    try {
      const metrics = await api.get<SystemMetrics>('/metrics/current');

      set({
        currentMetrics: metrics,
        isLoading: false,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch metrics';
      set({ error: message, isLoading: false });
    }
  },

  fetchHistoricalMetrics: async (range?: string) => {
    const timeRange = range || get().timeRange;
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<{
        cpu: ChartDataPoint[];
        memory: ChartDataPoint[];
        network: { in: ChartDataPoint[]; out: ChartDataPoint[] };
        requests: ChartDataPoint[];
        errors: ChartDataPoint[];
        latency: { p50: ChartDataPoint[]; p95: ChartDataPoint[]; p99: ChartDataPoint[] };
      }>('/metrics/historical', { range: timeRange });

      set({
        historicalMetrics: {
          cpu: [{ name: 'CPU Usage', data: response.cpu, color: '#3b82f6' }],
          memory: [{ name: 'Memory Usage', data: response.memory, color: '#8b5cf6' }],
          network: [
            { name: 'Bytes In', data: response.network.in, color: '#22c55e' },
            { name: 'Bytes Out', data: response.network.out, color: '#ef4444' },
          ],
          requests: [{ name: 'Requests/s', data: response.requests, color: '#3b82f6' }],
          errors: [{ name: 'Errors/s', data: response.errors, color: '#ef4444' }],
          latency: [
            { name: 'P50', data: response.latency.p50, color: '#22c55e' },
            { name: 'P95', data: response.latency.p95, color: '#eab308' },
            { name: 'P99', data: response.latency.p99, color: '#ef4444' },
          ],
        },
        isLoading: false,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch historical metrics';
      set({ error: message, isLoading: false });
    }
  },

  setTimeRange: (range: MetricsState['timeRange']) => {
    set({ timeRange: range });
    get().fetchHistoricalMetrics(range);
  },

  clearError: () => set({ error: null }),
}));
