import { useQuery } from '@tanstack/react-query';
import { questionService } from '../services/questionService';
import { questionsKeys } from '@/shared/lib/react-query';

export function useQuestionDetails(questionId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...questionsKeys.detail(questionId), 'details'],
    queryFn: () => questionService.getQuestionDetails(questionId),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}