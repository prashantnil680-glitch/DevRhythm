'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  FiCheckCircle,
  FiStar,
  FiRefreshCw,
  FiTarget,
  FiUsers,
  FiBell,
  FiCheck,
  FiTrash2,
} from 'react-icons/fi';
import type { Notification } from '@/shared/types';
import styles from './NotificationCard.module.css';

export interface NotificationCardProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  isMarking?: boolean;
  isDeleting?: boolean;
  index?: number;
}

// Helper to get icon and type-specific class for hover color
const getNotificationIconAndType = (type: Notification['type']) => {
  switch (type) {
    case 'question_solved':
      return { icon: <FiCheckCircle className={styles.icon} />, typeClass: styles.typeSolved };
    case 'question_mastered':
      return { icon: <FiStar className={styles.icon} />, typeClass: styles.typeMastered };
    case 'revision_completed':
    case 'revision_reminder_daily':
    case 'revision_reminder_urgent':
      return { icon: <FiRefreshCw className={styles.icon} />, typeClass: styles.typeRevision };
    case 'goal_completion':
      return { icon: <FiTarget className={styles.icon} />, typeClass: styles.typeGoal };
    case 'new_follower':
      return { icon: <FiUsers className={styles.icon} />, typeClass: styles.typeFollower };
    default:
      return { icon: <FiBell className={styles.icon} />, typeClass: styles.typeDefault };
  }
};

const formatTime = (timestamp: string): string => {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return '';
  }
};

const getNotificationLink = (notification: Notification): string | null => {
  const { type, data } = notification;

  switch (type) {
    case 'question_solved':
    case 'question_mastered':
    case 'revision_completed':
    case 'pod_solved':
    case 'pod_available':
      if (data?.platformQuestionId) {
        return `/questions/${data.platformQuestionId}`;
      }
      if (data?.questionId && typeof data.questionId === 'string') {
        return `/questions/${data.questionId}`;
      }
      return null;

    case 'new_follower':
      if (data?.followerUsername) {
        return `/user/${data.followerUsername}`;
      }
      if (data?.username) {
        return `/user/${data.username}`;
      }
      return null;

    case 'goal_completion':
      if (data?.goalId) {
        return `/goals/${data.goalId}`;
      }
      return '/goals';

    default:
      return null;
  }
};

export const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onMarkRead,
  onDelete,
  isMarking = false,
  isDeleting = false,
  index = 0,
}) => {
  const router = useRouter();
  const isUnread = !notification.readAt;
  const timeAgo = formatTime(notification.createdAt);
  const { icon, typeClass } = getNotificationIconAndType(notification.type);
  const link = getNotificationLink(notification);

  const handleCardClick = () => {
    if (link) {
      router.push(link);
    }
    if (isUnread && !isMarking) {
      onMarkRead(notification._id);
    }
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead(notification._id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(notification._id);
  };

  return (
    <div
      className={`${styles.card} ${isUnread ? styles.unread : ''}`}
      style={{ animationDelay: `${index * 0.04}s` }}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div
        className={`${styles.unreadDot} ${
          isUnread ? styles.unreadDotFilled : styles.unreadDotEmpty
        }`}
      />
      <div className={`${styles.iconColumn} ${typeClass}`}>{icon}</div>
      <div className={styles.contentColumn}>
        <div className={styles.title}>{notification.title}</div>
        <div className={styles.message}>{notification.message}</div>
        <div className={styles.timestamp}>{timeAgo}</div>
      </div>
      <div className={styles.actions}>
        <button
          className={`${styles.actionButton} ${styles.markReadButton}`}
          onClick={handleMarkRead}
          disabled={!isUnread || isMarking}
          title={isUnread ? 'Mark as read' : 'Mark as unread'}
          aria-label={isUnread ? 'Mark as read' : 'Mark as unread'}
        >
          <FiCheck />
        </button>
        <button
          className={`${styles.actionButton} ${styles.deleteButton}`}
          onClick={handleDelete}
          disabled={isDeleting}
          title="Delete"
          aria-label="Delete notification"
        >
          <FiTrash2 />
        </button>
      </div>
    </div>
  );
};

export default NotificationCard;