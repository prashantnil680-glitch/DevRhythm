'use client';

import { useQuery } from '@tanstack/react-query';
import { revisionService } from '@/features/revision/services/revisionService';
import { revisionKeys } from '@/shared/lib/react-query';
import HeroStats from './HeroStats';
import RevisionFunnel from './RevisionFunnel';
import QuickStats from './QuickStats';
import RhythmCenter from './RhythmCenter';
import { DifficultyStones, PlatformSeeds, TopPatterns } from './WisdomBoard';
import { RevisionDashboardSkeleton } from './RevisionDashboardSkeleton';
import ActionStream from './ActionStream';
import NoRecordFound from '@/shared/components/NoRecordFound';
import styles from './RevisionDashboardClient.module.css';

export default function RevisionDashboardClient() {
  const { data, isLoading, error } = useQuery({
    queryKey: revisionKeys.detailedStats(),
    queryFn: () => revisionService.getDetailedRevisionStats(),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <RevisionDashboardSkeleton />;

  if (error || !data) {
    return (
      <NoRecordFound
        message="Unable to load revision dashboard. Please try again later."
        onRetry={() => window.location.reload()}
        retryText="Retry"
      />
    );
  }

  // Transform byRevisionIndex
  const byRevisionIndex = (data.byRevisionIndex || []).map((item, idx) => ({
    index: idx,
    stage: `${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} review`,
    totalQuestions: item.totalQuestions,
    completed: item.completed,
  }));

  // Transform byDifficulty – cast difficulty to the union type
  const byDifficultyArray = Object.entries(data.byDifficulty || {}).map(([difficulty, values]) => ({
    difficulty: difficulty as 'Easy' | 'Medium' | 'Hard',
    totalRevisions: values.totalRevisions,
    completionRate: values.completionRate,
  }));

  // Transform byPlatform
  const byPlatformArray = Object.entries(data.byPlatform || {}).map(([platform, values]) => ({
    platform,
    totalRevisions: values.totalRevisions,
    completionRate: values.completionRate,
  }));

  // Transform trends.daily: rename timeSpent → totalTimeSpent, convert avgConfidence to number
  const transformedTrends = {
    daily: (data.trends?.daily || []).map(day => ({
      date: day.date,
      completed: day.completed,
      avgConfidence: typeof day.avgConfidence === 'string' ? parseFloat(day.avgConfidence) : (day.avgConfidence ?? 0),
      totalTimeSpent: day.timeSpent || 0,   // API uses 'timeSpent', component expects 'totalTimeSpent'
    })),
    weekly: data.trends?.weekly || [],
    monthly: data.trends?.monthly || [],
  };

  const quickStats = {
    totalCompleted: data.summary.totalCompletedSchedules || 0,
    pending: data.summary.totalRevisionsPending || 0,
    avgConfidence: data.confidenceStats?.overallAverageAfter
      ? parseFloat(data.confidenceStats.overallAverageAfter as any)
      : 0,
    totalTimeSpent: data.timeStats?.totalMinutesSpent || 0,
    longestStreak: data.summary.revisionStreak?.longest || 0,
  };

  return (
    <div className={styles.container}>
      <HeroStats stats={data.summary} />
      <div className={styles.twoColumnCore}>
        <div className={styles.leftColumn}>
          <RevisionFunnel data={byRevisionIndex} />
        </div>
        {/* <div className={styles.rightColumn}>
          <QuickStats {...quickStats} />
        </div> */}
      </div>
      <RhythmCenter trends={transformedTrends} />
      <div className={styles.wisdomBoard}>
        <DifficultyStones data={byDifficultyArray} />
        <PlatformSeeds data={byPlatformArray} />
        <TopPatterns data={data.byPattern || []} />
      </div>
      <ActionStream />
    </div>
  );
}