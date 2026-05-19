'use client';

import React from 'react';
import { FiCheck, FiRotateCcw } from 'react-icons/fi';
import DatePicker from '@/shared/components/DatePicker';
import SearchBar from '@/shared/components/SearchBar';
import Checkbox from '@/shared/components/Checkbox';
import styles from './NotificationFilters.module.css';

export interface NotificationFiltersProps {
  unreadCount: number;
  typeFilter: string;
  onTypeChange: (type: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (checked: boolean) => void;
  dateFilter: Date | null;
  onDateChange: (date: Date | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMarkAllRead: () => void;
  onResetFilters: () => void;
  isMarkingAll?: boolean;
}

const NOTIFICATION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'pod', label: 'POD' },
  { value: 'revision_reminder_daily', label: 'Revision' },
  { value: 'goal_completion', label: 'Goals' },
  { value: 'new_follower', label: 'Social' },
  { value: 'question_solved', label: 'Solved' },
  { value: 'question_mastered', label: 'Mastered' },
  { value: 'revision_completed', label: 'Revision Completed' },
];

export const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  unreadCount,
  typeFilter,
  onTypeChange,
  unreadOnly,
  onUnreadOnlyChange,
  dateFilter,
  onDateChange,
  searchQuery,
  onSearchChange,
  onMarkAllRead,
  onResetFilters,
  isMarkingAll = false,
}) => {
  return (
    <div className={styles.filterRow}>
      {/* Unread badge */}
      <div className={styles.unreadBadge}>
        <span className={styles.unreadCount}>{unreadCount}</span> unread
      </div>

      {/* Type dropdown */}
      <select
        className={styles.filterSelect}
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value)}
        aria-label="Filter by type"
      >
        {NOTIFICATION_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>

      {/* Unread only checkbox */}
      <div className={styles.checkboxWrapper}>
        <Checkbox
          checked={unreadOnly}
          onChange={onUnreadOnlyChange}
          label="Unread"
          aria-label="Show only unread notifications"
        />
      </div>

      {/* Date picker - wrapped to prevent full width */}
      <div className={styles.datePickerWrapper}>
        <DatePicker
          selected={dateFilter}
          onChange={onDateChange}
          placeholder="Select date"
          size="sm"
          variant="outline"
          dateFormat="yyyy-MM-dd"
          aria-label="Filter by date"
        />
      </div>

      {/* Search bar */}
      <div className={styles.searchWrapper}>
        <SearchBar
          value={searchQuery}
          onSearch={onSearchChange}
          onChange={onSearchChange}
          placeholder="Search notifications..."
          debounceMs={300}
          clearable
          ariaLabel="Search notifications"
          className={styles.searchBar}
        />
      </div>

      {/* Mark all read button */}
      <button
        className={`${styles.filterButton} ${styles.primaryButton}`}
        onClick={onMarkAllRead}
        disabled={isMarkingAll || unreadCount === 0}
        title="Mark all as read"
      >
        <FiCheck />  Read All
      </button>

      {/* Reset button */}
      <button
        className={styles.filterButton}
        onClick={onResetFilters}
        title="Reset all filters"
      >
        <FiRotateCcw /> Reset
      </button>
    </div>
  );
};

export default NotificationFilters;