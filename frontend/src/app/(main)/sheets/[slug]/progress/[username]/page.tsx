// frontend/src/app/(main)/sheets/[slug]/progress/[username]/page.tsx

'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUserProgress, useSheetChart, useSheet, useToggleBookmark, useJoinSheet } from '@/features/sheets';
import { useUser } from '@/features/user';
import { ROUTES } from '@/shared/config';
import Breadcrumb from '@/shared/components/Breadcrumb';
import type { BreadcrumbItem } from '@/shared/components/Breadcrumb';
import NotFoundPage from '@/shared/components/NotFoundPage';
import ProgressChart from '../../parts/ProgressChart';
import UserProgressHeader from './parts/UserProgressHeader';
import UserQuestionList from './parts/UserQuestionList';
import UserProgressSkeleton from './parts/UserProgressSkeleton';
import JoinSheetModal from '../../../parts/JoinSheetModal';
import { useState } from 'react';
import styles from './page.module.css';

export default function UserProgressPage() {
  const { slug, username } = useParams<{ slug: string; username: string }>();
  const router = useRouter();
  const { user } = useUser();
  const isAuthenticated = !!user;

  // Fetch sheet details to get sheet name and bookmark/join status
  const { data: sheetData, isLoading: sheetLoading, refetch: refetchSheet } = useSheet(slug);
  const sheetName = sheetData?.sheet?.name || '';
  const isBookmarked = sheetData?.sheet?.isBookmarked || false;
  const bookmarkCount = sheetData?.sheet?.bookmarkCount || 0;
  const hasJoinedSheet = sheetData?.hasJoined || false;

  const { data: progressData, isLoading, error, refetch: refetchProgress } = useUserProgress(slug, username);
  const { data: chartData } = useSheetChart(slug, username);

  const toggleBookmarkMutation = useToggleBookmark();
  const joinSheetMutation = useJoinSheet();

  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const handleToggleBookmark = async () => {
    await toggleBookmarkMutation.mutateAsync(slug);
    refetchSheet(); // refresh sheet data to update bookmark count and isBookmarked
  };

  const handleJoinSheet = (targetDate: string) => {
    joinSheetMutation.mutate({ slug, targetDate }, {
      onSuccess: () => {
        setJoinModalOpen(false);
        refetchSheet();
        refetchProgress();
      },
    });
  };

  const openJoinModal = () => setJoinModalOpen(true);

  if (isLoading || sheetLoading) return <UserProgressSkeleton />;
  if (error || !progressData) {
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
    userId,
    joinedAt,
    targetDate,
    completedAt,
    isFullyCompleted,
    progress,
    stats,
    shareLink,
  } = progressData;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', href: ROUTES.DASHBOARD },
    { label: 'Sheets', href: ROUTES.SHEETS.ROOT },
    { label: sheetName || 'Sheet', href: ROUTES.SHEETS.DETAIL(slug) },
    { label: `Progress of ${username}` },
  ];

  const renderLink = (item: BreadcrumbItem, props: { className: string; children: React.ReactNode }) => {
    if (!item.href) return <span {...props}>{props.children}</span>;
    return <Link href={item.href} className={props.className}>{props.children}</Link>;
  };

  return (
    <div className={styles.container}>
      <Breadcrumb items={breadcrumbItems} renderLink={renderLink} />

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
        isAuthenticated={isAuthenticated}
        hasJoinedSheet={hasJoinedSheet}
        isBookmarked={isBookmarked}
        bookmarkCount={bookmarkCount}
        onToggleBookmark={handleToggleBookmark}
        onJoinSheet={openJoinModal}
        isJoining={joinSheetMutation.isPending}
        isBookmarkPending={toggleBookmarkMutation.isPending}
      />

      <div className={styles.chartSection}>
        <ProgressChart
          solvedCount={stats.solvedCount}
          revisionCompletedCount={stats.revisionCompletedCount}
          totalQuestions={stats.totalQuestions}
        />
      </div>

      <div className={styles.questionsSection}>
        <h2 className={styles.sectionTitle}>Questions</h2>
        <UserQuestionList progress={progress} />
      </div>

      <JoinSheetModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onConfirm={handleJoinSheet}
        isLoading={joinSheetMutation.isPending}
      />
    </div>
  );
}