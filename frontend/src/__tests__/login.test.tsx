import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import LoginPage from '@/app/auth/login/page';
import { useAuthStore } from '@/stores/auth-store';

jest.mock('next/navigation');
jest.mock('@/stores/auth-store');
jest.mock('@/components/ui/toaster', () => ({
  useToast: () => ({
    error: jest.fn(),
    success: jest.fn(),
  }),
}));

describe('LoginPage', () => {
  const mockPush = jest.fn();
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuthStore as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: jest.fn(),
    });
  });

  it('should render login form', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should validate email format', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('should validate password length', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText(/password/i);
    await user.type(passwordInput, 'short');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('should call login and redirect on success', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should display error message on login failure', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    (useAuthStore as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: 'Invalid credentials',
      clearError: jest.fn(),
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
