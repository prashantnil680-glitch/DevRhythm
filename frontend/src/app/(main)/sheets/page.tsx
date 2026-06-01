'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiPlus } from 'react-icons/fi';
import { useSheets, useJoinSheet } from '@/features/sheets';
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

// Helper to scroll to top smoothly
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export default function SheetsListingPage() {
  const router = useRouter();
  const { user } = useUser();

  // Filter state
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'updatedAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Sticky filter logic
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterWrapperRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change AND scroll to top
  useEffect(() => {
    setPage(1);
    scrollToTop();
  }, [debouncedSearch, ownerFilter, sortBy, sortOrder]);

  // Build query params
  const params = {
    search: debouncedSearch || undefined,
    ...(ownerFilter === 'mine' && user ? { mySheets: true } : {}),
    sortBy,
    sortOrder,
    page,
    limit,
  };

  const { data, isLoading, error, refetch } = useSheets(params);
  const sheets = data?.sheets || [];
  const pagination = data?.pagination;

  const joinSheetMutation = useJoinSheet();
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
    refetch();
    router.push(ROUTES.SHEETS.DETAIL(selectedSheetSlug));
  };

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', href: ROUTES.DASHBOARD },
    { label: 'Sheets' },
  ];

  const renderLink = (item: BreadcrumbItem, props: { className: string; children: React.ReactNode }) => {
    if (!item.href) return <span {...props}>{props.children}</span>;
    return <Link href={item.href} className={props.className}>{props.children}</Link>;
  };

  // Sticky observer
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

      {/* Sentinel for sticky detection */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />

      {/* Filter wrapper with sticky behavior */}
      <div
        ref={filterWrapperRef}
        className={`${styles.filterWrapper} ${isSticky ? styles.sticky : ''}`}
      >
        <SheetFilterBar
          search={search}
          onSearchChange={setSearch}
          ownerFilter={ownerFilter}
          onOwnerFilterChange={setOwnerFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          isLoggedIn={!!user}
        />
      </div>

      {isLoading && <SheetsSkeleton count={limit} />}

      {error && (
        <div className={styles.errorState}>
          <p>Failed to load sheets. Please try again.</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {!isLoading && !error && sheets.length === 0 && (
        <div className={styles.emptyState}>
          <p>No sheets found.</p>
          {!search && ownerFilter === 'all' && (
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