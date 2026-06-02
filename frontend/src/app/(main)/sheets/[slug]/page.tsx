'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSheet, useJoinSheet, useLeaveSheet, useUpdateTargetDate, useDeleteSheet, useToggleBookmark } from '@/features/sheets';
import { useUser } from '@/features/user';
import { ROUTES } from '@/shared/config';
import Breadcrumb from '@/shared/components/Breadcrumb';
import Button from '@/shared/components/Button';
import type { BreadcrumbItem } from '@/shared/components/Breadcrumb';
import JoinSheetModal from '../parts/JoinSheetModal';
import UpdateTargetDateModal from './parts/UpdateTargetDateModal';
import DeleteSheetModal from './parts/DeleteSheetModal';
import LeaveSheetModal from './parts/LeaveSheetModal';
import SheetHero from './parts/SheetHero';
import ProgressChart from './parts/ProgressChart';
import QuestionList from './parts/QuestionList';
import ParticipantList from './parts/ParticipantList';
import SheetDetailSkeleton from './parts/SheetDetailSkeleton';
import styles from './page.module.css';

export default function SheetDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useUser();
  const isAuthenticated = !!user;

  const { data: sheetData, isLoading, error, refetch } = useSheet(slug);
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
    refetch(); // Refresh sheet data to get updated bookmarkCount and isBookmarked
  };

  if (isLoading) return <SheetDetailSkeleton />;
  if (error || !sheetData) {
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
    participants,
    stats,
    hasJoined,
    currentUserProgress,
  } = sheetData;

  const isOwner = user ? sheet.ownerId === user._id : false;
  const targetDate = currentUserProgress?.targetDate;

  const handleJoin = (targetDateStr: string) => {
    joinMutation.mutate({ slug, targetDate: targetDateStr }, {
      onSuccess: () => {
        setJoinModalOpen(false);
        refetch();
      },
    });
  };

  const handleLeave = () => {
    leaveMutation.mutate({ slug }, {
      onSuccess: () => {
        setLeaveModalOpen(false);
        refetch();
        router.push(ROUTES.SHEETS.ROOT);
      },
      onError: () => {
        setLeaveModalOpen(false);
      },
    });
  };

  const handleUpdateTargetDate = (newTargetDate: string) => {
    updateTargetDateMutation.mutate({ slug, targetDate: newTargetDate }, {
      onSuccess: () => refetch(),
    });
    setTargetDateModalOpen(false);
  };

  const handleDelete = () => {
    deleteMutation.mutate({ slug }, {
      onSuccess: () => router.push(ROUTES.SHEETS.ROOT),
    });
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
        participants={participants}
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

      {hasJoined && currentUserProgress && (
        <div className={styles.progressSection}>
          <ProgressChart
            solvedCount={currentUserProgress.solvedCount}
            revisionCompletedCount={currentUserProgress.revisionCompletedCount}
            totalQuestions={currentUserProgress.totalQuestions}
          />
        </div>
      )}

      {!hasJoined && (
        <div className={styles.joinPrompt}>
          <p>You haven't joined this sheet yet. Join to track your progress.</p>
          <Button variant="primary" onClick={() => setJoinModalOpen(true)}>Join Now</Button>
        </div>
      )}

      <div className={styles.questionGroupsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Questions</h2>
          <Link href="/questions" className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        {questions.length === 0 ? (
          <p className={styles.emptyState}>No questions in this sheet yet.</p>
        ) : (
          <QuestionList
            questions={questions}
            perQuestionParticipantCounts={stats.perQuestionParticipantCounts}
            perQuestionSolvedCounts={stats.perQuestionSolvedCounts}
            userProgressDetails={currentUserProgress?.details}
            isJoined={hasJoined}
          />
        )}
      </div>

      <div className={styles.participantsSection}>
        <h2 className={styles.sectionTitle}>Participants</h2>
        <ParticipantList participants={participants} sheetSlug={slug} />
      </div>

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