import { renderHook, act } from '@testing-library/react';
import { useMetricsStore } from '@/stores/metrics-store';
import { api } from '@/lib/api/client';

jest.mock('@/lib/api/client');

describe('MetricsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMetricsStore.setState({
      current: null,
      historical: [],
      isLoading: false,
      error: null,
      lastFetched: null,
    });
  });

  describe('fetchCurrent', () => {
    it('should fetch and store current metrics', async () => {
      const mockMetrics = {
        openAlerts: 5,
        timestamp: new Date().toISOString(),
      };

      (api.get as jest.Mock).mockResolvedValueOnce(mockMetrics);

      const { result } = renderHook(() => useMetricsStore());

      await act(async () => {
        await result.current.fetchCurrent();
      });

      expect(result.current.current).toEqual(mockMetrics);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('fetchHistorical', () => {
    it('should fetch and store historical metrics', async () => {
      const mockHistorical = [
        { date: '2024-01-01', severity: 'critical', count: 10 },
        { date: '2024-01-01', severity: 'high', count: 5 },
      ];

      (api.get as jest.Mock).mockResolvedValueOnce(mockHistorical);

      const { result } = renderHook(() => useMetricsStore());

      await act(async () => {
        await result.current.fetchHistorical(7);
      });

      expect(result.current.historical).toEqual(mockHistorical);
    });
  });

  describe('refresh', () => {
    it('should fetch both current and historical', async () => {
      (api.get as jest.Mock)
        .mockResolvedValueOnce({ openAlerts: 3, timestamp: new Date().toISOString() })
        .mockResolvedValueOnce([]);

      const { result } = renderHook(() => useMetricsStore());

      await act(async () => {
        await result.current.refresh();
      });

      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });
});
