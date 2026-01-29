import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import SignupPage from '@/app/auth/signup/page';
import { useAuthStore } from '@/stores/auth-store';

jest.mock('next/navigation');
jest.mock('@/stores/auth-store');
jest.mock('@/components/ui/toaster', () => ({
  useToast: () => ({
    error: jest.fn(),
    success: jest.fn(),
  }),
}));

describe('SignupPage', () => {
  const mockPush = jest.fn();
  const mockSignup = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuthStore as jest.Mock).mockReturnValue({
      signup: mockSignup,
      isLoading: false,
      error: null,
      clearError: jest.fn(),
    });
  });

  it('should render signup form', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('should validate passwords match', async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    await user.type(screen.getByLabelText(/password/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Different123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('should validate password requirements', async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    await user.type(screen.getByLabelText(/password/i), 'weak');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('should call signup and redirect on success', async () => {
    const user = userEvent.setup();
    mockSignup.mockResolvedValueOnce(undefined);

    render(<SignupPage />);

    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith('test@example.com', 'Password123!', 'John');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});
