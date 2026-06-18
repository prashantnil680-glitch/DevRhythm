'use client';

import { useEffect, useState } from 'react';
import {
  FiCheckCircle,
  FiTrendingUp,
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiAlertTriangle,
  FiCheck,
  FiAlertCircle,
} from 'react-icons/fi';
import Tooltip from '@/shared/components/Tooltip';
import styles from './HeroStats.module.css';

interface HeroStatsProps {
  stats: {
    totalActiveSchedules: number;
    totalRevisionsCompleted: number;
    totalRevisionsScheduled: number;
    totalPendingRevisionEntries: number;
    upcomingSchedulesCount: number;
    completionRate: number;
  };
}

const useCountUp = (target: number, duration = 600) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setCount(0);
      return;
    }
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
};

export default function HeroStats({ stats }: HeroStatsProps) {
  const completed = useCountUp(stats.totalRevisionsCompleted);
  const scheduled = useCountUp(stats.totalRevisionsScheduled);
  const pending = useCountUp(stats.totalPendingRevisionEntries);
  const rate = useCountUp(stats.completionRate);
  const active = useCountUp(stats.totalActiveSchedules);
  const upcoming = useCountUp(stats.upcomingSchedulesCount);

  // Determine insight type and icon
  let insightIcon = <FiCheck />;
  let insightLabel = 'All caught up';
  let insightType: 'success' | 'warning' | 'danger' = 'success';

  if (pending > 30) {
    insightIcon = <FiAlertCircle />;
    insightLabel = `${pending} pending – focus on revisions`;
    insightType = 'danger';
  } else if (pending > 10) {
    insightIcon = <FiAlertTriangle />;
    insightLabel = `${pending} pending – review soon`;
    insightType = 'warning';
  } else if (pending > 0) {
    insightIcon = <FiAlertTriangle />;
    insightLabel = `${pending} pending – manageable`;
    insightType = 'warning';
  } else {
    insightIcon = <FiCheck />;
    insightLabel = 'All caught up';
    insightType = 'success';
  }

  return (
    <div className={styles.container}>
      <div className={styles.statsRow}>
        {/* Completion Rate */}
        <span className={styles.stat}>
          <FiCheckCircle className={styles.icon} />
          <strong>{rate}%</strong>
          <Tooltip content="Percentage of scheduled revisions you've completed">
            <span className={styles.statLabel}>completed</span>
          </Tooltip>
        </span>

        <span className={styles.separator}>•</span>

        {/* Completed Revisions */}
        <span className={styles.stat}>
          <FiBookOpen className={styles.icon} />
          <strong>{completed.toLocaleString()}</strong>
          <Tooltip content="Total revisions you've completed out of all scheduled revisions">
            <span className={styles.statLabel}>of {scheduled.toLocaleString()} revised</span>
          </Tooltip>
        </span>

        <span className={styles.separator}>•</span>

        {/* Pending Revisions */}
        <span className={`${styles.stat} ${pending > 0 ? styles.pending : ''}`}>
          <FiTrendingUp className={styles.icon} />
          <strong>{pending.toLocaleString()}</strong>
          <Tooltip content="Revisions that are due or overdue and still need to be completed">
            <span className={styles.statLabel}>pending</span>
          </Tooltip>
        </span>

        <span className={styles.separator}>•</span>

        {/* Active Schedules */}
        <span className={styles.stat}>
          <FiCalendar className={styles.icon} />
          <strong>{active.toLocaleString()}</strong>
          <Tooltip content="Number of active revision schedules (questions you're actively revising)">
            <span className={styles.statLabel}>active</span>
          </Tooltip>
        </span>

        <span className={styles.separator}>•</span>

        {/* Upcoming Schedules */}
        <span className={styles.stat}>
          <FiClock className={styles.icon} />
          <strong>{upcoming.toLocaleString()}</strong>
          <Tooltip content="Schedules with upcoming revisions due in the next 7 days">
            <span className={styles.statLabel}>upcoming</span>
          </Tooltip>
        </span>

        {/* Insight Chip – sits at the end */}
        <span className={`${styles.insightChip} ${styles[insightType]}`}>
          {insightIcon}
          <span>{insightLabel}</span>
        </span>
      </div>
    </div>
  );
}