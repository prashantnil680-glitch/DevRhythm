'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { FiCalendar, FiTag, FiLink, FiPlus } from 'react-icons/fi';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import DatePicker from '@/shared/components/DatePicker';
import { useQuestionSearch } from '@/features/question';
import Loader from '@/shared/components/Loader';
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
  draftKey?: string; // NEW: custom localStorage key
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

export default function ManualTab({
  initialData,
  onSuccess,
  onSubmit,
  onCancel,
  isSubmitting,
  submitButtonText = 'Create Sheet',
  hideTargetDate = false,
  disableDraftSaving = false,
  draftKey,
}: ManualTabProps) {
  const storageKey = draftKey || 'sheet_create_draft_manual';

  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>(
    initialData?.selectedQuestions || []
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isFirstRender = useRef(true);

  const { data, isLoading } = useQuestionSearch(debouncedTerm, debouncedTerm.length >= 2);
  const searchResults = data?.questions || [];

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

  // Auto-save draft to localStorage (debounced) – skip if disabled
  useEffect(() => {
    if (disableDraftSaving) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const draft = {
        name: formValues.name,
        description: formValues.description,
        targetDate: formValues.targetDate ? formValues.targetDate.toISOString() : null,
        specialTag: formValues.specialTag,
        originalSourceName: formValues.originalSourceName,
        originalSourceUrl: formValues.originalSourceUrl,
        selectedQuestions,
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
    }, 300);
    return () => clearTimeout(timer);
  }, [formValues, selectedQuestions, disableDraftSaving, storageKey]);

  // Load draft on mount – unconditionally, draft overrides initialData
  useEffect(() => {
    if (disableDraftSaving) return;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        setValue('name', draft.name);
        setValue('description', draft.description);
        if (draft.targetDate) setValue('targetDate', new Date(draft.targetDate));
        setValue('specialTag', draft.specialTag);
        setValue('originalSourceName', draft.originalSourceName);
        setValue('originalSourceUrl', draft.originalSourceUrl);
        setSelectedQuestions(draft.selectedQuestions || []);
      } catch (e) { /* ignore */ }
    }
  }, [disableDraftSaving, setValue, storageKey]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const addQuestion = (q: { _id: string; title: string }) => {
    if (!selectedQuestions.some(sq => sq.id === q._id)) {
      setSelectedQuestions(prev => [...prev, { id: q._id, title: q.title }]);
    }
    setSearchTerm('');
    setIsSearchOpen(false);
  };

  const removeQuestion = (id: string) => {
    setSelectedQuestions(prev => prev.filter(sq => sq.id !== id));
  };

  const handleFormSubmit = (data: ManualFormData) => {
    onSubmit({
      name: data.name,
      description: data.description || '',
      questions: selectedQuestions.map(sq => sq.id),
      targetDate: format(data.targetDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
      specialTag: data.specialTag || undefined,
      originalSourceName: data.originalSourceName || undefined,
      originalSourceUrl: data.originalSourceUrl || undefined,
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className={styles.form}>
      <div className={styles.topActions}>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || selectedQuestions.length === 0}>{submitButtonText}</Button>
      </div>
      {/* The JSX remains identical, but we must ensure the target date field uses the same conditional */}
      <div className={styles.columns}>
        <div className={styles.leftPanel}>
          <div className={styles.sourceCard}>
            <h2 className={styles.panelTitle}>Sheet Details</h2>

            <div className={styles.field}>
              <label className={styles.label}>Name <span className={styles.required}>*</span></label>
              <Input {...register('name')} error={!!errors.name} fullWidth disabled={isSubmitting} className={styles.input} />
              {errors.name && <p className={styles.error}>{errors.name.message}</p>}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <textarea {...register('description')} rows={4} disabled={isSubmitting} className={styles.textarea} />
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
                    />
                  )}
                />
                {errors.targetDate && <p className={styles.error}>{errors.targetDate.message}</p>}
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}><FiTag className={styles.fieldIcon} /> Category</label>
              <Input {...register('specialTag')} placeholder="e.g., DSA, System Design, Interview Prep" fullWidth disabled={isSubmitting} className={styles.input} />
              <p className={styles.hint}>Helps organize sheets (optional)</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label}><FiLink className={styles.fieldIcon} /> Original Source</label>
              <Input {...register('originalSourceName')} placeholder="Source name" fullWidth disabled={isSubmitting} className={styles.input} />
              <Input {...register('originalSourceUrl')} placeholder="Source URL" fullWidth disabled={isSubmitting} className={styles.input} style={{ marginTop: '0.5rem' }} />
              {errors.originalSourceUrl && <p className={styles.error}>{errors.originalSourceUrl.message}</p>}
            </div>
          </div>
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.detailsScroll}>
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
                    placeholder="Search questions by title or ID..."
                    disabled={isSubmitting}
                    className={styles.searchInput}
                  />
                  {isLoading && <Loader size="sm" className={styles.spinner} />}
                </div>
                {isSearchOpen && debouncedTerm.length >= 2 && (
                  <div className={styles.searchDropdown}>
                    {searchResults.length === 0 && !isLoading && <div className={styles.noResults}>No questions found</div>}
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
                )}
              </div>
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
            </section>
          </div>
        </div>
      </div>
      
    </form>
  );
}