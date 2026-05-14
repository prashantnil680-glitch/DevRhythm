'use client';

import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { formatDistanceToNow, format } from 'date-fns';
import {
  FiCheckCircle,
  FiStar,
  FiUsers,
  FiTarget,
  FiAward,
  FiActivity,
} from 'react-icons/fi';
import { useRecentActivity } from '../hooks/useRecentActivity';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import NoRecordFound from '@/shared/components/NoRecordFound';
import styles from './RecentActivitySection.module.css';

export interface RecentActivitySectionProps {
  userId?: string;
  isOwnProfile?: boolean;
  limit?: number;
  className?: string;
}

const formatActivity = (log: any): { icon: React.ReactNode; message: string; link?: string } => {
  const { action, metadata, targetId } = log;

  switch (action) {
    case 'question_solved':
    case 'question_mastered': {
      let link: string | undefined;
      if (targetId && typeof targetId !== 'string') {
        if (targetId.platform && targetId.platformQuestionId) {
          link = `/questions/${targetId.platformQuestionId}`;
        } else if (targetId._id) {
          link = `/questions`;
        }
      }
      return {
        icon: action === 'question_mastered' ? <FiStar className={styles.icon} /> : <FiCheckCircle className={styles.icon} />,
        message: `${action === 'question_mastered' ? 'Mastered' : 'Solved'} “${metadata?.title || 'a problem'}” (${metadata?.difficulty || '?'}) · ${metadata?.platform || 'Unknown'}`,
        link,
      };
    }
    case 'joined_group':
      return {
        icon: <FiUsers className={styles.icon} />,
        message: `Joined group “${metadata?.groupName || 'a group'}”`,
        link: targetId?._id ? `/groups/${targetId._id}` : undefined,
      };
    case 'group_goal_progress':
      return {
        icon: <FiTarget className={styles.icon} />,
        message: `Made progress on goal (${metadata?.newProgress || 0}/${metadata?.target || '?'})`,
        link: metadata?.groupId ? `/groups/${metadata.groupId}` : undefined,
      };
    case 'group_challenge_progress':
      return {
        icon: <FiAward className={styles.icon} />,
        message: `Advanced in challenge (${metadata?.newProgress || 0}%)`,
        link: metadata?.groupId ? `/groups/${metadata.groupId}` : undefined,
      };
    default:
      return {
        icon: <FiActivity className={styles.icon} />,
        message: `Performed action: ${action}`,
        link: undefined,
      };
  }
};

const formatTime = (timestamp: string): string => {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return 'some time ago';
  }
};

const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  userId,
  isOwnProfile = false,
  limit = 5,
  className,
}) => {
  const { data, isLoading, error } = useRecentActivity(userId, isOwnProfile, limit);

  if (!isOwnProfile) return null;

  if (isLoading) {
    return (
      <div className={clsx(styles.container, className)}>
        <div className={styles.header}>
          <h2 className={styles.title}>Recent Activity</h2>
          <SkeletonLoader variant="text" width={80} height={24} />
        </div>
        <div className={styles.list}>
          {[...Array(3)].map((_, i) => (
            <SkeletonLoader key={i} variant="custom" className={styles.skeletonItem} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx(styles.container, styles.error, className)}>
        <p>Could not load recent activity</p>
      </div>
    );
  }

  const logs = data ?? [];

  if (logs.length === 0) {
    return (
      <div className={clsx(styles.container, styles.empty, className)}>
        <div className={styles.header}>
          <h2 className={styles.title}>Recent Activity</h2>
          <Link href="/activity" className={styles.viewall}>
            View All →
          </Link>
        </div>
        <NoRecordFound
          message="No recent activity yet. Start solving problems to see your journey!"
          icon={<FiActivity className={styles.emptyIcon} />}
        />
      </div>
    );
  }

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <h2 className={styles.title}>Recent Activity</h2>
        <Link href="/activity" className={styles.viewall}>
          View All →
        </Link>
      </div>
      <div className={styles.list}>
        {logs.slice(0, limit).map((log) => {
          const { icon, message, link } = formatActivity(log);
          const time = formatTime(log.timestamp);
          const dateUrl = `/activity/${format(new Date(log.timestamp), 'yyyy-MM-dd')}`;

          const content = (
            <div className={styles.item}>
              <div className={styles.itemIcon}>{icon}</div>
              <div className={styles.itemContent}>
                <span className={styles.message}>{message}</span>
                <Link href={dateUrl} className={styles.dateLink}>
                  {time}
                </Link>
              </div>
            </div>
          );

          if (link) {
            return (
              <Link key={log._id} href={link} className={styles.itemLink}>
                {content}
              </Link>
            );
          }

          return (
            <div key={log._id} className={styles.itemWrapper}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentActivitySection;