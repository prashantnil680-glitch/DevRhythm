'use client';

import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import Card from '@/shared/components/Card';
import { useMonthlyTrend } from '@/features/activity/hooks/useActivityData';
import styles from './MonthlyTrendChart.module.css';

// Register all required components including BarController
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function MonthlyTrendChart() {
  const { data, isLoading, error } = useMonthlyTrend({ months: 12, includeComparison: true });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const textColor = isDark ? '#E6E5DF' : '#242424';
  const gridColor = isDark ? '#3A3B36' : '#DAD8D2';
  const problemsColor = '#3d8b52';
  const goalsColor = '#C4A265';
  const avgColor = isDark ? '#8C8B85' : '#6C6C6C';

  const chartData = useMemo(() => {
    if (!data) return null;

    const datasets: any[] = [
      {
        label: 'Problems Solved',
        data: data.problemsSolved,
        type: 'bar' as const,
        backgroundColor: `${problemsColor}CC`,
        borderColor: problemsColor,
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
        yAxisID: 'y',
      },
      {
        label: 'Goals Completed',
        data: data.goalsCompleted,
        type: 'bar' as const,
        backgroundColor: `${goalsColor}CC`,
        borderColor: goalsColor,
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
        yAxisID: 'y',
      },
    ];

    if (data.comparison && data.comparison.avgGoalsCompleted) {
      datasets.push({
        label: 'Global Avg Goals',
        data: data.comparison.avgGoalsCompleted,
        type: 'line' as const,
        borderColor: avgColor,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        borderDash: [6, 6],
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: avgColor,
        pointBorderColor: avgColor,
        tension: 0.3,
        fill: false,
        yAxisID: 'y',
      });
    }

    return {
      labels: data.labels,
      datasets,
    };
  }, [data, problemsColor, goalsColor, avgColor]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart' as const,
      },
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            color: textColor,
            font: { size: 11, weight: 500 },
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
          callbacks: {
            afterBody: (tooltipItems: any[]) => {
              if (!data?.comparison?.userAhead) return [];
              const idx = tooltipItems[0]?.dataIndex;
              if (idx !== undefined && data.comparison.userAhead[idx]) {
                return ['✨ You are ahead of the global average'];
              }
              return [];
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { size: 10 } },
          title: {
            display: true,
            text: 'Count',
            color: textColor,
            font: { size: 10, weight: 500 },
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
  }, [textColor, gridColor, isDark, data]);

  if (isLoading) {
    return (
      <Card className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Monthly Trend (12 months)</h3>
        </div>
        <div className={styles.skeletonChart} />
      </Card>
    );
  }

  if (error || !chartData) {
    return (
      <Card className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Monthly Trend (12 months)</h3>
        </div>
        <div className={styles.errorState}>Unable to load chart data</div>
      </Card>
    );
  }

  return (
    <Card className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Monthly Trend (12 months)</h3>
      </div>
      <div className={styles.chartWrapper}>
        <Chart key={resolvedTheme} type="bar" data={chartData} options={chartOptions} />
      </div>
      {data.comparison && data.comparison.avgGoalsCompleted && (
        <p className={styles.footnote}>
          ✨ The sparkle indicates months where you exceeded the global average (if data available).
        </p>
      )}
    </Card>
  );
}