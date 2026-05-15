'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useNotifications,
  useUnreadCount,
  useMarkAllAsRead,
  useMarkAsRead,
} from '@/features/notification/hooks/useNotifications';
import { useDeleteNotification } from '@/features/notification/hooks/useDeleteNotification';
import Pagination from '@/shared/components/Pagination';
import Breadcrumb from '@/shared/components/Breadcrumb';
import type { BreadcrumbItem } from '@/shared/components/Breadcrumb';
import NotificationFilters from './NotificationFilters';
import NotificationCard from './NotificationCard';
import NotificationsSkeleton from './NotificationsSkeleton';
import type { GetNotificationsParams } from '@/features/notification/services/notificationService';
import styles from './NotificationsPageContent.module.css';

const PAGE_SIZE = 10;

// Custom renderLink for Next.js navigation
const renderLink = (item: BreadcrumbItem, props: { className: string; children: React.ReactNode }) => {
  if (!item.href) return <span {...props}>{props.children}</span>;
  return (
    <Link href={item.href} className={props.className}>
      {props.children}
    </Link>
  );
};

export const NotificationsPageContent: React.FC = () => {
  const router = useRouter();

  // Filter states
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, unreadOnly, dateFilter, debouncedSearch]);

  // Convert Date to YYYY-MM-DD string for API
  const dateFilterString = dateFilter ? dateFilter.toISOString().split('T')[0] : undefined;

  // Build API params with category for POD, otherwise type
  const buildApiParams = (): GetNotificationsParams => {
    const params: GetNotificationsParams = {
      page,
      limit: PAGE_SIZE,
      unreadOnly: unreadOnly || undefined,
      search: debouncedSearch || undefined,
      startDate: dateFilterString,
    };

    if (typeFilter === 'pod') {
      params.category = 'pod';
    } else if (typeFilter) {
      params.type = typeFilter;
    }

    return params;
  };

  // Fetch notifications
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useNotifications(buildApiParams());

  const { data: unreadCountData } = useUnreadCount();

  // Mutations
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();
  const deleteNotificationMutation = useDeleteNotification();

  const handleMarkRead = useCallback((id: string) => {
    markAsReadMutation.mutate(id);
  }, [markAsReadMutation]);

  const handleMarkAllRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  const handleDelete = useCallback((id: string) => {
    deleteNotificationMutation.mutate(id);
  }, [deleteNotificationMutation]);

  const handleResetFilters = useCallback(() => {
    setTypeFilter('');
    setUnreadOnly(false);
    setDateFilter(null);
    setSearchQuery('');
    setPage(1);
  }, []);

  // Extract pagination
  const pagination = data?.pagination;
  const totalPages = pagination?.pages ?? 0;
  const showPagination = totalPages > 1;

  // Breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Notifications' },
  ];

  return (
    <div className={styles.container}>
      {/* Breadcrumb */}
      <Breadcrumb
        items={breadcrumbItems}
        renderLink={renderLink}
        aria-label="Breadcrumb"
      />

      {/* Filters */}
      <NotificationFilters
        unreadCount={unreadCountData?.unreadCount ?? 0}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        unreadOnly={unreadOnly}
        onUnreadOnlyChange={setUnreadOnly}
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onMarkAllRead={handleMarkAllRead}
        onResetFilters={handleResetFilters}
        isMarkingAll={markAllAsReadMutation.isPending}
      />

      {/* Notification list */}
      {isLoading && <NotificationsSkeleton count={PAGE_SIZE} />}

      {error && (
        <div className={styles.errorState}>
          <p>Failed to load notifications. Please try again.</p>
          <button onClick={() => refetch()} className={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && data?.notifications.length === 0 && (
        <div className={styles.emptyState}>
          <p>No notifications found. <br /> click on Reset button.</p>
        </div>
      )}

      {!isLoading && !error && data && data.notifications.length > 0 && (
        <>
          <div className={styles.notifList}>
            {data.notifications.map((notification, idx) => (
              <NotificationCard
                key={notification._id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
                isMarking={markAsReadMutation.isPending}
                isDeleting={deleteNotificationMutation.isPending}
                index={idx}
              />
            ))}
          </div>
          {/* Pagination */}
          {showPagination && (
            <div className={styles.paginationWrapper}>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                showFirstLast
                showPrevNext
                size="md"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NotificationsPageContent;