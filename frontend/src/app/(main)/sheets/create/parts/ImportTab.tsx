'use client';

import { useRef, useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { FiCalendar, FiTag, FiLink, FiUpload } from 'react-icons/fi';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import DatePicker from '@/shared/components/DatePicker';
import Modal from '@/shared/components/Modal';
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
  draftKey?: string; // NEW: custom localStorage key
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

export default function ImportTab({
  initialData,
  onSuccess,
  onSubmit,
  onCancel,
  isSubmitting,
  draftKey,
}: ImportTabProps) {
  const storageKey = draftKey || 'sheet_create_draft_import';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [storedFileName, setStoredFileName] = useState<string | null>(initialData?.fileName || null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isFirstRender = useRef(true);

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

  // Auto-save draft – skip if no draftKey? We'll always save but use separate key for edit later.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const draft = {
        sheetName: formValues.sheetName,
        description: formValues.description,
        targetDate: formValues.targetDate ? formValues.targetDate.toISOString() : null,
        specialTag: formValues.specialTag,
        originalSourceName: formValues.originalSourceName,
        originalSourceUrl: formValues.originalSourceUrl,
        fileName: file ? file.name : storedFileName,
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
    }, 300);
    return () => clearTimeout(timer);
  }, [formValues, file, storedFileName, storageKey]);

  // Load draft unconditionally
  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        setValue('sheetName', draft.sheetName);
        setValue('description', draft.description);
        if (draft.targetDate) setValue('targetDate', new Date(draft.targetDate));
        setValue('specialTag', draft.specialTag);
        setValue('originalSourceName', draft.originalSourceName);
        setValue('originalSourceUrl', draft.originalSourceUrl);
        setStoredFileName(draft.fileName);
      } catch (e) { /* ignore */ }
    }
  }, [storageKey, setValue]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setStoredFileName(null);
    } else {
      setFile(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setStoredFileName(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFormSubmit = async (data: ImportFormData) => {
    if (!file && !storedFileName) {
      setFileError('Please select a file to upload');
      return;
    }
    if (!file) {
      setFileError('The previously selected file was lost. Please upload again.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sheetName', data.sheetName);
    formData.append('description', data.description || '');
    formData.append('targetDate', format(data.targetDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
    if (data.specialTag) formData.append('specialTag', data.specialTag);
    if (data.originalSourceName) formData.append('originalSourceName', data.originalSourceName);
    if (data.originalSourceUrl) formData.append('originalSourceUrl', data.originalSourceUrl);
    try {
      await onSubmit(formData);
      onSuccess();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Import failed';
      setErrorMessage(message);
      setErrorModalOpen(true);
    }
  };

  const isSubmitDisabled = isSubmitting || (!file && !storedFileName);

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

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)} className={styles.form}>
        <div className={styles.columns}>
          <div className={styles.leftPanel}>
            <div className={styles.sourceCard}>
              <h2 className={styles.panelTitle}>Sheet Details</h2>
              <div className={styles.field}>
                <label className={styles.label}>Name <span className={styles.required}>*</span></label>
                <Input {...register('sheetName')} error={!!errors.sheetName} fullWidth disabled={isSubmitting} className={styles.input} />
                {errors.sheetName && <p className={styles.error}>{errors.sheetName.message}</p>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <textarea {...register('description')} rows={4} disabled={isSubmitting} className={styles.textarea} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Target Date <span className={styles.required}>*</span></label>
                <Controller name="targetDate" control={control} render={({ field }) => (
                  <DatePicker selected={field.value} onChange={field.onChange} placeholder="Select a future date" minDate={(() => { const t = new Date(); t.setDate(t.getDate()+2); return t; })()} dateFormat="yyyy-MM-dd" className={styles.datePicker} />
                )} />
                {errors.targetDate && <p className={styles.error}>{errors.targetDate.message}</p>}
              </div>
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
                <h2 className={styles.sectionTitle}><FiUpload className={styles.sectionIcon} /> Upload File</h2>
                <div className={styles.uploadArea}>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls,.csv,.json" style={{ display: 'none' }} id="sheet-file" />
                  <label htmlFor="sheet-file" className={styles.uploadLabel}>
                    <FiUpload /> {file ? file.name : (storedFileName || 'Choose file (Excel, CSV, JSON)')}
                  </label>
                  {(file || storedFileName) && (
                    <div className={styles.filePreview}>
                      <span>{file ? file.name : storedFileName}</span>
                      <button type="button" className={styles.removeFile} onClick={handleRemoveFile}>Remove</button>
                    </div>
                  )}
                  {storedFileName && !file && <p className={styles.warning}>Previously selected file: {storedFileName}. Please re-upload.</p>}
                  {fileError && <p className={styles.error}>{fileError}</p>}
                  <p className={styles.hint}>Supported formats: .xlsx, .xls, .csv, .json</p>
                </div>
              </section>
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" disabled={isSubmitDisabled}>Import Sheet</Button>
        </div>
      </form>

      <Modal isOpen={errorModalOpen} onClose={() => setErrorModalOpen(false)} title="Import Error" size="md" closeOnBackdropClick closeOnEsc showCloseButton>
        <div className={styles.errorModalContent}>
          <p>The server encountered an error while processing your file:</p>
          <div className={styles.errorMessageBox}>{formatErrorMessage(errorMessage)}</div>
          <p className={styles.errorHint}>Please check your file format and try again.</p>
          <div className={styles.errorActions}><Button variant="primary" onClick={() => setErrorModalOpen(false)}>Got it</Button></div>
        </div>
      </Modal>
    </>
  );
}