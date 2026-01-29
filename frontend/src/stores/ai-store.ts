import { create } from 'zustand';
import { AnomalyPrediction, AIInsight, AlertSeverity } from '@/types';
import { api } from '@/lib/api/client';

interface AIState {
  anomalies: AnomalyPrediction[];
  insights: AIInsight[];
  severityTrends: Record<AlertSeverity, number>;
  isLoading: boolean;
  error: string | null;
}

interface AIActions {
  fetchAnomalies: () => Promise<void>;
  fetchInsights: () => Promise<void>;
  addAnomalyFromWebSocket: (anomaly: AnomalyPrediction) => void;
  clearError: () => void;
}

type AIStore = AIState & AIActions;

export const useAIStore = create<AIStore>((set, get) => ({
  anomalies: [],
  insights: [],
  severityTrends: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  },
  isLoading: false,
  error: null,

  fetchAnomalies: async () => {
    set({ isLoading: true, error: null });
    try {
      // Fetch from AI predictions endpoint or metrics
      const response = await api.get<AnomalyPrediction[]>('/ai/metrics');
      const anomalies = Array.isArray(response) ? response : [];
      
      // Calculate severity trends
      const trends: Record<AlertSeverity, number> = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      };
      
      anomalies.forEach((a) => {
        if (a.severity && trends[a.severity] !== undefined) {
          trends[a.severity] = (trends[a.severity] || 0) + 1;
        }
      });
      
      set({ anomalies, severityTrends: trends, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch anomalies',
        isLoading: false,
      });
    }
  },

  fetchInsights: async () => {
    set({ isLoading: true, error: null });
    try {
      // Mock or fetch from backend
      const insights: AIInsight[] = [];
      set({ insights, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch insights',
        isLoading: false,
      });
    }
  },

  addAnomalyFromWebSocket: (anomaly) => {
    set((state) => {
      const exists = state.anomalies.some((a) => a.id === anomaly.id);
      if (exists) {
        return {
          anomalies: state.anomalies.map((a) => (a.id === anomaly.id ? anomaly : a)),
        };
      }
      const newAnomalies = [anomaly, ...state.anomalies];
      const trends: Record<AlertSeverity, number> = { ...state.severityTrends };
      if (anomaly.severity && trends[anomaly.severity] !== undefined) {
        trends[anomaly.severity] = (trends[anomaly.severity] || 0) + 1;
      }
      return { anomalies: newAnomalies, severityTrends: trends };
    });
  },

  clearError: () => set({ error: null }),
}));
