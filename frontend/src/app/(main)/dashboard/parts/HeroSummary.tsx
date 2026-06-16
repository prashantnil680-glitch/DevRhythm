// frontend/src/app/(main)/dashboard/parts/HeroSummary.tsx

'use client';

import { memo } from 'react';
import Link from 'next/link';
import { FiTarget, FiCalendar } from 'react-icons/fi';
import { ROUTES } from '@/shared/config';
import Tooltip from '@/shared/components/Tooltip';
import type { DashboardSummary, GoalsData } from '@/features/dashboard';
import styles from './HeroSummary.module.css';

interface HeroSummaryProps {
  summary: DashboardSummary;
  goals: GoalsData['current'];
}

function HeroSummary({ summary, goals }: HeroSummaryProps) {
  const dailyGoal = goals.daily;
  const weeklyGoal = goals.weekly;

  const hasDaily = dailyGoal && dailyGoal.targetCount > 0;
  const hasWeekly = weeklyGoal && weeklyGoal.targetCount > 0;

  const dailyPercentage = hasDaily ? Math.round(dailyGoal.completionPercentage) : 0;
  const weeklyPercentage = hasWeekly ? Math.round(weeklyGoal.completionPercentage) : 0;

  return (
    <div className={styles.container}>
      {/* Metrics row – clearer labels with tooltips */}
      <div className={styles.metricsRow}>
        <span className={styles.stat}>
          <strong>{summary.totalSolved.toLocaleString()}</strong>
          <Tooltip content="Total number of problems you've solved across all platforms">
            <span className={styles.statLabel}>questions solved</span>
          </Tooltip>
        </span>
        <span className={styles.separator}>•</span>

        <span className={styles.stat}>
          <strong>{summary.currentStreak}</strong>
          <Tooltip content="Consecutive days with at least one solved problem">
            <span className={styles.statLabel}>day streak</span>
          </Tooltip>
        </span>
        <span className={styles.separator}>•</span>

        <span className={styles.stat}>
          <strong>{Math.round(summary.masteryRate)}%</strong>
          <Tooltip content="Percentage of questions you've mastered (solved + revised) out of all available questions">
            <span className={styles.statLabel}>mastery</span>
          </Tooltip>
        </span>
        <span className={styles.separator}>•</span>

        <span className={styles.stat}>
          <strong>{summary.longestStreak}</strong>
          <Tooltip content="Your longest consecutive days streak ever achieved">
            <span className={styles.statLabel}>longest streak</span>
          </Tooltip>
        </span>

        <Link href={ROUTES.QUESTIONS.ROOT} className={styles.viewAllLink}>
          View All questions →
        </Link>
      </div>

      {/* Goals row – only if at least one goal exists */}
      {(hasDaily || hasWeekly) && (
        <div className={styles.goalsRow}>
          {hasDaily && (
            <div className={styles.goalChip}>
              <FiTarget size={14} className={styles.goalIcon} />
              <span className={styles.goalLabel}>Daily</span>
              <span className={styles.goalProgress}>
                {dailyGoal?.completedCount}/{dailyGoal?.targetCount}
              </span>
              <span className={styles.goalPercentage}>{dailyPercentage}%</span>
            </div>
          )}
          {hasWeekly && (
            <div className={styles.goalChip}>
              <FiCalendar size={14} className={styles.goalIcon} />
              <span className={styles.goalLabel}>Weekly</span>
              <span className={styles.goalProgress}>
                {weeklyGoal?.completedCount}/{weeklyGoal?.targetCount}
              </span>
              <span className={styles.goalPercentage}>{weeklyPercentage}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(HeroSummary);