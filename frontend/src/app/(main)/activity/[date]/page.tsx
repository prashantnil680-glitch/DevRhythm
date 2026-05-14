'use client';

import { useParams } from 'next/navigation';
import {
  FiInfo,
  FiBookOpen,
  FiAward,
  FiCheckCircle,
  FiAlertCircle,
  FiTarget,
  FiXCircle,
  FiUsers,
} from 'react-icons/fi';
import Breadcrumb from '@/shared/components/Breadcrumb';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import EmptyState from '@/shared/components/EmptyState';
import { useDayActivity } from '@/features/activity/hooks/useActivityData';
import HeroSummary from '../parts/HeroSummary';
import styles from '../ActivityDashboard.module.css';
import { QuestionCard, GoalCard, GroupCard } from '../parts/AllActivityLog';

export default function ActivityDayPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;

  const { data, isLoading, error } = useDayActivity(date);

  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!isValidDate) {
    return <div className={styles.container}>Invalid date format</div>;
  }

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Activity', href: '/activity' },
    { label: date },
  ];

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Breadcrumb items={breadcrumbItems} />
        <div className={styles.fullWidth}>
          <SkeletonLoader variant="custom" height={180} />
        </div>
        <div className={styles.fullWidth}>
          <SkeletonLoader variant="custom" height={300} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <Breadcrumb items={breadcrumbItems} />
        <div className={styles.fullWidth}>
          <EmptyState
            title="Unable to load activity"
            description={`We couldn't fetch the activity data for ${date}. Please try again later.`}
            icon={<FiInfo size={48} />}
          />
        </div>
      </div>
    );
  }

  const solvedGroups = data.question_solved || {};
  const masteredGroups = data.question_mastered || {};
  const revisionData = data.revision_completed || {};
  const goalsData = data.goal_achieved || { completed: [], failed: [] };
  const groupProgress = data.group_goal_progress || [];
  const groupCompleted = data.group_goal_completed || [];
  const challengeProgress = data.group_challenge_progress || [];
  const challengeCompleted = data.group_challenge_completed || [];

  const solvedList = Object.values(solvedGroups);
  const masteredList = Object.values(masteredGroups);
  const onTimeGroups = revisionData.on_time || {};
  const overdueGroups = revisionData.overdue || {};

  return (
    <div className={styles.container}>
      <Breadcrumb items={breadcrumbItems} />

      <div className={styles.fullWidth}>
        <HeroSummary date={date} />
      </div>

      <div className={styles.fullWidth}>
        <div className={styles.activityLogSection}>
          <h3 className={styles.sectionTitle}>All Activity on {date}</h3>

          {/* Solved */}
          <div className={styles.tabSection}>
            <h4 className={styles.tabSubtitle}>Solved Questions</h4>
            {solvedList.length === 0 && (
              <EmptyState
                title="No solved questions"
                description="No problems were solved on this day."
                icon={<FiBookOpen size={48} />}
              />
            )}
            {solvedList.map((group: any) => (
              <QuestionCard
                key={group.question._id}
                question={group.question}
                timeline={group.solves_timeline}
                type="solve"
              />
            ))}
          </div>

          {/* Mastered */}
          <div className={styles.tabSection}>
            <h4 className={styles.tabSubtitle}>Mastered Questions</h4>
            {masteredList.length === 0 && (
              <EmptyState
                title="No mastered questions"
                description="No problems reached mastery on this day."
                icon={<FiAward size={48} />}
              />
            )}
            {masteredList.map((group: any) => (
              <QuestionCard
                key={group.question._id}
                question={group.question}
                timeline={group.solves_timeline}
                type="mastered"
              />
            ))}
          </div>

          {/* Revisions */}
          <div className={styles.tabSection}>
            <h4 className={styles.tabSubtitle}>Revisions</h4>
            <div className={styles.revisionsGrid}>
              <div className={styles.revisionsColumn}>
                <div className={styles.columnHeader}>On‑time</div>
                {Object.keys(onTimeGroups).length === 0 && (
                  <EmptyState
                    title="No on‑time revisions"
                    description="No revisions completed on time today."
                    icon={<FiCheckCircle size={40} />}
                  />
                )}
                {Object.values(onTimeGroups).map((group: any) => (
                  <QuestionCard
                    key={group.question._id}
                    question={group.question}
                    timeline={group.revision_timeline}
                    type="revision"
                  />
                ))}
              </div>
              <div className={styles.revisionsColumn}>
                <div className={styles.columnHeader}>Overdue</div>
                {Object.keys(overdueGroups).length === 0 && (
                  <EmptyState
                    title="No overdue revisions"
                    description="All revisions were completed on time."
                    icon={<FiAlertCircle size={40} />}
                  />
                )}
                {Object.values(overdueGroups).map((group: any) => (
                  <QuestionCard
                    key={group.question._id}
                    question={group.question}
                    timeline={group.revision_timeline}
                    type="revision"
                  />
                ))}
              </div>
            </div>
            {revisionData.message && (
              <div className={styles.disclaimerMessage}>
                <FiInfo size={14} />
                <span>{revisionData.message}</span>
              </div>
            )}
          </div>

          {/* Goals */}
          <div className={styles.tabSection}>
            <h4 className={styles.tabSubtitle}>Goals</h4>
            <div className={styles.goalsGrid}>
              <div className={styles.goalsColumn}>
                <div className={styles.columnHeader}>Completed</div>
                {goalsData.completed.length === 0 && (
                  <EmptyState
                    title="No completed goals"
                    description="No goals were achieved on this day."
                    icon={<FiTarget size={40} />}
                  />
                )}
                {goalsData.completed.map((goal: any) => (
                  <GoalCard key={goal._id} goal={goal} status="completed" />
                ))}
              </div>
              <div className={styles.goalsColumn}>
                <div className={styles.columnHeader}>Failed</div>
                {goalsData.failed.length === 0 && (
                  <EmptyState
                    title="No failed goals"
                    description="No goals were missed on this day."
                    icon={<FiXCircle size={40} />}
                  />
                )}
                {goalsData.failed.map((goal: any) => (
                  <GoalCard key={goal._id} goal={goal} status="failed" />
                ))}
              </div>
            </div>
          </div>

          {/* Group */}
          <div className={styles.tabSection}>
            <h4 className={styles.tabSubtitle}>Group Activity</h4>
            {groupProgress.length === 0 && groupCompleted.length === 0 && challengeProgress.length === 0 && challengeCompleted.length === 0 && (
              <EmptyState
                title="No group activity"
                description="No group goals or challenges were updated on this day."
                icon={<FiUsers size={48} />}
              />
            )}
            {[...groupProgress, ...groupCompleted, ...challengeProgress, ...challengeCompleted]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((item: any, idx: number) => (
                <GroupCard key={idx} items={[item]} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}