import { useQuery } from '@tanstack/react-query';
import { sheetService } from '../services/sheetsService';
import { sheetsKeys } from './useSheets';

interface UseSheetParticipantsParams {
  page?: number;
  limit?: number;
}

export function useSheetParticipants(slug: string, params?: UseSheetParticipantsParams) {
  return useQuery({
    queryKey: [...sheetsKeys.detail(slug), 'participants', params],
    queryFn: () => sheetService.getSheetParticipants(slug, params),
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  });
}