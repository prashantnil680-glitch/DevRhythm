import { useQuery } from '@tanstack/react-query';
import { activityService } from '../services/activityService';
import type {
  DailyTrendParams,
  MonthlyTrendParams,
  ActivityLogsParams,
  SocialFeedParams,
  AllActivityLogsResponse,
} from '../types/activity.types';

// ========== Query Keys ==========
export const activityKeys = {
  all: ['activity'] as const,
  dailyTrend: (params?: DailyTrendParams) => [...activityKeys.all, 'dailyTrend', params] as const,
  monthlyTrend: (params?: MonthlyTrendParams) => [...activityKeys.all, 'monthlyTrend', params] as const,
  today: () => [...activityKeys.all, 'today'] as const,
  socialFeed: (params?: SocialFeedParams) => [...activityKeys.all, 'socialFeed', params] as const,
  allLogs: (params?: ActivityLogsParams) => [...activityKeys.all, 'allLogs', params] as const,
};

// ========== Hooks ==========

/**
 * Hook for daily trend data (30‑day line chart)
 */
export function useDailyTrend(params?: DailyTrendParams) {
  return useQuery({
    queryKey: activityKeys.dailyTrend(params),
    queryFn: () => activityService.getDailyTrend(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for monthly trend data (12‑month bar + line chart)
 */
export function useMonthlyTrend(params?: MonthlyTrendParams) {
  return useQuery({
    queryKey: activityKeys.monthlyTrend(params),
    queryFn: () => activityService.getMonthlyTrend(params),
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Hook for today's activity (hero summary + day's questions/revisions)
 */
export function useTodayActivity() {
  return useQuery({
    queryKey: activityKeys.today(),
    queryFn: () => activityService.getTodayActivity(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for social feed (followed users' solved questions today)
 */
export function useSocialFeed(params?: SocialFeedParams) {
  return useQuery({
    queryKey: activityKeys.socialFeed(params),
    queryFn: () => activityService.getSocialFeed(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for all activity logs (grouped by action with pagination)
 * Returns { logs, pagination, isLoading, error }
 * Supports 'type' parameter for revision_completed (on_time/overdue)
 */
export function useAllActivityLogs(params?: ActivityLogsParams) {
  return useQuery({
    queryKey: activityKeys.allLogs(params),
    queryFn: () => activityService.getAllActivityLogs(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    select: (response) => ({
      logs: response.data,
      pagination: response.meta?.pagination,
    }),
  });
}

/**
 * Hook for activity on a specific date
 */
export function useDayActivity(date: string) {
  return useQuery({
    queryKey: [...activityKeys.all, 'day', date],
    queryFn: () => activityService.getDayActivity(date),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!date,
  });
}