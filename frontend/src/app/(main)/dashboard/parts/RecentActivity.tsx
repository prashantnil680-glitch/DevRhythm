'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { FiCheckCircle, FiRefreshCw, FiTarget } from 'react-icons/fi';
import Card from '@/shared/components/Card';
import Badge from '@/shared/components/Badge';
import { ROUTES } from '@/shared/config';
import type { ActivityItem } from '@/features/dashboard';
import styles from './RecentActivity.module.css';

interface RecentActivityProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'question_solved':
    case 'question_mastered':
      return <FiCheckCircle className={styles.iconSolved} />;
    case 'revision_completed':
      return <FiRefreshCw className={styles.iconRevision} />;
    case 'goal_achieved':
      return <FiTarget className={styles.iconGoal} />;
    default:
      return <FiCheckCircle className={styles.iconSolved} />;
  }
};

const formatActivityMessage = (activity: ActivityItem): string => {
  switch (activity.type) {
    case 'question_solved':
      return `Solved ${activity.title}`;
    case 'question_mastered':
      return `Mastered ${activity.title}`;
    case 'revision_completed':
      return `Revised ${activity.title}`;
    case 'goal_achieved':
      const message = activity.metadata?.message;
      return typeof message === 'string' ? message : 'Goal achieved';
    default:
      return activity.title;
  }
};

// Helper to determine if activity is clickable (leads to question page)
const isClickableActivity = (activity: ActivityItem): boolean => {
  const clickableTypes = ['solved', 'question_solved', 'question_mastered', 'revision_completed', 'revision'];
  return clickableTypes.includes(activity.type) && !!activity.platformQuestionId;
};

export default function RecentActivity({ activities, isLoading }: RecentActivityProps) {
  if (isLoading) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Recent Activity</h3>
          <Link href={ROUTES.ACTIVITY.ROOT} className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        <div className={styles.skeletonList}>
          <div className={styles.skeletonItem} />
          <div className={styles.skeletonItem} />
          <div className={styles.skeletonItem} />
        </div>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Recent Activity</h3>
          <Link href={ROUTES.ACTIVITY.ROOT} className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        <div className={styles.emptyState}>No recent activity.</div>
      </Card>
    );
  }

  const displayActivities = activities.slice(0, 7);

  return (
    <Card className={styles.container} noHover>
      <div className={styles.header}>
        <h3 className={styles.title}>Recent Activity</h3>
        <Link href={ROUTES.ACTIVITY.ROOT} className={styles.viewAllLink}>
          View All →
        </Link>
      </div>
      <div className={styles.activityList}>
        {displayActivities.map((activity, index) => {
          const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });
          const message = formatActivityMessage(activity);
          const isClickable = isClickableActivity(activity);
          const questionLink = activity.platformQuestionId ? `/questions/${activity.platformQuestionId}` : null;

          return (
            <div key={activity._id || `fallback-${index}`} className={styles.activityItem}>
              <div className={styles.activityIcon}>{getActivityIcon(activity.type)}</div>
              <div className={styles.activityContent}>
                <div className={styles.activityMessage}>
                  {isClickable && questionLink ? (
                    <Link href={questionLink} className={styles.messageLink}>
                      <span className={styles.messageText}>{message}</span>
                    </Link>
                  ) : (
                    <span className={styles.messageText}>{message}</span>
                  )}
                  {activity.difficulty && (
                    <Badge
                      variant={activity.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'}
                      size="sm"
                      className={styles.difficultyBadge}
                    >
                      {activity.difficulty}
                    </Badge>
                  )}
                </div>
                <div className={styles.activityTime}>{timeAgo}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}