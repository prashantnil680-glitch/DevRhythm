import { useQuery } from '@tanstack/react-query';
import { userService } from '../services/userService';
import { userKeys } from '@/shared/lib/react-query';

export function useTotalUsers() {
  return useQuery({
    queryKey: userKeys.totalCount(),
    queryFn: () => userService.getTotalUsers(),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000,
  });
}