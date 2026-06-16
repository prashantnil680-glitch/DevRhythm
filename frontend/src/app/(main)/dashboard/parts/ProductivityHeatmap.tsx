'use client';

import * as React from 'react';
import { memo, useMemo } from 'react';
import Link from 'next/link';
import styles from './ProductivityHeatmap.module.css';

// Shape when API returns array (as in your response)
interface ArrayDataPoint {
  date: string;
  activityCount: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
}

// Shape when API returns object with dailyData
interface ObjectDataPoint {
  date: string;
  totalActivities: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
}

interface ObjectHeatmapData {
  weekCount: number;
  firstDate: string;
  lastDate: string;
  dailyData: ObjectDataPoint[];
}

type ProductivityHeatmapData = ArrayDataPoint[] | ObjectHeatmapData;

interface ProductivityHeatmapProps {
  data?: ProductivityHeatmapData;
  isLoading?: boolean;
}

function HeatmapCell({ day, count, intensity, dateStr }: { day: number; count: number; intensity: number; dateStr: string }) {
  const levelClass = `level${intensity}`;
  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) : '';
  const tooltipText = dateStr ? `${formattedDate}: ${count} submission${count !== 1 ? 's' : ''}` : `Day ${day}: No activity`;
  const ariaLabel = dateStr ? `${formattedDate}, ${count} problem${count !== 1 ? 's' : ''} solved, intensity level ${intensity} out of 4` : `Day ${day}, no activity recorded`;

  const cellContent = (
    <div
      className={`${styles.cell} ${styles[levelClass]}`}
      data-tooltip={tooltipText}
      aria-label={ariaLabel}
      role="gridcell"
      style={{ cursor: dateStr ? 'pointer' : 'default' }}
    >
      <span className={styles.cellNumber}>{day}</span>
    </div>
  );

  // Only wrap with Link if we have a valid date string
  if (!dateStr) {
    return cellContent;
  }

  return (
    <Link href={`/activity/${dateStr}`} style={{ textDecoration: 'none', display: 'block' }}>
      {cellContent}
    </Link>
  );
}

function ProductivityHeatmap({ data, isLoading }: ProductivityHeatmapProps) {
  // Extract array of points from the two possible shapes
  const points = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.map(item => ({
        date: item.date,
        count: item.activityCount,
        intensity: item.intensityLevel,
      }));
    } else if (data.dailyData && Array.isArray(data.dailyData)) {
      return data.dailyData.map(item => ({
        date: item.date,
        count: item.totalActivities,
        intensity: item.intensityLevel,
      }));
    }
    return [];
  }, [data]);

  // Build activity map for quick lookup
  const activityMap = useMemo(() => {
    const map = new Map<number, { count: number; intensity: number; date: string }>();
    points.forEach(point => {
      const dateObj = new Date(point.date);
      const dayOfMonth = dateObj.getUTCDate();
      map.set(dayOfMonth, { count: point.count, intensity: point.intensity, date: point.date });
    });
    return map;
  }, [points]);

  // Determine month name from first data point
  const monthName = useMemo(() => {
    if (points.length === 0) return '';
    const firstDate = new Date(points[0].date);
    return firstDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [points]);

  // Build rows based on total days
  const rows = useMemo(() => {
    const totalDays = points.length;
    if (totalDays === 31) {
      return [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        [12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
        [22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
      ];
    } else if (totalDays === 30) {
      return [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
      ];
    } else if (totalDays === 29) {
      return [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25, 26, 27, 28, 29],
      ];
    } else {
      // 28 days (February non-leap)
      return [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25, 26, 27, 28],
      ];
    }
  }, [points.length]);

  if (isLoading || points.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Productivity Heatmap</h3>
        </div>
        <div className={styles.skeletonHeatmap} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Productivity Heatmap</h3>
      </div>
      <div className={styles.monthLabel}>{monthName}</div>
      <div className={styles.heatmapGrid}>
        {rows.map((row, rowIdx) => {
          const columnsCount = row.length;
          const rowClass = columnsCount === 11 ? styles['row--11cols'] : styles['row--10cols'];
          return (
            <div key={rowIdx} className={`${styles.row} ${rowClass}`}>
              {row.map(day => {
                const dayData = activityMap.get(day);
                const count = dayData?.count ?? 0;
                const intensity = (dayData?.intensity ?? 0) as 0 | 1 | 2 | 3 | 4;
                const dateStr = dayData?.date || '';
                return (
                  <HeatmapCell key={day} day={day} count={count} intensity={intensity} dateStr={dateStr} />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ProductivityHeatmap);