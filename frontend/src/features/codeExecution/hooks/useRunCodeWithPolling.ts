/**
 * src/features/codeExecution/hooks/useRunCodeWithPolling.ts
 * 
 * Handles async code execution with polling.
 * Returns a mutation that resolves with the final execution result,
 * and distinguishes between job completion and test success/failure.
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { codeExecutionService } from '../services/codeExecutionService';
import { toast } from '@/shared/components/Toast';
import type { ExecutionStatus } from '../components/ExecutionStatusIndicator';

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

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60;

function extractJobId(response: any): string | null {
  if (!response) return null;
  if (response.jobId) return response.jobId;
  if (response.data?.jobId) return response.data.jobId;
  if (response.data?.data?.jobId) return response.data.data.jobId;
  return null;
}

async function pollForResult(
  jobId: string,
  onStatusUpdate: (status: ExecutionStatus) => void
): Promise<ExecutionResult> {
  let attempts = 0;
  while (attempts < MAX_POLL_ATTEMPTS) {
    const backendResponse = await codeExecutionService.getResult(jobId);
    const apiStatus = backendResponse.data?.status ?? backendResponse.status;
    const result = backendResponse.data?.result ?? backendResponse.result;

    if (apiStatus === 'completed') {
      if (!result) throw new Error('Completed job returned no result');
      // Determine final UI status based on test outcome
      if (result.allPassed === true) {
        onStatusUpdate('completed');
      } else {
        onStatusUpdate('failed');
      }
      return result;
    }
    if (apiStatus === 'failed') {
      const errorMsg = backendResponse.data?.error ?? backendResponse.error ?? 'Execution failed';
      onStatusUpdate('failed');
      throw new Error(errorMsg);
    }
    // Map API status to UI status
    if (apiStatus === 'pending') onStatusUpdate('pending');
    if (apiStatus === 'processing') onStatusUpdate('processing');

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    attempts++;
  }
  onStatusUpdate('failed');
  throw new Error('Execution timed out after 2 minutes');
}

export function useRunCodeWithPolling() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ExecutionStatus>('idle');

  const mutation = useMutation({
    mutationFn: async ({ questionId, code, language, testCases }: RunCodeParams) => {
      setStatus('queued');
      const submitResponse = await codeExecutionService.execute({ questionId, code, language, testCases });
      const jobId = extractJobId(submitResponse);
      if (!jobId) {
        console.error('[RunCode] Failed to extract jobId from response:', submitResponse);
        setStatus('failed');
        throw new Error('No jobId returned from server');
      }
      console.log(`[RunCode] Job submitted: ${jobId}`);
      const result = await pollForResult(jobId, setStatus);
      return result;
    },
    onSuccess: (data, variables) => {
      if (variables.questionId) {
        queryClient.invalidateQueries({ queryKey: ['questions', variables.questionId, 'details'] });
      }
    },
    onError: (error: any) => {
      console.error('[RunCode] Mutation error:', error);
      setStatus('failed');
      const apiMessage = error.response?.data?.message;
      if (!apiMessage) {
        toast.error(error.message || 'Code execution failed');
      }
    },
  });

  const resetStatus = useCallback(() => {
    setStatus('idle');
  }, []);

  return {
    ...mutation,
    status,
    resetStatus,
  };
}