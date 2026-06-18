'use client';

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import type { AxiosRequestConfig } from 'axios';
import apiClient from '@/shared/lib/apiClient';

// ============================================================
// Types
// ============================================================

export interface RateLimitState {
  /** Whether a rate limit is currently active */
  isRateLimited: boolean;
  /** The total number of seconds the user must wait (initial) */
  retryAfterSeconds: number;
  /** The number of seconds remaining (countdown) */
  remainingTime: number;
  /** The original request configuration that was rate‑limited */
  originalRequest: AxiosRequestConfig | null;
}

export interface RateLimitContextValue extends RateLimitState {
  /** Activate rate‑limit state with the given request and wait duration */
  setRateLimited: (request: AxiosRequestConfig, seconds: number) => void;
  /** Reset the state (clear rate limit) */
  clearRateLimited: () => void;
  /** Retry the original request; returns a promise that resolves when the retry succeeds */
  retryRequest: () => Promise<unknown>;
  /** Manually update the remaining time (used by the toast countdown) */
  setRemainingTime: (seconds: number) => void;
}

// ============================================================
// Global bridge – allows the Axios interceptor to call setRateLimited
// ============================================================

type SetRateLimitedFn = (request: AxiosRequestConfig, seconds: number) => void;

let globalSetRateLimited: SetRateLimitedFn | null = null;

export const setRateLimitedGlobal = (fn: SetRateLimitedFn) => {
  globalSetRateLimited = fn;
};

export const getRateLimitedGlobal = (): SetRateLimitedFn | null => {
  return globalSetRateLimited;
};

// ============================================================
// Context
// ============================================================

const RateLimitContext = createContext<RateLimitContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface RateLimitProviderProps {
  children: ReactNode;
}

export const RateLimitProvider: React.FC<RateLimitProviderProps> = ({ children }) => {
  // ---- State ----
  const [state, setState] = useState<RateLimitState>({
    isRateLimited: false,
    retryAfterSeconds: 0,
    remainingTime: 0,
    originalRequest: null,
  });

  // ---- Refs ----
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const retryInProgressRef = useRef<boolean>(false);

  // ---- Cleanup timer ----
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ---- Core actions ----
  const clearRateLimited = useCallback(() => {
    clearTimer();
    setState({
      isRateLimited: false,
      retryAfterSeconds: 0,
      remainingTime: 0,
      originalRequest: null,
    });
  }, [clearTimer]);

  const setRateLimited = useCallback(
    (request: AxiosRequestConfig, seconds: number) => {
      // If we're already rate‑limited and the new limit is shorter, ignore it.
      // If the new limit is longer, update the remaining time to the longer duration.
      if (state.isRateLimited) {
        if (seconds <= state.remainingTime) {
          return; // existing limit is longer or equal, ignore new one
        }
        // New limit is longer – extend the wait.
        clearTimer();
        setState((prev) => ({
          ...prev,
          retryAfterSeconds: seconds,
          remainingTime: seconds,
        }));
        // Restart the countdown with the new duration.
        const interval = setInterval(() => {
          setState((prev) => {
            const newRemaining = prev.remainingTime - 1;
            if (newRemaining <= 0) {
              clearInterval(interval);
              return {
                ...prev,
                remainingTime: 0,
              };
            }
            return {
              ...prev,
              remainingTime: newRemaining,
            };
          });
        }, 1000);
        timerRef.current = interval;
        return;
      }

      // First time being rate‑limited.
      clearTimer(); // ensure no stray timer
      setState({
        isRateLimited: true,
        retryAfterSeconds: seconds,
        remainingTime: seconds,
        originalRequest: request,
      });

      // Start countdown.
      const interval = setInterval(() => {
        setState((prev) => {
          const newRemaining = prev.remainingTime - 1;
          if (newRemaining <= 0) {
            clearInterval(interval);
            return {
              ...prev,
              remainingTime: 0,
            };
          }
          return {
            ...prev,
            remainingTime: newRemaining,
          };
        });
      }, 1000);
      timerRef.current = interval;
    },
    [state.isRateLimited, state.remainingTime, clearTimer]
  );

  const setRemainingTime = useCallback((seconds: number) => {
    setState((prev) => ({
      ...prev,
      remainingTime: Math.max(0, seconds),
    }));
  }, []);

  const retryRequest = useCallback(() => {
    if (!state.originalRequest) {
      return Promise.reject(new Error('No request to retry'));
    }

    if (retryInProgressRef.current) {
      return Promise.reject(new Error('Retry already in progress'));
    }

    retryInProgressRef.current = true;

    // Keep the state active but set remainingTime to 0 so the button shows "Retry now".
    setState((prev) => ({ ...prev, remainingTime: 0 }));

    const config = { ...state.originalRequest };

    return apiClient
      .request(config)
      .then((response) => {
        clearRateLimited();
        return response;
      })
      .catch((error) => {
        // If the error is a 429, the interceptor will see that isRateLimited is true
        // and will not trigger a new toast. We keep the state active with remainingTime=0.
        // If the error is something else, we clear the rate-limit state.
        if (error.response?.status !== 429) {
          clearRateLimited();
        }
        // Re-throw so the caller can handle the error.
        throw error;
      })
      .finally(() => {
        retryInProgressRef.current = false;
      });
  }, [state.originalRequest, clearRateLimited]);

  // ---- Register global bridge when provider mounts ----
  // We use useEffect to set the global function after the provider mounts.
  React.useEffect(() => {
    setRateLimitedGlobal(setRateLimited);
    return () => {
      // Cleanup: clear the global reference when the provider unmounts.
      if (getRateLimitedGlobal() === setRateLimited) {
        setRateLimitedGlobal(null);
      }
    };
  }, [setRateLimited]);

  // ---- Context value ----
  const value: RateLimitContextValue = {
    ...state,
    setRateLimited,
    clearRateLimited,
    retryRequest,
    setRemainingTime,
  };

  return <RateLimitContext.Provider value={value}>{children}</RateLimitContext.Provider>;
};

// ============================================================
// Hook
// ============================================================

export const useRateLimit = (): RateLimitContextValue => {
  const context = useContext(RateLimitContext);
  if (!context) {
    throw new Error('useRateLimit must be used within a RateLimitProvider');
  }
  return context;
};

export default RateLimitProvider;