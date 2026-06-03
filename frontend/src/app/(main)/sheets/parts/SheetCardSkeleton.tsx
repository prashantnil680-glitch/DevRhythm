import SkeletonLoader from '@/shared/components/SkeletonLoader';
import styles from './SheetCard.module.css';

export default function SheetCardSkeleton() {
  return (
    <div className={styles.card}>
      <div className={styles.cardContent}>
        {/* Top row: title + button */}
        <div className={styles.topRow}>
          <SkeletonLoader variant="text" width="60%" height={24} />
          <div className={styles.actionGroup}>
            <SkeletonLoader variant="custom" width={64} height={32} />
            <SkeletonLoader variant="custom" width={44} height={26} />
          </div>
        </div>
        {/* Owner + date row */}
        <div className={styles.ownerRow}>
          <div className={styles.ownerAvatarWrapper}>
            <SkeletonLoader variant="custom" width={24} height={24} className={styles.ownerAvatar} />
            <SkeletonLoader variant="text" width={80} height={16} />
          </div>
          <span className={styles.separator}>•</span>
          <SkeletonLoader variant="text" width={100} height={16} />
        </div>
        {/* Description (2 lines) */}
        <div className={styles.description}>
          <SkeletonLoader variant="text" width="100%" height={16} />
          <SkeletonLoader variant="text" width="80%" height={16} style={{ marginTop: '0.25rem' }} />
        </div>
        {/* Metadata row: participants, tag, source */}
        <div className={styles.metadataRow}>
          <div className={styles.participantGroup}>
            <SkeletonLoader variant="custom" width={12} height={12} />
            <SkeletonLoader variant="text" width={80} height={16} />
            <div className={styles.avatarGroup}>
              {[1, 2, 3].map(i => (
                <SkeletonLoader key={i} variant="custom" width={24} height={24} className={styles.avatarSkeleton} />
              ))}
            </div>
          </div>
          <SkeletonLoader variant="text" width={60} height={20} className={styles.tagSkeleton} />
          <SkeletonLoader variant="text" width={80} height={20} className={styles.sourceSkeleton} />
        </div>
      </div>
    </div>
  );
}