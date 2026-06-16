'use client';

import { useState, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import { useDashboard } from '@/features/dashboard';
import { useSession } from '@/features/auth/hooks/useSession';
import HeroSummary from './parts/HeroSummary';
import WeeklyStudyTime from './parts/WeeklyStudyTime';
import ActiveGoals from './parts/ActiveGoals';
import DailyChallengeCard from './parts/DailyChallengeCard';
import PendingRevisions from './parts/PendingRevisions';
import RecentActivity from './parts/RecentActivity';
import WeakestPatternInsight from './parts/WeakestPatternInsight';
import WelcomeBanner from './parts/WelcomeBanner';
import DashboardSkeleton from './parts/DashboardSkeleton';
import styles from './page.module.css';

// Lazy load heavy components that are below the fold
const ProductivityHeatmap = lazy(() => import('./parts/ProductivityHeatmap'));
const GoalsProgressGraph = lazy(() => import('./parts/GoalsProgressGraph'));
const QuestionsList = lazy(() => import('@/features/user/components/QuestionsList'));

// Simple skeleton placeholders for lazy components
const SectionSkeleton = ({ height = 200 }: { height?: number }) => (
  <div className={styles.skeletonPlaceholder} style={{ height, background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', animation: 'pulse 1.5s ease-in-out infinite' }} />
);

interface DashboardPageClientProps {
  initialData?: any;
}

function DashboardPageClient({ initialData }: DashboardPageClientProps) {
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useDashboard(initialData);
  const { user } = useSession();

  const [showBanner, setShowBanner] = useState(false);
  const [bannerType, setBannerType] = useState<'welcome' | 'welcomeBack' | null>(null);

  useEffect(() => {
    if (user && dashboard && !dashboardLoading) {
      const showWelcome = sessionStorage.getItem('showWelcome') === 'true';
      const showWelcomeBack = sessionStorage.getItem('showWelcomeBack') === 'true';
      if (showWelcome) {
        setBannerType('welcome');
        setShowBanner(true);
      } else if (showWelcomeBack) {
        setBannerType('welcomeBack');
        setShowBanner(true);
      }
    }
  }, [user, dashboard, dashboardLoading]);

  const handleBannerDismiss = useCallback(() => {
    sessionStorage.removeItem('showWelcome');
    sessionStorage.removeItem('showWelcomeBack');
    setShowBanner(false);
    setBannerType(null);
  }, []);

  if (dashboardLoading || !dashboard || !user) {
    return <DashboardSkeleton />;
  }

  const { summary, productivity, goals, revisions, activity, dailyChallenge, insights, totalUsers } = dashboard;

  return (
    <div className={styles.container}>
      {showBanner && bannerType && (
        <WelcomeBanner
          type={bannerType}
          totalUsers={totalUsers ?? 0}
          onDismiss={handleBannerDismiss}
        />
      )}

      <div className={styles.heroSection}>
        <HeroSummary summary={summary} goals={goals.current} />
      </div>

      <div className={styles.twoColumn}>
        <div className={styles.heatmapColumn}>
          <Suspense fallback={<SectionSkeleton height={280} />}>
            <ProductivityHeatmap data={productivity.currentMonthHeatmap} isLoading={dashboardLoading} />
          </Suspense>
        </div>
        <div className={styles.weeklyColumn}>
          <WeeklyStudyTime data={productivity.weeklyStudyTime} isLoading={dashboardLoading} />
        </div>
      </div>

      <div className={styles.twoColumn}>
        <div className={styles.pendingColumn}>
          <PendingRevisions
            type="pending"
            revisions={revisions.pendingToday}
            isLoading={dashboardLoading}
            onRevisionComplete={() => refetchDashboard()}
            limit={2}
          />
        </div>
        <div className={styles.goalsGraphColumn}>
          <Suspense fallback={<SectionSkeleton height={300} />}>
            <GoalsProgressGraph />
          </Suspense>
        </div>
      </div>

      <div className={styles.twoColumn}>
        <div className={styles.activeGoalsColumn}>
          <ActiveGoals goals={goals.planned} isLoading={dashboardLoading} />
        </div>
        <div className={styles.dailyChallengeColumn}>
          <DailyChallengeCard dailyChallenge={dailyChallenge} isLoading={dashboardLoading} />
        </div>
      </div>

      <div className={styles.twoColumn}>
        <div className={styles.upcomingColumn}>
          <PendingRevisions type="upcoming" revisions={revisions.upcoming} isLoading={dashboardLoading} limit={5} />
        </div>
        <div className={styles.recentActivityColumn}>
          <RecentActivity activities={activity.timeline} isLoading={dashboardLoading} />
        </div>
      </div>

      <div className={styles.fullWidth}>
        <Suspense fallback={<SectionSkeleton height={200} />}>
          <QuestionsList isOwnProfile limit={3} />
        </Suspense>
      </div>

      <div className={styles.fullWidth}>
        <WeakestPatternInsight pattern={insights.weakestPattern} isLoading={dashboardLoading} />
      </div>
    </div>
  );
}

export default memo(DashboardPageClient);