'use client';

import Link from 'next/link';
import { differenceInDays, format } from 'date-fns';
import Card from '@/shared/components/Card';
import ProgressBar from '@/shared/components/ProgressBar';
import Badge from '@/shared/components/Badge';
import type { PlannedGoal } from '@/features/dashboard';
import styles from './ActiveGoals.module.css';

interface ActiveGoalsProps {
  goals: PlannedGoal[];
  isLoading?: boolean;
}

const getDaysLeft = (deadline: string): number | null => {
  const end = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInDays(end, today);
  return diff >= 0 ? diff : null;
};

const formatDeadline = (deadline: string): string => {
  const daysLeft = getDaysLeft(deadline);
  if (daysLeft === 0) return 'ends today';
  if (daysLeft === 1) return 'ends tomorrow';
  if (daysLeft !== null) return `ends ${format(new Date(deadline), 'MMM d')}`;
  return `ended ${format(new Date(deadline), 'MMM d')}`;
};

const formatDateRange = (title: string): string => {
  return title;
};

export default function ActiveGoals({ goals, isLoading }: ActiveGoalsProps) {
  // Safely handle undefined or null goals array
  const plannedGoals = goals ?? [];

  if (isLoading) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Active Goals</h3>
          <Link href="/goals" className={styles.viewAllLink}>
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

  if (!plannedGoals || plannedGoals.length === 0) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Active Goals</h3>
          <Link href="/goals" className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        <div className={styles.emptyState}>No active goals set.</div>
      </Card>
    );
  }

  // Filter only active goals (percentage < 100 and deadline not passed)
  const activeGoals = plannedGoals.filter(goal => {
    const isCompleted = goal.progress.percentage >= 100;
    const deadlinePassed = new Date(goal.deadline) < new Date();
    return !isCompleted && !deadlinePassed;
  });

  const displayGoals = activeGoals.slice(0, 3);

  if (displayGoals.length === 0) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Active Goals</h3>
          <Link href="/goals" className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        <div className={styles.emptyState}>No active goals at the moment.</div>
      </Card>
    );
  }

  return (
    <Card className={styles.container} noHover>
      <div className={styles.header}>
        <h3 className={styles.title}>Active Goals</h3>
        <Link href="/goals" className={styles.viewAllLink}>
          View All →
        </Link>
      </div>
      <div className={styles.goalsList}>
        {displayGoals.map((goal) => {
          const percentage = Math.round(goal.progress.percentage);
          const dateRange = formatDateRange(goal.title);
          const deadlineLabel = formatDeadline(goal.deadline);
          const daysLeft = getDaysLeft(goal.deadline);
          const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft > 0;

          // Badge variant based on days left
          let badgeVariant: 'success' | 'warning' | 'error' | 'default' = 'default';
          let badgeText = '';
          if (daysLeft !== null && daysLeft > 0) {
            if (daysLeft <= 3) {
              badgeVariant = 'error';
              badgeText = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
            } else if (daysLeft <= 7) {
              badgeVariant = 'warning';
              badgeText = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
            } else {
              badgeVariant = 'success';
              badgeText = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
            }
          } else if (daysLeft === 0) {
            badgeVariant = 'warning';
            badgeText = 'Ends today';
          } else if (daysLeft === null) {
            badgeVariant = 'error';
            badgeText = 'Overdue';
          }

          return (
            <Link key={goal.id} href={`/goals/${goal.id}`} className={styles.goalLink}>
              <div className={styles.goalItem}>
                <div className={styles.goalRow}>
                  <div className={styles.goalTitle}>{goal.description}</div>
                  {badgeText && (
                    <Badge variant={badgeVariant} size="sm" className={styles.goalBadge}>
                      {badgeText}
                    </Badge>
                  )}
                </div>
                <div className={styles.goalMeta}>
                  <span className={styles.dateRange}>{dateRange}</span>
                  <span className={styles.metaSeparator}>·</span>
                  <span className={styles.percentage}>{percentage}%</span>
                  <span className={styles.metaSeparator}>·</span>
                  <span className={styles.completion}>
                    {goal.progress.completed} / {goal.progress.total}
                  </span>
                </div>
                <ProgressBar value={percentage} max={100} size="sm" showValue={false} rounded />
                <div className={styles.goalFooter}>
                  <span className={styles.deadline}>{deadlineLabel}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}