// frontend/src/app/(main)/sheets/parts/SheetFilterBar.tsx

'use client';

import { useCallback } from 'react';
import SearchBar from '@/shared/components/SearchBar';
import Select from '@/shared/components/Select';
import SortDropdown from '@/shared/components/SortDropdown';
import clsx from 'clsx';
import styles from './SheetFilterBar.module.css';

interface SheetFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  viewFilter: 'all' | 'mine' | 'bookmarked';
  onViewFilterChange: (value: 'all' | 'mine' | 'bookmarked') => void;
  sortBy: 'createdAt' | 'name' | 'updatedAt' | 'bookmarkCount';
  onSortByChange: (value: 'createdAt' | 'name' | 'updatedAt' | 'bookmarkCount') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (value: 'asc' | 'desc') => void;
  isLoggedIn: boolean;
  hasSheets: boolean; // NEW: indicates if any sheets exist in the database
  className?: string;
}

// Full list of sort options (used when sheets exist)
const FULL_SORT_OPTIONS = [
  { value: 'bookmarkCount_desc', label: 'Most Bookmarked' },
  { value: 'bookmarkCount_asc', label: 'Least Bookmarked' },
  { value: 'createdAt_desc', label: 'Newest' },
  { value: 'createdAt_asc', label: 'Oldest' },
  // { value: 'name_asc', label: 'Name (A-Z)' },
  // { value: 'name_desc', label: 'Name (Z-A)' },
];

// Filtered sort options (without bookmark-related) when no sheets exist
const NO_SHEETS_SORT_OPTIONS = FULL_SORT_OPTIONS.filter(
  option => !option.value.startsWith('bookmarkCount')
);

// Full list of view options
const FULL_VIEW_OPTIONS = [
  { value: 'all', label: 'All Sheets' },
  { value: 'mine', label: 'My Sheets' },
  { value: 'bookmarked', label: 'Bookmarked' },
];

// Filtered view options (without 'bookmarked') when no sheets exist
const NO_SHEETS_VIEW_OPTIONS = FULL_VIEW_OPTIONS.filter(
  option => option.value !== 'bookmarked'
);

export default function SheetFilterBar({
  search,
  onSearchChange,
  viewFilter,
  onViewFilterChange,
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  isLoggedIn,
  hasSheets,
  className,
}: SheetFilterBarProps) {
  const handleSortChange = useCallback((selectedValue: string) => {
    const [newSortBy, newSortOrder] = selectedValue.split('_');
    onSortByChange(newSortBy as 'createdAt' | 'name' | 'updatedAt' | 'bookmarkCount');
    onSortOrderChange(newSortOrder as 'asc' | 'desc');
  }, [onSortByChange, onSortOrderChange]);

  const currentSortValue = `${sortBy}_${sortOrder}`;
  const sortOptions = hasSheets ? FULL_SORT_OPTIONS : NO_SHEETS_SORT_OPTIONS;
  const viewOptions = isLoggedIn ? (hasSheets ? FULL_VIEW_OPTIONS : NO_SHEETS_VIEW_OPTIONS) : [];

  // Ensure current viewFilter is valid if it's 'bookmarked' but no sheets exist
  // (This should be handled by the parent, but we can also guard here)
  const effectiveViewFilter = (!hasSheets && viewFilter === 'bookmarked') ? 'all' : viewFilter;

  return (
    <div className={clsx(styles.filterBar, className)}>
      <div className={styles.searchWrapper}>
        <SearchBar
          value={search}
          onChange={onSearchChange}
          onSearch={onSearchChange}
          placeholder="Search sheets..."
          debounceMs={300}
          clearable
          ariaLabel="Search sheets"
          className={styles.searchBar}
        />
      </div>

      <div className={styles.filterControls}>
        {isLoggedIn && viewOptions.length > 0 && (
          <Select
            value={effectiveViewFilter}
            onChange={(value) => onViewFilterChange(value as 'all' | 'mine' | 'bookmarked')}
            options={viewOptions}
            className={styles.filterSelect}
            aria-label="Filter sheets"
          />
        )}

        <SortDropdown
          options={sortOptions}
          value={currentSortValue}
          onChange={handleSortChange}
          label="Sort by"
          className={styles.sortDropdown}
        />
      </div>
    </div>
  );
}