'use client';
import { useEffect, useState } from 'react';
import {
  FiActivity,
  FiCheckCircle,
  FiTrendingUp,
  FiLayers,
  FiBookOpen,
  FiZap,
  FiCalendar,
  FiStar,
  FiAward,
  FiSmile,
  FiThumbsUp,
  FiTarget,
  FiFlag,
} from 'react-icons/fi';
import ProgressBar from '@/shared/components/ProgressBar';
import CircularProgress from '@/shared/components/CircularProgress';
import ConfidenceStars from '@/shared/components/ConfidenceStars';
import styles from './HeroStats.module.css';

interface HeroStatsProps {
  stats: {
    totalActiveSchedules: number;
    totalRevisionsCompleted: number;
    totalRevisionsScheduled: number;
    totalRevisionsPending: number;
    completionRate: number;
  };
}

const useCountUp = (target: number, duration = 800) => {
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

// Helper: get color for a percentage (0-100)
const getColorForPercentage = (percent: number): string => {
  if (percent >= 70) return '#40c463'; // green
  if (percent >= 40) return '#e0a83c'; // orange
  return '#c44c4c'; // red
};

// Helper: get gradient CSS string for completed number based on ratio (0-1)
const getCompletedGradient = (ratio: number): string => {
  if (ratio >= 0.7) return 'linear-gradient(135deg, var(--text-primary), #40c463)';
  if (ratio >= 0.4) return 'linear-gradient(135deg, var(--text-primary), #e0a83c)';
  return 'linear-gradient(135deg, var(--text-primary), #c44c4c)';
};

export default function HeroStats({ stats }: HeroStatsProps) {
  const activeCount = useCountUp(stats.totalActiveSchedules);
  const pendingCount = useCountUp(stats.totalRevisionsPending);
  const completedCount = useCountUp(stats.totalRevisionsCompleted);
  const scheduledCount = useCountUp(stats.totalRevisionsScheduled);
  const completionRate = useCountUp(stats.completionRate);

  // Dynamic colors
  const ringColor = getColorForPercentage(stats.completionRate);
  const completedRatio = stats.totalRevisionsCompleted / stats.totalRevisionsScheduled;
  const completedGradient = getCompletedGradient(completedRatio);

  const starRating = Math.max(1, Math.min(5, Math.floor(stats.completionRate / 20) + 1));

  const getMotivationalMessage = () => {
    const rate = stats.completionRate;
    if (rate >= 80) return "Outstanding! You're on fire!";
    if (rate >= 60) return 'Great progress! Keep pushing!';
    if (rate >= 40) return 'Good momentum! Stay consistent!';
    if (rate >= 20) return "Making progress! You've got this!";
    return "Every step counts! Let's start!";
  };

  const getStatusIcon = () => {
    const rate = stats.completionRate;
    if (rate >= 80) return <FiFlag size={14} />;
    if (rate >= 60) return <FiAward size={14} />;
    if (rate >= 40) return <FiThumbsUp size={14} />;
    if (rate >= 20) return <FiSmile size={14} />;
    return <FiTarget size={14} />;
  };

  const upcomingMessage = 'Check Upcoming Revisions section below – you got all upcoming revision';

  return (
    <div className={styles.unifiedCard}>
      <div className={styles.cardGlow} />

      {/* Top row: Completion Rate | Completed Revisions */}
      <div className={`${styles.row} ${styles.topRow}`}>
        {/* Completion Rate */}
        <div className={styles.cell}>
          <div className={styles.cardHeader}>
            <div className={styles.headerLeft}>
              <FiCheckCircle className={styles.cardIcon} />
            </div>
            <span className={styles.cardBadge}>Progress</span>
          </div>
          <div className={styles.circularWrapper}>
            <CircularProgress
              progress={completionRate}
              size={120}
              strokeWidth={8}
              progressColor={ringColor}
              backgroundColor="var(--border)"
              animate={true}
              hoverAnimate={true}
            >
              <div className={styles.circularContent}>
                <span className={styles.circularValue}>{completionRate}%</span>
                <span className={styles.circularLabel}>done</span>
              </div>
            </CircularProgress>
          </div>
          <div className={styles.cardInfo}>
            <div className={styles.statusChip}>
              {getStatusIcon()}
              <span>
                {stats.completionRate}% of {scheduledCount}
              </span>
            </div>
          </div>
          <div className={styles.cardFooter}>
            <FiZap className={styles.footerIcon} />
            <span>Overall completion</span>
          </div>
        </div>

        {/* Completed Revisions */}
        <div className={styles.cell}>
          <div className={styles.cardHeader}>
            <div className={styles.headerLeft}>
              <FiBookOpen className={styles.cardIcon} />
            </div>
            <span className={styles.cardBadge}>Achievement</span>
          </div>
          <div className={styles.cardValue}>
            <span
              className={styles.valueNumber}
              style={{
                background: completedGradient,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
              }}
            >
              {completedCount}
            </span>
            <span className={styles.valueLabel}>completed</span>
            <span className={styles.valueSubtext}>of {scheduledCount}</span>
          </div>
          <div className={styles.starsContainer}>
            <ConfidenceStars level={starRating} size={16} showEmpty={true} />
            <div className={styles.starsMessage}>{getMotivationalMessage()}</div>
          </div>
          <div className={styles.cardFooter}>
            <FiStar className={styles.footerIcon} />
            <span>Keep it up!</span>
          </div>
        </div>
      </div>

      {/* Bottom row: Active Schedules | Pending Revisions */}
      <div className={styles.row}>
        {/* Active Schedules */}
        <div className={styles.cell}>
          <div className={styles.cardHeader}>
            <div className={styles.headerLeft}>
              <FiLayers className={styles.cardIcon} />
            </div>
            <span className={styles.cardBadge}>Current</span>
          </div>
          <div className={styles.cardValue}>
            <span className={styles.valueNumber}>{activeCount}</span>
            <span className={styles.valueLabel}>active revision schedules</span>
          </div>
          <div className={styles.cardFooter}>
            <FiCalendar className={styles.footerIcon} />
            <span>{upcomingMessage}</span>
          </div>
        </div>

        {/* Pending Revisions */}
        <div className={styles.cell}>
          <div className={styles.cardHeader}>
            <div className={styles.headerLeft}>
              <FiTrendingUp className={styles.cardIcon} />
            </div>
            <span className={`${styles.cardBadge} ${styles.glowBadge}`}>To Do</span>
          </div>
          <div className={styles.cardValue}>
            <span className={`${styles.valueNumber} ${styles.pendingValue}`}>{pendingCount}</span>
            <span className={styles.valueLabel}>revisions pending</span>
          </div>
          <div className={styles.cardFooter}>
            <FiCalendar className={styles.footerIcon} />
            <span>{upcomingMessage}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
