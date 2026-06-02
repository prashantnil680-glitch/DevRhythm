'use client';

import Link from 'next/link';
import { FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import clsx from 'clsx';
import Badge from '@/shared/components/Badge';
import Tooltip from '@/shared/components/Tooltip';
import type { UserProgress } from '@/features/sheets';
import styles from './UserQuestionList.module.css';

interface UserQuestionListProps {
  progress: UserProgress['progress'];
}

export default function UserQuestionList({ progress }: UserQuestionListProps) {
  if (!progress || progress.length === 0) {
    return <div className={styles.emptyState}>No questions in this sheet.</div>;
  }

  return (
    <div className={styles.container}>
      {progress.map((item, idx) => {
        const { question, solved, revisionCompleted, lastUpdated } = item;
        if (!question) return null;

        return (
          <div key={question._id} className={styles.questionItem}>
            <div className={styles.questionNode}>
              <div className={clsx(styles.nodeDot, solved && styles.nodeSolved)} />
            </div>
            <div className={styles.questionContent}>
              <div className={styles.questionHeader}>
                <Link
                  href={`/questions/${question.platformQuestionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.questionTitle}
                >
                  {question.title}
                </Link>
                <div className={styles.questionMeta}>
                  <Badge
                    variant={question.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'}
                    size="sm"
                  >
                    {question.difficulty}
                  </Badge>
                  <span className={styles.platform}>{question.platform}</span>
                </div>
              </div>
              {question.tags && question.tags.length > 0 && (
                <div className={styles.questionTags}>
                  {question.tags.slice(0, 3).map(tag => (
                    <span key={tag} className={styles.tag}>#{tag}</span>
                  ))}
                  {question.tags.length > 3 && (
                    <Tooltip content={question.tags.slice(3).join(', ')}>
                      <span className={styles.tag}>+{question.tags.length - 3}</span>
                    </Tooltip>
                  )}
                </div>
              )}
              <div className={styles.statusRow}>
                <div className={styles.statusIcon}>
                  {solved ? (
                    <FiCheckCircle className={styles.solvedIcon} />
                  ) : (
                    <span className={styles.notSolved}>❌ Not solved</span>
                  )}
                  <span className={styles.statusLabel}>Solved</span>
                </div>
                <div className={styles.statusIcon}>
                  {revisionCompleted ? (
                    <FiRefreshCw className={styles.revisionIcon} />
                  ) : (
                    <span className={styles.notRevised}>🔄 Not revised</span>
                  )}
                  <span className={styles.statusLabel}>Revision</span>
                </div>
                {/* {lastUpdated && (
                  <div className={styles.lastUpdated}>
                    Last updated: {new Date(lastUpdated).toLocaleDateString()}
                  </div>
                )} */}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}