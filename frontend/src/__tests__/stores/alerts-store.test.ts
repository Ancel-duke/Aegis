import { renderHook, act } from '@testing-library/react';
import { useAlertsStore } from '@/stores/alerts-store';
import { Alert } from '@/types';

// Mock the API client
jest.mock('@/lib/api/client', () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

import { api } from '@/lib/api/client';

const mockAlerts: Alert[] = [
  {
    id: '1',
    title: 'Critical Alert',
    message: 'Server is down',
    severity: 'critical',
    source: 'backend',
    timestamp: '2024-01-01T12:00:00Z',
    resolved: false,
  },
  {
    id: '2',
    title: 'Warning Alert',
    message: 'High memory usage',
    severity: 'high',
    source: 'ai-engine',
    timestamp: '2024-01-01T11:00:00Z',
    resolved: false,
  },
  {
    id: '3',
    title: 'Resolved Alert',
    message: 'Issue fixed',
    severity: 'medium',
    source: 'executor',
    timestamp: '2024-01-01T10:00:00Z',
    resolved: true,
  },
];

describe('useAlertsStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAlertsStore.setState({
      alerts: [],
      filteredAlerts: [],
      selectedAlert: null,
      filters: {},
      isLoading: false,
      error: null,
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      wsConnected: false,
      unreadCount: 0,
    });
    jest.clearAllMocks();
  });

  describe('fetchAlerts', () => {
    it('should fetch alerts successfully', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        items: mockAlerts,
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });

      const { result } = renderHook(() => useAlertsStore());

      await act(async () => {
        await result.current.fetchAlerts();
      });

      expect(result.current.alerts).toHaveLength(3);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      (api.get as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAlertsStore());

      await act(async () => {
        await result.current.fetchAlerts();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('resolveAlert', () => {
    it('should resolve alert successfully', async () => {
      const resolvedAlert = { ...mockAlerts[0], resolved: true };
      (api.patch as jest.Mock).mockResolvedValueOnce(resolvedAlert);

      useAlertsStore.setState({
        alerts: mockAlerts,
        filteredAlerts: mockAlerts,
      });

      const { result } = renderHook(() => useAlertsStore());

      await act(async () => {
        await result.current.resolveAlert('1');
      });

      const alert = result.current.alerts.find((a) => a.id === '1');
      expect(alert?.resolved).toBe(true);
    });
  });

  describe('setFilters', () => {
    it('should filter alerts by severity', () => {
      useAlertsStore.setState({
        alerts: mockAlerts,
        filteredAlerts: mockAlerts,
      });

      const { result } = renderHook(() => useAlertsStore());

      act(() => {
        result.current.setFilters({ severity: ['critical'] });
      });

      expect(result.current.filteredAlerts).toHaveLength(1);
      expect(result.current.filteredAlerts[0].severity).toBe('critical');
    });

    it('should filter alerts by resolved status', () => {
      useAlertsStore.setState({
        alerts: mockAlerts,
        filteredAlerts: mockAlerts,
      });

      const { result } = renderHook(() => useAlertsStore());

      act(() => {
        result.current.setFilters({ resolved: true });
      });

      expect(result.current.filteredAlerts).toHaveLength(1);
      expect(result.current.filteredAlerts[0].resolved).toBe(true);
    });

    it('should filter alerts by source', () => {
      useAlertsStore.setState({
        alerts: mockAlerts,
        filteredAlerts: mockAlerts,
      });

      const { result } = renderHook(() => useAlertsStore());

      act(() => {
        result.current.setFilters({ source: 'backend' });
      });

      expect(result.current.filteredAlerts).toHaveLength(1);
      expect(result.current.filteredAlerts[0].source).toBe('backend');
    });
  });

  describe('clearFilters', () => {
    it('should clear all filters', () => {
      useAlertsStore.setState({
        alerts: mockAlerts,
        filteredAlerts: [mockAlerts[0]],
        filters: { severity: ['critical'] },
      });

      const { result } = renderHook(() => useAlertsStore());

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual({});
      expect(result.current.filteredAlerts).toHaveLength(3);
    });
  });

  describe('addAlert', () => {
    it('should add a new alert and increment unread count', () => {
      useAlertsStore.setState({
        alerts: mockAlerts,
        filteredAlerts: mockAlerts,
        unreadCount: 0,
      });

      const newAlert: Alert = {
        id: '4',
        title: 'New Alert',
        message: 'Something happened',
        severity: 'info',
        source: 'test',
        timestamp: new Date().toISOString(),
        resolved: false,
      };

      const { result } = renderHook(() => useAlertsStore());

      act(() => {
        result.current.addAlert(newAlert);
      });

      expect(result.current.alerts).toHaveLength(4);
      expect(result.current.unreadCount).toBe(1);
    });
  });

  describe('selectAlert', () => {
    it('should select an alert', () => {
      useAlertsStore.setState({
        alerts: mockAlerts,
        filteredAlerts: mockAlerts,
      });

      const { result } = renderHook(() => useAlertsStore());

      act(() => {
        result.current.selectAlert(mockAlerts[0]);
      });

      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('should deselect an alert', () => {
      useAlertsStore.setState({
        alerts: mockAlerts,
        filteredAlerts: mockAlerts,
        selectedAlert: mockAlerts[0],
      });

      const { result } = renderHook(() => useAlertsStore());

      act(() => {
        result.current.selectAlert(null);
      });

      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('markAllAsRead', () => {
    it('should reset unread count', () => {
      useAlertsStore.setState({
        unreadCount: 5,
      });

      const { result } = renderHook(() => useAlertsStore());

      act(() => {
        result.current.markAllAsRead();
      });

      expect(result.current.unreadCount).toBe(0);
    });
  });
});
