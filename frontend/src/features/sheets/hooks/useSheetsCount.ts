import { useQuery } from '@tanstack/react-query';
import { sheetService } from '../services/sheetsService';
import { sheetsKeys } from './useSheets';

/**
 * Hook to fetch the total number of active sheets.
 * @returns React Query result with count, isLoading, error
 */
export function useSheetsCount() {
  return useQuery({
    queryKey: sheetsKeys.count(),
    queryFn: () => sheetService.getSheetsCount(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}