'use client';

import { memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, differenceInHours, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { FiZap } from 'react-icons/fi';
import Card from '@/shared/components/Card';
import Button from '@/shared/components/Button';
import Badge from '@/shared/components/Badge';
import { ROUTES } from '@/shared/config';
import type { RevisionItem } from '@/features/dashboard';
import styles from './PendingRevisions.module.css';

interface PendingRevisionsProps {
  revisions: RevisionItem[];
  type?: 'pending' | 'upcoming';
  limit?: number;
  isLoading?: boolean;
  onRevisionComplete?: () => void;
}

function PendingRevisions({
  revisions,
  type = 'pending',
  limit,
  isLoading,
  onRevisionComplete,
}: PendingRevisionsProps) {
  const router = useRouter();

  const handleReviseClick = (questionSlug: string) => {
    router.push(`/questions/${questionSlug}`);
  };

  const title = type === 'pending' ? 'Pending Revisions Today' : 'Upcoming Revisions';
  const viewAllLink = ROUTES.REVISIONS.ROOT;
  const displayLimit = limit ?? (type === 'pending' ? 2 : 5);

  // Helper: get hours left today for pending revision
  const getHoursLeftToday = (scheduledDate: string): string | null => {
    const now = new Date();
    const endOfToday = endOfDay(now);
    const scheduled = new Date(scheduledDate);
    // Only calculate if scheduled is today
    if (startOfDay(scheduled).getTime() !== startOfDay(now).getTime()) return null;
    const hoursLeft = differenceInHours(endOfToday, now);
    if (hoursLeft <= 0) return 'Expired';
    return `${hoursLeft}h left`;
  };

  // Helper: get days until upcoming revision using local calendar dates
  const getDaysRemaining = (scheduledDate: string): string => {
    const scheduled = new Date(scheduledDate);
    const now = new Date();
    // Use local midnight for comparison (ignore time-of-day)
    const localScheduled = new Date(scheduled.getFullYear(), scheduled.getMonth(), scheduled.getDate());
    const localNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((localScheduled.getTime() - localNow.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `in ${diffDays} days`;
  };

  if (isLoading) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <Link href={viewAllLink} className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        <div className={styles.skeletonList}>
          <div className={styles.skeletonItem} />
          <div className={styles.skeletonItem} />
        </div>
      </Card>
    );
  }

  if (!revisions || revisions.length === 0) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <Link href={viewAllLink} className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        <div className={styles.emptyState}>No {type === 'pending' ? 'pending' : 'upcoming'} revisions.</div>
      </Card>
    );
  }

  const displayRevisions = revisions.slice(0, displayLimit);

  return (
    <Card className={styles.container} noHover>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <Link href={viewAllLink} className={styles.viewAllLink}>
          View All →
        </Link>
      </div>
      <div className={styles.revisionsList}>
        {displayRevisions.map((revision, index) => {
          const scheduledDate = format(new Date(revision.scheduledDate), 'MMM d');
          const isOverdue = type === 'pending' ? revision.overdue : false;
          const difficulty = revision.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined;
          const questionSlug = revision.platformQuestionId || revision.questionId;
          const questionUrl = `/questions/${questionSlug}`;

          // Compute time badge
          let timeBadge = null;
          if (type === 'pending') {
            const hoursLeft = getHoursLeftToday(revision.scheduledDate);
            if (hoursLeft && hoursLeft !== 'Expired') {
              timeBadge = <Badge variant="info" size="sm">{hoursLeft}</Badge>;
            } else if (hoursLeft === 'Expired') {
              timeBadge = <Badge variant="warning" size="sm">Expired</Badge>;
            }
          } else {
            const daysRemaining = getDaysRemaining(revision.scheduledDate);
            if (daysRemaining !== 'Overdue') {
              timeBadge = <Badge variant="info" size="sm">{daysRemaining}</Badge>;
            } else {
              timeBadge = <Badge variant="warning" size="sm">Overdue</Badge>;
            }
          }

          return (
            <div key={revision._id || `revision-${index}`} className={styles.revisionItem}>
              <div className={styles.revisionContent}>
                <div className={styles.revisionHeader}>
                  {type === 'pending' && <FiZap className={styles.lightningIcon} />}
                  <Link href={questionUrl} className={styles.questionLink}>
                    <span className={styles.questionTitle}>{revision.title}</span>
                  </Link>
                  {difficulty && (
                    <Badge variant={difficulty} size="sm">
                      {revision.difficulty}
                    </Badge>
                  )}
                  {timeBadge}
                  {type === 'pending' && isOverdue && (
                    <Badge variant="warning" size="sm">
                      Overdue
                    </Badge>
                  )}
                </div>
                <div className={styles.revisionMeta}>
                  <span className={styles.platform}>{revision.platform}</span>
                  <span className={styles.scheduledDate}>· {scheduledDate}</span>
                </div>
              </div>
              {type === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReviseClick(questionSlug)}
                  className={styles.reviseButton}
                >
                  Revise now
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default memo(PendingRevisions);