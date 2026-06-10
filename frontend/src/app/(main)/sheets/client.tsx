'use client';

import { useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiPlus } from 'react-icons/fi';
import { useSheets, useBookmarkedSheets, useToggleBookmark, useJoinSheet } from '@/features/sheets';
import { useUser } from '@/features/user';
import { ROUTES } from '@/shared/config';
import Button from '@/shared/components/Button';
import Pagination from '@/shared/components/Pagination';
import Breadcrumb from '@/shared/components/Breadcrumb';
import type { BreadcrumbItem } from '@/shared/components/Breadcrumb';
import SheetFilterBar from './parts/SheetFilterBar';
import SheetCard from './parts/SheetCard';
import SheetCardSkeleton from './parts/SheetCardSkeleton';
import styles from './page.module.css';

const JoinSheetModal = lazy(() => import('./parts/JoinSheetModal'));

interface SheetsClientProps {
  initialData: {
    sheets: any[];
    pagination: any;
  };
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export default function SheetsClient({ initialData }: SheetsClientProps) {
  const router = useRouter();
  const { user } = useUser();
  const isLoggedIn = !!user;

  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'mine' | 'bookmarked'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'updatedAt' | 'bookmarkCount'>(
    isLoggedIn ? 'bookmarkCount' : 'createdAt'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Memoised derived values
  const effectiveViewFilter = useMemo(() => (!isLoggedIn ? 'all' : viewFilter), [isLoggedIn, viewFilter]);
  const useBookmarks = useMemo(() => effectiveViewFilter === 'bookmarked', [effectiveViewFilter]);
  const useMySheets = useMemo(() => effectiveViewFilter === 'mine', [effectiveViewFilter]);

  const useInitialData = useMemo(() => {
    return !isLoggedIn && !useBookmarks && page === 1 && !search && sortBy === 'bookmarkCount' && sortOrder === 'desc';
  }, [isLoggedIn, useBookmarks, page, search, sortBy, sortOrder]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page and scroll when filters change
  useEffect(() => {
    setPage(1);
    scrollToTop();
  }, [debouncedSearch, viewFilter, sortBy, sortOrder]);

  // Reset to default view when authentication changes
  useEffect(() => {
    setViewFilter('all');
    setSortBy(isLoggedIn ? 'bookmarkCount' : 'createdAt');
    setSortOrder('desc');
    setPage(1);
  }, [isLoggedIn]);

  // Stabilised query parameters
  const sheetsParams = useMemo(() => {
    if (useBookmarks) return undefined;
    return {
      search: debouncedSearch || undefined,
      mySheets: useMySheets ? true : undefined,
      sortBy,
      sortOrder,
      page,
      limit,
    };
  }, [useBookmarks, debouncedSearch, useMySheets, sortBy, sortOrder, page, limit]);

  const bookmarksParams = useMemo(() => {
    if (!useBookmarks) return undefined;
    return {
      page,
      limit,
      search: debouncedSearch || undefined,
    };
  }, [useBookmarks, page, limit, debouncedSearch]);

  // Data fetching hooks
  const {
    data: sheetsData,
    isLoading: sheetsLoading,
    error: sheetsError,
    refetch: refetchSheets,
  } = useSheets(sheetsParams, { initialData: useInitialData ? initialData : undefined }, isLoggedIn);

  const {
    data: bookmarksData,
    isLoading: bookmarksLoading,
    error: bookmarksError,
    refetch: refetchBookmarks,
  } = useBookmarkedSheets(bookmarksParams);

  const isLoading = useMemo(() => (useBookmarks ? bookmarksLoading : sheetsLoading), [useBookmarks, bookmarksLoading, sheetsLoading]);
  const error = useMemo(() => (useBookmarks ? bookmarksError : sheetsError), [useBookmarks, bookmarksError, sheetsError]);
  const data = useMemo(() => (useBookmarks ? bookmarksData : sheetsData), [useBookmarks, bookmarksData, sheetsData]);
  const sheets = useMemo(() => data?.sheets || [], [data]);
  const pagination = useMemo(() => data?.pagination, [data]);

  const joinSheetMutation = useJoinSheet();
  const toggleBookmarkMutation = useToggleBookmark();

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedSheetSlug, setSelectedSheetSlug] = useState<string | null>(null);

  // Memoised callbacks
  const handleJoinClick = useCallback((slug: string) => {
    setSelectedSheetSlug(slug);
    setJoinModalOpen(true);
  }, []);

  const handleJoinConfirm = useCallback(async (targetDate: string) => {
    if (!selectedSheetSlug) return;
    await joinSheetMutation.mutateAsync({ slug: selectedSheetSlug, targetDate });
    setJoinModalOpen(false);
    setSelectedSheetSlug(null);
    refetchSheets();
    if (useBookmarks) refetchBookmarks();
    router.push(ROUTES.SHEETS.DETAIL(selectedSheetSlug));
  }, [selectedSheetSlug, joinSheetMutation, refetchSheets, useBookmarks, refetchBookmarks, router]);

  const handleToggleBookmark = useCallback(async (slug: string) => {
    await toggleBookmarkMutation.mutateAsync(slug);
    if (useBookmarks) {
      refetchBookmarks();
    } else {
      refetchSheets();
    }
  }, [toggleBookmarkMutation, useBookmarks, refetchBookmarks, refetchSheets]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    scrollToTop();
  }, []);

  const renderLink = useCallback((item: BreadcrumbItem, props: { className: string; children: React.ReactNode }) => {
    if (!item.href) return <span {...props}>{props.children}</span>;
    return <Link href={item.href} className={props.className}>{props.children}</Link>;
  }, []);

  // Memoised sheet cards
  const sheetCards = useMemo(() => {
    if (!sheets.length) return null;
    return sheets.map((sheet) => {
      const isOwner = user ? sheet.ownerId === user._id : false;
      const isJoined = user ? sheet.participants?.some(p => p.userId === user._id) : false;
      return (
        <SheetCard
          key={sheet._id}
          sheet={sheet}
          isOwner={isOwner}
          isJoined={isJoined}
          onJoin={() => handleJoinClick(sheet.slug)}
          onToggleBookmark={() => handleToggleBookmark(sheet.slug)}
          isAuthenticated={isLoggedIn}
          isBookmarkPending={toggleBookmarkMutation.isPending}
        />
      );
    });
  }, [sheets, user, handleJoinClick, handleToggleBookmark, isLoggedIn, toggleBookmarkMutation.isPending]);

  // Sticky header observer with requestAnimationFrame
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterWrapperRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        requestAnimationFrame(() => {
          setIsSticky(!entry.isIntersecting);
        });
      },
      { threshold: [0] }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', href: ROUTES.DASHBOARD },
    { label: 'Sheets' },
  ];

  return (
    <div className={styles.container}>
      <Breadcrumb items={breadcrumbItems} renderLink={renderLink} />

      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Sheets</h1>
        <Link href={ROUTES.SHEETS.CREATE}>
          <Button variant="primary" size="md" leftIcon={<FiPlus />}>
            Create Sheet
          </Button>
        </Link>
      </div>

      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />

      <div
        ref={filterWrapperRef}
        className={`${styles.filterWrapper} ${isSticky ? styles.sticky : ''}`}
      >
        <SheetFilterBar
          search={search}
          onSearchChange={setSearch}
          viewFilter={viewFilter}
          onViewFilterChange={setViewFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          isLoggedIn={isLoggedIn}
        />
      </div>

      {isLoading && (
        <div className={styles.sheetsList}>
          {Array.from({ length: limit }).map((_, i) => (
            <SheetCardSkeleton key={i} />
          ))}
        </div>
      )}

      {error && (
        <div className={styles.errorState}>
          <p>Failed to load sheets. Please try again.</p>
          <Button variant="outline" onClick={() => (useBookmarks ? refetchBookmarks() : refetchSheets())}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && sheets.length === 0 && (
        <div className={styles.emptyState}>
          <p>
            {effectiveViewFilter === 'bookmarked'
              ? 'No bookmarked sheets found.'
              : effectiveViewFilter === 'mine'
              ? 'No sheets found.'
              : 'No sheets found.'}
          </p>
          {!search && effectiveViewFilter === 'all' && (
            <Link href={ROUTES.SHEETS.CREATE}>
              <Button variant="primary">Create your first sheet →</Button>
            </Link>
          )}
        </div>
      )}

      {!isLoading && !error && sheets.length > 0 && (
        <div className={styles.sheetsList}>
          {sheetCards}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className={styles.paginationWrapper}>
          <Pagination
            currentPage={page}
            totalPages={pagination.pages}
            onPageChange={handlePageChange}
            showFirstLast
            showPrevNext
            size="md"
          />
        </div>
      )}

      {joinModalOpen && (
        <Suspense fallback={null}>
          <JoinSheetModal
            isOpen={joinModalOpen}
            onClose={() => {
              setJoinModalOpen(false);
              setSelectedSheetSlug(null);
            }}
            onConfirm={handleJoinConfirm}
            isLoading={joinSheetMutation.isPending}
          />
        </Suspense>
      )}
    </div>
  );
}