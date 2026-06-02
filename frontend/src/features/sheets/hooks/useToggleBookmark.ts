import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/components/Toast';
import { sheetService } from '../services/sheetsService';
import { sheetsKeys } from './useSheets';
import { sheetDetailKey } from './useSheet';
import type { SheetWithStats, SheetDetailsResponse } from '../types/sheets.types';

/**
 * Hook to toggle bookmark status for a sheet.
 * Optimistically updates the cache and invalidates queries on success.
 */
export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => sheetService.toggleBookmark(slug),

    onMutate: async (slug) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: sheetsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: sheetDetailKey(slug) });
      await queryClient.cancelQueries({ queryKey: sheetsKeys.bookmarks() });

      // Snapshot previous values
      const previousSheetsLists = queryClient.getQueriesData({
        queryKey: sheetsKeys.lists(),
      });
      const previousDetail = queryClient.getQueryData<SheetDetailsResponse>(sheetDetailKey(slug));
      const previousBookmarks = queryClient.getQueryData(sheetsKeys.bookmarks());

      // Optimistically update all sheets list caches
      queryClient.setQueriesData<{ sheets: SheetWithStats[] }>(
        { queryKey: sheetsKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            sheets: old.sheets.map((sheet) =>
              sheet.slug === slug
                ? {
                    ...sheet,
                    isBookmarked: !sheet.isBookmarked,
                    bookmarkCount: sheet.isBookmarked
                      ? Math.max(0, sheet.bookmarkCount - 1)
                      : sheet.bookmarkCount + 1,
                  }
                : sheet
            ),
          };
        }
      );

      // Optimistically update bookmarks list cache
      queryClient.setQueryData<{ sheets: SheetWithStats[] }>(
        sheetsKeys.bookmarks(),
        (old) => {
          if (!old) return old;
          const targetSheet = old.sheets.find((s) => s.slug === slug);
          if (!targetSheet) return old;
          // If bookmarking (isBookmarked becoming true), add to list at the beginning
          if (!targetSheet.isBookmarked) {
            return {
              ...old,
              sheets: [
                { ...targetSheet, isBookmarked: true, bookmarkCount: targetSheet.bookmarkCount + 1 },
                ...old.sheets.filter((s) => s.slug !== slug),
              ],
            };
          } else {
            // If unbookmarking, remove from list
            return {
              ...old,
              sheets: old.sheets.filter((s) => s.slug !== slug),
            };
          }
        }
      );

      // Optimistically update sheet detail cache
      if (previousDetail) {
        queryClient.setQueryData<SheetDetailsResponse>(sheetDetailKey(slug), {
          ...previousDetail,
          sheet: {
            ...previousDetail.sheet,
            isBookmarked: !previousDetail.sheet.isBookmarked,
            bookmarkCount: previousDetail.sheet.isBookmarked
              ? Math.max(0, previousDetail.sheet.bookmarkCount - 1)
              : previousDetail.sheet.bookmarkCount + 1,
          },
        });
      }

      // Return context for rollback
      return { previousSheetsLists, previousDetail, previousBookmarks };
    },

    onError: (err, slug, context) => {
      // Rollback all optimistic updates
      if (context?.previousSheetsLists) {
        context.previousSheetsLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(sheetDetailKey(slug), context.previousDetail);
      }
      if (context?.previousBookmarks) {
        queryClient.setQueryData(sheetsKeys.bookmarks(), context.previousBookmarks);
      }
      toast.error('Failed to update bookmark. Please try again.');
    },

    onSuccess: (data, slug) => {
      // Invalidate all relevant queries to sync with server
      queryClient.invalidateQueries({ queryKey: sheetsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sheetDetailKey(slug) });
      queryClient.invalidateQueries({ queryKey: sheetsKeys.bookmarks() });
      // Show success message based on new state
      toast.success(data.isBookmarked ? 'Sheet bookmarked' : 'Bookmark removed');
    },
  });
}