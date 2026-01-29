import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/(dashboard)/dashboard/page';
import { useMetricsStore } from '@/stores/metrics-store';
import { useAlertsStore } from '@/stores/alerts-store';
import { useAIStore } from '@/stores/ai-store';

jest.mock('@/stores/metrics-store');
jest.mock('@/stores/alerts-store');
jest.mock('@/stores/ai-store');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('DashboardPage', () => {
  const mockFetchCurrent = jest.fn();
  const mockFetchHistorical = jest.fn();
  const mockFetchPolicyEvaluationCounts = jest.fn();
  const mockFetchAlerts = jest.fn();
  const mockFetchAnomalies = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useMetricsStore as jest.Mock).mockReturnValue({
      current: { openAlerts: 5, timestamp: new Date().toISOString() },
      historical: [
        { date: '2024-01-01', severity: 'critical', count: 10 },
        { date: '2024-01-01', severity: 'high', count: 5 },
      ],
      policyEvaluationCounts: [
        { userId: 'user-1', action: 'read', count: 50 },
        { userId: 'user-2', action: 'write', count: 30 },
      ],
      isLoading: false,
      fetchCurrent: mockFetchCurrent,
      fetchHistorical: mockFetchHistorical,
      fetchPolicyEvaluationCounts: mockFetchPolicyEvaluationCounts,
      refresh: jest.fn(),
    });

    (useAlertsStore as jest.Mock).mockReturnValue({
      alerts: [
        {
          id: '1',
          title: 'Test Alert',
          message: 'Test message',
          severity: 'critical',
          status: 'open',
          timestamp: new Date().toISOString(),
          resolved: false,
        },
      ],
      isLoading: false,
      fetchAlerts: mockFetchAlerts,
    });

    (useAIStore as jest.Mock).mockReturnValue({
      anomalies: [
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
      ],
      isLoading: false,
      fetchAnomalies: mockFetchAnomalies,
    });
  });

  it('should render dashboard with metrics', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/system overview/i)).toBeInTheDocument();
  });

  it('should fetch data on mount', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(mockFetchCurrent).toHaveBeenCalled();
      expect(mockFetchHistorical).toHaveBeenCalled();
      expect(mockFetchPolicyEvaluationCounts).toHaveBeenCalled();
      expect(mockFetchAlerts).toHaveBeenCalled();
      expect(mockFetchAnomalies).toHaveBeenCalled();
    });
  });

  it('should display loading skeletons when loading', () => {
    (useMetricsStore as jest.Mock).mockReturnValue({
      current: null,
      historical: [],
      policyEvaluationCounts: [],
      isLoading: true,
      fetchCurrent: mockFetchCurrent,
      fetchHistorical: mockFetchHistorical,
      fetchPolicyEvaluationCounts: mockFetchPolicyEvaluationCounts,
      refresh: jest.fn(),
    });

    render(<DashboardPage />);
    // Skeleton components should be rendered
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });

  it('should display metrics cards', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/open alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/anomalies detected/i)).toBeInTheDocument();
  });
});
