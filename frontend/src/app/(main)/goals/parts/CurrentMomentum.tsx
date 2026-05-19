'use client';
import { format } from 'date-fns';
import CircularProgress from '@/shared/components/CircularProgress';
import Card from '@/shared/components/Card';
import styles from './CurrentMomentum.module.css';

interface GoalData {
  completedCount: number;
  targetCount: number;
  remaining: number;
  status: string;
  endDate?: string;
  completionPercentage: number;
}

interface CurrentMomentumProps {
  daily?: GoalData;
  weekly?: GoalData;
  isLoading?: boolean;
}

export default function CurrentMomentum({ daily, weekly, isLoading }: CurrentMomentumProps) {
  if (isLoading) {
    return (
      <div className={styles.container}>
        <Card className={styles.skeletonCard} noHover>
          <div className={styles.skeletonRing} />
          <div className={styles.skeletonText} />
        </Card>
        <Card className={styles.skeletonCard} noHover>
          <div className={styles.skeletonRing} />
          <div className={styles.skeletonText} />
        </Card>
      </div>
    );
  }

  const formatEndDate = (dateStr?: string) => {
    if (!dateStr) return 'No deadline';
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return 'ends today';
    return `ends ${format(date, 'MMM d')}`;
  };

  // Helper to check if a goal is "empty" (no active goal)
  const hasActiveGoal = (goal?: GoalData): boolean => {
    return !!goal && goal.targetCount > 0;
  };

  const renderGoalCard = (title: string, goal: GoalData) => {
    const percentage = Math.round(goal.completionPercentage);
    const progressText = `${goal.completedCount} / ${goal.targetCount} completed`;
    const remainingText = goal.remaining > 0 ? `${goal.remaining} left` : 'All done!';

    return (
      <Card className={styles.goalCard}>
        <div className={styles.cardContent}>
          <CircularProgress progress={percentage} size={100} strokeWidth={8}>
            <div className={styles.ringContent}>
              <span className={styles.percentage}>{percentage}%</span>
            </div>
          </CircularProgress>
          <div className={styles.details}>
            <h3 className={styles.goalTitle}>{title} goal</h3>
            <div className={styles.progressText}>{progressText}</div>
            <div className={styles.remainingText}>{remainingText}</div>
            <div className={styles.status}>
              <span className={`${styles.statusBadge} ${goal.status === 'active' ? styles.active : styles.completed}`}>
                {goal.status === 'active' ? 'Active' : 'Completed'}
              </span>
              <span className={styles.endDate}>{formatEndDate(goal.endDate)}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className={styles.container}>
      {hasActiveGoal(daily) && renderGoalCard('Daily', daily!)}
      {hasActiveGoal(weekly) && renderGoalCard('Weekly', weekly!)}
    </div>
  );
}