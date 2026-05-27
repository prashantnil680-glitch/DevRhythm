import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { questionService } from '../services/questionService';
import { questionsKeys } from '@/shared/lib/react-query';

export interface PatternQuestionsData {
  pattern: {
    name: string;
    slug: string;
    totalQuestions: number;
  };
  questions: Array<{
    _id: string;
    title: string;
    problemLink: string;
    platform: string;
    platformQuestionId: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    tags: string[];
    pattern: string[];
    userStatus?: 'Not Started' | 'Attempted' | 'Solved' | 'Mastered' | null;
    solvedAt?: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function usePatternQuestions(
  patternSlug: string,
  page: number = 1,
  limit: number = 15,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...questionsKeys.lists(), 'pattern', patternSlug, { page, limit }],
    queryFn: () => questionService.getQuestionsByPattern(patternSlug, page, limit),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    enabled: options?.enabled !== false && !!patternSlug,
  });
}