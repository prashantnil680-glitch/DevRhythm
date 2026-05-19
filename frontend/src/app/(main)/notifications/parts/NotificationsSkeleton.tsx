'use client';

import React from 'react';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import styles from './NotificationsSkeleton.module.css';

export interface NotificationsSkeletonProps {
  count?: number;
}

export const NotificationsSkeleton: React.FC<NotificationsSkeletonProps> = ({
  count = 5,
}) => {
  return (
    <div className={styles.container}>
      {/* Filter bar skeleton */}
      <div className={styles.filtersSkeleton}>
        <SkeletonLoader variant="custom" width={80} height={28} />
        <SkeletonLoader variant="custom" width={120} height={28} />
        <SkeletonLoader variant="custom" width={60} height={28} />
        <SkeletonLoader variant="custom" width={130} height={28} />
        <SkeletonLoader variant="custom" width={100} height={28} />
        <SkeletonLoader variant="custom" width={70} height={28} />
        <SkeletonLoader variant="custom" width={70} height={28} />
      </div>

      {/* Notification list skeletons */}
      <div className={styles.listSkeleton}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className={styles.cardSkeleton}>
            <div className={styles.cardSkeletonLeft}>
              <SkeletonLoader variant="custom" width={8} height={8} className={styles.dotSkeleton} />
              <SkeletonLoader variant="custom" width={24} height={24} className={styles.iconSkeleton} />
            </div>
            <div className={styles.cardSkeletonContent}>
              <SkeletonLoader variant="text" width="70%" />
              <SkeletonLoader variant="text" width="90%" />
              <SkeletonLoader variant="text" width="40%" />
            </div>
            <div className={styles.cardSkeletonActions}>
              <SkeletonLoader variant="custom" width={50} height={26} />
              <SkeletonLoader variant="custom" width={50} height={26} />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className={styles.paginationSkeleton}>
        <SkeletonLoader variant="custom" width={80} height={32} />
        <SkeletonLoader variant="custom" width={100} height={32} />
        <SkeletonLoader variant="custom" width={80} height={32} />
      </div>
    </div>
  );
};

export default NotificationsSkeleton;