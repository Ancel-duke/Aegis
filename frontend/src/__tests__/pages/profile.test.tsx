import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from '@/app/(dashboard)/profile/page';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api/client';

jest.mock('@/stores/auth-store');
jest.mock('@/lib/api/client');
jest.mock('@/components/ui/toaster', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('ProfilePage', () => {
  const mockRefreshUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as jest.Mock).mockReturnValue({
      user: {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      refreshUser: mockRefreshUser,
    });
  });

  it('should render profile page', () => {
    render(<ProfilePage />);
    expect(screen.getByText(/profile/i)).toBeInTheDocument();
    expect(screen.getByText(/john/i)).toBeInTheDocument();
  });

  it('should display user information', () => {
    render(<ProfilePage />);
    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
  });

  it('should allow profile update', async () => {
    const user = userEvent.setup();
    (api.patch as jest.Mock).mockResolvedValueOnce({});

    render(<ProfilePage />);

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jane');

    const saveButton = screen.getByText(/save changes/i);
    await user.click(saveButton);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalled();
    });
  });

  it('should allow password change', async () => {
    const user = userEvent.setup();
    (api.patch as jest.Mock).mockResolvedValueOnce({});

    render(<ProfilePage />);

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    await user.type(currentPasswordInput, 'OldPass123!');
    await user.type(newPasswordInput, 'NewPass123!');
    await user.type(confirmPasswordInput, 'NewPass123!');

    const changePasswordButton = screen.getByText(/change password/i);
    await user.click(changePasswordButton);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalled();
    });
  });

  it('should validate password match', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    await user.type(newPasswordInput, 'NewPass123!');
    await user.type(confirmPasswordInput, 'Different123!');

    const changePasswordButton = screen.getByText(/change password/i);
    await user.click(changePasswordButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });
});
