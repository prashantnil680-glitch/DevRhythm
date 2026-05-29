'use client';

import React from 'react';
import Link from 'next/link';
import { FiBookOpen } from 'react-icons/fi';
import { useMediaQuery } from '@/shared/hooks';
import PlatformIcon from '@/shared/components/PlatformIcon';
import type { Question } from '@/shared/types';
import styles from './SimilarQuestionsGrid.module.css';

interface SimilarQuestionsGridProps {
  questions: Question[];
  viewAllHref: string; 
}

export const SimilarQuestionsGrid: React.FC<SimilarQuestionsGridProps> = ({
  questions,
  viewAllHref,
}) => {
  const isDesktop = useMediaQuery('(min-width: 940px)');
  const isTablet = useMediaQuery('(min-width: 768px)') && !isDesktop;
  const cardWidth = isDesktop ? 'auto' : isTablet ? 280 : 200;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>
          <FiBookOpen className={styles.headerIcon} />
          Similar Questions
        </h3>
        <Link href={viewAllHref} className={styles.viewAll}>
          View all questions →
        </Link>
      </div>
      <div
        className={isDesktop ? styles.grid : styles.horizontalScroll}
        style={!isDesktop ? { gridAutoColumns: `${cardWidth}px` } : undefined}
      >
        {questions.map(q => (
          <Link
            key={q._id}
            href={`/questions/${q.platformQuestionId}`}
            className={styles.cardLink}
          >
            <div className={styles.card}>
              <div className={styles.title}>{q.title}</div>
              <div className={styles.meta}>
                <span className={`${styles.difficulty} ${styles[q.difficulty.toLowerCase()]}`}>
                  {q.difficulty}
                </span>
                <span className={styles.platform}>
                  <PlatformIcon platform={q.platform} size="sm" /> {q.platform}
                </span>
              </div>
              <div className={styles.tags}>
                {q.tags.slice(0, 2).map(tag => (
                  <span key={tag} className={styles.tag}>
                    #{tag}
                  </span>
                ))}
                {q.tags.length > 2 && <span className={styles.tag}>+{q.tags.length - 2}</span>}
              </div>
              {q.pattern && q.pattern[0] && (
                <div className={styles.pattern}>Pattern: {q.pattern[0]}</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};