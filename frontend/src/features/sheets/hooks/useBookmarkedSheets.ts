import { useQuery } from '@tanstack/react-query';
import { sheetService } from '../services/sheetsService';
import { sheetsKeys } from './useSheets';

interface UseBookmarkedSheetsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export function useBookmarkedSheets(params?: UseBookmarkedSheetsParams) {
  return useQuery({
    queryKey: sheetsKeys.bookmarks(params),
    queryFn: () => sheetService.getBookmarkedSheets(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}