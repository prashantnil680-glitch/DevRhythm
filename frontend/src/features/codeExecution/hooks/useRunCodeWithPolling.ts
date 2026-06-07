/**
 * src/features/codeExecution/hooks/useRunCodeWithPolling.ts
 * 
 * Handles async code execution with polling.
 * Returns a mutation that resolves with the final execution result,
 * and distinguishes between job completion and test success/failure.
 * 
 * Optimized with exponential backoff polling to reduce unnecessary requests.
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

// Polling configuration
const BASE_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 5000;
const BACKOFF_FACTOR = 1.5;
const MAX_POLL_ATTEMPTS = 60;

function extractJobId(response: any): string | null {
  if (!response) return null;
  if (response.jobId) return response.jobId;
  if (response.data?.jobId) return response.data.jobId;
  if (response.data?.data?.jobId) return response.data.data.jobId;
  return null;
}

/**
 * Exponential backoff delay calculation
 */
function getNextPollInterval(currentInterval: number): number {
  const next = currentInterval * BACKOFF_FACTOR;
  return Math.min(next, MAX_POLL_INTERVAL_MS);
}

/**
 * Poll for job result with exponential backoff
 */
async function pollForResult(
  jobId: string,
  onStatusUpdate: (status: ExecutionStatus) => void
): Promise<ExecutionResult> {
  let attempts = 0;
  let currentInterval = BASE_POLL_INTERVAL_MS;
  let lastStatus: ExecutionStatus | null = null;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const backendResponse = await codeExecutionService.getResult(jobId);
    const apiStatus = backendResponse.data?.status ?? backendResponse.status;
    const result = backendResponse.data?.result ?? backendResponse.result;

    // Update UI status only when it changes
    let uiStatus: ExecutionStatus = 'pending';
    if (apiStatus === 'pending') uiStatus = 'pending';
    else if (apiStatus === 'processing') uiStatus = 'processing';
    else if (apiStatus === 'completed') uiStatus = 'completed';
    else if (apiStatus === 'failed') uiStatus = 'failed';

    if (uiStatus !== lastStatus) {
      onStatusUpdate(uiStatus);
      lastStatus = uiStatus;
    }

    if (apiStatus === 'completed') {
      if (!result) throw new Error('Completed job returned no result');
      const finalStatus = result.allPassed === true ? 'completed' : 'failed';
      if (finalStatus !== lastStatus) onStatusUpdate(finalStatus);
      return result;
    }

    if (apiStatus === 'failed') {
      const errorMsg = backendResponse.data?.error ?? backendResponse.error ?? 'Execution failed';
      onStatusUpdate('failed');
      throw new Error(errorMsg);
    }

    // Exponential backoff wait
    await new Promise(resolve => setTimeout(resolve, currentInterval));
    currentInterval = getNextPollInterval(currentInterval);
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