import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, PaginatedResponse } from '@/shared/types';
import { isPublicPath } from './publicPaths';

// ========== Configuration ==========
const getBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL environment variable is not defined');
  }
  return baseUrl;
};

const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

export const buildQueryString = (params?: Record<string, any>): string => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, String(v)));
      } else {
        searchParams.set(key, String(value));
      }
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

export interface ApiClientResponse<T = any> {
  data: T;
  meta: Record<string, any>;
  status: number;
  statusText: string;
  headers: any;
  config: InternalAxiosRequestConfig;
}

export function isPaginatedResponse<T>(
  response: ApiClientResponse<T>
): response is ApiClientResponse<T> & { meta: { pagination: NonNullable<PaginatedResponse<T>['meta']['pagination']> } } {
  return !!response.meta?.pagination;
}

// ========== Create Axios Instance ==========
const apiClient: AxiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ========== Token Refresh Queue ==========
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void; }> = [];
let isRedirecting = false;

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 🔧 MODIFIED: Check public path before redirect
const clearTokensAndRedirect = () => {
  if (typeof window === 'undefined') return;
  if (isRedirecting) return;

  const currentPath = window.location.pathname;
  // ✅ Do not redirect if on a public path
  if (isPublicPath(currentPath)) {
    console.log('Skipping redirect – public path:', currentPath);
    return;
  }

  isRedirecting = true;
  const isLoginPage = currentPath === '/login';
  const isCallbackPage = currentPath === '/auth/callback';

  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_id');

  const secure = window.location.protocol === 'https:';
  document.cookie = `auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=strict${secure ? '; secure' : ''}`;

  if (isLoginPage || isCallbackPage) {
    isRedirecting = false;
    return;
  }

  const returnTo = window.location.pathname + window.location.search + window.location.hash;
  if (!returnTo.startsWith('/login')) {
    localStorage.setItem('returnTo', returnTo);
  }
  window.location.href = '/login';
};

// ========== Conditionally Add Interceptors (only in browser) ==========
if (typeof window !== 'undefined') {
  // Request interceptor – add token
  apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    error => Promise.reject(error)
  );

  // Response interceptor – handle 401 and token refresh
  apiClient.interceptors.response.use(
    response => {
      const apiResponse = response.data as ApiResponse;
      if (apiResponse.success === false) {
        const error = new Error(apiResponse.message || 'Request failed');
        (error as any).response = response;
        (error as any).isApiError = true;
        throw error;
      }
      return {
        data: apiResponse.data,
        meta: apiResponse.meta,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config: response.config,
      } as ApiClientResponse;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      const requestUrl = originalRequest?.url || '';
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

      // 🛡️ Homepage guard: skip 401 handling for /users/me on the root path
      if (currentPath === '/' && requestUrl.includes('/users/me')) {
        return Promise.reject(error);
      }

      // ---- Guards to prevent loops ----
      const pathname = window.location.pathname;
      if (isPublicPath(pathname)) {
        // ✅ If on a public page, do not redirect – just reject the error
        return Promise.reject(error);
      }
      if (pathname === '/login' || pathname === '/auth/callback') {
        return Promise.reject(error);
      }
      if (requestUrl.includes('/auth/refresh') || requestUrl.includes('/auth/exchange')) {
        return Promise.reject(error);
      }

      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        clearTokensAndRedirect();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      isRefreshing = true;
      try {
        const refreshResponse = await axios.post(
          `${getBaseUrl()}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );
        const { token: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data.data;
        localStorage.setItem('auth_token', newAccessToken);
        localStorage.setItem('refresh_token', newRefreshToken);
        const secure = window.location.protocol === 'https:';
        document.cookie = `auth_token=${newAccessToken}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=strict${secure ? '; secure' : ''}`;
        processQueue(null, newAccessToken);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        clearTokensAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
  );
}

export default apiClient;