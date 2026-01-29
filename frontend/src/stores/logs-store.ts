import { create } from 'zustand';
import { LogEntry, LogLevel } from '@/types';
import { api } from '@/lib/api/client';

interface LogsState {
  logs: LogEntry[];
  filters: {
    level?: LogLevel[];
    service?: string[];
    startDate?: string;
    endDate?: string;
    search?: string;
  };
  availableServices: string[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
}

interface LogsActions {
  fetchLogs: () => Promise<void>;
  fetchServices: () => Promise<void>;
  setFilters: (filters: Partial<LogsState['filters']>) => void;
  clearFilters: () => void;
  addLog: (log: LogEntry) => void;
  setStreaming: (streaming: boolean) => void;
  clearError: () => void;
}

type LogsStore = LogsState & LogsActions;

export const logLevelColors: Record<LogLevel, string> = {
  debug: 'text-gray-500',
  info: 'text-blue-500',
  warn: 'text-yellow-500',
  error: 'text-red-500',
  fatal: 'text-red-700',
};

export const useLogsStore = create<LogsStore>((set, get) => ({
  logs: [],
  filters: {},
  availableServices: [],
  isLoading: false,
  isStreaming: false,
  error: null,

  fetchLogs: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const params: Record<string, unknown> = {};
      if (filters.level?.length) params.level = filters.level.join(',');
      if (filters.service?.length) params.service = filters.service.join(',');
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.search) params.search = filters.search;
      
      // Note: Backend may not have /logs endpoint yet, this is a placeholder
      const response = await api.get<LogEntry[]>('/logs', params).catch(() => []);
      set({ logs: response, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
        isLoading: false,
      });
    }
  },

  fetchServices: async () => {
    try {
      // Extract unique services from logs or fetch from backend
      const { logs } = get();
      const services = Array.from(new Set(logs.map((l) => l.service)));
      set({ availableServices: services });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch services' });
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  clearFilters: () => set({ filters: {} }),

  addLog: (log) => {
    set((state) => {
      const exists = state.logs.some((l) => l.id === log.id);
      if (exists) {
        return {
          logs: state.logs.map((l) => (l.id === log.id ? log : l)),
        };
      }
      // Keep only last 1000 logs
      const newLogs = [log, ...state.logs].slice(0, 1000);
      return { logs: newLogs };
    });
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  clearError: () => set({ error: null }),
}));
