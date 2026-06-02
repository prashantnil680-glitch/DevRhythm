'use client';

import { useState, useCallback, useEffect } from 'react';
import SearchBar from '@/shared/components/SearchBar';
import Select from '@/shared/components/Select';
import Button from '@/shared/components/Button';
import styles from './QuestionsFilterBar.module.css';

interface QuestionsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  solveStatus: string;
  onSolveStatusChange: (value: string) => void;
  revisionStatus: string;
  onRevisionStatusChange: (value: string) => void;
  difficulty: string;
  onDifficultyChange: (value: string) => void;
  onClearFilters: () => void;
}

const QUESTION_STATUS_OPTIONS = [
  { value: '', label: 'All Questions' },
  { value: 'solved', label: 'Solved Questions' },
  { value: 'unsolved', label: 'Unsolved Questions' },
];

const REVISION_PROGRESS_OPTIONS = [
  { value: '', label: 'All Revisions' },
  { value: 'completed', label: 'Revision Completed' },
  { value: 'pending', label: 'Revision Pending' },
];

const DIFFICULTY_LEVEL_OPTIONS = [
  { value: '', label: 'All Levels' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export default function QuestionsFilterBar({
  search,
  onSearchChange,
  solveStatus,
  onSolveStatusChange,
  revisionStatus,
  onRevisionStatusChange,
  difficulty,
  onDifficultyChange,
  onClearFilters,
}: QuestionsFilterBarProps) {
  const [inputValue, setInputValue] = useState(search);

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  const handleSearch = useCallback((value: string) => {
    onSearchChange(value);
  }, [onSearchChange]);

  const hasActiveFilters = !!(search || solveStatus || revisionStatus || difficulty);

  return (
    <div className={styles.filterBar}>
      <div className={styles.searchWrapper}>
        <SearchBar
          value={inputValue}
          onChange={setInputValue}
          onSearch={handleSearch}
          placeholder="Search questions..."
          debounceMs={500}
          clearable
          ariaLabel="Search questions"
          className={styles.searchBar}
        />
      </div>
      <div className={styles.filterControls}>
        <Select
          value={solveStatus}
          onChange={onSolveStatusChange}
          options={QUESTION_STATUS_OPTIONS}
          className={styles.filterSelect}
          aria-label="Question Status"
        />
        <Select
          value={revisionStatus}
          onChange={onRevisionStatusChange}
          options={REVISION_PROGRESS_OPTIONS}
          className={styles.filterSelect}
          aria-label="Revision Progress"
        />
        <Select
          value={difficulty}
          onChange={onDifficultyChange}
          options={DIFFICULTY_LEVEL_OPTIONS}
          className={styles.filterSelect}
          aria-label="Difficulty Level"
        />
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className={styles.clearButton}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}