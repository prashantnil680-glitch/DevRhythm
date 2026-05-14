import apiClient, { ApiClientResponse, buildQueryString } from '@/shared/lib/apiClient';
import type {
  DailyTrendResponse,
  DailyTrendParams,
  MonthlyTrendResponse,
  MonthlyTrendParams,
  TodayActivityResponse,
  SocialFeedResponse,
  SocialFeedParams,
  AllActivityLogsResponse,
  ActivityLogsParams,
} from '../types/activity.types';

/**
 * Activity Dashboard API service
 * All endpoints require authentication
 */
export const activityService = {
  /**
   * GET /api/v1/trends/daily
   * Returns daily activity trends for the last N days (default 30)
   */
  async getDailyTrend(params?: DailyTrendParams): Promise<DailyTrendResponse> {
    const query = buildQueryString(params);
    const response = await apiClient.get<DailyTrendResponse>(`/trends/daily${query}`);
    return response.data;
  },

  /**
   * GET /api/v1/trends/monthly
   * Returns monthly aggregated trends for the last M months (default 12)
   */
  async getMonthlyTrend(params?: MonthlyTrendParams): Promise<MonthlyTrendResponse> {
    const query = buildQueryString(params);
    const response = await apiClient.get<MonthlyTrendResponse>(`/trends/monthly${query}`);
    return response.data;
  },

  /**
   * GET /api/v1/activity/today
   * Returns detailed breakdown of today's activity
   */
  async getTodayActivity(): Promise<TodayActivityResponse> {
    const response = await apiClient.get<TodayActivityResponse>('/activity/today');
    return response.data;
  },

  /**
   * GET /api/v1/activity/feed/today-grouped
   * Returns today's solved questions from followed users, grouped by user
   */
  async getSocialFeed(params?: SocialFeedParams): Promise<SocialFeedResponse> {
    const query = buildQueryString(params);
    const response = await apiClient.get<SocialFeedResponse>(`/activity/feed/today-grouped${query}`);
    return response.data;
  },

  /**
   * GET /api/v1/activity/
   * Returns all user's activity logs grouped by action
   * Returns full ApiClientResponse including meta.pagination
   */
  async getAllActivityLogs(params?: ActivityLogsParams): Promise<ApiClientResponse<AllActivityLogsResponse>> {
    const query = buildQueryString(params);
    const response = await apiClient.get<AllActivityLogsResponse>(`/activity${query}`);
    // apiClient interceptor returns ApiClientResponse, but TypeScript doesn't know it
    return response as unknown as ApiClientResponse<AllActivityLogsResponse>;
  },

  /**
   * GET /api/v1/activity/day/:date
   * Returns activity for a specific date (YYYY-MM-DD)
   */
  async getDayActivity(date: string): Promise<TodayActivityResponse> {
    const response = await apiClient.get<TodayActivityResponse>(`/activity/day/${date}`);
    return response.data;
  },
};

export default activityService;