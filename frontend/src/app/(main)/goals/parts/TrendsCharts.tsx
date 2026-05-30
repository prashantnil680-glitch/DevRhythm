'use client';

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
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
import { useTheme } from 'next-themes';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';
import { goalService } from '@/features/goal';
import { useGoalChartData } from '@/features/goal';
import { useMediaQuery } from '@/shared/hooks';
import styles from './TrendsCharts.module.css';

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

interface TrendsChartsProps {
  className?: string;
}

export default function TrendsCharts({ className }: TrendsChartsProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 939px)');

  // Monthly data
  const { data: monthlyData, isLoading: monthlyLoading, error: monthlyError } = useGoalChartData({
    periodType: 'monthly',
    range: 'last12months',
    includeComparison: true,
  });

  // Yearly data: fetch each year from currentYear - 3 to currentYear
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 3;
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i);

  const yearlyQueries = useQueries({
    queries: years.map(year => ({
      queryKey: ['goals', 'chart-data', 'yearly', year],
      queryFn: () => goalService.getGoalChartData({
        periodType: 'yearly',
        range: `year=${year}`,
        includeComparison: true,
      }),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const isLoadingYearly = yearlyQueries.some(q => q.isLoading);
  const yearlyError = yearlyQueries.some(q => q.error);

  const yearlyData = useMemo(() => {
    if (isLoadingYearly || yearlyError) return null;
    const labels: string[] = [];
    const userGoals: number[] = [];
    const avgGoals: number[] = [];
    for (let i = 0; i < years.length; i++) {
      const year = years[i];
      const data = yearlyQueries[i]?.data;
      labels.push(year.toString());
      userGoals.push(data?.user?.goalsCompleted?.[0] ?? 0);
      avgGoals.push(data?.comparison?.avgGoalsCompleted?.[0] ?? 0);
    }
    return { labels, user: { goalsCompleted: userGoals }, comparison: { avgGoalsCompleted: avgGoals } };
  }, [yearlyQueries, years, isLoadingYearly, yearlyError]);

  const isLoading = monthlyLoading || isLoadingYearly;
  const hasError = monthlyError || yearlyError;

  const textColor = isDark ? '#E6E5DF' : '#242424';
  const gridColor = isDark ? '#3A3B36' : '#DAD8D2';

  // Color palette – user line: vibrant green, average line: orange
  const userLineColor = '#2E7D32';      // green – growth
  const userPointColor = '#1B5E20';     // dark green for points
  const avgLineColor = '#F57C00';       // orange – distinct
  const avgPointColor = '#E65100';      // dark orange

  // Responsive chart options
  const chartOptions = useMemo(() => {
    let pointRadius = 3;
    let pointHoverRadius = 5;
    if (isMobile) {
      pointRadius = 2;
      pointHoverRadius = 3;
    } else if (isTablet) {
      pointRadius = 2.5;
      pointHoverRadius = 4;
    }

    let maxTicksLimit = undefined;
    let rotation = 45;
    if (isMobile) {
      maxTicksLimit = 6;
      rotation = 90;
    } else if (isTablet) {
      maxTicksLimit = 8;
      rotation = 60;
    }

    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            color: textColor,
            font: { size: isMobile ? 9 : 11 },
            boxWidth: 12,
            padding: 15,
            usePointStyle: true,
          },
          onHover: (event: any) => {
            const canvas = event.native?.target?.ownerSVGElement?.parentNode ?? event.chart?.canvas;
            if (canvas) canvas.style.cursor = 'pointer';
          },
          onLeave: (event: any) => {
            const canvas = event.native?.target?.ownerSVGElement?.parentNode ?? event.chart?.canvas;
            if (canvas) canvas.style.cursor = 'default';
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
          ticks: { color: textColor, stepSize: 1, font: { size: isMobile ? 9 : 10 } },
          title: {
            display: !isMobile,
            text: 'Goals completed',
            color: textColor,
            font: { size: 10 },
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            maxRotation: rotation,
            minRotation: rotation,
            maxTicksLimit,
            autoSkip: true,
            font: { size: isMobile ? 9 : 10 },
          },
        },
      },
    };
  }, [textColor, gridColor, isDark, isMobile, isTablet]);

  // Monthly chart data – with fill under the lines
  const monthlyChartData = useMemo(() => {
    if (!monthlyData?.labels || !monthlyData.user?.goalsCompleted) return null;
    return {
      labels: monthlyData.labels,
      datasets: [
        {
          label: 'Your goals',
          data: monthlyData.user.goalsCompleted,
          borderColor: userLineColor,
          backgroundColor: `${userLineColor}20`, // 12% opacity fill
          borderWidth: 2.5,
          pointRadius: isMobile ? 2 : 3,
          pointHoverRadius: isMobile ? 3 : 5,
          pointBackgroundColor: userPointColor,
          pointBorderColor: userPointColor,
          tension: 0.3,
          fill: true,           // ← area fill enabled
        },
        {
          label: 'Average user',
          data: monthlyData.comparison?.avgGoalsCompleted || [],
          borderColor: avgLineColor,
          backgroundColor: `${avgLineColor}20`, // 12% opacity fill
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: isMobile ? 1.5 : 2,
          pointHoverRadius: isMobile ? 2.5 : 4,
          pointBackgroundColor: avgPointColor,
          pointBorderColor: avgPointColor,
          tension: 0.3,
          fill: true,           // ← area fill enabled
        },
      ],
    };
  }, [monthlyData, userLineColor, userPointColor, avgLineColor, avgPointColor, isMobile]);

  // Yearly chart data – same styling
  const yearlyChartData = useMemo(() => {
    if (!yearlyData?.labels || !yearlyData.user?.goalsCompleted) return null;
    return {
      labels: yearlyData.labels,
      datasets: [
        {
          label: 'Your goals',
          data: yearlyData.user.goalsCompleted,
          borderColor: userLineColor,
          backgroundColor: `${userLineColor}20`,
          borderWidth: 2.5,
          pointRadius: isMobile ? 2 : 3,
          pointHoverRadius: isMobile ? 3 : 5,
          pointBackgroundColor: userPointColor,
          pointBorderColor: userPointColor,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Average user',
          data: yearlyData.comparison?.avgGoalsCompleted || [],
          borderColor: avgLineColor,
          backgroundColor: `${avgLineColor}20`,
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: isMobile ? 1.5 : 2,
          pointHoverRadius: isMobile ? 2.5 : 4,
          pointBackgroundColor: avgPointColor,
          pointBorderColor: avgPointColor,
          tension: 0.3,
          fill: true,
        },
      ],
    };
  }, [yearlyData, userLineColor, userPointColor, avgLineColor, avgPointColor, isMobile]);

  // Helper to generate footnote (with color and icon)
  const getFootnote = (type: 'monthly' | 'yearly') => {
    const data = type === 'monthly' ? monthlyData : yearlyData;
    if (!data?.user?.goalsCompleted?.length) return null;

    const goalsArray = data.user.goalsCompleted;
    const avgArray = data.comparison?.avgGoalsCompleted || [];
    const lastIndex = goalsArray.length - 1;
    const userValue = goalsArray[lastIndex];
    const avgValue = avgArray[lastIndex] ?? 0;
    const label = type === 'monthly'
      ? (data.labels?.[lastIndex] || 'this month')
      : (data.labels?.[lastIndex] || 'this year');
    const diff = userValue - avgValue;
    const isAhead = diff > 0;
    const isBehind = diff < 0;

    let icon = null;
    let colorClass = '';
    let message = '';

    if (type === 'monthly') {
      const unit = userValue === 1 ? 'goal' : 'goals';
      if (isAhead) {
        icon = <FiTrendingUp className={styles.footnoteIconUp} />;
        colorClass = styles.footnoteAhead;
        message = `You completed ${userValue} ${unit} in ${label} – ${diff} above avg (${avgValue.toFixed(1)})`;
      } else if (isBehind) {
        icon = <FiTrendingDown className={styles.footnoteIconDown} />;
        colorClass = styles.footnoteBehind;
        message = `You completed ${userValue} ${unit} in ${label} – ${Math.abs(diff)} below avg (${avgValue.toFixed(1)})`;
      } else {
        icon = <FiMinus className={styles.footnoteIconEqual} />;
        colorClass = styles.footnoteEqual;
        message = `You completed ${userValue} ${unit} in ${label} – same as avg`;
      }
    } else {
      if (isAhead) {
        icon = <FiTrendingUp className={styles.footnoteIconUp} />;
        colorClass = styles.footnoteAhead;
        message = `You're ahead of average in ${label} (${userValue} vs ${avgValue.toFixed(1)})`;
      } else if (isBehind) {
        icon = <FiTrendingDown className={styles.footnoteIconDown} />;
        colorClass = styles.footnoteBehind;
        message = `You're behind average in ${label} (${userValue} vs ${avgValue.toFixed(1)})`;
      } else {
        icon = <FiMinus className={styles.footnoteIconEqual} />;
        colorClass = styles.footnoteEqual;
        message = `You're matching average in ${label} (${userValue})`;
      }
    }

    return { icon, colorClass, message };
  };

  const monthlyFootnote = getFootnote('monthly');
  const yearlyFootnote = getFootnote('yearly');

  if (isLoading) {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.chartCard}>
          <div className={styles.skeletonChart} />
        </div>
        <div className={styles.chartCard}>
          <div className={styles.skeletonChart} />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.errorCard}>
          <p>Unable to load chart data. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.chartCard}>
        <h4 className={styles.chartTitle}>Monthly completion</h4>
        <div className={styles.chartWrapper}>
          {monthlyChartData ? (
            <Line data={monthlyChartData} options={chartOptions} />
          ) : (
            <div className={styles.noData}>No monthly data available</div>
          )}
        </div>
        {monthlyFootnote && (
          <p className={`${styles.footnote} ${monthlyFootnote.colorClass}`}>
            {monthlyFootnote.icon} {monthlyFootnote.message}
          </p>
        )}
      </div>
      <div className={styles.chartCard}>
        <h4 className={styles.chartTitle}>Yearly completion</h4>
        <div className={styles.chartWrapper}>
          {yearlyChartData ? (
            <Line data={yearlyChartData} options={chartOptions} />
          ) : (
            <div className={styles.noData}>No yearly data available</div>
          )}
        </div>
        {yearlyFootnote && (
          <p className={`${styles.footnote} ${yearlyFootnote.colorClass}`}>
            {yearlyFootnote.icon} {yearlyFootnote.message}
          </p>
        )}
      </div>
    </div>
  );
}