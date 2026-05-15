import apiClient, { buildQueryString, ApiClientResponse } from '@/shared/lib/apiClient';
import type { Notification } from '@/shared/types';

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}


export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const notificationService = {
  async getNotifications(params?: GetNotificationsParams): Promise<NotificationsResponse> {
    const query = buildQueryString(params);
    const response = await apiClient.get<{
      notifications: Notification[];
      unreadCount: number;
    }>(`/notifications${query}`) as ApiClientResponse<{
      notifications: Notification[];
      unreadCount: number;
    }>;

    // Extract pagination from meta (backend returns it under meta.pagination)
    const pagination = response.meta?.pagination || {
      page: params?.page || 1,
      limit: params?.limit || 20,
      total: response.data.notifications.length,
      pages: 1,
      hasNext: false,
      hasPrev: false,
    };

    return {
      notifications: response.data.notifications,
      unreadCount: response.data.unreadCount,
      pagination,
    };
  },

  async markAsRead(notificationId: string): Promise<Notification> {
    const response = await apiClient.patch<{ notification: Notification }>(
      `/notifications/${notificationId}/read`
    );
    return response.data.notification;
  },

  async markMultipleAsRead(notificationIds: string[]): Promise<{ modifiedCount: number }> {
    const response = await apiClient.post<{ modifiedCount: number }>(
      '/notifications/read-multiple',
      { notificationIds }
    );
    return response.data;
  },

  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    const response = await apiClient.post('/notifications/read-all');
    return response.data;
  },

  async deleteNotification(notificationId: string): Promise<void> {
    await apiClient.delete(`/notifications/${notificationId}`);
  },

  async getUnreadCount(): Promise<{ unreadCount: number }> {
    const response = await apiClient.get('/notifications/unread-count');
    return response.data;
  },
};