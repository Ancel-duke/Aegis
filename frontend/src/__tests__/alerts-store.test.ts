import { renderHook, act } from '@testing-library/react';
import { useAlertsStore } from '@/stores/alerts-store';
import { api } from '@/lib/api/client';
import { Alert } from '@/types';

jest.mock('@/lib/api/client');

describe('AlertsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAlertsStore.setState({
      alerts: [],
      filters: {},
      isLoading: false,
      error: null,
    });
  });

  describe('fetchAlerts', () => {
    it('should fetch and map alerts correctly', async () => {
      const mockAlerts = [
        {
          id: '1',
          title: 'Test Alert',
          description: 'Test description',
          severity: 'critical',
          status: 'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (api.get as jest.Mock).mockResolvedValueOnce(mockAlerts);

      const { result } = renderHook(() => useAlertsStore());

      await act(async () => {
        await result.current.fetchAlerts();
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].title).toBe('Test Alert');
      expect(result.current.alerts[0].resolved).toBe(false);
    });
  });

  describe('resolveAlert', () => {
    it('should optimistically update and then confirm', async () => {
      const alert: Alert = {
        id: '1',
        title: 'Test',
        message: 'Test',
        severity: 'critical',
        status: 'open',
        timestamp: new Date().toISOString(),
        resolved: false,
      };

      useAlertsStore.setState({ alerts: [alert] });

      const updatedAlert = { ...alert, status: 'resolved' };
      (api.patch as jest.Mock).mockResolvedValueOnce(updatedAlert);

      const { result } = renderHook(() => useAlertsStore());

      await act(async () => {
        await result.current.resolveAlert('1');
      });

      expect(result.current.alerts[0].status).toBe('resolved');
      expect(result.current.alerts[0].resolved).toBe(true);
    });
  });
});
