'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useSheet,
  useJoinSheet,
  useLeaveSheet,
  useUpdateTargetDate,
  useDeleteSheet,
  useToggleBookmark,
  useAggregatedProgress,
  useSheetRank,
  useSheetParticipants,
} from '@/features/sheets';
import { useUser } from '@/features/user';
import { ROUTES } from '@/shared/config';
import Breadcrumb from '@/shared/components/Breadcrumb';
import Button from '@/shared/components/Button';
import Pagination from '@/shared/components/Pagination';
import type { BreadcrumbItem } from '@/shared/components/Breadcrumb';
import JoinSheetModal from '../parts/JoinSheetModal';
import UpdateTargetDateModal from './parts/UpdateTargetDateModal';
import DeleteSheetModal from './parts/DeleteSheetModal';
import LeaveSheetModal from './parts/LeaveSheetModal';
import SheetHero from './parts/SheetHero';
import ProgressChart from './parts/ProgressChart';
import QuestionList from './parts/QuestionList';
import ParticipantList from './parts/ParticipantList';
import QuestionsFilterBar from './parts/QuestionsFilterBar';
import SheetDetailSkeleton from './parts/SheetDetailSkeleton';
import styles from './page.module.css';

export default function SheetDetailPageClient() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useUser();
  const isAuthenticated = !!user;

  // Filter states for questions
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [solveStatus, setSolveStatus] = useState('');
  const [revisionStatus, setRevisionStatus] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const limit = 20;

  // Participants pagination state
  const [participantsPage, setParticipantsPage] = useState(1);
  const participantsLimit = 10;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, solveStatus, revisionStatus, difficulty]);

  // Memoised query parameters
  const queryParams = useMemo(() => ({
    page,
    limit,
    search: search || undefined,
    solveStatus: solveStatus || undefined,
    revisionStatus: revisionStatus || undefined,
    difficulty: difficulty || undefined,
  }), [page, search, solveStatus, revisionStatus, difficulty]);

  const participantsParams = useMemo(() => ({
    page: participantsPage,
    limit: participantsLimit,
  }), [participantsPage]);

  // Data fetching hooks
  const {
    data: sheetData,
    isLoading,
    error,
    refetch,
  } = useSheet(slug, queryParams);

  const {
    data: aggregatedProgress,
    isLoading: aggLoading,
    refetch: refetchAggregatedProgress,
  } = useAggregatedProgress(slug);

  const {
    data: rankData,
    isLoading: rankLoading,
    refetch: refetchRank,
  } = useSheetRank(slug);

  const {
    data: participantsData,
    isLoading: participantsLoading,
    refetch: refetchParticipants,
  } = useSheetParticipants(slug, participantsParams);

  const joinMutation = useJoinSheet();
  const leaveMutation = useLeaveSheet();
  const updateTargetDateMutation = useUpdateTargetDate();
  const deleteMutation = useDeleteSheet();
  const toggleBookmarkMutation = useToggleBookmark();

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [targetDateModalOpen, setTargetDateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  // Memoised callbacks
  const handleToggleBookmark = useCallback(async () => {
    await toggleBookmarkMutation.mutateAsync(slug);
    refetch();
  }, [toggleBookmarkMutation, slug, refetch]);

  const handleJoin = useCallback((targetDateStr: string) => {
    joinMutation.mutate(
      { slug, targetDate: targetDateStr },
      {
        onSuccess: () => {
          setJoinModalOpen(false);
          refetch();
        },
      }
    );
  }, [joinMutation, slug, refetch]);

  const handleLeave = useCallback(() => {
    leaveMutation.mutate(
      { slug },
      {
        onSuccess: () => {
          setLeaveModalOpen(false);
          refetch();
          router.push(ROUTES.SHEETS.ROOT);
        },
        onError: () => setLeaveModalOpen(false),
      }
    );
  }, [leaveMutation, slug, refetch, router]);

  const handleUpdateTargetDate = useCallback((newTargetDate: string) => {
    updateTargetDateMutation.mutate(
      { slug, targetDate: newTargetDate },
      {
        onSuccess: () => refetch(),
      }
    );
    setTargetDateModalOpen(false);
  }, [updateTargetDateMutation, slug, refetch]);

  const handleDelete = useCallback(() => {
    deleteMutation.mutate(
      { slug },
      {
        onSuccess: () => router.push(ROUTES.SHEETS.ROOT),
      }
    );
    setDeleteModalOpen(false);
  }, [deleteMutation, slug, router]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setSolveStatus('');
    setRevisionStatus('');
    setDifficulty('');
    setPage(1);
  }, []);

  // Sticky filter logic with requestAnimationFrame
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterWrapperRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (sentinelRef.current) {
        const sentinelRect = sentinelRef.current.getBoundingClientRect();
        const newSticky = sentinelRect.bottom <= 0;
        requestAnimationFrame(() => {
          setIsSticky(prev => (prev === newSticky ? prev : newSticky));
        });
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const questionsSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isLoading && sheetData) {
      questionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page, search, solveStatus, revisionStatus, difficulty, isLoading, sheetData]);

  // Fallback refetch for stuck loading states
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (aggLoading && slug) {
        refetchAggregatedProgress();
      }
      if (rankLoading && slug) {
        refetchRank();
      }
      if (participantsLoading && slug) {
        refetchParticipants();
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [aggLoading, rankLoading, participantsLoading, slug, refetchAggregatedProgress, refetchRank, refetchParticipants]);

  // Memoised derived values
  const isOwner = useMemo(() => user ? sheetData?.sheet?.ownerId === user._id : false, [user, sheetData?.sheet?.ownerId]);
  const targetDate = useMemo(() => sheetData?.currentUserProgress?.targetDate, [sheetData?.currentUserProgress?.targetDate]);

  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
    if (!sheetData?.sheet) return [
      { label: 'Home', href: ROUTES.DASHBOARD },
      { label: 'Sheets', href: ROUTES.SHEETS.ROOT },
    ];
    return [
      { label: 'Home', href: ROUTES.DASHBOARD },
      { label: 'Sheets', href: ROUTES.SHEETS.ROOT },
      { label: sheetData.sheet.name },
    ];
  }, [sheetData?.sheet]);

  const renderLink = useCallback((item: BreadcrumbItem, props: { className: string; children: React.ReactNode }) => {
    if (!item.href) return <span {...props}>{props.children}</span>;
    return <Link href={item.href} className={props.className}>{props.children}</Link>;
  }, []);

  if (isLoading || !sheetData) return <SheetDetailSkeleton />;
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>Sheet not found or an error occurred.</p>
        <Button variant="outline" onClick={() => router.push(ROUTES.SHEETS.ROOT)}>
          Back to Sheets
        </Button>
      </div>
    );
  }

  const {
    sheet,
    questions,
    participants: initialParticipants,
    stats,
    hasJoined,
    currentUserProgress,
    pagination,
  } = sheetData;

  return (
    <div className={styles.container}>
      <Breadcrumb items={breadcrumbItems} renderLink={renderLink} />

      <SheetHero
        sheet={sheet}
        participants={initialParticipants}
        totalParticipants={stats.totalParticipants}
        hasJoined={hasJoined}
        isOwner={isOwner}
        targetDate={targetDate}
        isAuthenticated={isAuthenticated}
        onJoin={() => setJoinModalOpen(true)}
        onLeave={() => setLeaveModalOpen(true)}
        onUpdateTargetDate={() => setTargetDateModalOpen(true)}
        onEdit={() => router.push(`${ROUTES.SHEETS.ROOT}/${slug}/edit`)}
        onDelete={() => setDeleteModalOpen(true)}
        onToggleBookmark={handleToggleBookmark}
        isBookmarkPending={toggleBookmarkMutation.isPending}
      />

      <div className={styles.communityProgressSection}>
        <ProgressChart
          slug={slug}
          onJoinSheet={() => setJoinModalOpen(true)}
          isJoining={joinMutation.isPending}
          hasJoined={hasJoined}
          isAuthenticated={isAuthenticated}
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
          solveStatus={solveStatus}
          onSolveStatusChange={setSolveStatus}
          revisionStatus={revisionStatus}
          onRevisionStatusChange={setRevisionStatus}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          onClearFilters={handleClearFilters}
        />
      </div>

      <div ref={questionsSectionRef} className={styles.questionsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Questions</h2>
          <Link href="/questions" className={styles.viewAllLink}>
            View All →
          </Link>
        </div>

        {questions.length === 0 ? (
          <p className={styles.emptyState}>No questions match your filters.</p>
        ) : (
          <>
            <QuestionList
              questions={questions}
              perQuestionParticipantCounts={stats.perQuestionParticipantCounts}
              perQuestionSolvedCounts={stats.perQuestionSolvedCounts}
              userProgressDetails={currentUserProgress?.details}
              isJoined={hasJoined}
            />
            {pagination && pagination.pages > 1 && (
              <div className={styles.paginationWrapper}>
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.pages}
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

      <div className={styles.participantsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Participants</h2>
          <Link href="/users" className={styles.viewAllLink}>
            View All Participants →
          </Link>
        </div>
        <ParticipantList
          participants={participantsData?.participants || []}
          sheetSlug={slug}
          isLoading={participantsLoading}
          onJoinSheet={() => setJoinModalOpen(true)}
          isJoining={joinMutation.isPending}
          isAuthenticated={isAuthenticated}
        />
        {participantsData?.pagination && participantsData.pagination.totalPages > 1 && (
          <div className={styles.paginationWrapper}>
            <Pagination
              currentPage={participantsPage}
              totalPages={participantsData.pagination.totalPages}
              onPageChange={setParticipantsPage}
              siblingCount={0}
              showFirstLast
              showPrevNext
              size="md"
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <JoinSheetModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onConfirm={handleJoin}
        isLoading={joinMutation.isPending}
      />
      <UpdateTargetDateModal
        isOpen={targetDateModalOpen}
        onClose={() => setTargetDateModalOpen(false)}
        currentTargetDate={targetDate}
        onConfirm={handleUpdateTargetDate}
        isLoading={updateTargetDateMutation.isPending}
      />
      <DeleteSheetModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        sheetName={sheet.name}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
      <LeaveSheetModal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        sheetName={sheet.name}
        onConfirm={handleLeave}
        isLoading={leaveMutation.isPending}
      />
    </div>
  );
}