'use client';

import { useRef, useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  FiCalendar,
  FiTag,
  FiLink,
  FiUpload,
  FiAlertOctagon,
  FiCheck,
  FiLoader,
  FiChevronDown,
  FiChevronRight,
  FiFile,
  FiFileText,
} from 'react-icons/fi';
import Link from 'next/link';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import DatePicker from '@/shared/components/DatePicker';
import Modal from '@/shared/components/Modal';
import { sheetService } from '@/features/sheets';
import { slugify } from '@/shared/lib/stringUtils';
import styles from './ImportTab.module.css';

interface ImportTabProps {
  initialData?: {
    sheetName: string;
    description: string;
    targetDate: string | null;
    specialTag: string;
    originalSourceName: string;
    originalSourceUrl: string;
    fileName: string | null;
  };
  onSuccess: () => void;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  draftKey?: string;
}

const importSchema = z.object({
  sheetName: z.string().min(3, 'Name must be at least 3 characters').max(200),
  description: z.string().max(1000).optional(),
  targetDate: z.date().min(new Date(Date.now() + 86400000), 'Target date must be tomorrow or later'),
  specialTag: z.string().max(50).optional(),
  originalSourceName: z.string().max(200).optional(),
  originalSourceUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type ImportFormData = z.infer<typeof importSchema>;

const STAGES = [
  { label: 'Getting File Ready' },
  { label: 'Checking Sheet Data' },
  { label: 'Preparing Questions' },
  { label: 'Creating Your Sheet' },
];

export default function ImportTab({
  initialData,
  onSuccess,
  onSubmit,
  onCancel,
  isSubmitting,
  draftKey,
}: ImportTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{ publicId: string; fileName: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [duplicateErrorData, setDuplicateErrorData] = useState<{ existingSheetSlug: string; sheetName: string } | null>(null);
  const isFirstRender = useRef(true);
  const [isUploading, setIsUploading] = useState(false);
  const lastSavedDraftRef = useRef<any>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [backendDraftData, setBackendDraftData] = useState<any>(null);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Format guide state – compact
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [formatTab, setFormatTab] = useState<'json' | 'csv' | 'excel'>('json');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ImportFormData>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      sheetName: initialData?.sheetName || '',
      description: initialData?.description || '',
      targetDate: initialData?.targetDate
        ? new Date(initialData.targetDate)
        : (() => {
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

  // Load draft from backend
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await sheetService.getDraft('import');
        if (draft && draft.data) {
          setBackendDraftData(draft.data);
          setValue('sheetName', draft.data.sheetName);
          setValue('description', draft.data.description);
          if (draft.data.targetDate) {
            setValue('targetDate', new Date(draft.data.targetDate));
          }
          setValue('specialTag', draft.data.specialTag || '');
          setValue('originalSourceName', draft.data.originalSourceName || '');
          setValue('originalSourceUrl', draft.data.originalSourceUrl || '');
          if (draft.data.fileId && draft.data.fileName) {
            setUploadedFileInfo({ publicId: draft.data.fileId, fileName: draft.data.fileName });
            setFile(null);
          }
          lastSavedDraftRef.current = draft.data;
        }
      } catch (err) {
        console.error('Failed to load import draft:', err);
      } finally {
        setIsHydrating(false);
      }
    };
    loadDraft();
  }, [setValue]);

  // Auto-save draft
  useEffect(() => {
    if (isHydrating) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const draftData = {
      sheetName: formValues.sheetName,
      description: formValues.description,
      targetDate: formValues.targetDate ? formValues.targetDate.toISOString() : null,
      specialTag: formValues.specialTag,
      originalSourceName: formValues.originalSourceName,
      originalSourceUrl: formValues.originalSourceUrl,
      fileId: uploadedFileInfo?.publicId || null,
      fileName: uploadedFileInfo?.fileName || null,
    };
    const isValid = draftData.sheetName && draftData.sheetName.length >= 3;
    const isChanged = JSON.stringify(lastSavedDraftRef.current) !== JSON.stringify(draftData);
    if (isValid && isChanged) {
      lastSavedDraftRef.current = draftData;
      sheetService.saveDraft('import', draftData).catch(err => console.error('Auto-save draft failed:', err));
    }
  }, [formValues, uploadedFileInfo, isHydrating]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setIsUploading(true);
      try {
        const uploadResult = await sheetService.uploadFile(selectedFile);
        setFile(selectedFile);
        setUploadedFileInfo({ publicId: uploadResult.publicId, fileName: uploadResult.fileName });
        // Save file info to draft
        const draftData = {
          sheetName: formValues.sheetName,
          description: formValues.description,
          targetDate: formValues.targetDate ? formValues.targetDate.toISOString() : null,
          specialTag: formValues.specialTag,
          originalSourceName: formValues.originalSourceName,
          originalSourceUrl: formValues.originalSourceUrl,
          fileId: uploadResult.publicId,
          fileName: uploadResult.fileName,
        };
        lastSavedDraftRef.current = draftData;
        sheetService.saveDraft('import', draftData).catch(err => console.error('File save draft failed:', err));
      } catch (err: any) {
        setFileError('Failed to upload file. Please try again.');
        console.error(err);
      } finally {
        setIsUploading(false);
      }
    } else {
      setFile(null);
      setUploadedFileInfo(null);
      const draftData = {
        sheetName: formValues.sheetName,
        description: formValues.description,
        targetDate: formValues.targetDate ? formValues.targetDate.toISOString() : null,
        specialTag: formValues.specialTag,
        originalSourceName: formValues.originalSourceName,
        originalSourceUrl: formValues.originalSourceUrl,
        fileId: null,
        fileName: null,
      };
      lastSavedDraftRef.current = draftData;
      sheetService.saveDraft('import', draftData).catch(err => console.error('Remove file draft failed:', err));
    }
  };

  const handleRemoveFile = async () => {
    if (uploadedFileInfo?.publicId) {
      try {
        await sheetService.deleteUploadedFile(uploadedFileInfo.publicId);
      } catch (err) {
        console.error('Failed to delete uploaded file:', err);
      }
    }
    setFile(null);
    setUploadedFileInfo(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const draftData = {
      sheetName: formValues.sheetName,
      description: formValues.description,
      targetDate: formValues.targetDate ? formValues.targetDate.toISOString() : null,
      specialTag: formValues.specialTag,
      originalSourceName: formValues.originalSourceName,
      originalSourceUrl: formValues.originalSourceUrl,
      fileId: null,
      fileName: null,
    };
    lastSavedDraftRef.current = draftData;
    sheetService.saveDraft('import', draftData).catch(err => console.error('Remove file draft failed:', err));
  };

  const handleFormSubmit = async (data: ImportFormData) => {
    // Validate that either a file is present or we have a stored fileId from draft
    if (!file && !uploadedFileInfo) {
      setFileError('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    // Add form fields
    formData.append('sheetName', data.sheetName);
    formData.append('description', data.description || '');
    formData.append('targetDate', format(data.targetDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
    if (data.specialTag) formData.append('specialTag', data.specialTag);
    if (data.originalSourceName) formData.append('originalSourceName', data.originalSourceName);
    if (data.originalSourceUrl) formData.append('originalSourceUrl', data.originalSourceUrl);

    // If there is a new file (recently selected), send it
    if (file) {
      formData.append('file', file);
    }
    // Otherwise, if we have a stored fileId from a previous upload, send that
    else if (uploadedFileInfo?.publicId) {
      formData.append('fileId', uploadedFileInfo.publicId);
    }

    setShowLoadingModal(true);
    setCurrentStage(0);
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    stageTimerRef.current = setInterval(() => {
      setCurrentStage(prev => {
        if (prev < STAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 2000);

    try {
      await onSubmit(formData);
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
      setShowLoadingModal(false);
      // Clear draft after successful import
      await sheetService.deleteDraft('import');
      if (uploadedFileInfo?.publicId) {
        try {
          await sheetService.deleteUploadedFile(uploadedFileInfo.publicId);
        } catch (err) {
          /* ignore */
        }
      }
      onSuccess();
    } catch (err: any) {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
      setShowLoadingModal(false);
      const status = err?.response?.status;
      const responseData = err?.response?.data;
      if (status === 409 && responseData?.data?.existingSheetSlug) {
        setDuplicateErrorData({
          existingSheetSlug: responseData.data.existingSheetSlug,
          sheetName: data.sheetName,
        });
      } else {
        const message = responseData?.message || err?.message || 'Import failed';
        setErrorMessage(message);
        setErrorModalOpen(true);
      }
    }
  };

  const isSubmitDisabled = isSubmitting || (!file && !uploadedFileInfo) || isUploading || isHydrating;

  const formatErrorMessage = (msg: string) => {
    const parts = msg.split(/(\n)/);
    return parts.map((part, i) => {
      if (part === '\n') return <br key={i} />;
      if (part.trim().startsWith('[') || part.trim().startsWith('{')) {
        return <pre key={i} className={styles.errorPre}>{part}</pre>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleCloseDuplicateModal = () => {
    setDuplicateErrorData(null);
  };

  const showClearDraftButton = backendDraftData !== null && !isHydrating;

  // Helper to render format examples
  const renderFormatExample = () => {
    switch (formatTab) {
      case 'json':
        return (
          <pre className={styles.formatCodeBlock}>
            {`[
  { "title": "Two Sum", "platformQuestionId": "two-sum" },
  { "title": "Add Two Numbers", "platformQuestionId": "add-two-numbers" },
  { "platformQuestionId": "longest-substring-without-repeating-characters" }
]`}
          </pre>
        );
      case 'csv':
        return (
          <pre className={styles.formatCodeBlock}>
            {`Title,PlatformQuestionId
"Two Sum","two-sum"
"Add Two Numbers","add-two-numbers"
"Longest Substring Without Repeating Characters","longest-substring-without-repeating-characters"
"",valid-parentheses`}
          </pre>
        );
      case 'excel':
        return (
          <div className={styles.excelPreview}>
            <table className={styles.excelTable}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>PlatformQuestionId</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Two Sum</td>
                  <td>two-sum</td>
                </tr>
                <tr>
                  <td>Add Two Numbers</td>
                  <td>add-two-numbers</td>
                </tr>
                <tr>
                  <td></td>
                  <td>valid-parentheses</td>
                </tr>
              </tbody>
            </table>
            <p className={styles.formatNote}>
              💡 Either column works – <strong>PlatformQuestionId</strong> takes precedence if both are provided.
            </p>
          </div>
        );
    }
  };

  return (
    <>
      {isHydrating && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinnerSmall} />
          <p>Loading draft...</p>
        </div>
      )}
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className={styles.form}
        style={{ opacity: isHydrating ? 0.5 : 1, pointerEvents: isHydrating ? 'none' : 'auto' }}
      >
        <div className={styles.topActions}>
          <div className={styles.leftActions}>
            {showClearDraftButton && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await sheetService.deleteDraft('import');
                  setBackendDraftData(null);
                  setValue('sheetName', '');
                  setValue('description', '');
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 2);
                  tomorrow.setHours(0, 0, 0, 0);
                  setValue('targetDate', tomorrow);
                  setValue('specialTag', '');
                  setValue('originalSourceName', '');
                  setValue('originalSourceUrl', '');
                  setUploadedFileInfo(null);
                  setFile(null);
                  lastSavedDraftRef.current = null;
                }}
              >
                Clear Draft
              </Button>
            )}
          </div>
          <div className={styles.rightActions}>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              Import Sheet
            </Button>
          </div>
        </div>

        <div className={styles.columns}>
          <div className={styles.leftPanel}>
            <div className={styles.sourceCard}>
              <h2 className={styles.panelTitle}>Sheet Details</h2>
              <div className={styles.field}>
                <label className={styles.label}>
                  Name <span className={styles.required}>*</span>
                </label>
                <Input
                  {...register('sheetName')}
                  error={!!errors.sheetName}
                  fullWidth
                  disabled={isSubmitting}
                  className={styles.input}
                />
                {errors.sheetName && <p className={styles.error}>{errors.sheetName.message}</p>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <textarea {...register('description')} rows={4} disabled={isSubmitting} className={styles.textarea} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  Target Date <span className={styles.required}>*</span>
                </label>
                <Controller
                  name="targetDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder="Select a future date"
                      minDate={(() => {
                        const t = new Date();
                        t.setDate(t.getDate() + 2);
                        return t;
                      })()}
                      dateFormat="yyyy-MM-dd"
                      className={styles.datePicker}
                    />
                  )}
                />
                {errors.targetDate && <p className={styles.error}>{errors.targetDate.message}</p>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FiTag className={styles.fieldIcon} /> Category
                </label>
                <Input
                  {...register('specialTag')}
                  placeholder="e.g., DSA, System Design, Interview Prep"
                  fullWidth
                  disabled={isSubmitting}
                  className={styles.input}
                />
                <p className={styles.hint}>Helps organize sheets (optional)</p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FiLink className={styles.fieldIcon} /> Original Source
                </label>
                <Input
                  {...register('originalSourceName')}
                  placeholder="Source name"
                  fullWidth
                  disabled={isSubmitting}
                  className={styles.input}
                />
                <Input
                  {...register('originalSourceUrl')}
                  placeholder="Source URL"
                  fullWidth
                  disabled={isSubmitting}
                  className={styles.input}
                  style={{ marginTop: '0.5rem' }}
                />
                {errors.originalSourceUrl && <p className={styles.error}>{errors.originalSourceUrl.message}</p>}
              </div>
            </div>
          </div>
          <div className={styles.rightPanel}>
            <div className={styles.detailsScroll}>
              <section className={styles.detailsSection}>
                <h2 className={styles.sectionTitle}>
                  <FiUpload className={styles.sectionIcon} /> Upload File
                </h2>
                <div className={styles.uploadArea}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx,.xls,.csv,.json"
                    style={{ display: 'none' }}
                    id="sheet-file"
                  />
                  <label htmlFor="sheet-file" className={styles.uploadLabel}>
                    <FiUpload /> {file ? file.name : uploadedFileInfo?.fileName || 'Choose file (Excel, CSV, JSON)'}
                  </label>
                  {(file || uploadedFileInfo) && (
                    <div className={styles.filePreview}>
                      <span>{file ? file.name : uploadedFileInfo?.fileName}</span>
                      <button type="button" className={styles.removeFile} onClick={handleRemoveFile}>
                        Remove
                      </button>
                    </div>
                  )}
                  {isUploading && <p className={styles.hint}>Uploading file...</p>}
                  {fileError && <p className={styles.error}>{fileError}</p>}
                  <p className={styles.hint}>Supported formats: .xlsx, .xls, .csv, .json</p>

                  {/* Compact Format Guide Toggle */}
                  <button
                    type="button"
                    className={styles.formatToggle}
                    onClick={() => setShowFormatGuide(!showFormatGuide)}
                  >
                    {showFormatGuide ? <FiChevronDown /> : <FiChevronRight />}
                    <span>Format Guide</span>
                    <span className={styles.formatToggleBadge}>
                      {formatTab === 'json' ? 'JSON' : formatTab === 'csv' ? 'CSV' : 'Excel'}
                    </span>
                  </button>

                  {showFormatGuide && (
                    <div className={styles.formatGuideCompact}>
                      <div className={styles.formatTabsCompact}>
                        <button
                          type="button"
                          className={`${styles.formatTabCompact} ${formatTab === 'json' ? styles.formatTabActiveCompact : ''}`}
                          onClick={() => setFormatTab('json')}
                        >
                          <FiFileText size={12} /> JSON
                        </button>
                        <button
                          type="button"
                          className={`${styles.formatTabCompact} ${formatTab === 'csv' ? styles.formatTabActiveCompact : ''}`}
                          onClick={() => setFormatTab('csv')}
                        >
                          <FiFile size={12} /> CSV
                        </button>
                        <button
                          type="button"
                          className={`${styles.formatTabCompact} ${formatTab === 'excel' ? styles.formatTabActiveCompact : ''}`}
                          onClick={() => setFormatTab('excel')}
                        >
                          <FiFile size={12} /> Excel
                        </button>
                      </div>
                      <div className={styles.formatContentCompact}>
                        <p className={styles.formatDescriptionCompact}>
                          {formatTab === 'excel'
                            ? 'Use the first row as header with "Title" and/or "PlatformQuestionId" columns.'
                            : formatTab === 'csv'
                            ? 'CSV with header row: Title, PlatformQuestionId'
                            : 'JSON array of objects with title/platformQuestionId'}
                        </p>
                        {renderFormatExample()}
                      </div>
                    </div>
                  )}

                  <div className={styles.platformWarning}>
                    <div className={styles.warningHeader}>
                      <FiAlertOctagon className={styles.warningIcon} />
                      <span className={styles.warningBadge}>IMPORTANT</span>
                    </div>
                    <div className={styles.warningContent}>
                      <p className={styles.warningTitle}>Only LeetCode problems are supported</p>
                      <p className={styles.warningDescription}>
                        If your file contains problems from other platforms (Codeforces, HackerRank, etc.), they will be
                        skipped. Please ensure your sheet only includes LeetCode problem exact titles or slugs.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </form>

      {/* Loading Modal */}
      <Modal
        isOpen={showLoadingModal}
        onClose={() => {}}
        title="Importing Your Sheet"
        size="md"
        closeOnBackdropClick={false}
        closeOnEsc={false}
        showCloseButton={false}
      >
        <div className={styles.loadingModalContent}>
          <div className={styles.loadingSpinner}>
            <FiLoader className={styles.spinnerIcon} />
          </div>
          <p className={styles.loadingMessage}>
            We're importing your sheet and matching questions with our database. This may take a few minutes depending on
            the number of questions.
          </p>
          <p className={styles.loadingWarning}>
            ⚠️ Please do not refresh, close, or navigate away from this page while the import is in progress.
          </p>
          <div className={styles.stageList}>
            {STAGES.map((stage, idx) => {
              let icon;
              if (idx < currentStage) {
                icon = <FiCheck className={styles.stageIconCompleted} />;
              } else if (idx === currentStage) {
                icon = <FiLoader className={styles.stageIconActive} />;
              } else {
                icon = <span className={styles.stageIconPending}>◻️</span>;
              }
              return (
                <div key={stage.label} className={styles.stageItem}>
                  {icon}
                  <span className={styles.stageLabel}>{stage.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Duplicate Sheet Error Modal */}
      <Modal
        isOpen={!!duplicateErrorData}
        onClose={() => setDuplicateErrorData(null)}
        title=" "
        size="md"
        closeOnBackdropClick={true}
        closeOnEsc={true}
        showCloseButton={true}
      >
        <div className={styles.errorContent}>
          <FiAlertOctagon className={styles.errorIcon} />
          <h3 className={styles.errorTitle}>Sheet Already Exists</h3>
          <p className={styles.errorMessage}>
            A sheet with the name <strong>“{duplicateErrorData?.sheetName}”</strong> already exists in your account.
            Please choose a different name or view the existing sheet.
          </p>
          <div className={styles.errorActions}>
            {duplicateErrorData && (
              <Link href={`/sheets/${duplicateErrorData.existingSheetSlug}`} className={styles.viewSheetLink}>
                <Button variant="primary">View Existing Sheet</Button>
              </Link>
            )}
            <Button variant="outline" onClick={handleCloseDuplicateModal}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Generic Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Import Error"
        size="md"
        closeOnBackdropClick
        closeOnEsc
        showCloseButton
      >
        <div className={styles.errorModalContent}>
          <p>The server encountered an error while processing your file:</p>
          <div className={styles.errorMessageBox}>{formatErrorMessage(errorMessage)}</div>
          <p className={styles.errorHint}>Please check your file format and try again.</p>
          <div className={styles.errorActions}>
            <Button variant="primary" onClick={() => setErrorModalOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}