import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, UserRole } from '@/types';
import { api } from '@/lib/api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
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
  isLoading: true,
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
          const response = await api.post<{ user: User }>('/auth/login', {
            email,
            password,
          });
          
          set({
            user: response.user,
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

      signup: async (email: string, password: string, username: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.post<{ user: User }>('/auth/signup', {
            email,
            password,
            username,
          });
          
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Signup failed';
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // Continue with logout even if API fails
        } finally {
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
          const response = await api.get<{ user: User }>('/auth/me');
          
          set({
            user: response.user,
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
