import { FiClock, FiZap, FiCheckCircle, FiStar, FiBarChart2, FiCalendar, FiTrendingUp } from 'react-icons/fi';
import ConfidenceStars from '@/shared/components/ConfidenceStars';
import DifficultyRing from '@/shared/components/DifficultyRing';
import { formatDateForDisplay, formatRelativeTime } from '@/shared/lib/dateUtils';
import type { PatternMastery } from '@/shared/types';
import styles from './MetricsCard.module.css';

interface MetricsCardProps {
  pattern: PatternMastery;
}

// Helper: convert minutes to "Xh Ym" or "Xh" or "Ym"
const formatMinutes = (minutes: number): string => {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export default function MetricsCard({ pattern }: MetricsCardProps) {
  const {
    solvedCount,
    masteredCount,
    masteryRate,
    confidenceLevel,
    totalTimeSpent,
    averageTimePerQuestion,
    successRate,
    lastPracticed,
    difficultyBreakdown,
    platformDistribution,
  } = pattern;

  const lastPracticedDate = lastPracticed ? formatDateForDisplay(new Date(lastPracticed)) : 'Never';
  const lastPracticedRelative = lastPracticed ? formatRelativeTime(new Date(lastPracticed)) : '';

  const platforms = Object.entries(platformDistribution || {})
    .filter(([_, count]) => count > 0)
    .map(([platform, count]) => ({ platform, count }));

  const maxSolved = Math.max(
    difficultyBreakdown.easy.solved,
    difficultyBreakdown.medium.solved,
    difficultyBreakdown.hard.solved
  );
  
  const formattedTotalTime = formatMinutes(Math.round(totalTimeSpent));
  const formattedAvgTime = formatMinutes(Math.round(averageTimePerQuestion));

  return (
    <div className={styles.card}>
      {/* 2‑column grid for basic metrics */}
      <div className={styles.grid}>
        <div className={styles.metricItem}>
          <FiCheckCircle className={styles.icon} />
          <div className={styles.metricContent}>
            <span className={styles.label}>questions solved</span>
            <span className={styles.value}>{solvedCount}</span>
          </div>
        </div>
        <div className={styles.metricItem}>
          <FiStar className={styles.icon} />
          <div className={styles.metricContent}>
            <span className={styles.label}>mastered</span>
            <span className={styles.value}>{masteredCount}</span>
          </div>
        </div>
        <div className={styles.metricItem}>
          <FiZap className={styles.icon} />
          <div className={styles.metricContent}>
            <span className={styles.label}>mastery rate</span>
            <span className={styles.value}>{masteryRate.toFixed(1)}%</span>
          </div>
        </div>
        <div className={styles.metricItem}>
          <FiBarChart2 className={styles.icon} />
          <div className={styles.metricContent}>
            <span className={styles.label}>confidence</span>
            <ConfidenceStars level={confidenceLevel} size={16} />
          </div>
        </div>
        <div className={styles.metricItem}>
          <FiClock className={styles.icon} />
          <div className={styles.metricContent}>
            <span className={styles.label}>total time spent</span>
            <span className={styles.value}>{formattedTotalTime}</span>
          </div>
        </div>
        <div className={styles.metricItem}>
          <FiClock className={styles.icon} />
          <div className={styles.metricContent}>
            <span className={styles.label}>average time per question</span>
            <span className={styles.value}>{formattedAvgTime}</span>
          </div>
        </div>
        <div className={styles.metricItem}>
          <FiTrendingUp className={styles.icon} />
          <div className={styles.metricContent}>
            <span className={styles.label}>success rate</span>
            <span className={styles.value}>{successRate.toFixed(1)}%</span>
          </div>
        </div>
        <div className={styles.metricItem}>
          <FiCalendar className={styles.icon} />
          <div className={styles.metricContent}>
            <span className={styles.label}>last practiced</span>
            <span className={styles.value} title={lastPracticedDate}>
              {lastPracticedRelative || lastPracticedDate}
            </span>
          </div>
        </div>
      </div>

      {/* Difficulty breakdown – animated rings */}
      <div className={styles.section}>
        <h4 className={styles.subheader}>difficulty breakdown</h4>
        <div className={styles.ringsContainer}>
          <DifficultyRing
            solved={difficultyBreakdown.easy.solved}
            mastered={difficultyBreakdown.easy.mastered}
            difficulty="Easy"
            maxSolved={maxSolved}
          />
          <DifficultyRing
            solved={difficultyBreakdown.medium.solved}
            mastered={difficultyBreakdown.medium.mastered}
            difficulty="Medium"
            maxSolved={maxSolved}
          />
          <DifficultyRing
            solved={difficultyBreakdown.hard.solved}
            mastered={difficultyBreakdown.hard.mastered}
            difficulty="Hard"
            maxSolved={maxSolved}
          />
        </div>
      </div>

      {/* Platform distribution (commented out – uncomment if needed) */}
      {/* {platforms.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.subheader}>platform distribution</h4>
          <div className={styles.platformList}>
            {platforms.map(({ platform, count }) => (
              <div key={platform} className={styles.platformChip}>
                {platform} <span className={styles.platformCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )} */}
    </div>
  );
}