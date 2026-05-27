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
    weekOverWeekChangePercent: number;
    monthlyAverageWeeklyMinutes: number;
    changeFromMonthlyAveragePercent: number;
  };
  isLoading?: boolean;
}

export default function WeeklyStudyTime({ data, isLoading }: WeeklyStudyTimeProps) {
  const {
    currentWeekMinutes,
    previousWeekMinutes,
    weekOverWeekChangePercent,
    monthlyAverageWeeklyMinutes,
    changeFromMonthlyAveragePercent,
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

  // Trend icons and colors for the comparison percentages
  const currentColorClass = weekOverWeekChangePercent > 0 ? styles.trendPositive : weekOverWeekChangePercent < 0 ? styles.trendNegative : styles.trendNeutral;

  const weeklyIcon =
    weekOverWeekChangePercent > 0 ? (
      <FiTrendingUp className={styles.trendIconUp} />
    ) : weekOverWeekChangePercent < 0 ? (
      <FiTrendingDown className={styles.trendIconDown} />
    ) : null;
  const weeklyColor =
    weekOverWeekChangePercent > 0 ? styles.trendPositive : weekOverWeekChangePercent < 0 ? styles.trendNegative : styles.trendNeutral;
  const weeklyText = `${weekOverWeekChangePercent > 0 ? '+' : ''}${weekOverWeekChangePercent}%`;

  const monthlyIcon =
    changeFromMonthlyAveragePercent > 0 ? (
      <FiTrendingUp className={styles.trendIconUp} />
    ) : changeFromMonthlyAveragePercent < 0 ? (
      <FiTrendingDown className={styles.trendIconDown} />
    ) : null;
  const monthlyColor =
    changeFromMonthlyAveragePercent > 0 ? styles.trendPositive : changeFromMonthlyAveragePercent < 0 ? styles.trendNegative : styles.trendNeutral;
  const monthlyText = `${changeFromMonthlyAveragePercent > 0 ? '+' : ''}${changeFromMonthlyAveragePercent}%`;

  if (isLoading) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Weekly Study Time</h3>
          {/* <Link href={ROUTES.HEATMAP.ROOT} className={styles.viewAllLink}>
            View All →
          </Link> */}
        </div>
        <div className={styles.skeletonContent}>
          <div className={styles.skeletonTime} />
          <div className={styles.skeletonStats} />
        </div>
      </Card>
    );
  }

  return (
    <Card className={styles.container} noHover>
      <div className={styles.header}>
        <h3 className={styles.title}>Weekly Study Time</h3>
        {/* <Link href={ROUTES.HEATMAP.ROOT} className={styles.viewAllLink}>
          View All →
        </Link> */}
      </div>
      <div className={styles.content}>
        <div className={styles.timeWrapper}>
          <div className={`${styles.timeValue} ${currentColorClass}`}>
            {currentFormatted}
          </div>
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