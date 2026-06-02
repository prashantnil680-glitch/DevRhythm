'use client';

import React from 'react';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import EmptyState from '@/shared/components/EmptyState';
import { FiInbox } from 'react-icons/fi';
import { QuestionCard } from '@/app/(main)/questions/parts/QuestionCard';
import type { Question } from '@/shared/types';
import styles from './QuestionList.module.css';

interface QuestionListProps {
  questions: Question[];
  isLoading?: boolean;
}

export const QuestionList: React.FC<QuestionListProps> = ({ questions, isLoading }) => {
  if (isLoading) {
    return (
      <div className={styles.list}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonLoader key={i} variant="custom" className={styles.skeletonItem} />
        ))}
      </div>
    );
  }

  if (!questions.length) {
    return (
      <EmptyState
        title="No questions found"
        description="Try adjusting your filters or create a new question."
        icon={<FiInbox />}
      />
    );
  }

  return (
    <div className={styles.list}>
      {questions.map(question => (
        <QuestionCard key={question._id} question={question} />
      ))}
    </div>
  );
};