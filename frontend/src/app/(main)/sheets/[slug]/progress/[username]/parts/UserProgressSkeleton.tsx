'use client';

import SkeletonLoader from '@/shared/components/SkeletonLoader';
import styles from './UserProgressSkeleton.module.css';

export default function UserProgressSkeleton() {
  return (
    <div className={styles.container}>
      {/* Header skeleton (matches UserProgressHeader) */}
      <div className={styles.headerSkeleton}>
        {/* Top row: sheet name + share button */}
        <div className={styles.topRowSkeleton}>
          <SkeletonLoader variant="text" width="60%" height={28} />
          <SkeletonLoader variant="custom" width={120} height={32} />
        </div>
        {/* User row: avatar + username */}
        <div className={styles.userRowSkeleton}>
          <SkeletonLoader variant="custom" width={32} height={32} className={styles.avatarSkeleton} />
          <SkeletonLoader variant="text" width="30%" height={20} />
        </div>
        {/* Stats row: three inline stats */}
        <div className={styles.statsRowSkeleton}>
          <SkeletonLoader variant="text" width="80px" height={20} />
          <span className={styles.separatorSkeleton} />
          <SkeletonLoader variant="text" width="80px" height={20} />
          <span className={styles.separatorSkeleton} />
          <SkeletonLoader variant="text" width="80px" height={20} />
        </div>
        {/* Metadata row: joined, target, completed */}
        <div className={styles.metadataRowSkeleton}>
          <SkeletonLoader variant="text" width="120px" height={16} />
          <span className={styles.separatorSkeleton} />
          <SkeletonLoader variant="text" width="140px" height={16} />
          <span className={styles.separatorSkeleton} />
          <SkeletonLoader variant="text" width="100px" height={16} />
        </div>
      </div>

      {/* Progress chart skeleton (matches ProgressChart) */}
      <div className={styles.chartSkeleton}>
        {/* Left metrics */}
        <div className={styles.metricsSkeleton}>
          <div className={styles.metricItemSkeleton}>
            <SkeletonLoader variant="text" width="60px" height={20} />
            <SkeletonLoader variant="text" width="80px" height={20} />
          </div>
          <div className={styles.metricItemSkeleton}>
            <SkeletonLoader variant="text" width="60px" height={20} />
            <SkeletonLoader variant="text" width="80px" height={20} />
          </div>
          <div className={styles.metricItemSkeleton}>
            <SkeletonLoader variant="text" width="60px" height={20} />
            <SkeletonLoader variant="text" width="80px" height={20} />
          </div>
        </div>
        {/* Right chart circle */}
        <SkeletonLoader variant="custom" width={260} height={260} className={styles.chartCircleSkeleton} />
      </div>

      {/* Questions section skeleton */}
      <div className={styles.questionsSkeleton}>
        <SkeletonLoader variant="text" width="150px" height={24} className={styles.sectionTitleSkeleton} />
        <div className={styles.questionListSkeleton}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.questionItemSkeleton}>
              <div className={styles.questionNodeSkeleton}>
                <SkeletonLoader variant="custom" width={10} height={10} className={styles.nodeDotSkeleton} />
              </div>
              <div className={styles.questionContentSkeleton}>
                <SkeletonLoader variant="text" width="70%" height={20} />
                <div className={styles.questionMetaSkeleton}>
                  <SkeletonLoader variant="text" width="60px" height={16} />
                  <SkeletonLoader variant="text" width="80px" height={16} />
                </div>
                <div className={styles.questionTagsSkeleton}>
                  <SkeletonLoader variant="text" width="50px" height={16} />
                  <SkeletonLoader variant="text" width="50px" height={16} />
                </div>
                <div className={styles.questionStatusSkeleton}>
                  <SkeletonLoader variant="text" width="80px" height={16} />
                  <SkeletonLoader variant="text" width="80px" height={16} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}