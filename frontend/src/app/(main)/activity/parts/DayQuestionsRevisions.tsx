'use client';

import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import Card from '@/shared/components/Card';
import Badge from '@/shared/components/Badge';
import PlatformIcon from '@/shared/components/PlatformIcon';
import Tooltip from '@/shared/components/Tooltip';
import { useTodayActivity, useDayActivity } from '@/features/activity/hooks/useActivityData';
import styles from './DayQuestionsRevisions.module.css';

interface DayQuestionsRevisionsProps {
  date?: string; // YYYY-MM-DD – if provided, fetch for that date; otherwise today
}

export default function DayQuestionsRevisions({ date }: DayQuestionsRevisionsProps) {
  const todayQuery = useTodayActivity();
  const dayQuery = useDayActivity(date || '');
  const { data, isLoading, error } = date ? dayQuery : todayQuery;

  if (isLoading) {
    return (
      <Card className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Day&apos;s Questions &amp; Revisions</h3>
          <div className={styles.skeletonViewAll} />
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Solved today</div>
          <div className={styles.skeletonList}>
            {[1, 2].map((i) => (
              <div key={i} className={styles.skeletonItem} />
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Revisions done</div>
          <div className={styles.skeletonList}>
            {[1].map((i) => (
              <div key={i} className={styles.skeletonItem} />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Day&apos;s Questions &amp; Revisions</h3>
          <Link href="/activity/today" className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        <div className={styles.errorState}>
          <Tooltip content={error?.message || 'Unable to load data'}>
            <span>Could not load activity{date ? ` for ${date}` : ' today'}</span>
          </Tooltip>
        </div>
      </Card>
    );
  }

  const formatTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const formatTimeSpent = (minutes: number) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getDateFromTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'yyyy-MM-dd');
    } catch {
      return '';
    }
  };

  // Flatten solved & mastered questions
  const solvedGroups = data.question_solved || {};
  const masteredGroups = data.question_mastered || {};
  const solvedItems = [
    ...Object.values(solvedGroups).flatMap((group: any) =>
      group.solves_timeline.map((entry: any) => ({
        ...entry,
        question: group.question,
        type: 'solve',
      }))
    ),
    ...Object.values(masteredGroups).flatMap((group: any) =>
      group.solves_timeline.map((entry: any) => ({
        ...entry,
        question: group.question,
        type: 'mastered',
      }))
    ),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Flatten revisions (on_time + overdue)
  const revisionData = data.revision_completed || {};
  const onTimeGroups = revisionData.on_time || {};
  const overdueGroups = revisionData.overdue || {};
  const revisionItems = [
    ...Object.values(onTimeGroups).flatMap((group: any) =>
      group.revision_timeline.map((entry: any) => ({
        ...entry,
        question: group.question,
        overdueCompleted: false,
      }))
    ),
    ...Object.values(overdueGroups).flatMap((group: any) =>
      group.revision_timeline.map((entry: any) => ({
        ...entry,
        question: group.question,
        overdueCompleted: true,
      }))
    ),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <Card className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Day&apos;s Questions &amp; Revisions</h3>
        <Link href="/activity/today" className={styles.viewAllLink}>
          View All →
        </Link>
      </div>

      {/* Solved today section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Solved today</div>
        {solvedItems.length > 0 ? (
          <div className={styles.list}>
            {solvedItems.map((item, idx) => (
              <div key={`${item._id}-${idx}`} className={styles.listItem}>
                <Link
                  href={`/questions/${item.question.platformQuestionId}`}
                  className={styles.questionLink}
                >
                  <span className={styles.questionTitle}>{item.question.title}</span>
                </Link>
                <div className={styles.metaRow}>
                  <Badge variant={item.question.difficulty.toLowerCase()} size="sm">
                    {item.question.difficulty}
                  </Badge>
                  <PlatformIcon platform={item.question.platform} size="sm" />
                  {item.timeSpent > 0 && (
                    <span className={styles.timeSpent}>{formatTimeSpent(item.timeSpent)}</span>
                  )}
                  {item.isFirstSolve && (
                    <span className={styles.firstSolveBadge}>first solve</span>
                  )}
                  <Link
                    href={`/activity/${getDateFromTimestamp(item.timestamp)}`}
                    className={styles.dateLink}
                  >
                    {formatTimeAgo(item.timestamp)}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyMessage}>No problems solved yet today.</div>
        )}
      </div>

      {/* Revisions done section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Revisions done</div>
        {revisionItems.length > 0 ? (
          <div className={styles.list}>
            {revisionItems.map((item, idx) => (
              <div key={`${item._id}-${idx}`} className={styles.listItem}>
                <Link
                  href={`/questions/${item.question.platformQuestionId}`}
                  className={styles.questionLink}
                >
                  <span className={styles.questionTitle}>{item.question.title}</span>
                </Link>
                <div className={styles.metaRow}>
                  <Badge variant={item.question.difficulty.toLowerCase()} size="sm">
                    {item.question.difficulty}
                  </Badge>
                  <PlatformIcon platform={item.question.platform} size="sm" />
                  {item.overdueCompleted && (
                    <Badge variant="warning" size="sm" className={styles.overdueBadge}>
                      Overdue
                    </Badge>
                  )}
                  <Link
                    href={`/activity/${getDateFromTimestamp(item.timestamp)}`}
                    className={styles.dateLink}
                  >
                    {formatTimeAgo(item.timestamp)}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyMessage}>No revisions completed today.</div>
        )}
      </div>
    </Card>
  );
}