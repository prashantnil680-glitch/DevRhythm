"use client";

import React from 'react';
import {
  FiSearch,
  FiList,
  FiBarChart2,
  FiRepeat,
  FiTag,
  FiFilter,
  FiCheckCircle,
} from 'react-icons/fi';
import SearchBar from '@/shared/components/SearchBar';
import Select from '@/shared/components/Select';
import FilterChip from '@/shared/components/FilterChip';
import { MultiSelect } from '@/app/(main)/questions/parts/MultiSelect';
import {toast} from '@/shared/components/Toast'; 
import styles from './QuestionFilterControls.module.css';

export interface Filters {
  search: string;
  platform: string;
  difficulty: string;
  pattern: string;
  tags: string[];
  sort: string;
  status: string;
}

interface QuestionFilterControlsProps {
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: any) => void;
  platformOptions: { value: string; label: string }[];
  difficultyOptions: { value: string; label: string }[];
  patternOptions: { value: string; label: string }[];
  tagOptions: { value: string; label: string }[];
  sortOptions: { value: string; label: string }[];
  isAuthenticated?: boolean;
  className?: string;
}

export const QuestionFilterControls: React.FC<QuestionFilterControlsProps> = ({
  filters,
  onFilterChange,
  platformOptions,
  difficultyOptions,
  patternOptions,
  tagOptions,
  sortOptions,
  isAuthenticated = false,
  className,
}) => {
  const handleDifficultyChange = (value: string) => {
    onFilterChange('difficulty', value === 'all' ? '' : value);
  };

  const handleStatusChange = (status: string) => {
    if (status === 'solved' && !isAuthenticated) {
      // ✅ show a user‑friendly toast notification
      toast.error('Please log in to filter by solved status.', {
        duration: 4000,
        position: 'top-center',
      });
      return;
    }
    onFilterChange('status', status === 'all' ? '' : status);
  };

  return (
    <div className={`${styles.controls} ${className || ''}`}>
      {/* Search */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FiSearch className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Search</span>
        </div>
        <SearchBar
          placeholder="Search questions..."
          initialValue={filters.search}
          onSearch={val => onFilterChange('search', val)}
          debounceMs={300}
          clearable
        />
      </div>

      {/* Patterns (MultiSelect) */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
           <FiRepeat className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Patterns</span>
        </div>
        <MultiSelect
          options={tagOptions}
          values={filters.tags}
          onChange={val => onFilterChange('tags', val)}
          placeholder="Select patterns"
        />
      </div>

      {/* Difficulty chips */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FiBarChart2 className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Difficulty</span>
        </div>
        <div className={styles.chipGroup}>
          <FilterChip
            label="All"
            selected={!filters.difficulty}
            onClick={() => handleDifficultyChange('all')}
          />
          {difficultyOptions.map(opt => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              selected={filters.difficulty === opt.value}
              onClick={() => handleDifficultyChange(opt.value)}
            />
          ))}
        </div>
      </div>

      {/* Solved Status chip – conditionally disabled */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FiCheckCircle className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Status</span>
        </div>
        <div className={styles.chipGroup}>
          <FilterChip
            label="All"
            selected={!filters.status}
            onClick={() => handleStatusChange('all')}
          />
          <FilterChip
            label="Solved"
            selected={filters.status === 'solved'}
            onClick={() => handleStatusChange('solved')}
            disabled={!isAuthenticated}
          />
        </div>
      </div>

      {/* Platform */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FiList className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Platform</span>
        </div>
        <Select
          options={platformOptions}
          value={filters.platform}
          onChange={val => onFilterChange('platform', val)}
          placeholder="All platforms"
        />
      </div>

      {/* Sort */}
      {/* <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FiFilter className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Sort by</span>
        </div>
        <Select
          options={sortOptions}
          value={filters.sort}
          onChange={val => onFilterChange('sort', val)}
          placeholder="Select sorting"
        />
      </div> */}
    </div>
  );
};