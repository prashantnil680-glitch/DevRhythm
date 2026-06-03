import { useQuery } from '@tanstack/react-query';
import { sheetService } from '../services/sheetsService';
import type { GetSheetsParams, SheetsListResponse } from '../types/sheets.types';

const sheetsKeys = {
  all: ['sheets'] as const,
  lists: () => [...sheetsKeys.all, 'list'] as const,
  list: (params?: GetSheetsParams, isAuthenticated?: boolean) => 
    [...sheetsKeys.lists(), { ...params, authenticated: isAuthenticated }] as const,
  bookmarks: (params?: { page?: number; limit?: number; search?: string }) => [...sheetsKeys.all, 'bookmarks', params] as const,
  details: () => [...sheetsKeys.all, 'detail'] as const,
  detail: (slug: string) => [...sheetsKeys.details(), slug] as const,
};

interface UseSheetsOptions {
  initialData?: SheetsListResponse;
}

export function useSheets(params?: GetSheetsParams, options?: UseSheetsOptions, isAuthenticated?: boolean) {
  return useQuery({
    queryKey: sheetsKeys.list(params, isAuthenticated),
    queryFn: () => sheetService.getSheets(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    initialData: options?.initialData,
  });
}

export { sheetsKeys };