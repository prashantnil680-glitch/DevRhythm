import { useQuery } from '@tanstack/react-query';
import { sheetService } from '../services/sheetsService';
import { sheetsKeys } from './useSheets';

export function useAggregatedProgress(slug: string) {
  return useQuery({
    queryKey: [...sheetsKeys.detail(slug), 'aggregated-progress'],
    queryFn: () => sheetService.getAggregatedProgress(slug),
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  });
}