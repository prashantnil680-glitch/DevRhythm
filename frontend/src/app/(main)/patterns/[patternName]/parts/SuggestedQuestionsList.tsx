'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FiCheckCircle, FiHelpCircle, FiClock } from 'react-icons/fi';
import PlatformIcon from '@/shared/components/PlatformIcon';
import NoRecordFound from '@/shared/components/NoRecordFound';
import Pagination from '@/shared/components/Pagination';
import Tooltip from '@/shared/components/Tooltip';
import { usePatternQuestions } from '@/features/question';
import { formatDistanceToNow } from 'date-fns';
import { slugify } from '@/shared/lib/stringUtils';
import styles from './SuggestedQuestionsList.module.css';

interface SuggestedQuestionsListProps {
  patternSlug: string;
}

const formatSolvedDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
};

export default function SuggestedQuestionsList({ patternSlug }: SuggestedQuestionsListProps) {
  const [page, setPage] = useState(1);
  const limit = 15;
  const { data, isLoading, error } = usePatternQuestions(patternSlug, page, limit);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setTimeout(() => {
      const element = document.getElementById('suggested-questions-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  if (isLoading && !data) {
    return (
      <div id="suggested-questions-section" className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Suggested Questions</h3>
        </div>
        <div className={styles.list}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div id="suggested-questions-section" className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Suggested Questions</h3>
        </div>
        <NoRecordFound
          message="Unable to load suggested questions. Please try again later."
          icon={<FiHelpCircle size={48} />}
        />
      </div>
    );
  }

  const { questions, pagination, pattern } = data;
  const totalPages = pagination.pages;

  if (questions.length === 0) {
    return (
      <div id="suggested-questions-section" className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Suggested Questions</h3>
        </div>
        <NoRecordFound
          message={`No questions found for pattern "${pattern.name}".`}
          icon={<FiHelpCircle size={48} />}
        />
      </div>
    );
  }

  return (
    <div id="suggested-questions-section" className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          Suggested Questions
          <span className={styles.totalCount}>{pattern.totalQuestions} total</span>
        </h3>
      </div>

      <div className={styles.list}>
        {questions.map((q) => {
          const isSolved = q.userStatus === 'Solved' || q.userStatus === 'Mastered';
          const solvedDate = q.solvedAt ? formatSolvedDate(q.solvedAt) : null;

          return (
            <Link key={q._id} href={`/questions/${q.platformQuestionId}`} className={styles.rowLink}>
              <div className={styles.row}>
                {/* Dot indicator */}
                <div className={`${styles.dot} ${isSolved ? styles.dotSolved : ''}`} />

                {/* Content */}
                <div className={styles.content}>
                  <div className={styles.titleRow}>
                    <span className={styles.questionTitle}>{q.title}</span>
                    {isSolved && (
                      <Tooltip content={`Solved ${solvedDate || ''}`}>
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
                    {solvedDate && isSolved && (
                      <span className={styles.solvedDate}>
                        <FiClock size={10} /> {solvedDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className={styles.paginationWrapper}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            showFirstLast
            showPrevNext
            size="md"
          />
        </div>
      )}
    </div>
  );
}