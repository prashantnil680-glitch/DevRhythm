'use client';

import { format } from 'date-fns';
import { FiCalendar, FiTarget, FiExternalLink } from 'react-icons/fi';
import Link from 'next/link';
import Card from '@/shared/components/Card';
import Badge from '@/shared/components/Badge';
import Tooltip from '@/shared/components/Tooltip';
import ProgressBar from '@/shared/components/ProgressBar';
import Button from '@/shared/components/Button';
import { useDailyProblem } from '@/features/goal';
import type { DailyProblemResponse } from '@/features/goal/hooks/useDailyProblem';
import { slugify } from '@/shared/lib/stringUtils';
import styles from './DailyProblemCard.module.css';

interface DailyProblemCardProps {
  initialData?: DailyProblemResponse | null;
}

export default function DailyProblemCard({ initialData }: DailyProblemCardProps) {
  const { data, isLoading, error } = useDailyProblem(initialData || undefined);

  if (isLoading) {
    return (
      <Card className={styles.skeletonCard} noHover>
        <div className={styles.skeletonLeft}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonTags} />
        </div>
        <div className={styles.skeletonRight}>
          <div className={styles.skeletonGoal} />
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={styles.errorCard} noHover>
        <p>Unable to load today&apos;s problem. Please try again later.</p>
      </Card>
    );
  }

  const { dailyProblem, todayGoal } = data;
  const formattedDate = format(new Date(dailyProblem.date), 'MMMM d, yyyy');
  const goalPercentage = todayGoal?.completionPercentage;
  const internalLink = `/questions/${dailyProblem.titleSlug}`;

  return (
    <Card className={styles.container} noHover>
      <div className={styles.leftColumn}>
        <div className={styles.problemHeader}>
          <div className={styles.dateBadge}>
            <FiCalendar size={14} />
            <span>{formattedDate}</span>
          </div>
          <Badge
            variant={dailyProblem.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'}
            size="sm"
          >
            {dailyProblem.difficulty}
          </Badge>
          <div className={styles.podBadge}>
            <span>POD</span>
          </div>
        </div>
        <h3 className={styles.problemTitle}>
          <Link href={internalLink} className={styles.titleLink}>
            {dailyProblem.title}
          </Link>
        </h3>
        <div className={styles.tags}>
          {dailyProblem.tags.slice(0, 4).map((tag) => (
            <Link
              key={tag}
              href={`/patterns/${slugify(tag)}`}
              className={styles.tagLink}
            >
              #{tag}
            </Link>
          ))}
          {dailyProblem.tags.length > 4 && (
            <Tooltip content={dailyProblem.tags.slice(4).join(', ')}>
              <span className={styles.tag}>+{dailyProblem.tags.length - 4}</span>
            </Tooltip>
          )}
        </div>
        <div className={styles.externalLinkWrapper}>
          <Button
            variant="outline"
            size="sm"
            className={styles.leetcodeButton}
            onClick={() => window.open(dailyProblem.link, '_blank', 'noopener noreferrer')}
          >
            Solve on LeetCode <FiExternalLink size={14} />
          </Button>
        </div>
      </div>

      {todayGoal?.completedCount >= 0 && (
        <div className={styles.rightColumn}>
          <div className={styles.goalCard}>
            <div className={styles.goalHeader}>
              <FiTarget className={styles.icon} />
              <span className={styles.goalLabel}>Today&apos;s goal</span>
            </div>
            <div className={styles.goalProgress}>
              <ProgressBar value={goalPercentage} max={100} size="sm" showValue rounded />
              <span className={styles.goalCount}>
                {todayGoal?.completedCount} / {todayGoal?.targetCount} completed
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}