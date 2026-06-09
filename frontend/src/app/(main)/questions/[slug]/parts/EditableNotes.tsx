'use client';

import React, { useState, useCallback } from 'react';
import { FiEdit2, FiSave, FiX, FiFileText, FiZap } from 'react-icons/fi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Button from '@/shared/components/Button';
import styles from './EditableNotes.module.css';

interface EditableNotesProps {
  initialNotes?: string;
  initialKeyInsights?: string;
  onSave: (notes: string, keyInsights: string) => Promise<void>;
}

export const EditableNotes: React.FC<EditableNotesProps> = ({
  initialNotes = '',
  initialKeyInsights = '',
  onSave,
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const isLoggedIn = !!user;

  const [notes, setNotes] = useState(initialNotes);
  const [keyInsights, setKeyInsights] = useState(initialKeyInsights);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingKeyInsights, setIsEditingKeyInsights] = useState(false);
  const [tempNotes, setTempNotes] = useState(notes);
  const [tempKeyInsights, setTempKeyInsights] = useState(keyInsights);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isSavingKeyInsights, setIsSavingKeyInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetError = useCallback(() => {
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Start editing notes
  const handleEditNotes = () => {
    if (!isLoggedIn) return;
    setTempNotes(notes);
    setIsEditingNotes(true);
    setError(null);
  };

  // Cancel editing notes
  const handleCancelNotes = () => {
    setIsEditingNotes(false);
    setTempNotes(notes);
    setError(null);
  };

  // Save notes
  const handleSaveNotes = async () => {
    if (!isLoggedIn) return;
    if (tempNotes === notes) {
      setIsEditingNotes(false);
      return;
    }
    setIsSavingNotes(true);
    setError(null);
    try {
      await onSave(tempNotes, keyInsights);
      setNotes(tempNotes);
      setIsEditingNotes(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save notes');
      resetError();
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Start editing key insights
  const handleEditKeyInsights = () => {
    if (!isLoggedIn) return;
    setTempKeyInsights(keyInsights);
    setIsEditingKeyInsights(true);
    setError(null);
  };

  // Cancel editing key insights
  const handleCancelKeyInsights = () => {
    setIsEditingKeyInsights(false);
    setTempKeyInsights(keyInsights);
    setError(null);
  };

  // Save key insights
  const handleSaveKeyInsights = async () => {
    if (!isLoggedIn) return;
    if (tempKeyInsights === keyInsights) {
      setIsEditingKeyInsights(false);
      return;
    }
    setIsSavingKeyInsights(true);
    setError(null);
    try {
      await onSave(notes, tempKeyInsights);
      setKeyInsights(tempKeyInsights);
      setIsEditingKeyInsights(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save key insights');
      resetError();
    } finally {
      setIsSavingKeyInsights(false);
    }
  };

  // If not logged in, show a read‑only view with a login button
  if (!isLoggedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3>
            <FiFileText className={styles.headerIcon} />
            Notes & Key Insights
          </h3>
        </div>
        <div className={styles.loginPlaceholder}>
          <div className={styles.loginPlaceholderContent}>
            <p className={styles.loginPlaceholderTitle}>🔒 Login to add notes</p>
            <p className={styles.loginPlaceholderText}>
              Save your personal notes and key insights for this question.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/login')}
              className={styles.loginButton}
            >
              Login to Save
            </Button>
          </div>
        </div>
        <div className={styles.readOnlySection}>
          <div className={styles.column}>
            <div className={styles.label}>Notes</div>
            <div className={styles.readOnlyContent}>
              {initialNotes.trim() ? (
                <p className={styles.contentText}>{initialNotes}</p>
              ) : (
                <p className={styles.placeholder}>— no notes yet —</p>
              )}
            </div>
          </div>
          <div className={styles.column}>
            <div className={styles.label}>
              <FiZap className={styles.labelIcon} /> Key Insights
            </div>
            <div className={styles.readOnlyContent}>
              {initialKeyInsights.trim() ? (
                <p className={styles.contentText}>{initialKeyInsights}</p>
              ) : (
                <p className={styles.placeholder}>— add key insights —</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged‑in view (original component)
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>
          <FiFileText className={styles.headerIcon} />
          Notes & Key Insights
        </h3>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.content}>
        {/* Notes column */}
        <div className={styles.column}>
          <div className={styles.label}>Notes</div>
          <div className={styles.fieldContainer}>
            {!isEditingNotes ? (
              <>
                <div
                  className={styles.readOnlyContent}
                  onClick={handleEditNotes}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleEditNotes();
                  }}
                >
                  {notes.trim() ? (
                    <p className={styles.contentText}>{notes}</p>
                  ) : (
                    <p className={styles.placeholder}>— no notes yet —</p>
                  )}
                </div>
                <button
                  className={styles.editButton}
                  onClick={handleEditNotes}
                  aria-label="Edit notes"
                >
                  <FiEdit2 /> Edit
                </button>
              </>
            ) : (
              <div className={styles.editMode}>
                <textarea
                  className={styles.textarea}
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  rows={4}
                  autoFocus
                  aria-label="Edit notes"
                />
                <div className={styles.buttonGroup}>
                  <button
                    className={`${styles.actionButton} ${styles.saveButton}`}
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    aria-label="Save notes"
                  >
                    {isSavingNotes ? (
                      <span className={styles.spinner} />
                    ) : (
                      <>
                        <FiSave /> Save
                      </>
                    )}
                  </button>
                  <button
                    className={`${styles.actionButton} ${styles.cancelButton}`}
                    onClick={handleCancelNotes}
                    disabled={isSavingNotes}
                    aria-label="Cancel editing"
                  >
                    <FiX /> Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Key Insights column */}
        <div className={styles.column}>
          <div className={styles.label}>
            <FiZap className={styles.labelIcon} /> Key Insights
          </div>
          <div className={styles.fieldContainer}>
            {!isEditingKeyInsights ? (
              <>
                <div
                  className={styles.readOnlyContent}
                  onClick={handleEditKeyInsights}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleEditKeyInsights();
                  }}
                >
                  {keyInsights.trim() ? (
                    <p className={styles.contentText}>{keyInsights}</p>
                  ) : (
                    <p className={styles.placeholder}>— add key insights —</p>
                  )}
                </div>
                <button
                  className={styles.editButton}
                  onClick={handleEditKeyInsights}
                  aria-label="Edit key insights"
                >
                  <FiEdit2 /> Edit
                </button>
              </>
            ) : (
              <div className={styles.editMode}>
                <textarea
                  className={styles.textarea}
                  value={tempKeyInsights}
                  onChange={(e) => setTempKeyInsights(e.target.value)}
                  rows={4}
                  autoFocus
                  aria-label="Edit key insights"
                />
                <div className={styles.buttonGroup}>
                  <button
                    className={`${styles.actionButton} ${styles.saveButton}`}
                    onClick={handleSaveKeyInsights}
                    disabled={isSavingKeyInsights}
                    aria-label="Save key insights"
                  >
                    {isSavingKeyInsights ? (
                      <span className={styles.spinner} />
                    ) : (
                      <>
                        <FiSave /> Save
                      </>
                    )}
                  </button>
                  <button
                    className={`${styles.actionButton} ${styles.cancelButton}`}
                    onClick={handleCancelKeyInsights}
                    disabled={isSavingKeyInsights}
                    aria-label="Cancel editing"
                  >
                    <FiX /> Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};