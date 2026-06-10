'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { FiCalendar, FiTag, FiLink, FiPlus, FiLoader, FiCheck, FiAlertOctagon } from 'react-icons/fi';
import Link from 'next/link';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import DatePicker from '@/shared/components/DatePicker';
import Modal from '@/shared/components/Modal';
import { useQuestionSearch } from '@/features/question';
import { sheetService } from '@/features/sheets';
import Loader from '@/shared/components/Loader';
import { slugify } from '@/shared/lib/stringUtils';
import styles from './ManualTab.module.css';

interface SelectedQuestion {
  id: string;
  title: string;
}

interface ManualTabProps {
  initialData?: {
    name: string;
    description: string;
    targetDate: string | null;
    specialTag: string;
    originalSourceName: string;
    originalSourceUrl: string;
    selectedQuestions: SelectedQuestion[];
  };
  onSuccess: () => void;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  submitButtonText?: string;
  hideTargetDate?: boolean;
  disableDraftSaving?: boolean;
  draftKey?: string;
}

const manualSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(200),
  description: z.string().max(1000).optional(),
  targetDate: z.date().min(new Date(Date.now() + 86400000), 'Target date must be tomorrow or later'),
  specialTag: z.string().max(50).optional(),
  originalSourceName: z.string().max(200).optional(),
  originalSourceUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type ManualFormData = z.infer<typeof manualSchema>;

const STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'resolving', label: 'Resolving questions' },
  { key: 'creating', label: 'Creating sheet' },
  { key: 'completed', label: 'Completed' },
];

export default function ManualTab({
  initialData,
  onSuccess,
  onSubmit: _onSubmit,
  onCancel,
  isSubmitting: externalIsSubmitting,
  submitButtonText = 'Create Sheet',
  hideTargetDate = false,
  disableDraftSaving = false,
  draftKey,
}: ManualTabProps) {
  const isEditMode = !!draftKey;
  const storageKey = draftKey || 'sheet_create_draft_manual';

  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>(
    initialData?.selectedQuestions || []
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isFirstRender = useRef(true);
  const lastSavedDraftRef = useRef<any>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [backendDraftData, setBackendDraftData] = useState<any>(null);

  const [isAsyncCreating, setIsAsyncCreating] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<any>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading: searchLoading } = useQuestionSearch(debouncedTerm, debouncedTerm.length >= 2);
  const searchResults = useMemo(() => data?.questions || [], [data]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ManualFormData>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      targetDate: initialData?.targetDate ? new Date(initialData.targetDate) : (() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 2);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
      })(),
      specialTag: initialData?.specialTag || '',
      originalSourceName: initialData?.originalSourceName || '',
      originalSourceUrl: initialData?.originalSourceUrl || '',
    },
  });

  const formValues = watch();

  // Load draft from backend (create mode only)
  useEffect(() => {
    if (isEditMode || disableDraftSaving) {
      setIsHydrating(false);
      return;
    }
    const loadDraft = async () => {
      try {
        const draft = await sheetService.getDraft('manual');
        if (draft && draft.data) {
          setBackendDraftData(draft.data);
          setValue('name', draft.data.name);
          setValue('description', draft.data.description);
          if (draft.data.targetDate) {
            setValue('targetDate', new Date(draft.data.targetDate));
          }
          setValue('specialTag', draft.data.specialTag || '');
          setValue('originalSourceName', draft.data.originalSourceName || '');
          setValue('originalSourceUrl', draft.data.originalSourceUrl || '');
          setSelectedQuestions(draft.data.selectedQuestions || []);
          lastSavedDraftRef.current = draft.data;
        }
      } catch (err) {
        console.error('Failed to load manual draft:', err);
      } finally {
        setIsHydrating(false);
      }
    };
    loadDraft();
  }, [isEditMode, disableDraftSaving, setValue]);

  // Auto-save draft (only when valid and changed, after hydration)
  useEffect(() => {
    if (isHydrating) return;
    if (isEditMode) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const draftData = {
      name: formValues.name,
      description: formValues.description,
      targetDate: formValues.targetDate ? formValues.targetDate.toISOString() : null,
      specialTag: formValues.specialTag,
      originalSourceName: formValues.originalSourceName,
      originalSourceUrl: formValues.originalSourceUrl,
      selectedQuestions,
    };

    const isValid = draftData.name && draftData.name.length >= 3;
    const isChanged = JSON.stringify(lastSavedDraftRef.current) !== JSON.stringify(draftData);

    if (isValid && isChanged) {
      lastSavedDraftRef.current = draftData;
      sheetService.saveDraft('manual', draftData).catch(err => console.error('Auto-save draft failed:', err));
    }
  }, [formValues, selectedQuestions, isHydrating, isEditMode]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const addQuestion = useCallback((q: { _id: string; title: string }) => {
    if (!selectedQuestions.some(sq => sq.id === q._id)) {
      setSelectedQuestions(prev => [...prev, { id: q._id, title: q.title }]);
    }
    setSearchTerm('');
    setIsSearchOpen(false);
  }, [selectedQuestions]);

  const removeQuestion = useCallback((id: string) => {
    setSelectedQuestions(prev => prev.filter(sq => sq.id !== id));
  }, []);

  const pollProgress = useCallback(async (id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await sheetService.getSheetCreateProgress(id);
        setProgressData(res);
        if (res.stage === 'completed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setShowProgressModal(false);
          setIsAsyncCreating(false);
          onSuccess();
          sheetService.deleteDraft('manual').catch(err => console.error('Failed to delete draft:', err));
          if (res.sheetSlug) {
            window.location.href = `/sheets/${res.sheetSlug}`;
          } else {
            window.location.href = '/sheets';
          }
        } else if (res.stage === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsAsyncCreating(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  }, [onSuccess]);

  const handleAsyncSubmit = useCallback(async (data: ManualFormData) => {
    if (selectedQuestions.length === 0) return;
    setIsAsyncCreating(true);
    setShowProgressModal(true);
    setProgressData(null);
    try {
      const payload = {
        name: data.name,
        description: data.description || '',
        questions: selectedQuestions.map(sq => sq.id),
        targetDate: format(data.targetDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
        specialTag: data.specialTag || undefined,
        originalSourceName: data.originalSourceName || undefined,
        originalSourceUrl: data.originalSourceUrl || undefined,
      };
      const response = await sheetService.createSheetAsync(payload);
      const newJobId = response.data.jobId;
      setJobId(newJobId);
      pollProgress(newJobId);
    } catch (err: any) {
      console.error('Async creation error:', err);
      setShowProgressModal(false);
      setIsAsyncCreating(false);
    }
  }, [selectedQuestions, pollProgress]);

  const handleClearDraft = useCallback(async () => {
    await sheetService.deleteDraft('manual');
    setBackendDraftData(null);
    setValue('name', '');
    setValue('description', '');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(0, 0, 0, 0);
    setValue('targetDate', tomorrow);
    setValue('specialTag', '');
    setValue('originalSourceName', '');
    setValue('originalSourceUrl', '');
    setSelectedQuestions([]);
    lastSavedDraftRef.current = null;
  }, [setValue]);

  const getStageIndex = useCallback(() => {
    if (!progressData) return 0;
    const stageKey = progressData.stage;
    const index = STAGES.findIndex(s => s.key === stageKey);
    return index >= 0 ? index : 0;
  }, [progressData]);

  const currentStageIndex = getStageIndex();

  const renderProgressContent = useCallback(() => {
    if (!progressData) return null;
    const { stage, totalQuestions, processed, matched, skipped, unresolved, error } = progressData;

    if (stage === 'failed') {
      const sheetName = formValues.name;
      const slug = slugify(sheetName);
      const viewSheetUrl = `/sheets/${slug}`;
      const isDuplicateError = error?.toLowerCase().includes('already exists');

      return (
        <div className={styles.errorContent}>
          <FiAlertOctagon className={styles.errorIcon} />
          <h3 className={styles.errorTitle}>Sheet Already Exists</h3>
          <p className={styles.errorMessage}>
            A sheet with the name <strong>“{sheetName}”</strong> already exists in your account.
            Please choose a different name or view the existing sheet.
          </p>
          <div className={styles.errorActions}>
            <Link href={viewSheetUrl} className={styles.viewSheetLink}>
              <Button variant="primary">View Existing Sheet</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setShowProgressModal(false);
                setProgressData(null);
                setJobId(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className={styles.stageList}>
          {STAGES.map((stageItem, idx) => {
            let statusIcon = null;
            if (idx < currentStageIndex) statusIcon = <FiCheck className={styles.stageIconCompleted} />;
            else if (idx === currentStageIndex) statusIcon = <FiLoader className={styles.stageIconActive} />;
            else statusIcon = <span className={styles.stageIconPending}>◻️</span>;
            return (
              <div key={stageItem.key} className={styles.stageItem}>
                {statusIcon}
                <span className={styles.stageLabel}>{stageItem.label}</span>
              </div>
            );
          })}
        </div>
        {stage === 'resolving' && totalQuestions && (
          <div className={styles.progressStats}>
            <p>Processed: {processed} / {totalQuestions} questions</p>
            <p>Matched: {matched} | Skipped: {skipped}</p>
            {unresolved && unresolved.length > 0 && (
              <div className={styles.unresolvedWarning}>
                ⚠️ {unresolved.length} question(s) could not be matched: {unresolved.slice(0, 5).join(', ')}
                {unresolved.length > 5 && ` +${unresolved.length - 5} more`}
              </div>
            )}
          </div>
        )}
      </>
    );
  }, [progressData, currentStageIndex, formValues.name]);

  const isFormDisabled = isAsyncCreating || externalIsSubmitting;
  const showClearDraftButton = backendDraftData !== null && !isHydrating && !isEditMode;

  // Memoised search results rendering
  const searchDropdown = useMemo(() => {
    if (!isSearchOpen || debouncedTerm.length < 2) return null;
    return (
      <div className={styles.searchDropdown}>
        {searchResults.length === 0 && !searchLoading && <div className={styles.noResults}>No questions found</div>}
        {searchResults.map((q: any) => {
          const isSelected = selectedQuestions.some(sq => sq.id === q._id);
          return (
            <button key={q._id} type="button" className={styles.searchResult} onClick={() => addQuestion(q)} disabled={isSelected}>
              <span className={styles.resultTitle}>{q.title}</span>
              <span className={styles.resultId}>{q.platformQuestionId}</span>
            </button>
          );
        })}
      </div>
    );
  }, [isSearchOpen, debouncedTerm, searchResults, searchLoading, selectedQuestions, addQuestion]);

  return (
    <>
      {isHydrating && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinnerSmall} />
          <p>Loading draft...</p>
        </div>
      )}
      <form onSubmit={handleSubmit(handleAsyncSubmit)} className={styles.form} style={{ opacity: isHydrating ? 0.5 : 1, pointerEvents: isHydrating ? 'none' : 'auto' }}>
        <div className={styles.topActions}>
          <div className={styles.leftActions}>
            {showClearDraftButton && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClearDraft}>
                Clear Draft
              </Button>
            )}
          </div>
          <div className={styles.rightActions}>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isFormDisabled}>
              Cancel
            </Button>
            <Button type="submit" disabled={isFormDisabled || selectedQuestions.length === 0}>
              {submitButtonText}
            </Button>
          </div>
        </div>

        <div className={styles.columns}>
          <div className={styles.leftPanel}>
            <div className={styles.sourceCard}>
              <h2 className={styles.panelTitle}>Sheet Details</h2>
              <div className={styles.field}>
                <label className={styles.label}>Name <span className={styles.required}>*</span></label>
                <Input {...register('name')} error={!!errors.name} fullWidth disabled={isFormDisabled} className={styles.input} />
                {errors.name && <p className={styles.error}>{errors.name.message}</p>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <textarea {...register('description')} rows={4} disabled={isFormDisabled} className={styles.textarea} />
              </div>
              {!hideTargetDate && (
                <div className={styles.field}>
                  <label className={styles.label}>Target Date <span className={styles.required}>*</span></label>
                  <Controller
                    name="targetDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        selected={field.value}
                        onChange={field.onChange}
                        placeholder="Select a future date"
                        minDate={(() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 2);
                          return tomorrow;
                        })()}
                        dateFormat="yyyy-MM-dd"
                        className={styles.datePicker}
                        disabled={isFormDisabled}
                      />
                    )}
                  />
                  {errors.targetDate && <p className={styles.error}>{errors.targetDate.message}</p>}
                </div>
              )}
              <div className={styles.field}>
                <label className={styles.label}><FiTag className={styles.fieldIcon} /> Category</label>
                <Input {...register('specialTag')} placeholder="e.g., DSA, System Design, Interview Prep" fullWidth disabled={isFormDisabled} className={styles.input} />
                <p className={styles.hint}>Helps organize sheets (optional)</p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}><FiLink className={styles.fieldIcon} /> Original Source</label>
                <Input {...register('originalSourceName')} placeholder="Source name" fullWidth disabled={isFormDisabled} className={styles.input} />
                <Input {...register('originalSourceUrl')} placeholder="Source URL" fullWidth disabled={isFormDisabled} className={styles.input} style={{ marginTop: '0.5rem' }} />
                {errors.originalSourceUrl && <p className={styles.error}>{errors.originalSourceUrl.message}</p>}
              </div>
            </div>
          </div>

          <div className={styles.rightPanel}>
            <section className={styles.detailsSection}>
              <h2 className={styles.sectionTitle}><FiPlus className={styles.sectionIcon} /> Questions</h2>
              <div className={styles.searchWrapper}>
                <div className={styles.searchInputWrapper}>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setIsSearchOpen(true); }}
                    onFocus={() => setIsSearchOpen(true)}
                    onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                    placeholder="Search questions by title..."
                    disabled={isFormDisabled}
                    className={styles.searchInput}
                  />
                  {searchLoading && <Loader size="sm" className={styles.spinner} />}
                </div>
                {searchDropdown}
              </div>
              <div className={styles.detailsScroll}>
                <div className={styles.selectedList}>
                  {selectedQuestions.length === 0 && <div className={styles.emptySelected}>No questions selected.</div>}
                  {selectedQuestions.map((sq, idx) => (
                    <div key={sq.id} className={styles.selectedItem}>
                      <span className={styles.selectedIndex}>{idx + 1}.</span>
                      <span className={styles.selectedTitle}>{sq.title}</span>
                      <button type="button" className={styles.removeBtn} onClick={() => removeQuestion(sq.id)}>Remove</button>
                    </div>
                  ))}
                </div>
                {selectedQuestions.length === 0 && <p className={styles.error}>At least one question is required</p>}
              </div>
            </section>
          </div>
        </div>
      </form>

      <Modal
        isOpen={showProgressModal}
        onClose={() => {}}
        title={progressData?.stage === 'failed' ? ' ' : 'Creating Your Sheet'}
        size="md"
        closeOnBackdropClick={false}
        closeOnEsc={false}
        showCloseButton={false}
      >
        <div className={styles.loadingModalContent}>
          {progressData?.stage !== 'failed' && (
            <div className={styles.loadingSpinner}>
              <FiLoader className={styles.spinnerIcon} />
            </div>
          )}
          <p className={styles.loadingMessage}>
            {progressData?.stage === 'failed'
              ? 'Unable to create the sheet'
              : "We're resolving questions and creating your sheet.\nThis may take a few minutes depending on the number of questions."}
          </p>
          {progressData?.stage !== 'failed' && (
            <p className={styles.loadingWarning}>
              ⚠️ Please do not refresh, close, or navigate away from this page while the process is in progress.
            </p>
          )}
          {renderProgressContent()}
        </div>
      </Modal>
    </>
  );
}