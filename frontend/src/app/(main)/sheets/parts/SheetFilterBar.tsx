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
  className?: string;
}

// Full sort options (always shown for logged-in users)
const FULL_SORT_OPTIONS = [
  { value: 'bookmarkCount_desc', label: 'Most Bookmarked' },
  { value: 'bookmarkCount_asc', label: 'Least Bookmarked' },
  { value: 'createdAt_desc', label: 'Newest' },
  { value: 'createdAt_asc', label: 'Oldest' },
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
];

// Sort options without bookmark (for non‑logged‑in users)
const PUBLIC_SORT_OPTIONS = FULL_SORT_OPTIONS.filter(
  option => !option.value.startsWith('bookmarkCount')
);

// View options always include "Bookmarked" for logged‑in users
const VIEW_OPTIONS = [
  { value: 'all', label: 'All Sheets' },
  { value: 'mine', label: 'My Sheets' },
  { value: 'bookmarked', label: 'Bookmarked' },
];

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
  className,
}: SheetFilterBarProps) {
  const handleSortChange = useCallback((selectedValue: string) => {
    const [newSortBy, newSortOrder] = selectedValue.split('_');
    onSortByChange(newSortBy as 'createdAt' | 'name' | 'updatedAt' | 'bookmarkCount');
    onSortOrderChange(newSortOrder as 'asc' | 'desc');
  }, [onSortByChange, onSortOrderChange]);

  const currentSortValue = `${sortBy}_${sortOrder}`;
  const sortOptions = isLoggedIn ? FULL_SORT_OPTIONS : PUBLIC_SORT_OPTIONS;
  const viewOptions = isLoggedIn ? VIEW_OPTIONS : [];

  // Safety guard: if viewFilter is 'bookmarked' but user not logged in, fallback to 'all'
  const effectiveViewFilter = !isLoggedIn && viewFilter === 'bookmarked' ? 'all' : viewFilter;

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