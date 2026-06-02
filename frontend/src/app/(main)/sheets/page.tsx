'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiPlus } from 'react-icons/fi';
import { useSheets, useBookmarkedSheets, useToggleBookmark, useJoinSheet, useSheetsCount } from '@/features/sheets';
import { useUser } from '@/features/user';
import { ROUTES } from '@/shared/config';
import Button from '@/shared/components/Button';
import Pagination from '@/shared/components/Pagination';
import Breadcrumb from '@/shared/components/Breadcrumb';
import type { BreadcrumbItem } from '@/shared/components/Breadcrumb';
import SheetFilterBar from './parts/SheetFilterBar';
import SheetCard from './parts/SheetCard';
import SheetsSkeleton from './parts/SheetsSkeleton';
import JoinSheetModal from './parts/JoinSheetModal';
import styles from './page.module.css';

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export default function SheetsListingPage() {
  const router = useRouter();
  const { user } = useUser();
  const isLoggedIn = !!user;

  // Fetch total sheet count to determine if any sheets exist
  const { data: sheetsCountData, isLoading: countLoading } = useSheetsCount();
  const hasSheets = (sheetsCountData?.count ?? 0) > 0;

  // Filter state
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'mine' | 'bookmarked'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'updatedAt' | 'bookmarkCount'>('bookmarkCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Reset filters when there are no sheets (avoid invalid 'bookmarked' or bookmark sort)
  useEffect(() => {
    if (!hasSheets && !countLoading) {
      // Reset to safe defaults
      if (viewFilter === 'bookmarked') setViewFilter('all');
      if (sortBy === 'bookmarkCount') {
        setSortBy('createdAt');
        setSortOrder('desc');
      }
    }
  }, [hasSheets, countLoading, viewFilter, sortBy]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change and scroll to top
  useEffect(() => {
    setPage(1);
    scrollToTop();
  }, [debouncedSearch, viewFilter, sortBy, sortOrder]);

  const useBookmarks = viewFilter === 'bookmarked';

  const params = useBookmarks
    ? undefined
    : {
        search: debouncedSearch || undefined,
        mySheets: viewFilter === 'mine' ? true : undefined,
        sortBy,
        sortOrder,
        page,
        limit,
      };

  const {
    data: sheetsData,
    isLoading: sheetsLoading,
    error: sheetsError,
    refetch: refetchSheets,
  } = useSheets(params);

  const {
    data: bookmarksData,
    isLoading: bookmarksLoading,
    error: bookmarksError,
    refetch: refetchBookmarks,
  } = useBookmarkedSheets(
    useBookmarks
      ? {
          page,
          limit,
          search: debouncedSearch || undefined,
        }
      : undefined
  );

  const isLoading = (useBookmarks ? bookmarksLoading : sheetsLoading) || countLoading;
  const error = useBookmarks ? bookmarksError : sheetsError;
  const data = useBookmarks ? bookmarksData : sheetsData;
  const sheets = data?.sheets || [];
  const pagination = data?.pagination;

  const joinSheetMutation = useJoinSheet();
  const toggleBookmarkMutation = useToggleBookmark();

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedSheetSlug, setSelectedSheetSlug] = useState<string | null>(null);

  const handleJoinClick = (slug: string) => {
    setSelectedSheetSlug(slug);
    setJoinModalOpen(true);
  };

  const handleJoinConfirm = async (targetDate: string) => {
    if (!selectedSheetSlug) return;
    await joinSheetMutation.mutateAsync({ slug: selectedSheetSlug, targetDate });
    setJoinModalOpen(false);
    setSelectedSheetSlug(null);
    refetchSheets();
    if (useBookmarks) refetchBookmarks();
    router.push(ROUTES.SHEETS.DETAIL(selectedSheetSlug));
  };

  const handleToggleBookmark = async (slug: string) => {
    await toggleBookmarkMutation.mutateAsync(slug);
    if (useBookmarks) {
      refetchBookmarks();
    } else {
      refetchSheets();
    }
  };

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', href: ROUTES.DASHBOARD },
    { label: 'Sheets' },
  ];

  const renderLink = (item: BreadcrumbItem, props: { className: string; children: React.ReactNode }) => {
    if (!item.href) return <span {...props}>{props.children}</span>;
    return <Link href={item.href} className={props.className}>{props.children}</Link>;
  };

  // Sticky filter logic (unchanged)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterWrapperRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: [0] }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

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
          hasSheets={hasSheets}
        />
      </div>

      {isLoading && <SheetsSkeleton count={limit} />}

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
            {viewFilter === 'bookmarked'
              ? 'No bookmarked sheets found.'
              : viewFilter === 'mine'
              ? 'No sheets found.'
              : 'No sheets found.'}
          </p>
          {!search && viewFilter === 'all' && (
            <Link href={ROUTES.SHEETS.CREATE}>
              <Button variant="primary">Create your first sheet →</Button>
            </Link>
          )}
        </div>
      )}

      {!isLoading && !error && sheets.length > 0 && (
        <div className={styles.sheetsList}>
          {sheets.map((sheet) => {
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
          })}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className={styles.paginationWrapper}>
          <Pagination
            currentPage={page}
            totalPages={pagination.pages}
            onPageChange={(newPage) => {
              setPage(newPage);
              scrollToTop();
            }}
            showFirstLast
            showPrevNext
            size="md"
          />
        </div>
      )}

      <JoinSheetModal
        isOpen={joinModalOpen}
        onClose={() => {
          setJoinModalOpen(false);
          setSelectedSheetSlug(null);
        }}
        onConfirm={handleJoinConfirm}
        isLoading={joinSheetMutation.isPending}
      />
    </div>
  );
}