import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertsPage from '@/app/(dashboard)/alerts/page';
import { useAlertsStore } from '@/stores/alerts-store';
import { useWebSocket } from '@/lib/websocket';

jest.mock('@/stores/alerts-store');
jest.mock('@/lib/websocket');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/components/ui/toaster', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('AlertsPage', () => {
  const mockFetchAlerts = jest.fn();
  const mockResolveAlert = jest.fn();
  const mockAcknowledgeAlert = jest.fn();
  const mockSetFilters = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAlertsStore as jest.Mock).mockReturnValue({
      alerts: [
        {
          id: '1',
          title: 'Critical Alert',
          message: 'System error',
          severity: 'critical',
          status: 'open',
          timestamp: new Date().toISOString(),
          resolved: false,
        },
      ],
      filters: {},
      isLoading: false,
      fetchAlerts: mockFetchAlerts,
      resolveAlert: mockResolveAlert,
      acknowledgeAlert: mockAcknowledgeAlert,
      setFilters: mockSetFilters,
      addAlertFromWebSocket: jest.fn(),
    });

    (useWebSocket as jest.Mock).mockReturnValue({
      isConnected: true,
      isConnecting: false,
    });
  });

  it('should render alerts page', () => {
    render(<AlertsPage />);
    expect(screen.getByText(/alerts/i)).toBeInTheDocument();
  });

  it('should fetch alerts on mount', async () => {
    render(<AlertsPage />);
    await waitFor(() => {
      expect(mockFetchAlerts).toHaveBeenCalled();
    });
  });

  it('should display alerts list', () => {
    render(<AlertsPage />);
    expect(screen.getByText(/critical alert/i)).toBeInTheDocument();
  });

  it('should allow filtering by severity', async () => {
    const user = userEvent.setup();
    render(<AlertsPage />);

    const filterButton = screen.getByText(/filters/i);
    await user.click(filterButton);

    // Filter UI should be visible
    expect(screen.getByText(/severity/i)).toBeInTheDocument();
  });

  it('should handle resolve action', async () => {
    const user = userEvent.setup();
    mockResolveAlert.mockResolvedValueOnce(undefined);

    render(<AlertsPage />);

    const resolveButton = screen.getByText(/resolve/i);
    await user.click(resolveButton);

    await waitFor(() => {
      expect(mockResolveAlert).toHaveBeenCalled();
    });
  });
});
