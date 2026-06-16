'use client';

import { useGoalStats, useCurrentGoalProgress } from '@/features/goal';
import { useGoalData } from '@/features/goal/GoalDataContext';
import LazySection from '@/shared/components/LazySection';
import HeroStats from './HeroStats';
import CurrentMomentum from './CurrentMomentum';
import DailyProblemCard from './DailyProblemCard';
import GoalCreationReminder from './GoalCreationReminder';
import { TrendsChartsSkeleton } from './TrendsChartsSkeleton';
import { PlannedGoalsListSkeleton } from './PlannedGoalsListSkeleton';
import { HistoryListSkeleton } from './HistoryListSkeleton';
import { GoalDashboardSkeleton } from './GoalDashboardSkeleton';
import styles from './GoalDashboardClient.module.css';

export default function GoalDashboardClient() {
  const { dailyProblem: initialDaily, goalStats: initialStats, currentGoals: initialCurrent } = useGoalData();

  const { data: statsData, isLoading: statsLoading, error: statsError } = useGoalStats(initialStats);
  const { daily, weekly, isLoading: currentLoading, error: currentError } = useCurrentGoalProgress({ initialData: initialCurrent });

  const isLoading = statsLoading || currentLoading;

  if (isLoading) {
    return <GoalDashboardSkeleton />;
  }

  if (statsError || currentError) {
    return (
      <div className={styles.errorContainer}>
        <p>Unable to load goal dashboard. Please try again later.</p>
      </div>
    );
  }

  const totalGoals = statsData?.totalGoals ?? 0;
  const completionRate = statsData?.completionRate ?? 0;

  const dailyGoalData = {
    completedCount: daily.completed,
    targetCount: daily.target,
    remaining: daily.remaining,
    status: 'active' as const,
    completionPercentage: daily.percentage,
  };

  const weeklyGoalData = {
    completedCount: weekly.completed,
    targetCount: weekly.target,
    remaining: weekly.remaining,
    status: 'active' as const,
    completionPercentage: weekly.percentage,
  };

  return (
    <div className={styles.container}>
      <div className={styles.heroRow}>
        <DailyProblemCard initialData={initialDaily} />
        <HeroStats totalGoals={totalGoals} completionRate={completionRate} />
      </div>

      {/* <CurrentMomentum daily={dailyGoalData} weekly={weeklyGoalData} /> */}
      <LazySection
        loader={() => import('./TrendsCharts')}
        fallback={<TrendsChartsSkeleton />}
        rootMargin="400px"
      />
      <LazySection
        loader={() => import('./PlannedGoalsList')}
        fallback={<PlannedGoalsListSkeleton />}
        rootMargin="400px"
      />
      <LazySection
        loader={() => import('./HistoryList')}
        fallback={<HistoryListSkeleton />}
        rootMargin="400px"
      />
      <GoalCreationReminder />
    </div>
  );
}