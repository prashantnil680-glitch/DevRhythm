'use client';

import SkeletonLoader from '@/shared/components/SkeletonLoader';
import styles from './CreateSheetSkeleton.module.css';

export default function CreateSheetSkeleton() {
  return (
    <div className={styles.container}>
      {/* Tabs placeholder */}
      <div className={styles.tabsSkeleton}>
        <SkeletonLoader variant="text" width="100px" height={40} />
        <SkeletonLoader variant="text" width="100px" height={40} />
      </div>

      {/* Two‑column layout (matching ManualTab) */}
      <div className={styles.columns}>
        {/* Left Panel – Sheet Details */}
        <div className={styles.leftPanel}>
          <div className={styles.card}>
            <SkeletonLoader variant="text" width="60%" height={28} className={styles.panelTitleSkeleton} />

            {/* Name field */}
            <div className={styles.field}>
              <SkeletonLoader variant="text" width="30%" height={16} />
              <SkeletonLoader variant="text" width="100%" height={40} />
            </div>

            {/* Description field */}
            <div className={styles.field}>
              <SkeletonLoader variant="text" width="30%" height={16} />
              <SkeletonLoader variant="text" width="100%" height={80} />
            </div>

            {/* Target Date field */}
            <div className={styles.field}>
              <SkeletonLoader variant="text" width="30%" height={16} />
              <SkeletonLoader variant="text" width="100%" height={40} />
            </div>

            {/* Special Tag field */}
            <div className={styles.field}>
              <SkeletonLoader variant="text" width="30%" height={16} />
              <SkeletonLoader variant="text" width="100%" height={40} />
            </div>

            {/* Original Source Name field */}
            <div className={styles.field}>
              <SkeletonLoader variant="text" width="30%" height={16} />
              <SkeletonLoader variant="text" width="100%" height={40} />
            </div>

            {/* Original Source URL field */}
            <div className={styles.field}>
              <SkeletonLoader variant="text" width="30%" height={16} />
              <SkeletonLoader variant="text" width="100%" height={40} />
            </div>
          </div>
        </div>

        {/* Right Panel – Questions */}
        <div className={styles.rightPanel}>
          <div className={styles.card}>
            <SkeletonLoader variant="text" width="40%" height={28} className={styles.panelTitleSkeleton} />

            {/* Search bar placeholder */}
            <div className={styles.searchSkeleton}>
              <SkeletonLoader variant="text" width="100%" height={40} />
            </div>

            {/* Selected questions list placeholder */}
            <div className={styles.selectedSkeleton}>
              <SkeletonLoader variant="text" width="30%" height={20} />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={styles.selectedItemSkeleton}>
                  <SkeletonLoader variant="text" width="80%" height={24} />
                  <SkeletonLoader variant="custom" width={24} height={24} className={styles.removeBtnSkeleton} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className={styles.actions}>
        <SkeletonLoader variant="custom" width={100} height={40} />
        <SkeletonLoader variant="custom" width={120} height={40} />
      </div>
    </div>
  );
}