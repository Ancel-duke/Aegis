import { create } from 'zustand';
import { Alert, AlertSeverity, AlertFilters, PaginatedResponse } from '@/types';
import { api } from '@/lib/api/client';

interface AlertsState {
  alerts: Alert[];
  filteredAlerts: Alert[];
  selectedAlert: Alert | null;
  filters: AlertFilters;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  // WebSocket state
  wsConnected: boolean;
  unreadCount: number;
}

interface AlertsActions {
  fetchAlerts: (page?: number, limit?: number) => Promise<void>;
  fetchAlert: (id: string) => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
  unresolveAlert: (id: string) => Promise<void>;
  setFilters: (filters: Partial<AlertFilters>) => void;
  clearFilters: () => void;
  selectAlert: (alert: Alert | null) => void;
  addAlert: (alert: Alert) => void;
  updateAlert: (alert: Alert) => void;
  removeAlert: (id: string) => void;
  setWsConnected: (connected: boolean) => void;
  markAllAsRead: () => void;
  clearError: () => void;
}

type AlertsStore = AlertsState & AlertsActions;

const initialFilters: AlertFilters = {
  severity: undefined,
  resolved: undefined,
  source: undefined,
  startDate: undefined,
  endDate: undefined,
};

const initialState: AlertsState = {
  alerts: [],
  filteredAlerts: [],
  selectedAlert: null,
  filters: initialFilters,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  wsConnected: false,
  unreadCount: 0,
};

// Filter alerts based on current filters
function applyFilters(alerts: Alert[], filters: AlertFilters): Alert[] {
  return alerts.filter((alert) => {
    if (filters.severity?.length && !filters.severity.includes(alert.severity)) {
      return false;
    }
    if (filters.resolved !== undefined && alert.resolved !== filters.resolved) {
      return false;
    }
    if (filters.source && alert.source !== filters.source) {
      return false;
    }
    if (filters.startDate && new Date(alert.timestamp) < new Date(filters.startDate)) {
      return false;
    }
    if (filters.endDate && new Date(alert.timestamp) > new Date(filters.endDate)) {
      return false;
    }
    return true;
  });
}

// Sort alerts by severity and timestamp
function sortAlerts(alerts: Alert[]): Alert[] {
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  return [...alerts].sort((a, b) => {
    // Unresolved first
    if (a.resolved !== b.resolved) {
      return a.resolved ? 1 : -1;
    }
    // Then by severity
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    // Then by timestamp (newest first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

export const useAlertsStore = create<AlertsStore>((set, get) => ({
  ...initialState,

  fetchAlerts: async (page = 1, limit = 20) => {
    set({ isLoading: true, error: null });

    try {
      const { filters } = get();
      const params = {
        page,
        limit,
        ...filters,
        severity: filters.severity?.join(','),
      };

      const response = await api.get<PaginatedResponse<Alert>>('/alerts', params);

      const sortedAlerts = sortAlerts(response.items);
      const filteredAlerts = applyFilters(sortedAlerts, filters);

      set({
        alerts: sortedAlerts,
        filteredAlerts,
        isLoading: false,
        pagination: {
          page: response.page,
          limit: response.limit,
          total: response.total,
          totalPages: response.totalPages,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch alerts';
      set({ error: message, isLoading: false });
    }
  },

  fetchAlert: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const alert = await api.get<Alert>(`/alerts/${id}`);
      set({ selectedAlert: alert, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch alert';
      set({ error: message, isLoading: false });
    }
  },

  resolveAlert: async (id: string) => {
    try {
      const alert = await api.patch<Alert>(`/alerts/${id}/resolve`);
      const { alerts, filters } = get();
      const updatedAlerts = alerts.map((a) => (a.id === id ? alert : a));
      const sortedAlerts = sortAlerts(updatedAlerts);

      set({
        alerts: sortedAlerts,
        filteredAlerts: applyFilters(sortedAlerts, filters),
        selectedAlert: alert,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resolve alert';
      set({ error: message });
      throw error;
    }
  },

  unresolveAlert: async (id: string) => {
    try {
      const alert = await api.patch<Alert>(`/alerts/${id}/unresolve`);
      const { alerts, filters } = get();
      const updatedAlerts = alerts.map((a) => (a.id === id ? alert : a));
      const sortedAlerts = sortAlerts(updatedAlerts);

      set({
        alerts: sortedAlerts,
        filteredAlerts: applyFilters(sortedAlerts, filters),
        selectedAlert: alert,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unresolve alert';
      set({ error: message });
      throw error;
    }
  },

  setFilters: (newFilters: Partial<AlertFilters>) => {
    const { alerts, filters } = get();
    const updatedFilters = { ...filters, ...newFilters };
    const filteredAlerts = applyFilters(alerts, updatedFilters);

    set({
      filters: updatedFilters,
      filteredAlerts,
    });
  },

  clearFilters: () => {
    const { alerts } = get();
    set({
      filters: initialFilters,
      filteredAlerts: alerts,
    });
  },

  selectAlert: (alert: Alert | null) => {
    set({ selectedAlert: alert });
  },

  addAlert: (alert: Alert) => {
    const { alerts, filters, unreadCount } = get();
    const updatedAlerts = sortAlerts([alert, ...alerts]);

    set({
      alerts: updatedAlerts,
      filteredAlerts: applyFilters(updatedAlerts, filters),
      unreadCount: unreadCount + 1,
    });
  },

  updateAlert: (alert: Alert) => {
    const { alerts, filters } = get();
    const updatedAlerts = alerts.map((a) => (a.id === alert.id ? alert : a));
    const sortedAlerts = sortAlerts(updatedAlerts);

    set({
      alerts: sortedAlerts,
      filteredAlerts: applyFilters(sortedAlerts, filters),
    });
  },

  removeAlert: (id: string) => {
    const { alerts, filters, selectedAlert } = get();
    const updatedAlerts = alerts.filter((a) => a.id !== id);

    set({
      alerts: updatedAlerts,
      filteredAlerts: applyFilters(updatedAlerts, filters),
      selectedAlert: selectedAlert?.id === id ? null : selectedAlert,
    });
  },

  setWsConnected: (connected: boolean) => {
    set({ wsConnected: connected });
  },

  markAllAsRead: () => {
    set({ unreadCount: 0 });
  },

  clearError: () => set({ error: null }),
}));
