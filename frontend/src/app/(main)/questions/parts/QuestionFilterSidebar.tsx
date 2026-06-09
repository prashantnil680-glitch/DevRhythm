'use client';

import React from 'react';
import { QuestionFilterControls, Filters } from '@/app/(main)/questions/parts/QuestionFilterControls';
import Button from '@/shared/components/Button';
import StatCard from '@/shared/components/StatCard';
import Divider from '@/shared/components/Divider';
import type { QuestionStatistics } from '@/features/question/types/question.types';
import styles from './QuestionFilterSidebar.module.css';

interface QuestionFilterSidebarProps {
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

export const QuestionFilterSidebar: React.FC<QuestionFilterSidebarProps> = ({
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
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h2 className={styles.title}>Filters</h2>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear all
        </Button>
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
                <StatCard label="Total" value={stats.totalQuestions} size="sm" />
                <StatCard
                label="Easy"
                value={stats.byDifficulty.easy}
                size="sm"
                className={styles.easy}
                />
                <StatCard
                label="Medium"
                value={stats.byDifficulty.medium}
                size="sm"
                className={styles.medium}
                />
                <StatCard
                label="Hard"
                value={stats.byDifficulty.hard}
                size="sm"
                className={styles.hard}
                />
            </div>
            </>
        )}
    </aside>
  );
};