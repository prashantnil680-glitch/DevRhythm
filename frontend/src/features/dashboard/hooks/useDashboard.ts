import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import type { DashboardResponse } from '../types/dashboard.types';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  detail: () => [...dashboardKeys.all, 'data'] as const,
};

interface UseDashboardOptions {
  initialData?: DashboardResponse;
}

export function useDashboard(initialData?: DashboardResponse) {
  return useQuery({
    queryKey: dashboardKeys.detail(),
    queryFn: () => dashboardService.getDashboard(),
    staleTime: 30 * 1000, // 30 seconds – matches server cache
    gcTime: 60 * 1000,
    initialData,
  });
}