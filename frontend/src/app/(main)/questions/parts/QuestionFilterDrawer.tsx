'use client';
import React from 'react';
import { createPortal } from 'react-dom';
import { IoClose } from 'react-icons/io5';
import { QuestionFilterControls, Filters } from '@/app/(main)/questions/parts/QuestionFilterControls';
import Button from '@/shared/components/Button';
import Divider from '@/shared/components/Divider';
import { QuestionStatistics } from '@/features/question/types/question.types';
import styles from './QuestionFilterDrawer.module.css';

interface QuestionFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: any) => void;
  onClearFilters: () => void;
  stats?: QuestionStatistics | null;
  platformOptions: { value: string; label: string }[];
  difficultyOptions: { value: string; label: string }[];
  patternOptions: { value: string; label: string }[];
  tagOptions: { value: string; label: string }[];
  sortOptions: { value: string; label: string }[];
  isAuthenticated?: boolean;
}

export const QuestionFilterDrawer: React.FC<QuestionFilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onClearFilters,
  stats,
  platformOptions,
  difficultyOptions,
  patternOptions,
  tagOptions,
  sortOptions,
  isAuthenticated = false,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Filters</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <IoClose />
          </button>
        </div>

        <QuestionFilterControls
          filters={filters}
          onFilterChange={onFilterChange}
          platformOptions={platformOptions}
          difficultyOptions={difficultyOptions}
          patternOptions={patternOptions}
          tagOptions={tagOptions}
          sortOptions={sortOptions}
          isAuthenticated={isAuthenticated}
        />

        {stats && (
          <>
            <Divider className={styles.divider} />
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total</span>
                <span className={styles.statValue}>{stats.totalQuestions}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Easy</span>
                <span className={styles.statValue}>{stats.byDifficulty.easy}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Medium</span>
                <span className={styles.statValue}>{stats.byDifficulty.medium}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Hard</span>
                <span className={styles.statValue}>{stats.byDifficulty.hard}</span>
              </div>
            </div>
          </>
        )}

        <div className={styles.footer}>
          <Button variant="outline" onClick={onClearFilters} fullWidth>
            Clear all
          </Button>
          <Button onClick={onClose} fullWidth>
            Apply filters
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};