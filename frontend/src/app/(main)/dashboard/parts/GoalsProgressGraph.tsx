'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useGoalChartData } from '@/features/goal';
import { ROUTES } from '@/shared/config';
import styles from './GoalsProgressGraph.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface GoalsProgressGraphProps {
  className?: string;
}

export default function GoalsProgressGraph({ className }: GoalsProgressGraphProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { data, isLoading, error } = useGoalChartData({
    periodType: 'monthly',
    range: 'last12months',
    includeComparison: true,
  });

  const textColor = isDark ? '#E6E5DF' : '#242424';
  const gridColor = isDark ? '#3A3B36' : '#DAD8D2';
  const userLineColor = '#2E7D32';
  const userPointColor = '#1B5E20';
  const avgLineColor = '#F57C00';
  const avgPointColor = '#E65100';

  const chartData = useMemo(() => {
    if (!data?.labels || !data.user?.goalsCompleted) return null;

    return {
      labels: data.labels,
      datasets: [
        {
          label: 'Your goals',
          data: data.user.goalsCompleted,
          borderColor: userLineColor,
          backgroundColor: `${userLineColor}20`, // 12% opacity fill
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: userPointColor,
          pointBorderColor: userPointColor,
          tension: 0.3,
          fill: true,           // ← fill under the line
        },
        {
          label: 'Average user',
          data: data.comparison?.avgGoalsCompleted || [],
          borderColor: avgLineColor,
          backgroundColor: `${avgLineColor}20`, // 12% opacity fill
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: avgPointColor,
          pointBorderColor: avgPointColor,
          tension: 0.3,
          fill: true,           // ← fill under the line
        },
      ],
    };
  }, [data, userLineColor, userPointColor, avgLineColor, avgPointColor]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            color: textColor,
            font: { size: 11 },
            boxWidth: 12,
            padding: 15,
            usePointStyle: true,
          },
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: isDark ? '#2C2D28' : '#FBFAF6',
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: gridColor,
          borderWidth: 1,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, stepSize: 1, font: { size: 10 } },
          title: {
            display: true,
            text: 'Goals completed',
            color: textColor,
            font: { size: 10 },
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            font: { size: 10 },
          },
        },
      },
    };
  }, [textColor, gridColor, isDark]);

  const getFootnote = () => {
    if (!data?.user?.goalsCompleted?.length) return null;
    const goalsArray = data.user.goalsCompleted;
    const avgArray = data.comparison?.avgGoalsCompleted || [];
    const lastIndex = goalsArray.length - 1;
    const userValue = goalsArray[lastIndex];
    const avgValue = avgArray[lastIndex] ?? 0;
    const label = data.labels?.[lastIndex] || 'this month';
    const diff = userValue - avgValue;
    const isAhead = diff > 0;
    const isBehind = diff < 0;
    const unit = userValue === 1 ? 'goal' : 'goals';

    if (isAhead) {
      return `You completed ${userValue} ${unit} in ${label} – ${diff} above avg (${avgValue.toFixed(1)})`;
    } else if (isBehind) {
      return `You completed ${userValue} ${unit} in ${label} – ${Math.abs(diff)} below avg (${avgValue.toFixed(1)})`;
    } else {
      return `You completed ${userValue} ${unit} in ${label} – same as avg`;
    }
  };

  const footnote = getFootnote();

  if (isLoading) {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.header}>
          <h3 className={styles.title}>Goals Progress Graph</h3>
          <Link href={ROUTES.GOALS.ROOT} className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        <div className={styles.skeletonChart} />
      </div>
    );
  }

  if (error || !chartData) {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.header}>
          <h3 className={styles.title}>Goals Progress Graph</h3>
          <Link href={ROUTES.GOALS.ROOT} className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        <div className={styles.errorState}>Unable to load chart data</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Goals Progress Graph</h3>
        <Link href={ROUTES.GOALS.ROOT} className={styles.viewAllLink}>
          View All →
        </Link>
      </div>
      <div className={styles.chartWrapper}>
        <Line data={chartData} options={chartOptions} />
      </div>
      {footnote && <p className={styles.footnote}>{footnote}</p>}
    </div>
  );
}