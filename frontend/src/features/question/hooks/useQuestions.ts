import { useQuery } from '@tanstack/react-query';
import { questionService } from '../services/questionService';
import { questionsKeys } from '@/shared/lib/react-query';
import { slugify } from '@/shared/lib/stringUtils';

type SortOption = 'newest' | 'oldest' | 'difficulty' | 'title';

interface UseQuestionsParams {
  page?: number;
  limit?: number;
  platform?: string;
  difficulty?: string;
  pattern?: string;        // human-readable pattern name, e.g., "Hash Table"
  tags?: string[];
  search?: string;         // user input for exact problem, e.g., "two sum"
  sort?: SortOption;
  status?: string;         // 'solved' or 'all'
}

export function useQuestions(params?: UseQuestionsParams) {
  // Build the actual query parameters for the API
  const apiParams: Record<string, any> = {};

  if (params?.page) apiParams.page = params.page;
  if (params?.limit) apiParams.limit = params.limit;
  if (params?.platform) apiParams.platform = params.platform;

  // Difficulty: omit if 'all' (backend default)
  if (params?.difficulty && params.difficulty !== 'all') {
    apiParams.difficulty = params.difficulty;
  }

  // Pattern: slugify the human-readable name
  if (params?.pattern && params.pattern !== 'all') {
    apiParams.pattern = slugify(params.pattern);
  }

  // Tags: already array
  if (params?.tags && params.tags.length > 0) {
    apiParams.tags = params.tags;
  }

  // Search: treat as exact match on platformQuestionId -> qtitle, slugify
  if (params?.search && params.search.trim()) {
    apiParams.qtitle = slugify(params.search.trim());
  }

  // Status: 'solved' or omit for 'all'
  if (params?.status === 'solved') {
    apiParams.status = 'solved';
  }

  // Sort mapping
  if (params?.sort) {
    switch (params.sort) {
      case 'newest':
        apiParams.sortBy = 'createdAt';
        apiParams.sortOrder = 'desc';
        break;
      case 'oldest':
        apiParams.sortBy = 'createdAt';
        apiParams.sortOrder = 'asc';
        break;
      case 'difficulty':
        apiParams.sortBy = 'difficulty';
        apiParams.sortOrder = 'asc';
        break;
      case 'title':
        apiParams.sortBy = 'title';
        apiParams.sortOrder = 'asc';
        break;
    }
  } else {
    // default sort
    apiParams.sortBy = 'createdAt';
    apiParams.sortOrder = 'desc';
  }

  return useQuery({
    queryKey: questionsKeys.list(apiParams),
    queryFn: () => questionService.getQuestions(apiParams),
    staleTime: 5 * 60 * 1000,
  });
}