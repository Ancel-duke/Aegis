import { create } from 'zustand';
import { LogEntry, LogLevel, LogFilters, PaginatedResponse } from '@/types';
import { api } from '@/lib/api/client';

interface LogsState {
  logs: LogEntry[];
  selectedLog: LogEntry | null;
  filters: LogFilters;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  availableServices: string[];
  isStreaming: boolean;
}

interface LogsActions {
  fetchLogs: (page?: number, limit?: number) => Promise<void>;
  fetchLog: (id: string) => Promise<void>;
  fetchServices: () => Promise<void>;
  setFilters: (filters: Partial<LogFilters>) => void;
  clearFilters: () => void;
  selectLog: (log: LogEntry | null) => void;
  addLog: (log: LogEntry) => void;
  setStreaming: (streaming: boolean) => void;
  clearError: () => void;
}

type LogsStore = LogsState & LogsActions;

const initialFilters: LogFilters = {
  level: undefined,
  service: undefined,
  startDate: undefined,
  endDate: undefined,
  search: undefined,
};

const initialState: LogsState = {
  logs: [],
  selectedLog: null,
  filters: initialFilters,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0,
  },
  availableServices: [],
  isStreaming: false,
};

export const useLogsStore = create<LogsStore>((set, get) => ({
  ...initialState,

  fetchLogs: async (page = 1, limit = 100) => {
    set({ isLoading: true, error: null });

    try {
      const { filters } = get();
      const params = {
        page,
        limit,
        ...filters,
        level: filters.level?.join(','),
        service: filters.service?.join(','),
      };

      const response = await api.get<PaginatedResponse<LogEntry>>('/logs', params);

      set({
        logs: response.items,
        isLoading: false,
        pagination: {
          page: response.page,
          limit: response.limit,
          total: response.total,
          totalPages: response.totalPages,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch logs';
      set({ error: message, isLoading: false });
    }
  },

  fetchLog: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const log = await api.get<LogEntry>(`/logs/${id}`);
      set({ selectedLog: log, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch log';
      set({ error: message, isLoading: false });
    }
  },

  fetchServices: async () => {
    try {
      const response = await api.get<{ services: string[] }>('/logs/services');
      set({ availableServices: response.services });
    } catch (error) {
      console.error('Failed to fetch services:', error);
    }
  },

  setFilters: (newFilters: Partial<LogFilters>) => {
    const { filters } = get();
    set({ filters: { ...filters, ...newFilters } });
  },

  clearFilters: () => {
    set({ filters: initialFilters });
  },

  selectLog: (log: LogEntry | null) => {
    set({ selectedLog: log });
  },

  addLog: (log: LogEntry) => {
    const { logs } = get();
    // Keep only last 1000 logs in memory when streaming
    const newLogs = [log, ...logs].slice(0, 1000);
    set({ logs: newLogs });
  },

  setStreaming: (streaming: boolean) => {
    set({ isStreaming: streaming });
  },

  clearError: () => set({ error: null }),
}));

// Log level colors for UI
export const logLevelColors: Record<LogLevel, string> = {
  debug: 'text-gray-500 bg-gray-500/10',
  info: 'text-blue-500 bg-blue-500/10',
  warn: 'text-yellow-500 bg-yellow-500/10',
  error: 'text-red-500 bg-red-500/10',
  fatal: 'text-red-700 bg-red-700/10',
};
