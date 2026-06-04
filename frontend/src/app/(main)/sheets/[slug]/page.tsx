'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function SheetDetailPage() {
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

  const queryParams = {
    page,
    limit,
    search: search || undefined,
    solveStatus: solveStatus || undefined,
    revisionStatus: revisionStatus || undefined,
    difficulty: difficulty || undefined,
  };

  const {
    data: sheetData,
    isLoading,
    error,
    refetch,
  } = useSheet(slug, queryParams);

  const { data: aggregatedProgress, isLoading: aggLoading } = useAggregatedProgress(slug);
  const { data: rankData, isLoading: rankLoading } = useSheetRank(slug);
  const {
    data: participantsData,
    isLoading: participantsLoading,
  } = useSheetParticipants(slug, { page: participantsPage, limit: participantsLimit });

  const joinMutation = useJoinSheet();
  const leaveMutation = useLeaveSheet();
  const updateTargetDateMutation = useUpdateTargetDate();
  const deleteMutation = useDeleteSheet();
  const toggleBookmarkMutation = useToggleBookmark();

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [targetDateModalOpen, setTargetDateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  const handleToggleBookmark = async () => {
    await toggleBookmarkMutation.mutateAsync(slug);
    refetch();
  };

  // Sticky filter logic (same as progress page)
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

  const questionsSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isLoading && sheetData) {
      questionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page, search, solveStatus, revisionStatus, difficulty, isLoading, sheetData]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleClearFilters = () => {
    setSearch('');
    setSolveStatus('');
    setRevisionStatus('');
    setDifficulty('');
    setPage(1);
  };

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
    participants: initialParticipants, // not used directly, kept for compatibility
    stats,
    hasJoined,
    currentUserProgress,
    pagination,
  } = sheetData;

  const isOwner = user ? sheet.ownerId === user._id : false;
  const targetDate = currentUserProgress?.targetDate;

  const handleJoin = (targetDateStr: string) => {
    joinMutation.mutate(
      { slug, targetDate: targetDateStr },
      {
        onSuccess: () => {
          setJoinModalOpen(false);
          refetch();
        },
      }
    );
  };

  const handleLeave = () => {
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
  };

  const handleUpdateTargetDate = (newTargetDate: string) => {
    updateTargetDateMutation.mutate(
      { slug, targetDate: newTargetDate },
      {
        onSuccess: () => refetch(),
      }
    );
    setTargetDateModalOpen(false);
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { slug },
      {
        onSuccess: () => router.push(ROUTES.SHEETS.ROOT),
      }
    );
    setDeleteModalOpen(false);
  };

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', href: ROUTES.DASHBOARD },
    { label: 'Sheets', href: ROUTES.SHEETS.ROOT },
    { label: sheet.name },
  ];

  const renderLink = (item: BreadcrumbItem, props: { className: string; children: React.ReactNode }) => {
    if (!item.href) return <span {...props}>{props.children}</span>;
    return <Link href={item.href} className={props.className}>{props.children}</Link>;
  };

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