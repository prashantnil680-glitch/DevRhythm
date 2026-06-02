'use client';

import { useCallback } from 'react';
import { FiSearch } from 'react-icons/fi';
import SearchBar from '@/shared/components/SearchBar';
import Select from '@/shared/components/Select';
import SortDropdown from '@/shared/components/SortDropdown';
import clsx from 'clsx';
import styles from './SheetFilterBar.module.css';

interface SheetFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  viewFilter: 'all' | 'mine' | 'bookmarked';  // changed from ownerFilter
  onViewFilterChange: (value: 'all' | 'mine' | 'bookmarked') => void;
  sortBy: 'createdAt' | 'name' | 'updatedAt' | 'bookmarkCount'; // added bookmarkCount
  onSortByChange: (value: 'createdAt' | 'name' | 'updatedAt' | 'bookmarkCount') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (value: 'asc' | 'desc') => void;
  isLoggedIn: boolean;
  className?: string;
}

const SORT_OPTIONS = [
  { value: 'bookmarkCount_desc', label: 'Most bookmarked' },
  { value: 'bookmarkCount_asc', label: 'Least bookmarked' },
  { value: 'createdAt_desc', label: 'Newest' },
  { value: 'createdAt_asc', label: 'Oldest' },
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
];

const VIEW_OPTIONS = [
  { value: 'all', label: 'All Sheets' },
  { value: 'mine', label: 'My Sheets' },
  { value: 'bookmarked', label: 'Bookmarks' },
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
        {isLoggedIn && (
          <Select
            value={viewFilter}
            onChange={(value) => onViewFilterChange(value as 'all' | 'mine' | 'bookmarked')}
            options={VIEW_OPTIONS}
            className={styles.filterSelect}
            aria-label="Filter sheets"
          />
        )}

        <SortDropdown
          options={SORT_OPTIONS}
          value={currentSortValue}
          onChange={handleSortChange}
          label="Sort by"
          className={styles.sortDropdown}
        />
      </div>
    </div>
  );
}