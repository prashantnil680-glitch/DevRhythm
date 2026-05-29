'use client';

import React from 'react';
import clsx from 'clsx';
import { FaFire } from 'react-icons/fa';
import { FiCalendar, FiClock, FiRefreshCw, FiTarget } from 'react-icons/fi';

import { useUserStats } from '../hooks/useUserStats';
import { useMediaQuery } from '@/shared/hooks';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import Tooltip from '@/shared/components/Tooltip';
import type { User } from '@/shared/types';
import type { UserStats } from '@/features/user/types/userStats.types';
import styles from './StatsPanel.module.css';

export interface StatsPanelProps {
  user: User;
  isOwnProfile?: boolean;
  className?: string;
  initialStats?: UserStats | null; 
}

// Helper to format minutes to hours with one decimal
const formatHours = (minutes: number): string => {
  const hours = minutes / 60;
  return hours.toFixed(1) + 'h';
};

// Helper to format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

const StatsPanel: React.FC<StatsPanelProps> = ({
  user,
  isOwnProfile = false,
  className,
  initialStats,
}) => {
  const userId = user?._id;
  const { data: stats, isLoading, error } = useUserStats(userId, isOwnProfile, initialStats);
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (!user) return null;

  if (isLoading) {
    return (
      <div className={clsx(styles.container, className)}>
        <div className={styles.header}>Echoes · Stats</div>
        <div className={styles.grid}>
          <SkeletonLoader variant="custom" height={120} />
          <SkeletonLoader variant="custom" height={120} />
          <SkeletonLoader variant="custom" height={80} />
          <SkeletonLoader variant="custom" height={80} />
          <SkeletonLoader variant="custom" height={80} />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={clsx(styles.container, className)}>
        <div className={styles.header}>Echoes · Stats</div>
        <p className={styles.error}>Could not load stats</p>
      </div>
    );
  }

  const {
    totalSolved,
    totalRevisions,
    masteryRate,
    streak,
    activeDays,
    totalTimeSpent,
    difficultyBreakdown,
    platformBreakdown,
    preferences,
  } = stats;

  const currentStreak = streak.current;
  const longestStreak = streak.longest;

  // Ensure platform breakdown includes all expected platforms
  const platforms = {
    LeetCode: platformBreakdown.LeetCode ?? 0,
    Codeforces: platformBreakdown.Codeforces ?? 0,
    HackerRank: platformBreakdown.HackerRank ?? 0,
  };

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>Progress Overview</div>

      <div className={styles.grid}>
        {/* Mastery block */}
        <Tooltip
          content="Percentage of questions you have mastered"
          placement={isMobile ? 'bottom' : 'top'}
        >
          <div className={clsx(styles.block, styles.masteryBlock)}>
            <div className={styles.masteryValue}>{Math.round(masteryRate)}%</div>
            <div className={styles.blockLabel}>Mastery Score</div>
          </div>
        </Tooltip>

        {/* Solved block */}
        <Tooltip content="Total number of problems solved" placement={isMobile ? 'bottom' : 'top'}>
          <div className={clsx(styles.block, styles.solvedBlock)}>
            <div className={styles.solvedValue}>{formatNumber(totalSolved)}</div>
            <div className={styles.blockLabel}>Problems Solved</div>
            <div className={styles.difficultyRow}>
              <Tooltip content="Easy problems solved" placement={isMobile ? 'bottom' : 'top'}>
                <div className={styles.difficultyPill}>
                  <span className={styles.difficultyNumber}>{difficultyBreakdown.Easy.solved}</span>
                  <span className={styles.difficultyLabel}>Easy</span>
                </div>
              </Tooltip>
              <Tooltip content="Medium problems solved" placement={isMobile ? 'bottom' : 'top'}>
                <div className={styles.difficultyPill}>
                  <span className={styles.difficultyNumber}>
                    {difficultyBreakdown.Medium.solved}
                  </span>
                  <span className={styles.difficultyLabel}>Medium</span>
                </div>
              </Tooltip>
              <Tooltip content="Hard problems solved" placement={isMobile ? 'bottom' : 'top'}>
                <div className={styles.difficultyPill}>
                  <span className={styles.difficultyNumber}>{difficultyBreakdown.Hard.solved}</span>
                  <span className={styles.difficultyLabel}>Hard</span>
                </div>
              </Tooltip>
            </div>
          </div>
        </Tooltip>

        {/* Streak & Activity block */}
        <div className={clsx(styles.block, styles.streakBlock)}>
          <Tooltip
            content="Current consecutive days with activity"
            placement={isMobile ? 'bottom' : 'top'}
          >
            <div className={styles.streakItem}>
              <FaFire className={styles.streakIcon} />
              <span className={styles.streakValue}>{currentStreak}d</span>
              <span className={styles.blockLabel}>Current Streak</span>
            </div>
          </Tooltip>
          <Tooltip content="Longest streak ever achieved" placement={isMobile ? 'bottom' : 'top'}>
            <div className={styles.streakItem}>
              <FaFire className={styles.streakIcon} />
              <span className={styles.streakValue}>{longestStreak}d</span>
              <span className={styles.blockLabel}>Longest Streak</span>
            </div>
          </Tooltip>
          <Tooltip
            content="Total days with at least one activity"
            placement={isMobile ? 'bottom' : 'top'}
          >
            <div className={styles.streakItem}>
              <FiCalendar className={styles.streakIcon} />
              <span className={styles.streakValue}>{activeDays}d</span>
              <span className={styles.blockLabel}>Active Days</span>
            </div>
          </Tooltip>
        </div>

        {/* Effort block */}
        <div className={clsx(styles.block, styles.effortBlock)}>
          <Tooltip
            content="Total time spent solving problems (hours)"
            placement={isMobile ? 'bottom' : 'top'}
          >
            <div className={styles.effortItem}>
              <FiClock className={styles.effortIcon} />
              <span className={styles.effortValue}>{formatHours(totalTimeSpent)}</span>
              <span className={styles.blockLabel}>Time Spent</span>
            </div>
          </Tooltip>
          <Tooltip content="Total revisions completed" placement={isMobile ? 'bottom' : 'top'}>
            <div className={styles.effortItem}>
              <FiRefreshCw className={styles.effortIcon} />
              <span className={styles.effortValue}>{formatNumber(totalRevisions)}</span>
              <span className={styles.blockLabel}>Revision Done</span>
            </div>
          </Tooltip>
        </div>

        {/* Platforms block */}
        <div className={clsx(styles.block, styles.platformsBlock)}>
          <Tooltip content="Problems solved on LeetCode" placement={isMobile ? 'bottom' : 'top'}>
            <div className={styles.platformItem}>
              <span className={styles.platformName}>LeetCode</span>
              <span className={styles.platformCount}>{platforms.LeetCode}</span>
            </div>
          </Tooltip>
          <Tooltip content="Problems solved on Codeforces" placement={isMobile ? 'bottom' : 'top'}>
            <div className={styles.platformItem}>
              <span className={styles.platformName}>Codeforces</span>
              <span className={styles.platformCount}>{platforms.Codeforces}</span>
            </div>
          </Tooltip>
          <Tooltip content="Problems solved on HackerRank" placement={isMobile ? 'bottom' : 'top'}>
            <div className={styles.platformItem}>
              <span className={styles.platformName}>HackerRank</span>
              <span className={styles.platformCount}>{platforms.HackerRank}</span>
            </div>
          </Tooltip>
        </div>

        {/* Goals block – only for own profile */}
        {isOwnProfile && preferences && preferences.dailyGoal &&  preferences.weeklyGoal && (
          <div className={clsx(styles.block, styles.goalsBlock)}>
            <Tooltip content="Your daily target" placement={isMobile ? 'bottom' : 'top'}>
              <div className={styles.goalItem}>
                <FiTarget className={styles.goalIcon} />
                <span className={styles.goalValue}>{preferences.dailyGoal}</span>
                <span className={styles.goalLabel}>Daily Goal</span>
              </div>
            </Tooltip>
            <span className={styles.goalSeparator}>·</span>
            <Tooltip content="Your weekly target" placement={isMobile ? 'bottom' : 'top'}>
              <div className={styles.goalItem}>
                <FiCalendar className={styles.goalIcon} />
                <span className={styles.goalValue}>{preferences.weeklyGoal}</span>
                <span className={styles.goalLabel}>Weekly Goal</span>
              </div>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsPanel;