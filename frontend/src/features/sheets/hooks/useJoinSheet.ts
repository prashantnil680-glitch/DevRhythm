import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/components/Toast';
import { sheetService } from '../services/sheetsService';
import { sheetsKeys } from './useSheets';
import { sheetDetailKey } from './useSheet';

/**
 * Hook to join a sheet.
 * On success, invalidates sheets list and detail queries, then shows a success toast.
 * @returns Mutation object with mutate, isPending, error, etc.
 */
export function useJoinSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, targetDate }: { slug: string; targetDate: string }) =>
      sheetService.joinSheet(slug, targetDate),

    onSuccess: (data, variables) => {
      // Invalidate sheets list queries (participant count changes)
      queryClient.invalidateQueries({ queryKey: sheetsKeys.lists() });
      // Invalidate the specific sheet detail query
      queryClient.invalidateQueries({ queryKey: sheetDetailKey(variables.slug) });

      toast.success('Successfully joined the sheet!');
    },

    onError: (error: any) => {
      let message = error.response?.data?.message || error.message || 'Failed to join sheet';
      if (message === 'Validation failed') {
        message = 'Target date must be a future date (tomorrow or later).';
      }
      toast.error(message);
    },
  });
}