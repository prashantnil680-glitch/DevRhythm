'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useUserProgress, useSheetChart, useSheet } from '@/features/sheets';
import { ROUTES } from '@/shared/config';
import Breadcrumb from '@/shared/components/Breadcrumb';
import type { BreadcrumbItem } from '@/shared/components/Breadcrumb';
import NotFoundPage from '@/shared/components/NotFoundPage';
import ProgressChart from '../../parts/ProgressChart';
import UserProgressHeader from './parts/UserProgressHeader';
import UserQuestionList from './parts/UserQuestionList';
import UserProgressSkeleton from './parts/UserProgressSkeleton';
import styles from './page.module.css';

export default function UserProgressPage() {
  const { slug, username } = useParams<{ slug: string; username: string }>();

  // Fetch sheet details to get sheet name
  const { data: sheetData, isLoading: sheetLoading } = useSheet(slug);
  const sheetName = sheetData?.sheet?.name || '';

  const { data: progressData, isLoading, error } = useUserProgress(slug, username);
  const { data: chartData } = useSheetChart(slug, username);

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
    </div>
  );
}