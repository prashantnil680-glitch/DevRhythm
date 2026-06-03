'use client'
import { useState, useEffect, useCallback, useRef } from 'react';
import { sheetService } from '../services/sheetsService';
import { useDebounceCallback } from '@/shared/hooks';

interface UseSheetDraftOptions {
  type: 'manual' | 'import';
  enabled?: boolean;
}

export function useSheetDraft({ type, enabled = true }: UseSheetDraftOptions) {
  const [draft, setDraft] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const fetchLockRef = useRef(false);

  // Fetch draft on mount
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    const fetchDraft = async () => {
      if (fetchLockRef.current) return;
      fetchLockRef.current = true;
      try {
        setIsLoading(true);
        const draftData = await sheetService.getDraft(type);
        if (isMountedRef.current) {
          setDraft(draftData || null);
          setError(null);
        }
      } catch (err: any) {
        // Rate limit errors are not critical; just log quietly
        if (err?.response?.status === 429) {
          console.warn(`Rate limited while fetching ${type} draft`);
        } else {
          console.error(`Failed to load ${type} draft:`, err);
          if (isMountedRef.current) {
            setError(err);
          }
        }
        if (isMountedRef.current) {
          setDraft(null);
        }
      } finally {
        if (isMountedRef.current) setIsLoading(false);
        fetchLockRef.current = false;
      }
    };
    fetchDraft();
    return () => {
      isMountedRef.current = false;
    };
  }, [type, enabled]);

  // Debounced save function (longer delay to reduce rate limit hits)
  const saveDraft = useDebounceCallback(async (data: any) => {
    if (!enabled) return;
    try {
      setIsSaving(true);
      await sheetService.saveDraft(type, data);
      setError(null);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        console.warn(`Rate limited while saving ${type} draft`);
      } else {
        console.error(`Failed to save ${type} draft:`, err);
        setError(err);
      }
    } finally {
      setIsSaving(false);
    }
  }, 1000); // increased from 500ms to 1000ms

  // Update draft (local state + trigger debounced save)
  const updateDraft = useCallback((newData: any) => {
    setDraft(newData);
    saveDraft(newData);
  }, [saveDraft]);

  // Clear draft (delete from backend and reset local state)
  const clearDraft = useCallback(async () => {
    if (!enabled) return;
    try {
      await sheetService.deleteDraft(type);
      setDraft(null);
      setError(null);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        console.warn(`Rate limited while deleting ${type} draft`);
      } else {
        console.error(`Failed to delete ${type} draft:`, err);
        setError(err);
      }
    }
  }, [type, enabled]);

  return {
    draft,
    isLoading,
    isSaving,
    error,
    updateDraft,
    clearDraft,
  };
}