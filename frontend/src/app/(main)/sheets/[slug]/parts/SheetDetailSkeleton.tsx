'use client';

import SkeletonLoader from '@/shared/components/SkeletonLoader';
import styles from './SheetDetailSkeleton.module.css';

export default function SheetDetailSkeleton() {
  return (
    <div className={styles.container}>
      {/* Hero section skeleton (matches redesigned SheetHero) */}
      <div className={styles.heroSkeleton}>
        <div className={styles.topRowSkeleton}>
          <SkeletonLoader variant="text" width="60%" height={32} />
          <SkeletonLoader variant="custom" width={32} height={32} className={styles.kebabSkeleton} />
        </div>
        <div className={styles.metadataRowSkeleton}>
          <div className={styles.ownerSkeleton}>
            <SkeletonLoader variant="custom" width={24} height={24} className={styles.avatarSkeleton} />
            <SkeletonLoader variant="text" width="100px" height={16} />
          </div>
          <span className={styles.separatorSkeleton} />
          <SkeletonLoader variant="text" width="120px" height={16} />
          <span className={styles.separatorSkeleton} />
          <SkeletonLoader variant="text" width="80px" height={16} />
          <span className={styles.separatorSkeleton} />
          <SkeletonLoader variant="text" width="100px" height={16} />
        </div>
        <SkeletonLoader variant="text" width="80%" height={40} className={styles.descriptionSkeleton} />
        <div className={styles.bottomRowSkeleton}>
          <div className={styles.participantsSkeleton}>
            <SkeletonLoader variant="custom" width={16} height={16} />
            <SkeletonLoader variant="text" width="100px" height={16} />
            <div className={styles.avatarGroupSkeleton}>
              <SkeletonLoader variant="custom" width={24} height={24} className={styles.avatarSkeleton} />
              <SkeletonLoader variant="custom" width={24} height={24} className={styles.avatarSkeleton} />
              <SkeletonLoader variant="custom" width={24} height={24} className={styles.avatarSkeleton} />
            </div>
          </div>
          <div className={styles.targetDateSkeleton}>
            <SkeletonLoader variant="custom" width={16} height={16} />
            <SkeletonLoader variant="text" width="140px" height={16} />
            <SkeletonLoader variant="custom" width={16} height={16} />
          </div>
        </div>
      </div>

      {/* Progress chart skeleton (two columns) */}
      <div className={styles.chartSkeleton}>
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
        <SkeletonLoader variant="custom" width={260} height={260} className={styles.chartCircleSkeleton} />
      </div>

      {/* Questions section skeleton with header and timeline list */}
      <div className={styles.questionsSectionSkeleton}>
        <div className={styles.sectionHeaderSkeleton}>
          <SkeletonLoader variant="text" width="120px" height={24} />
          <SkeletonLoader variant="text" width="80px" height={20} className={styles.viewAllSkeleton} />
        </div>
        <div className={styles.timelineSkeleton}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.questionItemSkeleton}>
              <div className={styles.leftColumnSkeleton}>
                <SkeletonLoader variant="custom" width={12} height={12} className={styles.nodeDotSkeleton} />
                {i < 3 && <div className={styles.verticalLineSkeleton} />}
              </div>
              <div className={styles.rightColumnSkeleton}>
                <SkeletonLoader variant="text" width="60%" height={20} className={styles.titleSkeleton} />
                <div className={styles.branchRowSkeleton}>
                  <span className={styles.branchSymbolSkeleton}>╰─</span>
                  <div className={styles.branchContentSkeleton}>
                    <div className={styles.metadataRowSkeleton}>
                      <SkeletonLoader variant="text" width="50px" height={20} />
                      <SkeletonLoader variant="text" width="80px" height={16} />
                    </div>
                    <div className={styles.tagsSkeleton}>
                      <SkeletonLoader variant="text" width="60px" height={16} />
                      <SkeletonLoader variant="text" width="70px" height={16} />
                    </div>
                    <div className={styles.statusRowSkeleton}>
                      <SkeletonLoader variant="text" width="80px" height={16} />
                      <SkeletonLoader variant="text" width="80px" height={16} />
                      <SkeletonLoader variant="text" width="140px" height={16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Participants section skeleton */}
      <div className={styles.participantsSectionSkeleton}>
        <SkeletonLoader variant="text" width="150px" height={24} className={styles.sectionTitleSkeleton} />
        <div className={styles.participantsGridSkeleton}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.participantCardSkeleton}>
              <SkeletonLoader variant="custom" width={40} height={40} className={styles.avatarSkeleton} />
              <div className={styles.participantInfoSkeleton}>
                <SkeletonLoader variant="text" width="100px" height={16} />
                <SkeletonLoader variant="text" width="80px" height={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}