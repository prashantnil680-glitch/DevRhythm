'use client';

import { useTodayActivity } from '@/features/activity/hooks/useActivityData';
import Breadcrumb from '@/shared/components/Breadcrumb';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import styles from './ActivityDashboard.module.css';

// Lazy import parts to avoid circular dependencies
import HeroSummary from './parts/HeroSummary';
import DayQuestionsRevisions from './parts/DayQuestionsRevisions';
import DailyTrendChart from './parts/DailyTrendChart';
import MonthlyTrendChart from './parts/MonthlyTrendChart';
import SocialFeed from './parts/SocialFeed';
import AllActivityLog from './parts/AllActivityLog';

// Activity Dashboard Skeleton - matches the layout but shows placeholders
function ActivityDashboardSkeleton() {
  return (
    <div className={styles.container}>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Activity' }]} />

      <div className={styles.fullWidth}>
        <SkeletonLoader variant="custom" height={180} />
      </div>

      <div className={styles.twoColumnRow}>
        <div className={styles.dailyTrendColumn}>
          <SkeletonLoader variant="custom" height={300} />
        </div>
        <div className={styles.dayQuestionsColumn}>
          <SkeletonLoader variant="custom" height={300} />
        </div>
      </div>

      <div className={styles.twoColumnRow}>
        <div className={styles.monthlyTrendColumn}>
          <SkeletonLoader variant="custom" height={320} />
        </div>
        <div className={styles.socialFeedColumn}>
          <SkeletonLoader variant="custom" height={320} />
        </div>
      </div>

      <div className={styles.fullWidth}>
        <SkeletonLoader variant="custom" height={400} />
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { isLoading: todayLoading } = useTodayActivity();

  // Show global skeleton while today's data is loading (matches dashboard pattern)
  if (todayLoading) {
    return <ActivityDashboardSkeleton />;
  }

  return (
    <div className={styles.container}>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Activity' }]} />

      {/* Hero Summary – full width */}
      <div className={styles.fullWidth}>
        <HeroSummary />
      </div>

      {/* Row 1: Daily Trend Chart (2/3) + Day's Q&R (1/3) */}
      <div className={styles.twoColumnRow}>
        <div className={styles.dailyTrendColumn}>
          <DailyTrendChart />
        </div>
        <div className={styles.dayQuestionsColumn}>
          <DayQuestionsRevisions />
        </div>
      </div>

      {/* Row 2: Monthly Trend Chart (2/3) + Social Feed (1/3) */}
      <div className={styles.twoColumnRow}>
        <div className={styles.monthlyTrendColumn}>
          <MonthlyTrendChart />
        </div>
        <div className={styles.socialFeedColumn}>
          <SocialFeed />
        </div>
      </div>

      {/* Row 3: All Activity Log – full width */}
      <div className={styles.fullWidth}>
        <AllActivityLog />
      </div>
    </div>
  );
}