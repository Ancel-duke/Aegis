import { create } from 'zustand';
import { Alert, AlertSeverity } from '@/types';
import { api } from '@/lib/api/client';

interface AlertsState {
  alerts: Alert[];
  filters: {
    severity?: AlertSeverity[];
    status?: 'open' | 'acknowledged' | 'resolved';
  };
  isLoading: boolean;
  error: string | null;
}

interface AlertsActions {
  fetchAlerts: () => Promise<void>;
  createAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>) => Promise<void>;
  updateAlert: (id: string, updates: Partial<Alert>) => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;
  setFilters: (filters: AlertsState['filters']) => void;
  addAlertFromWebSocket: (alert: Alert) => void;
  clearError: () => void;
}

type AlertsStore = AlertsState & AlertsActions;

export const useAlertsStore = create<AlertsStore>((set, get) => ({
  alerts: [],
  filters: {},
  isLoading: false,
  error: null,

  fetchAlerts: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const params: Record<string, unknown> = {};
      if (filters.severity?.length) params.severity = filters.severity.join(',');
      if (filters.status) params.status = filters.status;
      
      const response = await api.get<Array<{ id: string; title: string; description?: string; severity: string; status: string; createdAt: string; updatedAt: string; metadata?: Record<string, unknown> }>>('/alerts', params);
      // Map backend response to frontend Alert type
      const mappedAlerts: Alert[] = response.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        message: a.description,
        severity: a.severity as AlertSeverity,
        status: a.status as 'open' | 'acknowledged' | 'resolved',
        resolved: a.status === 'resolved',
        timestamp: a.createdAt,
        metadata: a.metadata,
      }));
      set({ alerts: mappedAlerts, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch alerts',
        isLoading: false,
      });
    }
  },

  createAlert: async (alertData) => {
    try {
      const newAlert = await api.post<Alert>('/alerts', {
        title: alertData.title,
        description: alertData.message,
        severity: alertData.severity,
        metadata: alertData.metadata,
      });
      set((state) => ({ alerts: [newAlert, ...state.alerts] }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create alert',
      });
      throw error;
    }
  },

  updateAlert: async (id, updates) => {
    try {
      const updated = await api.patch<Alert>(`/alerts/${id}`, updates);
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? updated : a)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update alert',
      });
      throw error;
    }
  },

  resolveAlert: async (id) => {
    // Optimistic update
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, status: 'resolved', resolved: true, resolvedAt: new Date().toISOString() } : a
      ),
    }));
    
    try {
      const updated = await api.patch<Alert>(`/alerts/${id}`, { status: 'resolved' });
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? updated : a)),
      }));
    } catch (error) {
      // Revert on error
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === id ? { ...a, status: 'open', resolved: false, resolvedAt: undefined } : a
        ),
      }));
      throw error;
    }
  },

  acknowledgeAlert: async (id) => {
    try {
      await api.patch(`/alerts/${id}`, { status: 'acknowledged' });
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === id ? { ...a, status: 'acknowledged' } : a
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to acknowledge alert',
      });
      throw error;
    }
  },

  setFilters: (filters) => set({ filters }),

  addAlertFromWebSocket: (alert) => {
    set((state) => {
      const exists = state.alerts.some((a) => a.id === alert.id);
      if (exists) {
        return {
          alerts: state.alerts.map((a) => (a.id === alert.id ? alert : a)),
        };
      }
      return { alerts: [alert, ...state.alerts] };
    });
  },

  clearError: () => set({ error: null }),
}));
