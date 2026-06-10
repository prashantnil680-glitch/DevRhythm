'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from '@/features/auth/hooks/useSession';
import { useUsers } from '@/features/community/hooks/useUsers';
import FilterPanel, { type SortItem } from './FilterPanel';
import Pagination from '@/shared/components/Pagination';
import Breadcrumb from '@/shared/components/Breadcrumb';
import Button from '@/shared/components/Button'; // 👈 import shared Button
import dynamic from 'next/dynamic';
import { useInView } from 'react-intersection-observer';
import styles from './CommunityPage.module.css';

const PAGE_SIZE = 20;

const UserList = dynamic(
  () => import('./UserList'),
  {
    ssr: false,
    loading: () => (
      <div className={styles.userList}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>
    ),
  }
);

export default function CommunityPage() {
  const { user, isAuthenticated } = useSession();
  const [search, setSearch] = useState('');
  const [sorts, setSorts] = useState<SortItem[]>([{ field: 'totalSolved', order: 'desc' }]);
  const [currentPage, setCurrentPage] = useState(1);
  const dotsRef = useRef<HTMLDivElement>(null);

  const { ref: listRef, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px',
    threshold: 0,
  });

  useEffect(() => {
    const handleScroll = () => {
      if (dotsRef.current) {
        dotsRef.current.style.transform = `translateY(${window.scrollY * 0.02}px)`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sorts]);

  const buildSortParams = useCallback(() => {
    if (sorts.length === 0) return { sortBy: 'totalSolved', sortOrder: 'desc' };
    const sortBy = sorts.map(s => s.field).join(',');
    const sortOrder = sorts.map(s => s.order).join(',');
    return { sortBy, sortOrder };
  }, [sorts]);

  const { sortBy, sortOrder } = buildSortParams();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useUsers(
    {
      page: currentPage,
      limit: PAGE_SIZE,
      search: search || undefined,
      sortBy,
      sortOrder,
    },
    { enabled: inView }
  );

  const handleFiltersChange = (filters: { sorts: SortItem[] }) => {
    setSorts(filters.sorts);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const users = data?.users || [];
  const pagination = data?.pagination;

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Community' },
  ];

  return (
    <>
      <div ref={dotsRef} className={styles.parallaxDots} aria-hidden="true" />
      <div className={styles.container}>
        <Breadcrumb items={breadcrumbItems} />
        <div className={styles.pageHeader}>
          <h1>Community</h1>
          <p>Find your coding companions. See who’s on the same rhythm.</p>
        </div>

        <FilterPanel
          onFiltersChange={handleFiltersChange}
          onSearchChange={handleSearchChange}
          isAuthenticated={!!user}
          initialSorts={sorts}
        />

        <div ref={listRef} className={styles.listContainer} aria-live="polite" aria-busy={isLoading}>
          {inView ? (
            <>
              {error ? (
                <div className={styles.errorState}>
                  <p>Failed to load community members.</p>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => refetch()}
                  >
                    Try again
                  </Button>
                </div>
              ) : isLoading ? (
                <div className={styles.userList}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={styles.skeletonCard} />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No community members found.</p>
                  <p className={styles.emptyStateHint}>Try adjusting your search or filters.</p>
                </div>
              ) : (
                <UserList
                  users={users}
                  isLoading={isLoading}
                  error={null}
                  isAuthenticated={!!user}
                  onRetry={() => refetch()}
                />
              )}
            </>
          ) : (
            <div className={styles.placeholderArea} aria-hidden="true">
              <div className={styles.userList}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={styles.placeholderCard} />
                ))}
              </div>
            </div>
          )}
        </div>

        {pagination && pagination.total > 0 && inView && (
          <div className={styles.paginationWrapper}>
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.pages}
              onPageChange={handlePageChange}
              showFirstLast
              showPrevNext
              size="md"
            />
          </div>
        )}
      </div>
    </>
  );
}