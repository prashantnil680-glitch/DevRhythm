import { useMutation } from '@tanstack/react-query';
import { useRef, useState, useEffect } from 'react';
import { questionService } from '../services/questionService';
import { toast } from '@/shared/components/Toast';

export function useLeetCodeFetch() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [cooldownTimer, setCooldownTimer] = useState<NodeJS.Timeout | null>(null);

  const cancelPrevious = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (cooldownTimer) clearTimeout(cooldownTimer);
    };
  }, [cooldownTimer]);

  return useMutation({
    mutationFn: async (url: string) => {
      if (retryAfter && retryAfter > Date.now()) {
        const waitSeconds = Math.ceil((retryAfter - Date.now()) / 1000);
        throw new Error(`Rate limited. Please wait ${waitSeconds} seconds.`);
      }
      cancelPrevious();
      return questionService.fetchLeetCodeQuestion(url, abortControllerRef.current?.signal);
    },
    onError: (error: any) => {
      if (error?.code === 'ERR_CANCELED' || error?.message?.includes('canceled')) {
        return;
      }

      const status = error.response?.status;

      if (status === 429) {
        const retryAfterHeader = error.response?.headers?.['retry-after'];
        let waitSeconds = 60;
        if (retryAfterHeader && !isNaN(parseInt(retryAfterHeader))) {
          waitSeconds = parseInt(retryAfterHeader);
        }
        const retryTimestamp = Date.now() + waitSeconds * 1000;
        setRetryAfter(retryTimestamp);

        if (cooldownTimer) clearTimeout(cooldownTimer);
        const timer = setTimeout(() => setRetryAfter(null), waitSeconds * 1000);
        setCooldownTimer(timer);

        toast.error(`Too many requests. Please wait ${waitSeconds} seconds.`);
        return;
      }

      if (status === 404) {
        toast.error('Problem not found on LeetCode. Please check the URL.');
        return;
      }

      if (status === 403 && error.response?.data?.message?.toLowerCase().includes('vip')) {
        toast.error('LeetCode Premium (VIP) questions are not supported.');
        return;
      }

      toast.error(error.message || 'Failed to fetch LeetCode problem');
    },
  });
}