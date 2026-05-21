'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, addDays, subDays } from 'date-fns';
import { FiStar, FiArrowLeft, FiArrowRight, FiCalendar, FiEye } from 'react-icons/fi';
import { useTodayActivity, useDayActivity } from '@/features/activity/hooks/useActivityData';
import Tooltip from '@/shared/components/Tooltip';
import styles from './HeroSummary.module.css';

interface HeroSummaryProps {
  date?: string; // YYYY-MM-DD – if provided, fetch for that date; otherwise today
}

export default function HeroSummary({ date }: HeroSummaryProps) {
  const router = useRouter();
  const todayQuery = useTodayActivity();
  const dayQuery = useDayActivity(date || '');
  const { data, isLoading, error } = date ? dayQuery : todayQuery;

  // console.log("================ Data : ", data);
  const isDayPage = !!date;

  // Compute previous and next day dates (only on day page and when data loaded)
  let prevDate = null;
  let nextDate = null;
  if (isDayPage && data?.date) {
    const currentDate = new Date(data.date);
    prevDate = subDays(currentDate, 1);
    nextDate = addDays(currentDate, 1);
  }

  const handlePrevDay = () => {
    if (prevDate) {
      const prevDateStr = format(prevDate, 'yyyy-MM-dd');
      router.push(`/activity/${prevDateStr}`);
    }
  };

  const handleNextDay = () => {
    if (nextDate) {
      const nextDateStr = format(nextDate, 'yyyy-MM-dd');
      router.push(`/activity/${nextDateStr}`);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.skeletonDate} />
          <div className={styles.skeletonAction} />
        </div>
        <div className={styles.statsGrid}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className={styles.statItem}>
              <div className={styles.skeletonValue} />
              <div className={styles.skeletonLabel} />
            </div>
          ))}
        </div>
        <div className={styles.goalRow}>
          <div className={styles.skeletonProgress} />
          <div className={styles.skeletonProgress} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>{date ? `Activity for ${date}` : "Today's Activity"}</h3>
          {isDayPage ? (
            <div className={styles.dayNavButtons}>
              <button className={styles.navButton} onClick={handlePrevDay} disabled={!prevDate}>
                <FiArrowLeft size={14} /> Prev
              </button>
              <button className={styles.navButton} onClick={handleNextDay} disabled={!nextDate}>
                Next <FiArrowRight size={14} />
              </button>
            </div>
          ) : (
            <Link href="/progress" className={styles.viewAllLink}>
              View All →
            </Link>
          )}
        </div>
        <div className={styles.errorState}>
          <Tooltip content={error?.message || 'Unable to load activity data'}>
            <span>Could not load activity{date ? ` for ${date}` : ' today'}</span>
          </Tooltip>
        </div>
      </div>
    );
  }

  const formattedDate = format(new Date(data.date), 'EEEE, MMMM d, yyyy');

  const formatStudyTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const isHighStudyTime = data.studyTimeMinutes >= 120;
  const isHighProblems = data.problemsSolved >= 5;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <FiCalendar className={styles.calendarIcon} />
          <Link href={`/activity/${data.date}`} className={styles.titleLink}>
            <h2 className={styles.title}>{formattedDate}</h2>
          </Link>
        </div>
        {isDayPage ? (
          <div className={styles.dayNavButtons}>
            <button className={styles.navButton} onClick={handlePrevDay} disabled={!prevDate}>
              <FiArrowLeft size={14} /> Prev
            </button>
            <button className={styles.navButton} onClick={handleNextDay} disabled={!nextDate}>
              Next <FiArrowRight size={14} />
            </button>
          </div>
        ) : (
          <Link href={`/activity/${data.date}`} className={styles.viewDayLink}>
            <FiEye size={14} /> Full Day View <FiArrowRight size={14} />
          </Link>
        )}
      </div>

      <div className={styles.statsGrid}>
        {/* Problems Solved */}
        <div className={styles.statItem}>
          <div className={styles.statValueWrapper}>
            <span className={styles.statValue}>{data.problemsSolved}</span>
            {isHighProblems && (
              <Tooltip content="Amazing! 5+ problems solved today! 🎉">
                <span className={styles.starBadge}>
                  <FiStar size={16} />
                </span>
              </Tooltip>
            )}
          </div>
          <span className={styles.statLabel}>Problems Solved</span>
        </div>

        {/* Revisions Completed */}
        <div className={styles.statItem}>
          <span className={styles.statValue}>{data.revisionsCompleted}</span>
          <span className={styles.statLabel}>Revisions</span>
        </div>

        {/* Study Time */}
        <div className={styles.statItem}>
          <div className={styles.statValueWrapper}>
            <span className={styles.statValue}>{formatStudyTime(data.studyTimeMinutes)}</span>
            {isHighStudyTime && (
              <Tooltip content="Great focus! 2+ hours of study today! 💪">
                <span className={styles.starBadge}>
                  <FiStar size={16} />
                </span>
              </Tooltip>
            )}
          </div>
          <span className={styles.statLabel}>Today Study Time</span>
        </div>

        {/* Goal Completion */}
        <div className={styles.statItem}>
          <div className={styles.goalProgressWrapper}>
            <span className={styles.statValue}>{data.goalCompletion}%</span>
            <span className={styles.statLabel}>Daily Goal</span>
          </div>
          <div className={styles.progressContainer}>
            <div
              className={styles.progressFill}
              style={{ width: `${data.goalCompletion}%` }}
            />
            <span className={styles.progressCount}>
              {data.problemsSolved}/{data.goalTarget}
            </span>
          </div>
        </div>
      </div>

      {data.goalAchieved && (
        <div className={styles.goalAchievedBadge}>
          <span className={styles.badge}>🎯 Goal achieved</span>
        </div>
      )}
    </div>
  );
}