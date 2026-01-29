import { create } from 'zustand';
import { api } from '@/lib/api/client';

interface CurrentMetrics {
  openAlerts: number;
  timestamp: string;
  [key: string]: unknown;
}

interface HistoricalMetrics {
  date: string;
  severity: string;
  count: number;
}

interface MetricsState {
  current: CurrentMetrics | null;
  historical: HistoricalMetrics[];
  isLoading: boolean;
  error: string | null;
  lastFetched: Date | null;
}

interface MetricsActions {
  fetchCurrent: () => Promise<void>;
  fetchHistorical: (days?: number) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

type MetricsStore = MetricsState & MetricsActions;

export const useMetricsStore = create<MetricsStore>((set) => ({
  current: null,
  historical: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchCurrent: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<CurrentMetrics>('/metrics/current');
      set({
        current: response,
        isLoading: false,
        lastFetched: new Date(),
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
        isLoading: false,
      });
    }
  },

  fetchHistorical: async (days = 7) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<HistoricalMetrics[]>('/metrics/historical', {
        days,
      });
      set({ historical: response, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch historical metrics',
        isLoading: false,
      });
    }
  },

  refresh: async () => {
    await Promise.all([
      useMetricsStore.getState().fetchCurrent(),
      useMetricsStore.getState().fetchHistorical(),
    ]);
  },

  clearError: () => set({ error: null }),
}));
