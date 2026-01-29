import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for JWT
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add JWT token from HttpOnly cookie (handled by browser) or from storage
    // If backend uses HttpOnly cookies, the browser automatically includes them
    // If not, we need to get from storage and add to Authorization header
    const accessToken = getAccessToken();
    if (accessToken && config.headers) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Add CSRF token if available
    const csrfToken = getCsrfToken();
    if (csrfToken && config.headers) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    // Add timestamp to prevent caching
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

function getAccessToken(): string | null {
  if (typeof document === 'undefined') return null;
  // Try to get from cookie (if not HttpOnly)
  const match = document.cookie.match(/accessToken=([^;]+)/);
  if (match) return match[1];
  
  // Fallback to localStorage (less secure)
  try {
    return localStorage.getItem('accessToken');
  } catch {
    return null;
  }
}

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Get refresh token from storage (if not HttpOnly)
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Call refresh endpoint
        await axios.post<{ accessToken: string; refreshToken: string }>(
          `${API_URL}/api/v1/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );

        // Retry original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Redirect to login if refresh fails
        if (typeof window !== 'undefined') {
          // Clear auth state
          try {
            sessionStorage.removeItem('aegis-auth');
            localStorage.removeItem('refreshToken');
          } catch {
            // ignore
          }
          window.location.href = '/auth/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Transform error for consistent handling
    const apiError: ApiError = {
      message: error.response?.data?.message || error.message || 'An error occurred',
      code: error.response?.data?.code || 'UNKNOWN_ERROR',
      statusCode: error.response?.status || 500,
      details: error.response?.data?.details,
    };

    return Promise.reject(apiError);
  }
);

// Helper functions
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

function getRefreshToken(): string | null {
  if (typeof document === 'undefined') return null;
  // Try to get from cookie (if not HttpOnly) or localStorage
  const match = document.cookie.match(/refreshToken=([^;]+)/);
  if (match) return match[1];
  
  // Fallback to localStorage (less secure, but needed if backend doesn't set HttpOnly)
  try {
    return localStorage.getItem('refreshToken');
  } catch {
    return null;
  }
}

// Type-safe request methods
export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    apiClient.get<T>(url, { params }).then((res) => res.data),

  post: <T>(url: string, data?: unknown) =>
    apiClient.post<T>(url, data).then((res) => res.data),

  put: <T>(url: string, data?: unknown) =>
    apiClient.put<T>(url, data).then((res) => res.data),

  patch: <T>(url: string, data?: unknown) =>
    apiClient.patch<T>(url, data).then((res) => res.data),

  delete: <T>(url: string) =>
    apiClient.delete<T>(url).then((res) => res.data),
};

export default apiClient;
