'use client';

import React from 'react';
import Link from 'next/link';
import { FiBookOpen, FiCheckCircle } from 'react-icons/fi';
import PlatformIcon from '@/shared/components/PlatformIcon';
import Tooltip from '@/shared/components/Tooltip';
import { slugify } from '@/shared/lib/stringUtils';
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
  if (!questions.length) return null;

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

      <div className={styles.list}>
        {questions.map((q) => {
          const isSolved = q.isSolved === true;
          return (
            <Link
              key={q._id}
              href={`/questions/${q.platformQuestionId}`}
              className={styles.rowLink}
            >
              <div className={styles.row}>
                {/* Dot indicator */}
                <div className={`${styles.dot} ${isSolved ? styles.dotSolved : ''}`} />

                {/* Content */}
                <div className={styles.content}>
                  <div className={styles.titleRow}>
                    <span className={styles.questionTitle}>{q.title}</span>
                    {isSolved && (
                      <Tooltip content="Solved">
                        <span className={styles.solvedBadge}>
                          <FiCheckCircle size={12} /> Solved
                        </span>
                      </Tooltip>
                    )}
                  </div>
                  <div className={styles.metadataRow}>
                    <span className={`${styles.difficulty} ${styles[q.difficulty.toLowerCase()]}`}>
                      {q.difficulty}
                    </span>
                    <span className={styles.platform}>
                      <PlatformIcon platform={q.platform} size="sm" />
                      {q.platform}
                    </span>
                    {q.tags &&
                      q.tags.slice(0, 3).map((tag) => {
                        const slug = slugify(tag);
                        return (
                          <Link
                            key={tag}
                            href={`/patterns/${slug}`}
                            className={styles.tag}
                            onClick={(e) => e.stopPropagation()}
                          >
                            #{tag}
                          </Link>
                        );
                      })}
                    {q.tags && q.tags.length > 3 && (
                      <Tooltip content={q.tags.slice(3).join(', ')}>
                        <span className={styles.tagMore}>+{q.tags.length - 3}</span>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};