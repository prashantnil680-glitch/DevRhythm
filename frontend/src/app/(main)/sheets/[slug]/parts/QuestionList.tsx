'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { FiCheckCircle, FiRefreshCw, FiUsers, FiLock } from 'react-icons/fi';
import clsx from 'clsx';
import Badge from '@/shared/components/Badge';
import { ROUTES } from '@/shared/config';
import type { SheetQuestion, UserProgressDetail } from '@/features/sheets';
import styles from './QuestionList.module.css';

interface QuestionListProps {
  questions: SheetQuestion[];
  perQuestionParticipantCounts: Record<string, number>;
  perQuestionSolvedCounts: Record<string, number>;
  userProgressDetails?: UserProgressDetail[];
  isJoined: boolean;
}

interface QuestionItemProps {
  question: SheetQuestion;
  idx: number;
  isLast: boolean;
  isJoined: boolean;
  isSolved: boolean;
  isRevisionCompleted: boolean;
  participantCount: number;
  solvedCount: number;
}

const QuestionItem = React.memo(function QuestionItem({
  question,
  idx,
  isLast,
  isJoined,
  isSolved,
  isRevisionCompleted,
  participantCount,
  solvedCount,
}: QuestionItemProps) {
  const platformFilterUrl = `/questions?platform=${encodeURIComponent(question.platform)}&page=1`;
  const difficultyFilterUrl = `/questions?page=1&difficulty=${question.difficulty}`;

  return (
    <div className={styles.questionItem}>
      {/* Left column: dot and vertical line */}
      <div className={styles.leftColumn}>
        <div className={clsx(styles.nodeDot, isSolved && styles.nodeSolved)} />
        {!isLast && <div className={styles.verticalLine} />}
      </div>

      {/* Right column: title + branch + details */}
      <div className={styles.rightColumn}>
        {/* Title row */}
        <div className={styles.titleRow}>
          <Link
            href={`/questions/${question.platformQuestionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.questionTitle}
          >
            {question.title}
          </Link>
        </div>

        {/* Branch line with metadata, tags, status */}
        <div className={styles.branchRow}>
          <span className={styles.branchSymbol}>╰─</span>
          <div className={styles.branchContent}>
            <div className={styles.metadataRow}>
              <Link href={difficultyFilterUrl} className={styles.difficultyLink}>
                <Badge
                  variant={question.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'}
                  size="sm"
                >
                  {question.difficulty}
                </Badge>
              </Link>
              <Link href={platformFilterUrl} className={styles.platformLink}>
                <span className={styles.platform}>{question.platform}</span>
              </Link>
            </div>

            {/* Tags */}
            {question.tags && question.tags.length > 0 && (
              <div className={styles.questionTags}>
                {question.tags.map((tag, tagIdx) => {
                  const slug = question.tagsSlugs?.[tagIdx] || '';
                  return (
                    <Link
                      key={tag}
                      href={ROUTES.PATTERNS.DETAIL(slug)}
                      className={styles.tagLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      #{tag}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Status row */}
            <div className={styles.statusRow}>
              {isJoined ? (
                <div className={styles.userStatus}>
                  <span className={clsx(styles.statusIcon, isSolved && styles.solved)}>
                    {isSolved ? '✓' : '◯'} Solved
                  </span>
                  <span className={clsx(styles.statusIcon, isRevisionCompleted && styles.revised)}>
                    {isRevisionCompleted ? '✓' : '◯'} Revision
                  </span>
                </div>
              ) : (
                <div className={styles.notJoined}>
                  <FiLock className={styles.lockIcon} />
                  <span>Join to track progress</span>
                </div>
              )}
              <div className={styles.participantStats}>
                <FiUsers className={styles.usersIcon} />
                <span>{solvedCount} / {participantCount} participants solved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function QuestionList({
  questions,
  perQuestionParticipantCounts,
  perQuestionSolvedCounts,
  userProgressDetails,
  isJoined,
}: QuestionListProps) {
  const progressMap = useMemo(() => {
    const map = new Map<string, { solved: boolean; revisionCompleted: boolean }>();
    if (userProgressDetails) {
      userProgressDetails.forEach(p => {
        map.set(p.questionId.toString(), {
          solved: p.solved,
          revisionCompleted: p.revisionCompleted,
        });
      });
    }
    return map;
  }, [userProgressDetails]);

  return (
    <div className={styles.container}>
      {questions.map((question, idx) => {
        const questionId = question._id.toString();
        const progress = progressMap.get(questionId);
        const isSolved = progress?.solved || false;
        const isRevisionCompleted = progress?.revisionCompleted || false;
        const participantCount = perQuestionParticipantCounts[questionId] || 0;
        const solvedCount = perQuestionSolvedCounts[questionId] || 0;
        const isLast = idx === questions.length - 1;

        return (
          <QuestionItem
            key={question._id}
            question={question}
            idx={idx}
            isLast={isLast}
            isJoined={isJoined}
            isSolved={isSolved}
            isRevisionCompleted={isRevisionCompleted}
            participantCount={participantCount}
            solvedCount={solvedCount}
          />
        );
      })}
    </div>
  );
}

export default React.memo(QuestionList);