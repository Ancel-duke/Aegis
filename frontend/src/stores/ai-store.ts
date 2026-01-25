import { create } from 'zustand';
import { AnomalyPrediction, AIInsight, TimeSeriesData, HealingAction, AlertSeverity } from '@/types';
import { api } from '@/lib/api/client';

interface AIState {
  predictions: AnomalyPrediction[];
  insights: AIInsight[];
  healingActions: HealingAction[];
  anomalyTrends: TimeSeriesData[];
  severityHeatmap: {
    metric: string;
    data: { timestamp: string; severity: AlertSeverity; count: number }[];
  }[];
  filters: {
    metric?: string;
    severity?: AlertSeverity[];
    startDate?: string;
    endDate?: string;
  };
  isLoading: boolean;
  error: string | null;
}

interface AIActions {
  fetchPredictions: () => Promise<void>;
  fetchInsights: () => Promise<void>;
  fetchHealingActions: () => Promise<void>;
  fetchAnomalyTrends: (metric?: string) => Promise<void>;
  fetchSeverityHeatmap: () => Promise<void>;
  setFilters: (filters: Partial<AIState['filters']>) => void;
  clearFilters: () => void;
  clearError: () => void;
}

type AIStore = AIState & AIActions;

const initialState: AIState = {
  predictions: [],
  insights: [],
  healingActions: [],
  anomalyTrends: [],
  severityHeatmap: [],
  filters: {},
  isLoading: false,
  error: null,
};

export const useAIStore = create<AIStore>((set, get) => ({
  ...initialState,

  fetchPredictions: async () => {
    set({ isLoading: true, error: null });

    try {
      const { filters } = get();
      const predictions = await api.get<AnomalyPrediction[]>('/ai/predictions', filters);

      set({ predictions, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch predictions';
      set({ error: message, isLoading: false });
    }
  },

  fetchInsights: async () => {
    set({ isLoading: true, error: null });

    try {
      const insights = await api.get<AIInsight[]>('/ai/insights');

      set({ insights, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch insights';
      set({ error: message, isLoading: false });
    }
  },

  fetchHealingActions: async () => {
    set({ isLoading: true, error: null });

    try {
      const healingActions = await api.get<HealingAction[]>('/executor/actions', {
        limit: 50,
        sortBy: 'triggeredAt',
        sortOrder: 'desc',
      });

      set({ healingActions, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch healing actions';
      set({ error: message, isLoading: false });
    }
  },

  fetchAnomalyTrends: async (metric?: string) => {
    set({ isLoading: true, error: null });

    try {
      const { filters } = get();
      const response = await api.get<{
        trends: { timestamp: string; anomalyCount: number; avgScore: number }[];
      }>('/ai/trends', {
        metric: metric || filters.metric,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      set({
        anomalyTrends: [
          {
            name: 'Anomaly Count',
            data: response.trends.map((t) => ({
              timestamp: t.timestamp,
              value: t.anomalyCount,
            })),
            color: '#ef4444',
          },
          {
            name: 'Avg Score',
            data: response.trends.map((t) => ({
              timestamp: t.timestamp,
              value: t.avgScore,
            })),
            color: '#eab308',
          },
        ],
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch anomaly trends';
      set({ error: message, isLoading: false });
    }
  },

  fetchSeverityHeatmap: async () => {
    set({ isLoading: true, error: null });

    try {
      const { filters } = get();
      const response = await api.get<{
        heatmap: AIState['severityHeatmap'];
      }>('/ai/heatmap', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      set({ severityHeatmap: response.heatmap, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch severity heatmap';
      set({ error: message, isLoading: false });
    }
  },

  setFilters: (newFilters) => {
    const { filters } = get();
    set({ filters: { ...filters, ...newFilters } });
  },

  clearFilters: () => {
    set({ filters: {} });
  },

  clearError: () => set({ error: null }),
}));
