import { renderHook, act } from '@testing-library/react';
import { useAIStore } from '@/stores/ai-store';
import { api } from '@/lib/api/client';
import { AnomalyPrediction } from '@/types';

jest.mock('@/lib/api/client');

describe('AIStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAIStore.setState({
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
    });
  });

  describe('fetchAnomalies', () => {
    it('should fetch and calculate severity trends', async () => {
      const mockAnomalies: AnomalyPrediction[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          metric: 'cpu',
          value: 95,
          predicted: 80,
          anomalyScore: 0.9,
          isAnomaly: true,
          severity: 'critical',
        },
        {
          id: '2',
          timestamp: new Date().toISOString(),
          metric: 'memory',
          value: 85,
          predicted: 70,
          anomalyScore: 0.7,
          isAnomaly: true,
          severity: 'high',
        },
      ];

      (api.get as jest.Mock).mockResolvedValueOnce(mockAnomalies);

      const { result } = renderHook(() => useAIStore());

      await act(async () => {
        await result.current.fetchAnomalies();
      });

      expect(result.current.anomalies).toHaveLength(2);
      expect(result.current.severityTrends.critical).toBe(1);
      expect(result.current.severityTrends.high).toBe(1);
    });

    it('should handle API errors', async () => {
      (api.get as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => useAIStore());

      await act(async () => {
        await result.current.fetchAnomalies();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('addAnomalyFromWebSocket', () => {
    it('should add new anomaly and update trends', () => {
      const { result } = renderHook(() => useAIStore());

      const newAnomaly: AnomalyPrediction = {
        id: '3',
        timestamp: new Date().toISOString(),
        metric: 'latency',
        value: 500,
        predicted: 200,
        anomalyScore: 0.8,
        isAnomaly: true,
        severity: 'critical',
      };

      act(() => {
        result.current.addAnomalyFromWebSocket(newAnomaly);
      });

      expect(result.current.anomalies).toHaveLength(1);
      expect(result.current.severityTrends.critical).toBe(1);
    });

    it('should update existing anomaly', () => {
      const existingAnomaly: AnomalyPrediction = {
        id: '1',
        timestamp: new Date().toISOString(),
        metric: 'cpu',
        value: 90,
        predicted: 80,
        anomalyScore: 0.7,
        isAnomaly: true,
        severity: 'high',
      };

      useAIStore.setState({ anomalies: [existingAnomaly] });

      const { result } = renderHook(() => useAIStore());

      const updatedAnomaly = { ...existingAnomaly, severity: 'critical' as const };

      act(() => {
        result.current.addAnomalyFromWebSocket(updatedAnomaly);
      });

      expect(result.current.anomalies).toHaveLength(1);
      expect(result.current.anomalies[0].severity).toBe('critical');
    });
  });
});
