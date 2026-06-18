'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUserProgress, useSheet, useToggleBookmark } from '@/features/sheets';
import { useUser } from '@/features/user';
import { ROUTES } from '@/shared/config';
import Pagination from '@/shared/components/Pagination';
import NotFoundPage from '@/shared/components/NotFoundPage';
import Modal from '@/shared/components/Modal';
import Button from '@/shared/components/Button';
import UserProgressHeader from './parts/UserProgressHeader';
import UserQuestionList from './parts/UserQuestionList';
import UserProgressChart from './parts/UserProgressChart';
import UserProgressSkeleton from './parts/UserProgressSkeleton';
import QuestionsFilterBar from '../../parts/QuestionsFilterBar';
import styles from './page.module.css';

interface UserProgressPageClientProps {
  requiresAuth?: boolean;
}

export default function UserProgressPageClient({ requiresAuth = false }: UserProgressPageClientProps) {
  const { slug, username } = useParams<{ slug: string; username: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [loginModalOpen, setLoginModalOpen] = useState(requiresAuth);

  // Fetch sheet data for bookmark state and sheet name
  const { data: sheetData, isLoading: sheetLoading } = useSheet(slug);
  const sheetName = sheetData?.sheet?.name || '';
  const isBookmarked = sheetData?.sheet?.isBookmarked || false;
  const bookmarkCount = sheetData?.sheet?.bookmarkCount || 0;

  // Bookmark mutation
  const toggleBookmarkMutation = useToggleBookmark();
  const handleToggleBookmark = useCallback(() => {
    toggleBookmarkMutation.mutate(slug);
  }, [slug, toggleBookmarkMutation]);

  // Filter & pagination state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'solved' | 'unsolved' | 'all'>('all');
  const [revisionStatus, setRevisionStatus] = useState<'completed' | 'pending' | 'all'>('all');
  const [difficulty, setDifficulty] = useState<string>('');
  const [sortBy, setSortBy] = useState<'title' | 'difficulty' | 'lastUpdated' | 'solved' | 'revisionCompleted'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const limit = 10;

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, revisionStatus, difficulty, sortBy, sortOrder]);

  // Query parameters
  const queryParams = {
    page,
    limit,
    search: debouncedSearch || undefined,
    status: status === 'all' ? undefined : status,
    revisionStatus: revisionStatus === 'all' ? undefined : revisionStatus,
    difficulty: difficulty ? (difficulty as 'easy' | 'medium' | 'hard') : undefined,
    sortBy,
    sortOrder,
  };

  const { data, isLoading, error } = useUserProgress(slug, username, queryParams);

  // Sticky filter logic using scroll event (optimised)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterWrapperRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (sentinelRef.current) {
        const sentinelRect = sentinelRef.current.getBoundingClientRect();
        const newSticky = sentinelRect.bottom <= 0;
        setIsSticky(prev => (prev === newSticky ? prev : newSticky));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const questionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isLoading && data) {
      questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page, debouncedSearch, status, revisionStatus, difficulty, sortBy, sortOrder, isLoading, data]);

  const handleClearFilters = () => {
    setSearch('');
    setStatus('all');
    setRevisionStatus('all');
    setDifficulty('');
    setSortBy('title');
    setSortOrder('asc');
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLoginRedirect = () => {
    const returnTo = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?returnTo=${returnTo}`;
  };

  // If authentication is required, show modal and prevent data fetching
  if (requiresAuth) {
    return (
      <>
        {sheetLoading ? <UserProgressSkeleton /> : (
          <div className={styles.container}>
            <Modal
              isOpen={loginModalOpen}
              onClose={() => setLoginModalOpen(false)}
              title="Authentication Required"
              size="sm"
              closeOnBackdropClick={false}
              closeOnEsc={false}
              showCloseButton={false}
            >
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p>You need to be logged in to view user progress.</p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                  <Button variant="outline" onClick={() => router.push(ROUTES.SHEETS.DETAIL(slug))}>
                    Go Back
                  </Button>
                  <Button variant="primary" onClick={handleLoginRedirect}>
                    Log In
                  </Button>
                </div>
              </div>
            </Modal>
          </div>
        )}
      </>
    );
  }

  if (isLoading || sheetLoading) return <UserProgressSkeleton />;
  if (error || !data) {
    return (
      <NotFoundPage
        title="Progress Not Found"
        message={`User "${username}" hasn't joined this sheet or the sheet doesn't exist.`}
        actions={[
          { text: 'Back to Sheet', href: ROUTES.SHEETS.DETAIL(slug), variant: 'primary' },
          { text: 'View All Sheets', href: ROUTES.SHEETS.ROOT, variant: 'outline' },
        ]}
      />
    );
  }

  const {
    joinedAt,
    targetDate,
    completedAt,
    isFullyCompleted,
    progress,
    stats,
    shareLink,
    pagination,
  } = data;

  return (
    <div className={styles.container}>
      <UserProgressHeader
        username={username}
        sheetSlug={slug}
        sheetName={sheetName}
        joinedAt={joinedAt}
        targetDate={targetDate}
        completedAt={completedAt}
        isFullyCompleted={isFullyCompleted}
        stats={stats}
        shareLink={shareLink}
        isAuthenticated={!!user}
        hasJoinedSheet={true}
        isBookmarked={isBookmarked}
        bookmarkCount={bookmarkCount}
        onToggleBookmark={handleToggleBookmark}
        isBookmarkPending={toggleBookmarkMutation.isPending}
        onJoinSheet={() => {}}
      />

      <div className={styles.chartSection}>
        <UserProgressChart
          solvedCount={stats.solvedCount}
          revisionCompletedCount={stats.revisionCompletedCount}
          totalQuestions={stats.totalQuestions}
        />
      </div>

      {/* Sentinel for sticky detection */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />

      <div
        ref={filterWrapperRef}
        className={`${styles.filterWrapper} ${isSticky ? styles.sticky : ''}`}
      >
        <QuestionsFilterBar
          search={search}
          onSearchChange={setSearch}
          solveStatus={status}
          onSolveStatusChange={(value) => setStatus(value as 'solved' | 'unsolved' | 'all')}
          revisionStatus={revisionStatus}
          onRevisionStatusChange={(value) => setRevisionStatus(value as 'completed' | 'pending' | 'all')}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          onClearFilters={handleClearFilters}
        />
      </div>

      <div ref={questionsRef} className={styles.questionsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Questions</h2>
        </div>

        {progress.length === 0 ? (
          <p className={styles.emptyState}>No questions match your filters.</p>
        ) : (
          <>
            <UserQuestionList progress={progress} />
            {pagination && pagination.totalPages > 1 && (
              <div className={styles.paginationWrapper}>
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
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
    </div>
  );
}