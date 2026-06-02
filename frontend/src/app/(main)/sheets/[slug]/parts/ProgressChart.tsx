// frontend/src/app/(main)/sheets/[slug]/parts/ProgressChart.tsx

'use client';

import { useMemo } from 'react';
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
import styles from './ProgressChart.module.css';

ChartJS.register(PolarAreaController, ArcElement, RadialLinearScale, Tooltip, Legend);

interface ProgressChartProps {
  solvedCount: number;
  revisionCompletedCount: number;
  totalQuestions: number;
}

export default function ProgressChart({
  solvedCount,
  revisionCompletedCount,
  totalQuestions,
}: ProgressChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Derived values
  const unsolvedCount = totalQuestions - solvedCount;
  const revisionPendingCount = totalQuestions - revisionCompletedCount;
  const solvedPercentage = totalQuestions ? (solvedCount / totalQuestions) * 100 : 0;
  const revisionPercentage = totalQuestions ? (revisionCompletedCount / totalQuestions) * 100 : 0;
  const overallPercentage = (solvedPercentage + revisionPercentage) / 2;

  const chartData = useMemo(() => ({
    labels: ['Solved', 'Unsolved', 'Revision Completed', 'Revision Pending'],
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
  }), [solvedCount, unsolvedCount, revisionCompletedCount, revisionPendingCount, isDark]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw;
            const total = (label === 'Solved' || label === 'Unsolved')
              ? totalQuestions
              : totalQuestions;
            const percentage = total ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
      legend: {
        display: false,
      },
    },
    scales: {
      r: {
        ticks: { display: false },
        grid: { display: false },
        angleLines: { display: false },
        startAngle: 0,
      },
    },
  }), [totalQuestions]);

  return (
    <div className={styles.container}>
      {/* Left column: metrics */}
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
          <span className={styles.metricValue}>
            {Math.round(overallPercentage)}% complete
          </span>
        </div>
      </div>

      {/* Right column: polar area chart */}
      <div className={styles.chartWrapper}>
        <PolarArea data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}