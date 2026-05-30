'use client';

import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  eachMonthOfInterval,
  subMonths,
  getDate,
} from 'date-fns';
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
import Card from '@/shared/components/Card';
import Tabs from '@/shared/components/Tabs';
import TooltipComponent from '@/shared/components/Tooltip';
import styles from './RhythmCenter.module.css';

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

type Period = 'daily' | 'weekly' | 'monthly';

interface RhythmCenterProps {
  trends: {
    daily: Array<{ date: string; completed: number; avgConfidence: number; totalTimeSpent: number }>;
  };
}

const safeNumber = (value: unknown): number => {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

// Chart component using Chart.js
interface LineChartProps {
  title: string;
  data: number[];
  labels: string[];
  borderColor: string;
  backgroundColor: string;
  yAxisLabel?: string;
}

function LineChart({ title, data, labels, borderColor, backgroundColor, yAxisLabel }: LineChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const textColor = isDark ? '#E6E5DF' : '#242424';
  const gridColor = isDark ? '#3A3B36' : '#DAD8D2';

  const chartData = {
    labels,
    datasets: [
      {
        label: title,
        data,
        borderColor,
        backgroundColor,
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: borderColor,
        pointBorderColor: borderColor,
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // we show title separately
      },
      tooltip: {
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
        ticks: { color: textColor, font: { size: 10 } },
        title: {
          display: !!yAxisLabel,
          text: yAxisLabel || '',
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

  return (
    <div className={styles.graphCard}>
      <h4>{title}</h4>
      <div className={styles.chartWrapper}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

export default function RhythmCenter({ trends }: RhythmCenterProps) {
  const [period, setPeriod] = useState<Period>('daily');

  const normalizedDaily = useMemo(() => {
    return trends.daily.map(day => ({
      date: day.date,
      completed: safeNumber(day.completed),
      avgConfidence: Math.min(5, Math.max(0, safeNumber(day.avgConfidence))),
      totalTimeSpent: safeNumber(day.totalTimeSpent),
    }));
  }, [trends.daily]);

  const aggregatedData = useMemo(() => {
    const dailyMap = new Map(normalizedDaily.map(d => [d.date, d]));

    if (period === 'daily') {
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const days: string[] = [];
      for (let d = thirtyDaysAgo; d <= today; d.setDate(d.getDate() + 1)) {
        days.push(format(d, 'yyyy-MM-dd'));
      }
      return days.map(date => {
        const day = dailyMap.get(date);
        return {
          date: format(new Date(date), 'MMM d'),
          completed: day?.completed ?? 0,
          avgConfidence: day?.avgConfidence ?? 0,
          totalTimeSpent: day?.totalTimeSpent ?? 0,
        };
      });
    }

    if (period === 'weekly') {
      const today = new Date();
      const start = startOfWeek(today, { weekStartsOn: 1 });
      const weeks = eachWeekOfInterval({ start: subMonths(start, 3), end: start }, { weekStartsOn: 1 });
      return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        let completed = 0, confidenceSum = 0, timeSum = 0, count = 0;
        for (let d = weekStart; d <= weekEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = format(d, 'yyyy-MM-dd');
          const day = dailyMap.get(dateStr);
          if (day) {
            completed += day.completed;
            confidenceSum += day.avgConfidence;
            timeSum += day.totalTimeSpent;
            count++;
          }
        }
        const avgConfidence = count > 0 ? confidenceSum / count : 0;
        return {
          date: format(weekStart, 'MMM d'),
          completed,
          avgConfidence: isNaN(avgConfidence) ? 0 : Math.min(5, avgConfidence),
          totalTimeSpent: timeSum,
        };
      }).slice(-12);
    }

    // monthly
    const today = new Date();
    const months = eachMonthOfInterval({ start: subMonths(today, 5), end: today });
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      let completed = 0, confidenceSum = 0, timeSum = 0, count = 0;
      for (let d = monthStart; d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        const day = dailyMap.get(dateStr);
        if (day) {
          completed += day.completed;
          confidenceSum += day.avgConfidence;
          timeSum += day.totalTimeSpent;
          count++;
        }
      }
      const avgConfidence = count > 0 ? confidenceSum / count : 0;
      return {
        date: format(month, 'MMM yyyy'),
        completed,
        avgConfidence: isNaN(avgConfidence) ? 0 : Math.min(5, avgConfidence),
        totalTimeSpent: timeSum,
      };
    });
  }, [normalizedDaily, period]);

  // Build data for the heatmap (daily = days of current month, weekly = weeks, monthly = months)
  const heatmapItems = useMemo(() => {
    const dailyMap = new Map(normalizedDaily.map(d => [d.date, d]));
    if (period === 'daily') {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      return days.map(day => ({
        id: format(day, 'yyyy-MM-dd'),
        label: format(day, 'd'),
        value: dailyMap.get(format(day, 'yyyy-MM-dd'))?.completed ?? 0,
        confidence: dailyMap.get(format(day, 'yyyy-MM-dd'))?.avgConfidence ?? 0,
      }));
    }
    if (period === 'weekly') {
      const today = new Date();
      const start = startOfWeek(today, { weekStartsOn: 1 });
      const weeks = eachWeekOfInterval({ start: subMonths(start, 3), end: start }, { weekStartsOn: 1 });
      return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        let completed = 0, confidenceSum = 0, count = 0;
        for (let d = weekStart; d <= weekEnd; d.setDate(d.getDate() + 1)) {
          const dayData = dailyMap.get(format(d, 'yyyy-MM-dd'));
          if (dayData) {
            completed += dayData.completed;
            confidenceSum += dayData.avgConfidence;
            count++;
          }
        }
        const avgConfidence = count > 0 ? confidenceSum / count : 0;
        return {
          id: format(weekStart, 'w'),
          label: `W${format(weekStart, 'w')}`,
          value: completed,
          confidence: avgConfidence,
        };
      }).slice(-12);
    }
    // monthly
    const today = new Date();
    const months = eachMonthOfInterval({ start: subMonths(today, 5), end: today });
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      let completed = 0, confidenceSum = 0, count = 0;
      for (let d = monthStart; d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dayData = dailyMap.get(format(d, 'yyyy-MM-dd'));
        if (dayData) {
          completed += dayData.completed;
          confidenceSum += dayData.avgConfidence;
          count++;
        }
      }
      const avgConfidence = count > 0 ? confidenceSum / count : 0;
      return {
        id: format(month, 'yyyy-MM'),
        label: format(month, 'MMM'),
        value: completed,
        confidence: avgConfidence,
      };
    });
  }, [normalizedDaily, period]);

  const getIntensityColor = (value: number) => {
    if (value === 0) return 'var(--heat-0)';
    if (value <= 2) return 'var(--heat-1)';
    if (value <= 5) return 'var(--heat-2)';
    if (value <= 10) return 'var(--heat-3)';
    return 'var(--heat-4)';
  };

  const tabs = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ];

  // Build month rows for daily period
  const monthRows = useMemo(() => {
    if (period !== 'daily') return null;
    const daysInMonth = heatmapItems.length;
    if (daysInMonth === 31) {
      return [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        [12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
        [22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
      ];
    } else if (daysInMonth === 30) {
      return [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
      ];
    } else if (daysInMonth === 29) {
      return [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25, 26, 27, 28, 29],
      ];
    } else {
      return [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25, 26, 27, 28],
      ];
    }
  }, [period, heatmapItems]);

  // Theme colors for graphs
  const completedColor = '#3d8b52';     // moss
  const confidenceColor = '#C4A265';    // sand
  const timeColor = '#6C5CE7';

  const completedBg = `${completedColor}20`;
  const confidenceBg = `${confidenceColor}20`;
  const timeBg = `${timeColor}20`;

  const currentAggregated = aggregatedData;
  const labels = currentAggregated.map(d => d.date);
  const completedData = currentAggregated.map(d => d.completed);
  const confidenceData = currentAggregated.map(d => d.avgConfidence);
  const timeData = currentAggregated.map(d => d.totalTimeSpent);

  return (
    <Card className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>The Rhythm of Practice</h3>
        <Tabs tabs={tabs} activeTab={period} onChange={(id) => setPeriod(id as Period)} variant="underline" size="sm" />
      </div>

      <div className={styles.graphsRow}>
        <LineChart
          title="Revisions / day"
          data={completedData}
          labels={labels}
          borderColor={completedColor}
          backgroundColor={completedBg}
          yAxisLabel="revisions"
        />
        <LineChart
          title="Confidence trend"
          data={confidenceData}
          labels={labels}
          borderColor={confidenceColor}
          backgroundColor={confidenceBg}
          yAxisLabel="confidence (1‑5)"
        />
        <LineChart
          title="Time spent (min)"
          data={timeData}
          labels={labels}
          borderColor={timeColor}
          backgroundColor={timeBg}
          yAxisLabel="minutes"
        />
      </div>

      {/* HEATMAP SECTION – unchanged */}
      <div className={styles.heatmapContainer}>
        <div className={styles.heatmapHeader}>
          <span>{period === 'daily' ? format(new Date(), 'MMMM yyyy') : period === 'weekly' ? 'Weekly Activity' : 'Monthly Activity'}</span>
        </div>

        {period === 'daily' && monthRows ? (
          <div className={styles.heatmapGridRows}>
            {monthRows.map((row, rowIdx) => {
              const columnsCount = row.length;
              const rowClass = columnsCount === 11 ? styles['row--11cols'] : styles['row--10cols'];
              return (
                <div key={rowIdx} className={`${styles.row} ${rowClass}`}>
                  {row.map(dayNumber => {
                    const dayItem = heatmapItems.find(item => parseInt(item.label) === dayNumber);
                    const completed = dayItem?.value ?? 0;
                    const confidence = dayItem?.confidence ?? 0;
                    const tooltipText = `${dayNumber}: ${completed} revision${completed !== 1 ? 's' : ''}`;
                    return (
                      <TooltipComponent key={dayNumber} content={tooltipText}>
                        <div
                          className={styles.cell}
                          style={{ backgroundColor: getIntensityColor(completed) }}
                        >
                          <span className={styles.cellNumber}>{dayNumber}</span>
                          <span
                            className={styles.confidenceDot}
                            style={{
                              backgroundColor: confidence >= 4 ? '#2e7d32' : confidence >= 3 ? '#ed6c02' : '#d32f2f',
                            }}
                          />
                        </div>
                      </TooltipComponent>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.heatmapGrid}>
            {heatmapItems.map(item => {
              const tooltipText = `${item.label}: ${item.value} revision${item.value !== 1 ? 's' : ''}, avg confidence ${item.confidence.toFixed(1)}`;
              return (
                <TooltipComponent key={item.id} content={tooltipText}>
                  <div
                    className={styles.cell}
                    style={{ backgroundColor: getIntensityColor(item.value) }}
                  >
                    <span className={styles.cellNumber}>{item.label}</span>
                    <span
                      className={styles.confidenceDot}
                      style={{
                        backgroundColor: item.confidence >= 4 ? '#2e7d32' : item.confidence >= 3 ? '#ed6c02' : '#d32f2f',
                      }}
                    />
                  </div>
                </TooltipComponent>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}