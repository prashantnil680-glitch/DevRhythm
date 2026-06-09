'use client';

import { useMemo, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Chart as ChartJS,
  PolarAreaController,
  ArcElement,
  RadialLinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { PolarArea } from 'react-chartjs-2';
import { Avatar } from '@/shared/components/Avatar';
import Button from '@/shared/components/Button';
import { useAggregatedProgress, useSheetRank } from '@/features/sheets';
import styles from './ProgressChart.module.css';
import Link from 'next/link';
import { FiLogIn } from 'react-icons/fi';

ChartJS.register(PolarAreaController, ArcElement, RadialLinearScale, Tooltip, Legend);

interface ProgressChartProps {
  slug: string;
  onJoinSheet: () => void;
  isJoining?: boolean;
  hasJoined: boolean;
  isAuthenticated?: boolean;
}

export default function ProgressChart({
  slug,
  onJoinSheet,
  isJoining = false,
  hasJoined,
  isAuthenticated = false,
}: ProgressChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const {
    data: aggData,
    isLoading: aggLoading,
    error: aggError,
    refetch: refetchAgg,
  } = useAggregatedProgress(slug);

  const {
    data: rankData,
    isLoading: rankLoading,
    error: rankError,
    refetch: refetchRank,
  } = useSheetRank(slug);

  // Fallback: if still loading after 1 second, force a refetch (handles race conditions)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (aggLoading && slug) refetchAgg();
      if (rankLoading && slug) refetchRank();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [aggLoading, rankLoading, slug, refetchAgg, refetchRank]);

  // If rank data failed, treat as empty (no rank information)
  const effectiveRankData = rankError ? { topRanks: [], currentUser: null } : rankData;
  const isLoading = aggLoading || (rankLoading && !rankError);

  const chartData = useMemo(() => {
    if (!aggData) return null;
    const { chart, metadata } = aggData;
    const labels = chart.labels;
    const dataset = chart.datasets[0];
    const [solvedCount, unsolvedCount, revisionCompletedCount, revisionPendingCount] = dataset.data;
    const totalQuestions = metadata.totalQuestions;
    return {
      labels,
      datasets: [
        {
          data: [solvedCount, unsolvedCount, revisionCompletedCount, revisionPendingCount],
          backgroundColor: isDark
            ? ['#4caf50', '#3a3b36', '#f59e0b', '#3a3b36']
            : ['#4caf50', '#dad8d2', '#f59e0b', '#dad8d2'],
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
      totalQuestions,
    };
  }, [aggData, isDark]);

  const chartOptions = useMemo(() => {
    const totalQuestions = chartData?.totalQuestions || 0;
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const value = context.raw;
              const percentage = totalQuestions ? ((value / totalQuestions) * 100).toFixed(1) : 0;
              return `${label}: ${value} (${percentage}%)`;
            },
          },
        },
        legend: { display: false },
      },
      scales: {
        r: {
          ticks: { display: false },
          grid: { display: false },
          angleLines: { display: false },
          startAngle: 0,
        },
      },
    };
  }, [chartData]);

  if (isLoading || !aggData || !chartData) {
    return (
      <div className={styles.container}>
        <div className={styles.leftColumn}>
          <div className={styles.loadingText}>Loading community progress...</div>
        </div>
        <div className={styles.chartWrapper}>
          <div className={styles.loadingChart}>Loading chart...</div>
        </div>
      </div>
    );
  }

  const { chart, metadata } = aggData;
  const dataset = chart.datasets[0];
  const [solvedCount, unsolvedCount, revisionCompletedCount, revisionPendingCount] = dataset.data;
  const totalQuestions = metadata.totalQuestions;
  const solvedPercentage = metadata.solvedPercentage;
  const revisionPercentage = metadata.revisionCompletedPercentage;
  const overallPercentage = (solvedPercentage + revisionPercentage) / 2;

  const { topRanks, currentUser } = effectiveRankData || { topRanks: [], currentUser: null };

  return (
    <div className={styles.container}>
      {/* Left column: community metrics + leaderboard */}
      <div className={styles.leftColumn}>
        <h2 className={styles.communityTitle}>Community Progress</h2>
        <div className={styles.metrics}>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>✓ Solved</span>
            <span className={styles.metricValue}>
              {solvedCount} / {totalQuestions}
              <span className={styles.percentage}>({Math.round(solvedPercentage)}%)</span>
            </span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>⟳ Revision</span>
            <span className={styles.metricValue}>
              {revisionCompletedCount} / {totalQuestions}
              <span className={styles.percentage}>({Math.round(revisionPercentage)}%)</span>
            </span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Overall</span>
            <span className={styles.metricValue}>{Math.round(overallPercentage)}% complete</span>
          </div>
        </div>

        {/* Leaderboard section */}
        <div className={styles.leaderboard}>
          <h4 className={styles.leaderboardTitle}>🏆 Top Performers</h4>
          {topRanks.length === 0 ? (
            <div className={styles.noRankData}>No participants yet.</div>
          ) : (
            <div className={styles.rankList}>
              {topRanks.map((entry) => (
                <div key={entry.userId} className={styles.rankItem}>
                  <span className={styles.rankNumber}>#{entry.rank}</span>
                  <Link
                    href={`/sheets/${slug}/progress/${entry.username}`}
                    className={styles.rankLink}
                  >
                    <Avatar
                      src={entry.avatarUrl}
                      name={entry.displayName || entry.username}
                      size="sm"
                    />
                  </Link>
                  <div className={styles.rankUserInfo}>
                    <Link
                      href={`/sheets/${slug}/progress/${entry.username}`}
                      className={styles.rankNameLink}
                    >
                      <span className={styles.rankName}>{entry.displayName || entry.username}</span>
                    </Link>
                    <div className={styles.rankStats}>
                      <span>✓ {entry.solvedCount}</span>
                      <span>⟳ {entry.revisionCompletedCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <hr className={styles.divider} />
          {currentUser ? (
            <div className={styles.yourRank}>
              <span className={styles.yourRankLabel}>Your Rank:</span>
              <span className={styles.yourRankValue}>#{currentUser.rank}</span>
              <Link
                href={`/sheets/${slug}/progress/${currentUser.username}`}
                className={styles.rankLink}
              >
                <Avatar
                  src={currentUser.avatarUrl}
                  name={currentUser.displayName || currentUser.username}
                  size="sm"
                />
              </Link>
              <Link
                href={`/sheets/${slug}/progress/${currentUser.username}`}
                className={styles.rankNameLink}
              >
                <span className={styles.yourRankName}>
                  {currentUser.displayName || currentUser.username}
                </span>
              </Link>
              <div className={styles.yourRankStats}>
                <span>✓ {currentUser.solvedCount}</span>
                <span>⟳ {currentUser.revisionCompletedCount}</span>
              </div>
            </div>
          ) : !hasJoined ? (
            isAuthenticated ? (
              <div className={styles.joinPrompt}>
                <p>You have not joined this sheet. Join to see your rank.</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onJoinSheet}
                  isLoading={isJoining}
                  leftIcon={<FiLogIn />}
                >
                  Join Sheet
                </Button>
              </div>
            ) : (
              <div className={styles.loginPrompt}>
                <p>Log in to join this sheet and track your progress.</p>
                <Link href="/login">
                  <Button variant="primary" size="sm" leftIcon={<FiLogIn />}>
                    Log in
                  </Button>
                </Link>
              </div>
            )
          ) : null}
        </div>
      </div>

      {/* Right column: polar area chart */}
      <div className={styles.chartWrapper}>
        <PolarArea data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}