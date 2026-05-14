'use client';

import { useMemo } from 'react';
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
import Card from '@/shared/components/Card';
import { useDailyTrend } from '@/features/activity/hooks/useActivityData';
import styles from './DailyTrendChart.module.css';

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

export default function DailyTrendChart() {
  const { data, isLoading, error } = useDailyTrend({ days: 30 });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const textColor = isDark ? '#E6E5DF' : '#242424';
  const gridColor = isDark ? '#3A3B36' : '#DAD8D2';
  const problemsColor = '#3d8b52';
  const revisionsColor = '#C4A265';
  const studyTimeColor = isDark ? '#8C8B85' : '#6C6C6C';
  const goalColor = isDark ? '#B7B6AF' : '#575757';

  const chartData = useMemo(() => {
    if (!data) return null;

    const formattedLabels = data.labels.map((label) => {
      const date = new Date(label);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels: formattedLabels,
      datasets: [
        {
          label: 'Problems Solved',
          data: data.problemsSolved,
          borderColor: problemsColor,
          backgroundColor: `${problemsColor}20`,
          borderWidth: 2.5,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointBackgroundColor: problemsColor,
          pointBorderColor: problemsColor,
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Revisions Completed',
          data: data.revisionsCompleted,
          borderColor: revisionsColor,
          backgroundColor: `${revisionsColor}20`,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: revisionsColor,
          pointBorderColor: revisionsColor,
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Goal Completion %',
          data: data.goalCompletionRate,
          borderColor: goalColor,
          backgroundColor: `${goalColor}20`,
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 1,
          pointHoverRadius: 3,
          pointBackgroundColor: goalColor,
          pointBorderColor: goalColor,
          tension: 0.3,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Study Time (min)',
          data: data.studyTimeMinutes,
          borderColor: studyTimeColor,
          backgroundColor: `${studyTimeColor}20`,
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 3,
          pointBackgroundColor: studyTimeColor,
          pointBorderColor: studyTimeColor,
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        },
      ],
    };
  }, [data, problemsColor, revisionsColor, studyTimeColor, goalColor]);

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
            label: (context: any) => {
              let label = context.dataset.label || '';
              let value = context.raw;
              if (context.dataset.label === 'Study Time (min)') {
                return `${label}: ${value} min`;
              }
              if (context.dataset.label === 'Goal Completion %') {
                return `${label}: ${value}%`;
              }
              return `${label}: ${value}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          position: 'left' as const,
          title: {
            display: true,
            text: 'Count / %',
            color: textColor,
            font: { size: 10, weight: 500 },
          },
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { size: 10 }, stepSize: 1 },
        },
        y1: {
          beginAtZero: true,
          position: 'right' as const,
          title: {
            display: true,
            text: 'Minutes',
            color: studyTimeColor,
            font: { size: 10, weight: 500 },
          },
          grid: { drawOnChartArea: false },
          ticks: { color: studyTimeColor, font: { size: 10 } },
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
  }, [textColor, gridColor, isDark, studyTimeColor]);

  if (isLoading) {
    return (
      <Card className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Daily Trend (30 days)</h3>
        </div>
        <div className={styles.skeletonChart} />
      </Card>
    );
  }

  if (error || !chartData) {
    return (
      <Card className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Daily Trend (30 days)</h3>
        </div>
        <div className={styles.errorState}>Unable to load chart data</div>
      </Card>
    );
  }

  return (
    <Card className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Daily Trend (30 days)</h3>
      </div>
      <div className={styles.chartWrapper}>
        <Line key={resolvedTheme} data={chartData} options={chartOptions} />
      </div>
    </Card>
  );
}