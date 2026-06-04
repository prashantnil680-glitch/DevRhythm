import { useMutation, useQueryClient } from '@tanstack/react-query';
import { codeExecutionService } from '@/features/codeExecution/services/codeExecutionService';
import { toast } from '@/shared/components/Toast';

interface RunCodeParams {
  questionId: string;
  code: string;
  language: string;
  testCases: Array<{ stdin: string; expected: string }>;
}

interface ExecutionResult {
  results: Array<{
    passed: boolean;
    input: string;
    expected: string;
    output: string;
    error?: string;
  }>;
  passedCount: number;
  totalCount: number;
  allPassed: boolean;
}

const POLL_INTERVAL_MS = 2000; // 2 seconds
const MAX_POLL_ATTEMPTS = 60;  // 2 minutes timeout

async function pollForResult(jobId: string): Promise<ExecutionResult> {
  let attempts = 0;
  while (attempts < MAX_POLL_ATTEMPTS) {
    const response = await codeExecutionService.getResult(jobId);
    const status = response.data?.status;
    if (status === 'completed') {
      return response.data.result;
    }
    if (status === 'failed') {
      throw new Error(response.data.error || 'Code execution failed');
    }
    // still pending or processing
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    attempts++;
  }
  throw new Error('Execution timed out after 2 minutes');
}

export function useRunCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, code, language, testCases }: RunCodeParams) => {
      // 1. Submit the job
      const submitResponse = await codeExecutionService.execute({
        questionId,
        code,
        language,
        testCases,
      });

      const jobId = submitResponse.data?.jobId;
      if (!jobId) {
        // Fallback for old synchronous response (should not happen)
        return submitResponse.data;
      }

      // 2. Poll for result
      const result = await pollForResult(jobId);
      return result;
    },
    onSuccess: (data) => {
      // Invalidate question details to refresh progress, revision, etc.
      if (data?.questionId) {
        queryClient.invalidateQueries({ queryKey: ['questions', data.questionId, 'details'] });
      }
    },
    onError: (error: any) => {
      const apiMessage = error.response?.data?.message;
      if (apiMessage && typeof apiMessage === 'string') {
        // Detailed error will be shown in Results tab – no toast needed
        return;
      }
      toast.error(error.message || 'Code execution failed');
    },
  });
}