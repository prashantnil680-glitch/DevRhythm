'use client';

import { FiTarget, FiCheckCircle } from 'react-icons/fi';
import Tooltip from '@/shared/components/Tooltip';
import styles from './HeroStats.module.css';

interface HeroStatsProps {
  totalGoals: number;
  completionRate: number;
  isLoading?: boolean;
}

export default function HeroStats({ totalGoals, completionRate, isLoading }: HeroStatsProps) {
  if (isLoading) {
    return <div className={styles.skeletonCard} />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.statItem}>
        <FiTarget className={styles.statIcon} />
        <span className={styles.statValue}>{totalGoals}</span>
        <Tooltip content="Total number of goals you've created (daily, weekly, planned)">
          <span className={styles.statLabel}>total goals</span>
        </Tooltip>
      </div>
      <div className={styles.statItem}>
        <FiCheckCircle className={styles.statIcon} />
        <span className={styles.statValue}>{Math.round(completionRate)}%</span>
        <Tooltip content="Percentage of all your goals that have been completed">
          <span className={styles.statLabel}>completion rate</span>
        </Tooltip>
      </div>
    </div>
  );
}