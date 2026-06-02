'use client';

import SkeletonLoader from '@/shared/components/SkeletonLoader';
import styles from './SheetsSkeleton.module.css';

interface SheetsSkeletonProps {
  count?: number;
}

export default function SheetsSkeleton({ count = 5 }: SheetsSkeletonProps) {
  return (
    <div className={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={styles.skeletonCard}>
          {/* Top row: title + action button */}
          <div className={styles.topRowSkeleton}>
            <SkeletonLoader variant="text" width="60%" height={24} />
            <SkeletonLoader variant="custom" width={80} height={32} />
          </div>

          {/* Owner + date row */}
          <div className={styles.ownerRowSkeleton}>
            <div className={styles.ownerInfoSkeleton}>
              <SkeletonLoader variant="custom" width={24} height={24} className={styles.avatarSkeleton} />
              <SkeletonLoader variant="text" width="100px" height={16} />
            </div>
            <span className={styles.separatorSkeleton} />
            <SkeletonLoader variant="text" width="120px" height={16} />
          </div>

          {/* Description (2 lines) */}
          <div className={styles.descriptionSkeleton}>
            <SkeletonLoader variant="text" width="100%" height={16} />
            <SkeletonLoader variant="text" width="80%" height={16} />
          </div>

          {/* Metadata row: participants, tag, source */}
          <div className={styles.metadataRowSkeleton}>
            <div className={styles.participantsSkeleton}>
              <SkeletonLoader variant="custom" width={16} height={16} />
              <div className={styles.avatarGroupSkeleton}>
                <SkeletonLoader variant="custom" width={24} height={24} className={styles.avatarSkeleton} />
                <SkeletonLoader variant="custom" width={24} height={24} className={styles.avatarSkeleton} />
                <SkeletonLoader variant="custom" width={24} height={24} className={styles.avatarSkeleton} />
              </div>
            </div>
            <SkeletonLoader variant="text" width="60px" height={20} className={styles.tagSkeleton} />
            <SkeletonLoader variant="text" width="80px" height={20} className={styles.sourceSkeleton} />
          </div>
        </div>
      ))}
    </div>
  );
}