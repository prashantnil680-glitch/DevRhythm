import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { questionService } from '../services/questionService';
import { questionsKeys } from '@/shared/lib/react-query';
import { slugify } from '@/shared/lib/stringUtils';

type SortOption = 'newest' | 'oldest' | 'difficulty' | 'title';

interface UseQuestionsParams {
  page?: number;
  limit?: number;
  platform?: string;
  difficulty?: string;
  pattern?: string;
  tags?: string[];
  search?: string;
  sort?: SortOption;
  status?: string;
}

export function useQuestions(params?: UseQuestionsParams) {
  const apiParams: Record<string, any> = {};

  if (params?.page) apiParams.page = params.page;
  if (params?.limit) apiParams.limit = params.limit;
  if (params?.platform) apiParams.platform = params.platform;

  if (params?.difficulty && params.difficulty !== 'all') {
    apiParams.difficulty = params.difficulty;
  }

  if (params?.pattern && params.pattern !== 'all') {
    apiParams.pattern = slugify(params.pattern);
  }

  if (params?.tags && params.tags.length > 0) {
    apiParams.tags = params.tags;
  }

  if (params?.search && params.search.trim()) {
    apiParams.qtitle = slugify(params.search.trim());
  }

  if (params?.status === 'solved') {
    apiParams.status = 'solved';
  }

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
    apiParams.sortBy = 'createdAt';
    apiParams.sortOrder = 'desc';
  }

  return useQuery({
    queryKey: questionsKeys.list(apiParams),
    queryFn: () => questionService.getQuestions(apiParams),
    staleTime: 5 * 60 * 1000, // 5 minutes – data rarely changes
    refetchOnWindowFocus: false, // avoid refetching when tab becomes active
    placeholderData: keepPreviousData,
  });
}