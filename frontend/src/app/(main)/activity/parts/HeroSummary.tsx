'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, addDays, subDays } from 'date-fns';
import {
  FiArrowLeft,
  FiArrowRight,
  FiCalendar,
  FiEye,
  FiStar,
  FiCheckCircle,
  FiRefreshCw,
  FiClock,
  FiTrendingUp,
  FiActivity,
  FiCheck,
  FiXCircle,
} from 'react-icons/fi';
import { useTodayActivity, useDayActivity } from '@/features/activity/hooks/useActivityData';
import Tooltip from '@/shared/components/Tooltip';
import styles from './HeroSummary.module.css';

interface HeroSummaryProps {
  date?: string;
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
    if (prevDate) router.push(`/activity/${format(prevDate, 'yyyy-MM-dd')}`);
  };
  const handleNextDay = () => {
    if (nextDate) router.push(`/activity/${format(nextDate, 'yyyy-MM-dd')}`);
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
        <div className={styles.statsGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonStat} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h3 className={styles.title}>{date ? `Activity for ${date}` : "Today's Activity"}</h3>
        </div>
        <div className={styles.errorState}>
          <Tooltip content={error?.message || 'Unable to load activity'}>
            <span>Could not load activity{date ? ` for ${date}` : ' today'}</span>
          </Tooltip>
        </div>
      </div>
    );
  }

  const formattedDate = format(new Date(data.date), 'EEEE, MMMM d, yyyy');
  const studyTime = formatStudyTime(data.studyTimeMinutes);

  const isHighProblems = data.problemsSolved >= 5;
  const isHighStudyTime = data.studyTimeMinutes >= 120;

  // Insight chip logic
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = isDayPage && data.date === todayStr;

  let insightIcon = <FiTrendingUp />;
  let insightLabel = 'Keep going!';
  let insightType: 'success' | 'warning' | 'danger' = 'success';

  if (data.problemsSolved >= 5) {
    insightIcon = <FiStar />;
    insightLabel = '🌟 Great progress!';
    insightType = 'success';
  } else if (data.problemsSolved >= 3) {
    insightIcon = <FiTrendingUp />;
    insightLabel = 'Good start!';
    insightType = 'warning';
  } else if (data.problemsSolved === 0 && data.revisionsCompleted === 0) {
    if (isToday) {
      insightIcon = <FiClock />;
      insightLabel = '📝 Start your day with a problem!';
      insightType = 'warning';
    } else {
      insightIcon = <FiClock />;
      insightLabel = 'No activity on this day';
      insightType = 'danger';
    }
  } else {
    if (!isToday) {
      insightIcon = <FiCheckCircle />;
      insightLabel = `✓ ${data.problemsSolved} problem${data.problemsSolved > 1 ? 's' : ''} solved`;
      insightType = 'success';
    } else {
      insightIcon = <FiTrendingUp />;
      insightLabel = 'Keep going!';
      insightType = 'warning';
    }
  }

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

      {/* ===== TWO ROWS ===== */}
      {/* Row 1: Solved, Revisions, Study Time */}
      <div className={styles.row}>
        <div className={styles.statItem}>
          <FiCheckCircle className={styles.iconSolved} />
          <strong>{data.problemsSolved}</strong>
          <Tooltip content="Number of problems solved today">
            <span className={styles.statLabel}>Problem Solved</span>
          </Tooltip>
          {isHighProblems && (
            <Tooltip content="Great progress! 5+ problems solved today! 🎉">
              <FiStar className={styles.starIcon} />
            </Tooltip>
          )}
        </div>

        <div className={styles.statItem}>
          <FiRefreshCw className={styles.iconRevision} />
          <strong>{data.revisionsCompleted}</strong>
          <Tooltip content="Revisions completed today">
            <span className={styles.statLabel}>Revisions Complete</span>
          </Tooltip>
        </div>

        <div className={styles.statItem}>
          <FiClock className={styles.iconTime} />
          <strong>{studyTime}</strong>
          <Tooltip content="Total study time today">
            <span className={styles.statLabel}>Study Time</span>
          </Tooltip>
          {isHighStudyTime && (
            <Tooltip content="Amazing focus! 2+ hours of study today! 💪">
              <FiStar className={styles.starIcon} />
            </Tooltip>
          )}
        </div>
      </div>

      {/* Row 2: Submissions, Passed, Failed, Insight Chip */}
      <div className={styles.row}>
        <div className={styles.statItem}>
          <FiActivity className={styles.iconSubmissions} />
          <strong>{data.submissions ?? 0}</strong>
          <Tooltip content="Total code submissions today">
            <span className={styles.statLabel}>Submissions</span>
          </Tooltip>
        </div>

        <div className={styles.statItem}>
          <FiCheck className={styles.iconPassed} />
          <strong className={styles.passedNumber}>{data.passedCount ?? 0}</strong>
          <Tooltip content="Test cases passed today">
            <span className={styles.statLabel}>Passed</span>
          </Tooltip>
        </div>

        <div className={styles.statItem}>
          <FiXCircle className={styles.iconFailed} />
          <strong className={styles.failedNumber}>{data.failedCount ?? 0}</strong>
          <Tooltip content="Test cases failed today">
            <span className={styles.statLabel}>Failed</span>
          </Tooltip>
        </div>

        {/* Insight chip – appears on the second row, aligned to the right */}
        <div className={`${styles.insightChip} ${styles[insightType]}`}>
          {insightIcon}
          <span>{insightLabel}</span>
        </div>
      </div>
    </div>
  );
}