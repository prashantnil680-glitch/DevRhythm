import apiClient, { buildQueryString, ApiClientResponse } from '@/shared/lib/apiClient';
import type { User, PublicProgressItem, HeatmapData } from '@/shared/types';

export const userService = {
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<{ user: User }>('/users/me');
    return response.data.user;
  },

  async updateUser(data: Partial<User>): Promise<User> {
    const response = await apiClient.put<{ user: User }>('/users/me', data);
    return response.data.user;
  },

  async getUserByUsername(username: string): Promise<User> {
    const response = await apiClient.get<{ user: User }>(`/users/${username}`);
    return response.data.user;
  },

  async getUserStats(): Promise<any> {
    const response = await apiClient.get('/users/me/stats');
    return response.data;
  },

  async updateLastOnline(): Promise<{ lastOnline: string }> {
    const response = await apiClient.put('/users/me/last-online');
    return response.data;
  },

  async deleteCurrentUser(): Promise<void> {
    await apiClient.delete('/users/me');
  },

  async searchUsers(q: string, page?: number, limit?: number): Promise<{ users: User[]; pagination: any }> {
    const params = { q, page, limit };
    const query = buildQueryString(params);
    const response = await apiClient.get<{ users: User[] }>(`/users/search${query}`) as ApiClientResponse<{ users: User[] }>;
    return {
      users: response.data.users,
      pagination: response.meta?.pagination || null,
    };
  },

  async getTopStreaks(page?: number, limit?: number): Promise<{ users: User[]; pagination: any }> {
    const params = { page, limit };
    const query = buildQueryString(params);
    const response = await apiClient.get<{ users: User[] }>(`/users/top/streaks${query}`) as ApiClientResponse<{ users: User[] }>;
    return {
      users: response.data.users,
      pagination: response.meta?.pagination || null,
    };
  },

  async getTopSolved(page?: number, limit?: number): Promise<{ users: User[]; pagination: any }> {
    const params = { page, limit };
    const query = buildQueryString(params);
    const response = await apiClient.get<{ users: User[] }>(`/users/top/solved${query}`) as ApiClientResponse<{ users: User[] }>;
    return {
      users: response.data.users,
      pagination: response.meta?.pagination || null,
    };
  },

  async checkUsernameAvailability(username: string): Promise<{ available: boolean; username: string }> {
    const response = await apiClient.get(`/users/${username}/availability`);
    return response.data;
  },

  /**
   * Get public progress for a user (solved questions).
   * @param userId - The user's ID
   * @param options - Optional parameters: limit, sortBy, sortOrder
   */
  async getUserPublicProgress(
    userId: string,
    options?: { limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }
  ): Promise<PublicProgressItem[]> {
    const params: Record<string, any> = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.sortBy) params.sortBy = options.sortBy;
    if (options?.sortOrder) params.sortOrder = options.sortOrder;
    const query = buildQueryString(params);
    const response = await apiClient.get<{ progress: PublicProgressItem[] }>(`/users/${userId}/progress${query}`);
    return response.data.progress;
  },

  /**
   * Get public heatmap data for a user for a specific year.
   * @param userId - The user's ID
   * @param year - The year (e.g., 2025)
   */
  async getUserHeatmap(userId: string, year: number): Promise<HeatmapData> {
    const response = await apiClient.get<HeatmapData>(`/users/${userId}/heatmap/${year}`);
    return response.data;
  },
  
  async getTotalUsers(): Promise<{ total: number }> {
    const response = await apiClient.get('/users/count');
    return response.data;
  },
};