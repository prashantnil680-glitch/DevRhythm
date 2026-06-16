'use client';

import { memo } from 'react';
import Link from 'next/link';
import Card from '@/shared/components/Card';
import Button from '@/shared/components/Button';
import { ROUTES } from '@/shared/config';
import type { WeakestPattern } from '@/features/dashboard';
import styles from './WeakestPatternInsight.module.css';

interface WeakestPatternInsightProps {
  pattern: WeakestPattern | null;
  isLoading?: boolean;
}

function WeakestPatternInsight({ pattern, isLoading }: WeakestPatternInsightProps) {
  // Determine the link URL based on pattern availability
  const viewAllLink = pattern ? `/patterns/${pattern.slug}` : '/patterns';

  if (isLoading) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Weakest Pattern Insight</h3>
          <div className={styles.skeletonViewLink} />
        </div>
        <div className={styles.skeletonContent}>
          <div className={styles.skeletonPattern} />
          <div className={styles.skeletonActions} />
        </div>
      </Card>
    );
  }

  if (!pattern) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.header}>
          <h3 className={styles.title}>Weakest Pattern Insight</h3>
          <Link href={viewAllLink} className={styles.viewAllLink}>
            View Pattern →
          </Link>
        </div>
        <div className={styles.emptyState}>
          <p>No pattern data available yet. Start solving problems to generate insights.</p>
        </div>
      </Card>
    );
  }

  const confidenceLevel = pattern.confidenceLevel;
  const masteryRate = Math.round(pattern.masteryRate);
  const solvedCount = pattern.solvedCount;
  const patternUrl = `/patterns/${pattern.slug}`;

  const confidenceDots = Array.from({ length: 5 }, (_, i) => i < confidenceLevel);

  return (
    <Card className={styles.container} noHover>
      <div className={styles.header}>
        <h3 className={styles.title}>Weakest Pattern Insight</h3>
        <Link href={patternUrl} className={styles.viewAllLink}>
          View Pattern →
        </Link>
      </div>

      <div className={styles.cardInner}>
        <div className={styles.leftSection}>
          <Link href={patternUrl} className={styles.patternNameLink}>
            <h2 className={styles.patternName}>{pattern.patternName}</h2>
          </Link>
        </div>

        <div className={styles.rightSection}>
          <div className={styles.confidenceWrapper}>
            <div className={styles.confidenceDots}>
              {confidenceDots.map((filled, idx) => (
                <span
                  key={idx}
                  className={`${styles.dot} ${filled ? styles.dotFilled : styles.dotEmpty}`}
                />
              ))}
            </div>
            <span className={styles.confidenceLabel}>{confidenceLevel}/5 Confidence</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.metricsRow}>
            <div className={styles.metricItem}>
              <span className={styles.metricValue}>{masteryRate}%</span>
              <span className={styles.metricLabel}>Mastery Rate</span>
            </div>
            <span className={styles.metricPipe}>|</span>
            <div className={styles.metricItem}>
              <span className={styles.metricValue}>{solvedCount}</span>
              <span className={styles.metricLabel}>Question Solve</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default memo(WeakestPatternInsight);