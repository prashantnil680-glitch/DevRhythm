'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiBookOpen, FiClock, FiRefreshCw } from 'react-icons/fi';
import clsx from 'clsx';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

import { progressService } from '@/features/progress/services/progressService';
import { userService } from '@/features/user/services/userService';
import { userKeys, progressKeys } from '@/shared/lib/react-query';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import NoRecordFound from '@/shared/components/NoRecordFound';
import Tooltip from '@/shared/components/Tooltip';
import { formatDateForDisplay } from '@/shared/lib/dateUtils';
import { truncate } from '@/shared/lib/stringUtils';
import type { PublicProgressItem, UserQuestionProgress } from '@/shared/types';

import styles from './QuestionsList.module.css';

export interface QuestionsListProps {
  userId?: string;
  isOwnProfile?: boolean;
  limit?: number;
  initialProgress?: PublicProgressItem[]; // server‑fetched data for public profiles
}

type ProgressItem = PublicProgressItem | UserQuestionProgress;

const safeParseDate = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

const formatShortRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = (now.getTime() - date.getTime()) / 1000;
  const diffInMinutes = diffInSeconds / 60;
  const diffInHours = diffInMinutes / 60;
  const diffInDays = diffInHours / 24;
  const diffInMonths = diffInDays / 30;
  const diffInYears = diffInDays / 365;

  if (diffInSeconds < 60) return 'now';
  if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m`;
  if (diffInHours < 24) return `${Math.floor(diffInHours)}h`;
  if (diffInDays < 7) return `${Math.floor(diffInDays)}d`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w`;
  if (diffInMonths < 12) return `${Math.floor(diffInMonths)}mo`;
  return `${Math.floor(diffInYears)}y`;
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
    ? progressKeys.list({
        limit,
        status: 'Solved',
        sortBy: 'attempts.solvedAt',
        sortOrder: 'desc',
      })
    : userKeys.progress(userId!, { limit, sortBy: 'solvedAt', sortOrder: 'desc' });

  const queryFn = async (): Promise<ProgressItem[]> => {
    if (isOwnProfile) {
      const res = await progressService.getProgress({
        limit,
        status: 'Solved',
        sortBy: 'attempts.solvedAt',
        sortOrder: 'desc',
      });
      return res.progress as ProgressItem[];
    } else {
      return userService.getUserPublicProgress(userId!, {
        limit,
        sortBy: 'solvedAt',
        sortOrder: 'desc',
      }) as Promise<ProgressItem[]>;
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
          <h2 className={styles.title}>The path of solved</h2>
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
          <h2 className={styles.title}>The path of solved</h2>
        </div>
        <NoRecordFound
          message="No ascents yet. Ready to plant your flag?"
          icon={<FiBookOpen className={styles.emptyIcon} />}
        />
      </div>
    );
  }

  const items = sortedData.slice(0, limit);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>The path of solved</h2>
        <Link
          href={`/questions`}
          className={styles.viewAll}
        >
          View All →
        </Link>
      </div>
      <div className={styles.timeline}>
        {items.map((item) => (
          <QuestionItem key={item._id} item={item} isOwnProfile={isOwnProfile} />
        ))}
      </div>
    </div>
  );
};

const QuestionItem: React.FC<{ item: ProgressItem; isOwnProfile: boolean }> = ({
  item,
  isOwnProfile,
}) => {
  const questionId = item.questionId;
  if (!questionId) return null;
  const status = item.status;
  const attempts = item.attempts;
  const revisionCount = item.revisionCount || 0;
  const totalTimeSpent = item.totalTimeSpent || 0;
  const confidenceLevel = item.confidenceLevel || 1;
  const {
    title,
    difficulty,
    pattern,
    tags,
    problemLink,
    platform,
    platformQuestionId,
  } = questionId;

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

  const difficultyClass = styles[difficulty.toLowerCase()];
  const timeDisplay =
    totalTimeSpent < 60 ? `${totalTimeSpent}m` : `${Math.round(totalTimeSpent / 60)}h`;
  const revisionShort = lastActivityDate ? formatShortRelativeTime(lastActivityDate) : 'N/A';
  const revisionFull = lastActivityDate
    ? formatDistanceToNow(lastActivityDate, { addSuffix: true })
    : 'N/A';

  const displayedTags = tags.slice(0, 2);
  const remainingTags = tags.length - 2;

  // Build internal link using platform and platformQuestionId (slug) for own profile
  const href = isOwnProfile
    ? `/questions/${platformQuestionId}`
    : problemLink;
  const target = isOwnProfile ? undefined : '_blank';
  const rel = isOwnProfile ? undefined : 'noopener noreferrer';

  return (
    <div className={styles.item}>
      <div className={clsx(styles.node, styles.nodeGlow)} style={confidenceGlow(confidenceLevel)} />
      <div className={styles.date}>
        {solvedDate ? formatDateForDisplay(solvedDate) : 'Date unknown'}
      </div>
      <div className={styles.titleLine}>
        <span className={styles.connector}>╰─</span>
        {/* <Tooltip content={problemLink}> */}
          <Link href={href} className={styles.titleLink} target={target} rel={rel}>
            {title}
          </Link>
        {/* </Tooltip> */}
        <span className={styles.status}>{status}</span>
      </div>
      <div className={styles.meta}>
        <span className={clsx(styles.difficulty, difficultyClass)}>{difficulty}</span>
        {pattern && <span className={styles.pattern}>· {pattern}</span>}
      </div>
      <div className={styles.tagsRow}>
        {displayedTags.map((tag) => (
          <span key={tag} className={styles.tag}>
            #{tag}
          </span>
        ))}
        {remainingTags > 0 && (
          <Tooltip content={tags.slice(2).join(', ')}>
            <span className={styles.tag}>+{remainingTags}</span>
          </Tooltip>
        )}
      </div>
      <div className={styles.metricsRow}>
        <Tooltip content={`Total time spent: ${totalTimeSpent} minutes`}>
          <span className={styles.metric}>
            <FiClock className={styles.metricIcon} /> {timeDisplay}
          </span>
        </Tooltip>
        <Tooltip content={`Attempts: ${attempts?.count || 0}`}>
          <span className={styles.metric}>
            <span className={styles.metricIcon}>👣</span> {attempts?.count || 0} att
          </span>
        </Tooltip>
        <Tooltip content={`Revisions: ${revisionCount}`}>
          <span className={styles.metric}>
            <span className={styles.metricIcon}>↻</span> {revisionCount} rev
          </span>
        </Tooltip>
        <Tooltip content={`Last activity: ${revisionFull}`}>
          <span className={styles.metric}>
            <FiRefreshCw className={styles.metricIcon} /> {revisionShort}
          </span>
        </Tooltip>
      </div>
      {isOwnProfile && (item as UserQuestionProgress).notes && (
        <div className={styles.notes}>
          <span className={styles.notesIcon}>📓</span>
          <span className={styles.notesText}>
            “{truncate((item as UserQuestionProgress).notes!, 50)}”
          </span>
        </div>
      )}
    </div>
  );
};

export default QuestionsList;