import { useQuery } from '@tanstack/react-query';
import { sheetService } from '../services/sheetsService';
import type { GetSheetsParams, SheetsListResponse } from '../types/sheets.types';

const sheetsKeys = {
  all: ['sheets'] as const,
  lists: () => [...sheetsKeys.all, 'list'] as const,
  list: (params?: GetSheetsParams) => [...sheetsKeys.lists(), params] as const,
  bookmarks: (params?: { page?: number; limit?: number; search?: string }) => 
    [...sheetsKeys.all, 'bookmarks', params] as const,
  count: () => [...sheetsKeys.all, 'count'] as const,
};

export function useSheets(params?: GetSheetsParams) {
  return useQuery({
    queryKey: sheetsKeys.list(params),
    queryFn: () => sheetService.getSheets(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

export { sheetsKeys };