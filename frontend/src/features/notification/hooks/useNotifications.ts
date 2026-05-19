import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService, GetNotificationsParams, NotificationsResponse } from '../services/notificationService';
import { notificationKeys } from '@/shared/lib/react-query';

export function useNotifications(params?: GetNotificationsParams) {
  return useQuery<NotificationsResponse>({
    queryKey: notificationKeys.list(params || {}),
    queryFn: () => notificationService.getNotifications(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    staleTime: 1 * 60 * 1000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}