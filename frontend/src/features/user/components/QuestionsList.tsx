'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiBookOpen, FiClock, FiRefreshCw, FiLock } from 'react-icons/fi';
import clsx from 'clsx';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { progressService } from '@/features/progress/services/progressService';
import { userService } from '@/features/user/services/userService';
import { userKeys, progressKeys } from '@/shared/lib/react-query';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import NoRecordFound from '@/shared/components/NoRecordFound';
import Tooltip from '@/shared/components/Tooltip';
import { slugify } from '@/shared/lib/stringUtils';
import type { PublicProgressItem, UserQuestionProgress } from '@/shared/types';
import styles from './QuestionsList.module.css';

export interface QuestionsListProps {
  userId?: string;
  isOwnProfile?: boolean;
  limit?: number;
  initialProgress?: PublicProgressItem[];
}

type ProgressItem = PublicProgressItem | UserQuestionProgress;

const safeParseDate = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

const formatShortRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffSeconds = (now.getTime() - date.getTime()) / 1000;
  const diffMinutes = diffSeconds / 60;
  const diffHours = diffMinutes / 60;
  const diffDays = diffHours / 24;

  if (diffSeconds < 60) return 'now';
  if (diffMinutes < 60) return `${Math.floor(diffMinutes)}m`;
  if (diffHours < 24) return `${Math.floor(diffHours)}h`;
  if (diffDays < 7) return `${Math.floor(diffDays)}d`;
  return format(date, 'MMM d'); // e.g., "May 27"
};

const formatTotalTime = (minutes: number): string => {
  const hours = minutes / 60;
  if (hours < 0.1) return '0h';
  return `${hours.toFixed(1)}h`;
};

const confidenceGlow = (level: number): React.CSSProperties => {
  const spread = level * 4;
  const size = level * 2;
  const opacity = 0.2 + level * 0.08;
  return {
    '--glow-spread': `${spread}px`,
    '--glow-size': `${size}px`,
    '--glow-opacity': opacity,
  } as React.CSSProperties;
};

const QuestionsList: React.FC<QuestionsListProps> = ({
  userId,
  isOwnProfile = false,
  limit = 6,
  initialProgress,
}) => {
  const queryKey = isOwnProfile
    ? progressKeys.list({ limit, status: 'Solved', sortBy: 'attempts.solvedAt', sortOrder: 'desc' })
    : userKeys.progress(userId!, { limit, sortBy: 'solvedAt', sortOrder: 'desc' });

  const queryFn = async (): Promise<ProgressItem[]> => {
    if (isOwnProfile) {
      const res = await progressService.getProgress({ limit, status: 'Solved', sortBy: 'attempts.solvedAt', sortOrder: 'desc' });
      return res.progress as ProgressItem[];
    } else {
      return userService.getUserPublicProgress(userId!, { limit, sortBy: 'solvedAt', sortOrder: 'desc' }) as Promise<ProgressItem[]>;
    }
  };

  const { data, isLoading, isFetching, error } = useQuery<ProgressItem[]>({
    queryKey,
    queryFn,
    enabled: (isOwnProfile ? true : !!userId) && !(initialProgress && !isOwnProfile),
    initialData: !isOwnProfile ? initialProgress : undefined,
    staleTime: 5 * 60 * 1000,
  });

  const showSkeleton = isLoading || (isFetching && !data);

  const getSolvedDate = React.useCallback(
    (item: ProgressItem): Date => {
      if (isOwnProfile) {
        const ownItem = item as UserQuestionProgress;
        const dateStr = ownItem.attempts?.solvedAt || ownItem.updatedAt;
        return safeParseDate(dateStr) || new Date(0);
      } else {
        const publicItem = item as PublicProgressItem;
        const dateStr = publicItem.solvedAt || publicItem.attempts?.lastAttemptAt;
        return safeParseDate(dateStr) || new Date(0);
      }
    },
    [isOwnProfile]
  );

  const sortedData = React.useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const dateA = getSolvedDate(a).getTime();
      const dateB = getSolvedDate(b).getTime();
      return dateB - dateA;
    });
  }, [data, getSolvedDate]);

  if (showSkeleton) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Recently Solved</h2>
          <span className={styles.viewAll}>loading…</span>
        </div>
        <div className={styles.timeline}>
          {Array.from({ length: limit }).map((_, i) => (
            <SkeletonLoader key={i} variant="custom" className={styles.skeletonItem} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !sortedData || sortedData.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Recently Solved</h2>
        </div>
        <NoRecordFound message="No solved questions yet. Solve your first problem to start your journey" icon={<FiBookOpen className={styles.emptyIcon} />} />
      </div>
    );
  }

  const items = sortedData.slice(0, limit);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Recently Solved</h2>
        <Link href="/questions" className={styles.viewAll}>
          View All →
        </Link>
      </div>
      <div className={styles.timeline}>
        {items.map((item, idx) => (
          <QuestionItem key={item._id} item={item} isOwnProfile={isOwnProfile} isLast={idx === items.length - 1} />
        ))}
      </div>
    </div>
  );
};

const QuestionItem: React.FC<{ item: ProgressItem; isOwnProfile: boolean; isLast: boolean }> = ({
  item,
  isOwnProfile,
  isLast,
}) => {
  const questionId = item.questionId;
  if (!questionId) return null;

  const status = item.status;
  const attempts = item.attempts;
  const revisionCount = item.revisionCount || 0;
  const totalTimeSpent = item.totalTimeSpent || 0;
  const confidenceLevel = item.confidenceLevel || 1;
  const { title, difficulty, pattern, tags, problemLink, platform, platformQuestionId } = questionId;

  let solvedDateStr: string | undefined;
  let lastActivityStr: string | undefined;
  if (isOwnProfile) {
    const ownItem = item as UserQuestionProgress;
    solvedDateStr = ownItem.attempts?.solvedAt;
    lastActivityStr = ownItem.attempts?.lastAttemptAt || ownItem.updatedAt;
  } else {
    const publicItem = item as PublicProgressItem;
    solvedDateStr = publicItem.solvedAt;
    lastActivityStr = publicItem.attempts?.lastAttemptAt || publicItem.solvedAt;
  }

  const solvedDate = safeParseDate(solvedDateStr) ?? safeParseDate(lastActivityStr) ?? new Date(0);
  const lastActivityDate = safeParseDate(lastActivityStr);
  const lastActivityDisplay = lastActivityDate
    ? formatShortRelativeTime(lastActivityDate)
    : 'unknown';

  const timeDisplay = formatTotalTime(totalTimeSpent);
  const difficultyClass = styles[difficulty.toLowerCase()];

  // Build clickable links
  const href = isOwnProfile ? `/questions/${platformQuestionId}` : problemLink;
  const target = isOwnProfile ? undefined : '_blank';
  const rel = isOwnProfile ? undefined : 'noopener noreferrer';

  // Tag slugs (generated on the fly)
  const tagsWithSlugs = tags.map(tag => ({ name: tag, slug: slugify(tag) }));

  // Platform filter link
  const platformFilterUrl = `/questions?platform=${encodeURIComponent(platform)}&page=1`;
  const difficultyFilterUrl = `/questions?page=1&difficulty=${difficulty}`;

  // Confidence glow style
  const glowStyle = confidenceGlow(confidenceLevel);

  return (
    <div className={styles.questionItem}>
      {/* Left column: dot + vertical line */}
      <div className={styles.leftColumn}>
        <div className={clsx(styles.nodeDot, styles.nodeGlow)} style={glowStyle} />
        {!isLast && <div className={styles.verticalLine} />}
      </div>

      {/* Right column: title + branch + details */}
      <div className={styles.rightColumn}>
        <div className={styles.titleRow}>
          <Link href={href} className={styles.questionTitle} target={target} rel={rel}>
            {title}
          </Link>
        </div>

        <div className={styles.branchRow}>
          <span className={styles.branchSymbol}>╰─</span>
          <div className={styles.branchContent}>
            <div className={styles.metadataRow}>
              <Link href={difficultyFilterUrl} className={styles.difficultyLink}>
                <span className={clsx(styles.difficulty, difficultyClass)}>{difficulty}</span>
              </Link>
              <Link href={platformFilterUrl} className={styles.platformLink}>
                <span className={styles.platform}>{platform}</span>
              </Link>
            </div>

            {/* Tags */}
            {tagsWithSlugs.length > 0 && (
              <div className={styles.tagsRow}>
                {tagsWithSlugs.map(({ name, slug }) => (
                  <Link
                    key={name}
                    href={`/patterns/${slug}`}
                    className={styles.tagLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    #{name}
                  </Link>
                ))}
              </div>
            )}

            {/* Status, metrics, notes */}
            <div className={styles.statusRow}>
              <span className={clsx(styles.statusIcon, styles.solved)}>✓ Solved</span>
              <span className={styles.statusIcon}>◯ Revision</span>
              <span className={styles.metricSeparator}>•</span>
              <Tooltip content={`Total time: ${totalTimeSpent} minutes`}>
                <span className={styles.metric}>
                  <FiClock className={styles.metricIcon} /> {timeDisplay}
                </span>
              </Tooltip>
              <span className={styles.metricSeparator}>•</span>
              <Tooltip content={`Attempts: ${attempts?.count || 0}`}>
                <span className={styles.metric}>
                  <span className={styles.metricIcon}>👣</span> {attempts?.count || 0} att
                </span>
              </Tooltip>
              <span className={styles.metricSeparator}>•</span>
              <Tooltip content={`Revisions: ${revisionCount}`}>
                <span className={styles.metric}>
                  <FiRefreshCw className={styles.metricIcon} /> {revisionCount} rev
                </span>
              </Tooltip>
              <span className={styles.metricSeparator}>•</span>
              <Tooltip content={lastActivityDate ? `Last activity: ${formatDistanceToNow(lastActivityDate, { addSuffix: true })}` : ''}>
                <span className={styles.metric}>
                  <FiClock className={styles.metricIcon} /> Last: {lastActivityDisplay}
                </span>
              </Tooltip>
            </div>

            {isOwnProfile && (item as UserQuestionProgress).notes && (
              <div className={styles.notes}>
                <span className={styles.notesIcon}>📓</span>
                <span className={styles.notesText}>
                  “{(item as UserQuestionProgress).notes!.slice(0, 80)}”
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionsList;