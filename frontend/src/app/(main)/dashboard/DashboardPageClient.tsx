'use client';

import { useState, useEffect } from 'react';
import { useDashboard } from '@/features/dashboard';
import { useUser, useTotalUsers } from '@/features/user';
import QuestionsList from '@/features/user/components/QuestionsList';
import HeroSummary from './parts/HeroSummary';
import ProductivityHeatmap from './parts/ProductivityHeatmap';
import WeeklyStudyTime from './parts/WeeklyStudyTime';
import GoalsProgressGraph from './parts/GoalsProgressGraph';
import ActiveGoals from './parts/ActiveGoals';
import DailyChallengeCard from './parts/DailyChallengeCard';
import PendingRevisions from './parts/PendingRevisions';
import RecentActivity from './parts/RecentActivity';
import WeakestPatternInsight from './parts/WeakestPatternInsight';
import WelcomeBanner from './parts/WelcomeBanner';
import DashboardSkeleton from './parts/DashboardSkeleton';
import styles from './page.module.css';

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useDashboard();
  const { user } = useUser();
  const { data: totalUsersData, isLoading: totalUsersLoading } = useTotalUsers();

  const [showBanner, setShowBanner] = useState(false);
  const [bannerType, setBannerType] = useState<'welcome' | 'welcomeBack' | null>(null);

  // Read sessionStorage flags after user is loaded
  useEffect(() => {
    if (user && !dashboardLoading && !totalUsersLoading) {
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
  }, [user, dashboardLoading, totalUsersLoading]);

  const handleBannerDismiss = () => {
    // Clear sessionStorage flags
    sessionStorage.removeItem('showWelcome');
    sessionStorage.removeItem('showWelcomeBack');
    setShowBanner(false);
    setBannerType(null);
  };

  if (dashboardLoading || !dashboard || !user || totalUsersLoading) {
    return <DashboardSkeleton />;
  }

  const { summary, productivity, goals, revisions, activity, dailyChallenge, insights } = dashboard;
  const totalUsers = totalUsersData?.total ?? 0;

  return (
    <div className={styles.container}>
      {/* Welcome Banner – shown only once per session */}
      {showBanner && bannerType && (
        <WelcomeBanner
          type={bannerType}
          totalUsers={totalUsers}
          onDismiss={handleBannerDismiss}
        />
      )}

      <div className={styles.heroSection}>
        <HeroSummary summary={summary} goals={goals.current} />
      </div>

      {/* Rest of the dashboard unchanged */}
      <div className={styles.twoColumn}>
        <div className={styles.heatmapColumn}>
          <ProductivityHeatmap data={productivity.currentMonthHeatmap} isLoading={dashboardLoading} />
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
          <GoalsProgressGraph />
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
        <QuestionsList isOwnProfile limit={3} />
      </div>

      <div className={styles.fullWidth}>
        <WeakestPatternInsight pattern={insights.weakestPattern} isLoading={dashboardLoading} />
      </div>
    </div>
  );
}