import { useQuery } from '@tanstack/react-query';
import { questionService } from '../services/questionService';
import { questionsKeys } from '@/shared/lib/react-query';

export function useSimilarQuestions(questionId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [...questionsKeys.detail(questionId), 'similar'],
    queryFn: () => questionService.getSimilarQuestions(questionId),
    enabled: enabled && !!questionId,
    staleTime: 60 * 60 * 1000, // 1 hour – similar questions rarely change
    refetchOnWindowFocus: false,
    refetchOnMount: false, // rely on server-provided initial data
    retry: 2,
    retryDelay: 1000,
  });
}