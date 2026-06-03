import { useQuery } from '@tanstack/react-query';
import { sheetService } from '../services/sheetsService';
import { sheetsKeys } from './useSheets';

interface UseUserProgressParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'solved' | 'unsolved' | 'all';
  revisionStatus?: 'completed' | 'pending' | 'all';
  difficulty?: 'easy' | 'medium' | 'hard';
  sortBy?: 'title' | 'difficulty' | 'lastUpdated' | 'solved' | 'revisionCompleted';
  sortOrder?: 'asc' | 'desc';
}

export function useUserProgress(slug: string, username: string, params?: UseUserProgressParams) {
  return useQuery({
    queryKey: [...sheetsKeys.detail(slug), 'progress', username, params],
    queryFn: () => sheetService.getUserProgress(slug, username, params),
    enabled: !!slug && !!username,
    staleTime: 1 * 60 * 1000,
  });
}