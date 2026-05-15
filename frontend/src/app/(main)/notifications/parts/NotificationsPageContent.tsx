'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// Helper to scroll to top smoothly
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Scroll to top whenever page or filters change (after they have taken effect)
  useEffect(() => {
    scrollToTop();
  }, [page, typeFilter, unreadOnly, dateFilter, debouncedSearch]);

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
    // Scroll to top after marking all as read (filter changes may trigger useEffect anyway)
    scrollToTop();
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
    scrollToTop();
  }, []);

  // Handle page change (pagination)
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
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

  // Sticky filter logic
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterWrapperRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: [0] }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className={styles.container}>
      {/* Breadcrumb - no separator prop, uses default "//" */}
      <Breadcrumb
        items={breadcrumbItems}
        renderLink={renderLink}
        aria-label="Breadcrumb"
      />

      {/* Sentinel for sticky detection */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />

      {/* Filter wrapper with sticky behavior */}
      <div
        ref={filterWrapperRef}
        className={`${styles.filterWrapper} ${isSticky ? styles.sticky : ''}`}
      >
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
      </div>

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
          <p>No notifications found.</p>
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
          {showPagination && (
            <div className={styles.paginationWrapper}>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
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