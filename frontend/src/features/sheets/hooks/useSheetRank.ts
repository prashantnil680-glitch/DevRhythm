import { useQuery } from '@tanstack/react-query';
import { sheetService } from '../services/sheetsService';
import { sheetsKeys } from './useSheets';

export function useSheetRank(slug: string) {
  return useQuery({
    queryKey: [...sheetsKeys.detail(slug), 'rank'],
    queryFn: () => sheetService.getSheetRank(slug),
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  });
}