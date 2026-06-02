import { useQuery } from '@tanstack/react-query';
import { sheetService } from '../services/sheetsService';
import type { SheetDetailsResponse } from '../types/sheets.types';

export interface SheetQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  solveStatus?: string;
  revisionStatus?: string;
  difficulty?: string;
}

/**
 * Hook to fetch a single sheet by slug with optional filtering and pagination.
 * @param slug - The sheet slug (URL-friendly identifier)
 * @param params - Optional query parameters for filtering questions
 * @returns React Query result with data, isLoading, error, refetch
 */
export function useSheet(slug: string, params?: SheetQueryParams) {
  const queryKey = ['sheets', 'detail', slug, params].filter(Boolean);
  return useQuery({
    queryKey,
    queryFn: () => sheetService.getSheetBySlug(slug, params),
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// Re-export the query key for invalidation if needed elsewhere
export const sheetDetailKey = (slug: string, params?: SheetQueryParams) =>
  ['sheets', 'detail', slug, params].filter(Boolean);