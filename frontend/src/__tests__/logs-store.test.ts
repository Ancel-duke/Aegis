import { renderHook, act } from '@testing-library/react';
import { useLogsStore } from '@/stores/logs-store';
import { api } from '@/lib/api/client';
import { LogEntry, LogLevel } from '@/types';

jest.mock('@/lib/api/client');

describe('LogsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLogsStore.setState({
      logs: [],
      filters: {},
      availableServices: [],
      isLoading: false,
      isStreaming: false,
      error: null,
    });
  });

  describe('fetchLogs', () => {
    it('should fetch logs with filters', async () => {
      const mockLogs: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'backend',
          message: 'Test error',
        },
      ];

      (api.get as jest.Mock).mockResolvedValueOnce(mockLogs);

      const { result } = renderHook(() => useLogsStore());

      await act(async () => {
        await result.current.fetchLogs();
      });

      expect(result.current.logs).toHaveLength(1);
      expect(result.current.logs[0].level).toBe('error');
    });

    it('should handle empty response gracefully', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useLogsStore());

      await act(async () => {
        await result.current.fetchLogs();
      });

      expect(result.current.logs).toHaveLength(0);
    });
  });

  describe('addLog', () => {
    it('should add new log entry', () => {
      const { result } = renderHook(() => useLogsStore());

      const newLog: LogEntry = {
        id: '2',
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'frontend',
        message: 'New log entry',
      };

      act(() => {
        result.current.addLog(newLog);
      });

      expect(result.current.logs).toHaveLength(1);
      expect(result.current.logs[0].message).toBe('New log entry');
    });

    it('should update existing log', () => {
      const existingLog: LogEntry = {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'backend',
        message: 'Original message',
      };

      useLogsStore.setState({ logs: [existingLog] });

      const { result } = renderHook(() => useLogsStore());

      const updatedLog = { ...existingLog, message: 'Updated message' };

      act(() => {
        result.current.addLog(updatedLog);
      });

      expect(result.current.logs).toHaveLength(1);
      expect(result.current.logs[0].message).toBe('Updated message');
    });

    it('should limit logs to 1000 entries', () => {
      const manyLogs: LogEntry[] = Array.from({ length: 1001 }, (_, i) => ({
        id: `log-${i}`,
        timestamp: new Date().toISOString(),
        level: 'info' as LogLevel,
        service: 'backend',
        message: `Log ${i}`,
      }));

      useLogsStore.setState({ logs: manyLogs });

      const { result } = renderHook(() => useLogsStore());

      const newLog: LogEntry = {
        id: 'log-1001',
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'backend',
        message: 'New log',
      };

      act(() => {
        result.current.addLog(newLog);
      });

      expect(result.current.logs).toHaveLength(1000);
      expect(result.current.logs[0].id).toBe('log-1001');
    });
  });

  describe('setFilters', () => {
    it('should update filters', () => {
      const { result } = renderHook(() => useLogsStore());

      act(() => {
        result.current.setFilters({ level: ['error', 'warn'] });
      });

      expect(result.current.filters.level).toEqual(['error', 'warn']);
    });
  });

  describe('setStreaming', () => {
    it('should toggle streaming state', () => {
      const { result } = renderHook(() => useLogsStore());

      act(() => {
        result.current.setStreaming(true);
      });

      expect(result.current.isStreaming).toBe(true);

      act(() => {
        result.current.setStreaming(false);
      });

      expect(result.current.isStreaming).toBe(false);
    });
  });
});
