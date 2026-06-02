'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, addDays, subDays } from 'date-fns';
import { FiArrowLeft, FiArrowRight, FiCalendar, FiEye, FiStar } from 'react-icons/fi';
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

  const isDayPage = !!date;

  let prevDate = null;
  let nextDate = null;
  if (isDayPage && data?.date) {
    const currentDate = new Date(data.date);
    prevDate = subDays(currentDate, 1);
    nextDate = addDays(currentDate, 1);
  }

  const handlePrevDay = () => {
    if (prevDate) {
      router.push(`/activity/${format(prevDate, 'yyyy-MM-dd')}`);
    }
  };

  const handleNextDay = () => {
    if (nextDate) {
      router.push(`/activity/${format(nextDate, 'yyyy-MM-dd')}`);
    }
  };

  const formatStudyTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <div className={styles.skeletonDate} />
          <div className={styles.skeletonActions} />
        </div>
        <div className={styles.statsRow}>
          <div className={styles.skeletonStat} />
          <div className={styles.skeletonStat} />
          <div className={styles.skeletonStat} />
          <div className={styles.skeletonStat} />
        </div>
        <div className={styles.skeletonProgress} />
      </div>
    );
  }

  if (error || !data) {
    const errorMessage = error?.message || 'Unable to load activity data';
    return (
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h3 className={styles.title}>{date ? `Activity for ${date}` : "Today's Activity"}</h3>
        </div>
        <div className={styles.errorState}>
          <Tooltip content={errorMessage}>
            <span>Could not load activity{date ? ` for ${date}` : ' today'}</span>
          </Tooltip>
        </div>
      </div>
    );
  }

  const formattedDate = format(new Date(data.date), 'EEEE, MMMM d, yyyy');
  const studyTime = formatStudyTime(data.studyTimeMinutes);
  const goalPercent = data.goalCompletion || 0;

  // Progress highlighting thresholds
  const isHighProblems = data.problemsSolved >= 5;
  const isHighStudyTime = data.studyTimeMinutes >= 120;

  return (
    <div className={styles.container}>
      {/* Header row */}
      <div className={styles.headerRow}>
        <div className={styles.dateGroup}>
          <FiCalendar className={styles.calendarIcon} />
          {isDayPage ? (
            <span className={styles.title}>{formattedDate}</span>
          ) : (
            <Link href={`/activity/${data.date}`} className={styles.titleLink}>
              <span className={styles.title}>{formattedDate}</span>
            </Link>
          )}
        </div>
        <div className={styles.actions}>
          {isDayPage ? (
            <div className={styles.dayNavButtons}>
              <button onClick={handlePrevDay} disabled={!prevDate} className={styles.navButton}>
                <FiArrowLeft size={14} /> Prev
              </button>
              <button onClick={handleNextDay} disabled={!nextDate} className={styles.navButton}>
                Next <FiArrowRight size={14} />
              </button>
            </div>
          ) : (
            <Link href={`/activity/${data.date}`} className={styles.viewDayLink}>
              <FiEye size={14} /> Full Day View <FiArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Stats row (inline with separators) */}
      <div className={styles.statsRow}>
        <span className={styles.stat}>
          <strong>{data.problemsSolved}</strong> problems solved
          {isHighProblems && (
            <Tooltip content="Great progress! 5+ problems solved today! 🎉">
              <FiStar className={styles.starIcon} />
            </Tooltip>
          )}
        </span>
        <span className={styles.separator}>•</span>
        <span className={styles.stat}>
          <strong>{data.revisionsCompleted}</strong> revisions completed
        </span>
        <span className={styles.separator}>•</span>
        <span className={styles.stat}>
          <strong>{studyTime}</strong> study time
          {isHighStudyTime && (
            <Tooltip content="Amazing focus! 2+ hours of study today! 💪">
              <FiStar className={styles.starIcon} />
            </Tooltip>
          )}
        </span>
        {/* Goal percent is commented out as requested */}
      </div>

      {/* Progress bar (commented out – uncomment if needed) */}
      {/* <div className={styles.progressWrapper}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${goalPercent}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {data.problemsSolved}/{data.goalTarget} problems completed today
        </span>
      </div> */}
    </div>
  );
}