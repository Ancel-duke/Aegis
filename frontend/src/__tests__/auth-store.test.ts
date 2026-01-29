import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api/client';

jest.mock('@/lib/api/client');

describe('AuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  describe('login', () => {
    it('should login successfully and set user', async () => {
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'John',
        roles: [{ name: 'user' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (api.post as jest.Mock).mockResolvedValueOnce(mockTokens);
      (api.get as jest.Mock).mockResolvedValueOnce(mockUser);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('test@example.com');
      expect(result.current.error).toBeNull();
    });

    it('should handle login failure', async () => {
      (api.post as jest.Mock).mockRejectedValueOnce(new Error('Invalid credentials'));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.login('test@example.com', 'wrong');
        } catch {
          // expected
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('logout', () => {
    it('should clear user and tokens on logout', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'test@example.com', username: 'test', role: 'user', createdAt: '', updatedAt: '' },
        isAuthenticated: true,
      });

      (api.post as jest.Mock).mockResolvedValueOnce({});

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('hasRole', () => {
    it('should return true if user has role', () => {
      useAuthStore.setState({
        user: { id: '1', email: 'test@example.com', username: 'test', role: 'admin', createdAt: '', updatedAt: '' },
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuthStore());
      expect(result.current.hasRole('admin')).toBe(true);
      expect(result.current.hasRole('user')).toBe(false);
    });
  });
});
