'use client';

import Link from 'next/link';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { ROUTES } from '@/shared/config';
import Card from '@/shared/components/Card';
import styles from './WeeklyStudyTime.module.css';

interface WeeklyStudyTimeProps {
  data: {
    currentWeekMinutes: number;
    previousWeekMinutes: number;
    weekOverWeekChangePercent: number | null;
    monthlyAverageWeeklyMinutes: number;
    changeFromMonthlyAveragePercent: number | null;
  };
  isLoading?: boolean;
}

export default function WeeklyStudyTime({ data, isLoading }: WeeklyStudyTimeProps) {
  // Handle missing data gracefully
  if (!isLoading && !data) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Weekly Study Time</h3>
        </div>
        <div className={styles.emptyState}>No study time data available.</div>
      </Card>
    );
  }

  // Guard against incomplete data (missing required fields)
  if (!isLoading && data && (typeof data.currentWeekMinutes !== 'number' || typeof data.previousWeekMinutes !== 'number')) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Weekly Study Time</h3>
        </div>
        <div className={styles.emptyState}>Unable to load study time data.</div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Weekly Study Time</h3>
        </div>
        <div className={styles.skeletonContent}>
          <div className={styles.skeletonTime} />
          <div className={styles.skeletonStats} />
        </div>
      </Card>
    );
  }

  // Handle null values – default to 0
  const weekOverWeekChange = data.weekOverWeekChangePercent ?? 0;
  const monthlyChange = data.changeFromMonthlyAveragePercent ?? 0;

  const {
    currentWeekMinutes,
    previousWeekMinutes,
    monthlyAverageWeeklyMinutes,
  } = data;

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const currentFormatted = formatTime(currentWeekMinutes);
  const previousFormatted = formatTime(previousWeekMinutes);
  const avgMonthlyFormatted = formatTime(monthlyAverageWeeklyMinutes);

  // Determine trend styling based on derived values
  const isWeeklyPositive = weekOverWeekChange > 0;
  const isWeeklyNegative = weekOverWeekChange < 0;
  const isMonthlyPositive = monthlyChange > 0;
  const isMonthlyNegative = monthlyChange < 0;

  const weeklyIcon =
    isWeeklyPositive ? (
      <FiTrendingUp className={styles.trendIconUp} />
    ) : isWeeklyNegative ? (
      <FiTrendingDown className={styles.trendIconDown} />
    ) : null;

  const weeklyColor =
    isWeeklyPositive
      ? styles.trendPositive
      : isWeeklyNegative
      ? styles.trendNegative
      : styles.trendNeutral;

  const weeklyText = `${isWeeklyPositive ? '+' : ''}${weekOverWeekChange.toFixed(0)}%`;

  const monthlyIcon =
    isMonthlyPositive ? (
      <FiTrendingUp className={styles.trendIconUp} />
    ) : isMonthlyNegative ? (
      <FiTrendingDown className={styles.trendIconDown} />
    ) : null;

  const monthlyColor =
    isMonthlyPositive
      ? styles.trendPositive
      : isMonthlyNegative
      ? styles.trendNegative
      : styles.trendNeutral;

  const monthlyText = `${isMonthlyPositive ? '+' : ''}${monthlyChange.toFixed(0)}%`;

  return (
    <Card className={styles.container} noHover>
      <div className={styles.header}>
        <h3 className={styles.title}>Weekly Study Time</h3>
      </div>
      <div className={styles.content}>
        <div className={styles.timeWrapper}>
          <div className={styles.timeValue}>{currentFormatted}</div>
          <div className={styles.timeLabel}>this week</div>
        </div>

        <div className={styles.comparisonRows}>
          <div className={styles.comparisonItem}>
            <span className={styles.comparisonLabel}>vs last week</span>
            <div className={`${styles.comparisonValue} ${weeklyColor}`}>
              {weeklyIcon}
              <span>{weeklyText}</span>
            </div>
          </div>
          <div className={styles.comparisonItem}>
            <span className={styles.comparisonLabel}>vs monthly avg</span>
            <div className={`${styles.comparisonValue} ${monthlyColor}`}>
              {monthlyIcon}
              <span>{monthlyText}</span>
            </div>
          </div>
        </div>

        <div className={styles.referenceValues}>
          <span>last week {previousFormatted}</span>
          <span className={styles.referenceDivider}>|</span>
          <span>monthly avg {avgMonthlyFormatted}</span>
        </div>
      </div>
    </Card>
  );
}