'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { FaCheckCircle } from 'react-icons/fa';
import PlatformIcon from '@/shared/components/PlatformIcon';
import Tooltip from '@/shared/components/Tooltip';
import type { Question } from '@/shared/types';
import styles from './QuestionCard.module.css';

interface QuestionCardProps {
  question: Question;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClick = () => {
    const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    sessionStorage.setItem('lastQuestionsListUrl', currentUrl);
  };

  const displayedTags = question.tags.slice(0, 3);
  const remainingTags = question.tags.slice(3);

  return (
    <Link href={`/questions/${question.platformQuestionId}`} className={styles.rowLink} onClick={handleClick}>
      <div className={styles.row}>
        {/* Dot indicator */}
        <div className={clsx(styles.dot, question.isSolved && styles.dotSolved)} />

        <div className={styles.content}>
          {/* First line: title */}
          <div className={styles.titleRow}>
            <span className={styles.title}>{question.title}</span>
          </div>

          {/* Second line: metadata */}
          <div className={styles.metadataRow}>
            <span className={clsx(styles.difficulty, styles[question.difficulty.toLowerCase()])}>
              {question.difficulty}
            </span>

            <span className={styles.platform}>
              <PlatformIcon platform={question.platform} size="sm" />
              {question.platform}
            </span>

            {displayedTags.map(tag => (
              <span key={tag} className={styles.tag}>#{tag}</span>
            ))}
            {remainingTags.length > 0 && (
              <Tooltip content={remainingTags.join(', ')}>
                <span className={styles.tagMore}>+{remainingTags.length}</span>
              </Tooltip>
            )}

            {question.isSolved && (
              <span className={styles.solvedBadge}>
                <FaCheckCircle /> Solved
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};