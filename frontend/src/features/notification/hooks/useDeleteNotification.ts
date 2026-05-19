import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notificationService';
import { notificationKeys } from '@/shared/lib/react-query';
import { toast } from '@/shared/components/Toast';

/**
 * Hook to delete a single notification.
 * Automatically invalidates the notifications list and unread count cache.
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationService.deleteNotification(notificationId),
    onSuccess: () => {
      // Invalidate all notification lists (since they may contain the deleted item)
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      // Invalidate the unread count query
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
      toast.success('Notification deleted');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to delete notification';
      toast.error(message);
    },
  });
}