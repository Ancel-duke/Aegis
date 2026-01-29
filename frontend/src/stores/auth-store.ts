import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, UserRole, ApiError } from '@/types';
import { api } from '@/lib/api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Role-based permissions
const rolePermissions: Record<UserRole, string[]> = {
  admin: [
    'view:dashboard',
    'view:alerts',
    'manage:alerts',
    'view:policies',
    'manage:policies',
    'view:logs',
    'view:metrics',
    'view:ai-insights',
    'manage:users',
    'view:profile',
    'manage:profile',
  ],
  auditor: [
    'view:dashboard',
    'view:alerts',
    'view:policies',
    'view:logs',
    'view:metrics',
    'view:ai-insights',
    'view:profile',
    'manage:profile',
  ],
  user: [
    'view:dashboard',
    'view:alerts',
    'view:profile',
    'manage:profile',
  ],
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Backend returns { accessToken, refreshToken } and sets HttpOnly cookies
          const tokenResponse = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', {
            email,
            password,
          });
          
          // Store tokens if not HttpOnly (fallback)
          if (typeof window !== 'undefined') {
            try {
              if (tokenResponse.accessToken) {
                localStorage.setItem('accessToken', tokenResponse.accessToken);
              }
              if (tokenResponse.refreshToken) {
                localStorage.setItem('refreshToken', tokenResponse.refreshToken);
              }
            } catch {
              // ignore storage errors
            }
          }
          
          // Fetch user info after login
          const userResponse = await api.get<{ id: string; email: string; firstName?: string; lastName?: string; avatar?: string; roles: Array<{ name: string }>; createdAt: string; updatedAt: string }>('/users/me');
          
          const user: User = {
            id: userResponse.id,
            email: userResponse.email,
            firstName: userResponse.firstName,
            lastName: userResponse.lastName,
            username: userResponse.firstName || userResponse.email.split('@')[0],
            avatar: userResponse.avatar,
            role: userResponse.roles?.[0]?.name === 'admin' ? 'admin' : userResponse.roles?.[0]?.name === 'auditor' ? 'auditor' : 'user',
            roles: userResponse.roles,
            createdAt: userResponse.createdAt || new Date().toISOString(),
            updatedAt: userResponse.updatedAt || new Date().toISOString(),
          };
          
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      signup: async (email: string, password: string, username: string, lastName?: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Backend expects: email, password, firstName, lastName (optional)
          const tokenResponse = await api.post<{ accessToken: string; refreshToken: string }>('/auth/signup', {
            email,
            password,
            firstName: username,
            ...(lastName !== undefined && lastName !== '' ? { lastName } : {}),
          });
          
          // Store tokens if not HttpOnly (fallback)
          if (typeof window !== 'undefined') {
            try {
              if (tokenResponse?.accessToken) {
                localStorage.setItem('accessToken', tokenResponse.accessToken);
              }
              if (tokenResponse?.refreshToken) {
                localStorage.setItem('refreshToken', tokenResponse.refreshToken);
              }
            } catch {
              // ignore storage errors
            }
          }
          
          // Fetch user info after signup
          const userResponse = await api.get<{ id: string; email: string; firstName?: string; lastName?: string; avatar?: string; roles: Array<{ name: string }>; createdAt: string; updatedAt: string }>('/users/me');
          
          const user: User = {
            id: userResponse.id,
            email: userResponse.email,
            firstName: userResponse.firstName,
            lastName: userResponse.lastName,
            username: userResponse.firstName || userResponse.email.split('@')[0],
            avatar: userResponse.avatar,
            role: userResponse.roles?.[0]?.name === 'admin' ? 'admin' : userResponse.roles?.[0]?.name === 'auditor' ? 'auditor' : 'user',
            roles: userResponse.roles,
            createdAt: userResponse.createdAt || new Date().toISOString(),
            updatedAt: userResponse.updatedAt || new Date().toISOString(),
          };
          
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message =
            (error as ApiError)?.message ??
            (error instanceof Error ? error.message : 'Signup failed');
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
          });
          throw error;
        } finally {
          set((state) => ({ ...state, isLoading: false }));
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // Continue with logout even if API fails
        } finally {
          // Clear tokens from storage
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              sessionStorage.removeItem('aegis-auth');
            } catch {
              // ignore
            }
          }
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      refreshUser: async () => {
        set({ isLoading: true });
        
        try {
          const userResponse = await api.get<{ id: string; email: string; firstName?: string; lastName?: string; avatar?: string; roles: Array<{ name: string }>; createdAt: string; updatedAt: string }>('/users/me');
          
          const user: User = {
            id: userResponse.id,
            email: userResponse.email,
            firstName: userResponse.firstName,
            lastName: userResponse.lastName,
            username: userResponse.firstName || userResponse.email.split('@')[0],
            avatar: userResponse.avatar,
            role: userResponse.roles?.[0]?.name === 'admin' ? 'admin' : userResponse.roles?.[0]?.name === 'auditor' ? 'auditor' : 'user',
            roles: userResponse.roles,
            createdAt: userResponse.createdAt || new Date().toISOString(),
            updatedAt: userResponse.updatedAt || new Date().toISOString(),
          };
          
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      clearError: () => set({ error: null }),

      hasRole: (role: UserRole | UserRole[]) => {
        const { user } = get();
        if (!user) return false;
        
        const roles = Array.isArray(role) ? role : [role];
        return roles.includes(user.role);
      },

      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        
        const permissions = rolePermissions[user.role] || [];
        return permissions.includes(permission);
      },
    }),
    {
      name: 'aegis-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
