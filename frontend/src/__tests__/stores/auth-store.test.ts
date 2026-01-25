import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '@/stores/auth-store';

// Mock the API client
jest.mock('@/lib/api/client', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

import { api } from '@/lib/api/client';

const mockUser = {
  id: '1',
  email: 'test@example.com',
  username: 'testuser',
  role: 'admin' as const,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({ user: mockUser });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle login failure', async () => {
      const error = new Error('Invalid credentials');
      (api.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'wrong-password');
        })
      ).rejects.toThrow();

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
    });
  });

  describe('signup', () => {
    it('should signup successfully', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({ user: mockUser });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.signup('test@example.com', 'password123', 'testuser');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle signup failure', async () => {
      const error = new Error('Email already exists');
      (api.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.signup('test@example.com', 'password123', 'testuser');
        })
      ).rejects.toThrow();

      expect(result.current.error).toBe('Email already exists');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      // Set up initial authenticated state
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      (api.post as jest.Mock).mockResolvedValueOnce({});

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', () => {
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.hasRole('admin')).toBe(true);
      expect(result.current.hasRole('user')).toBe(false);
    });

    it('should return true for any matching role in array', () => {
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.hasRole(['admin', 'user'])).toBe(true);
      expect(result.current.hasRole(['user', 'auditor'])).toBe(false);
    });

    it('should return false when no user is logged in', () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.hasRole('admin')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin permissions', () => {
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.hasPermission('manage:policies')).toBe(true);
      expect(result.current.hasPermission('manage:users')).toBe(true);
      expect(result.current.hasPermission('view:logs')).toBe(true);
    });

    it('should return false for invalid permissions', () => {
      useAuthStore.setState({
        user: { ...mockUser, role: 'user' },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.hasPermission('manage:policies')).toBe(false);
      expect(result.current.hasPermission('manage:users')).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear the error state', () => {
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Some error',
      });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
