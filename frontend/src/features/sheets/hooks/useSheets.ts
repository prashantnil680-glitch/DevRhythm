import { useQuery } from '@tanstack/react-query';
import { sheetService } from '../services/sheetsService';
import type { GetSheetsParams, SheetsListResponse } from '../types/sheets.types';

// Helper to create a stable string representation of params
function stableStringify(obj: any): string {
  if (!obj || typeof obj !== 'object') return JSON.stringify(obj);
  const sorted: Record<string, any> = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = obj[key];
  });
  return JSON.stringify(sorted);
}

const sheetsKeys = {
  all: ['sheets'] as const,
  lists: () => [...sheetsKeys.all, 'list'] as const,
  list: (params?: GetSheetsParams, isAuthenticated?: boolean) => {
    const serializedParams = params ? stableStringify(params) : undefined;
    return [...sheetsKeys.lists(), { params: serializedParams, authenticated: isAuthenticated }] as const;
  },
  bookmarks: (params?: { page?: number; limit?: number; search?: string }) => {
    const serializedParams = params ? stableStringify(params) : undefined;
    return [...sheetsKeys.all, 'bookmarks', serializedParams] as const;
  },
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