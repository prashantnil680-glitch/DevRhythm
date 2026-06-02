'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { FiCalendar, FiClock, FiCheckCircle, FiShare2, FiBookmark, FiLogIn } from 'react-icons/fi';
import { FaBookmark } from 'react-icons/fa';
import { Avatar } from '@/shared/components/Avatar';
import Button from '@/shared/components/Button';
import Tooltip from '@/shared/components/Tooltip';
import { toast } from '@/shared/components/Toast';
import { useUser } from '@/features/user';
import { ROUTES } from '@/shared/config';
import type { UserProgress } from '@/features/sheets';
import styles from './UserProgressHeader.module.css';

interface UserProgressHeaderProps {
  username: string;
  sheetSlug: string;
  sheetName: string;
  joinedAt: string;
  targetDate: string;
  completedAt: string | null;
  isFullyCompleted: boolean;
  stats: UserProgress['stats'];
  shareLink: string;
  // Bookmark & Join props
  isAuthenticated: boolean;
  hasJoinedSheet: boolean;
  isBookmarked: boolean;
  bookmarkCount: number;
  onToggleBookmark: () => void;
  onJoinSheet: () => void;
  isJoining?: boolean;
  isBookmarkPending?: boolean;
}

export default function UserProgressHeader({
  username,
  sheetSlug,
  sheetName,
  joinedAt,
  targetDate,
  completedAt,
  isFullyCompleted,
  stats,
  shareLink,
  isAuthenticated,
  hasJoinedSheet,
  isBookmarked,
  bookmarkCount,
  onToggleBookmark,
  onJoinSheet,
  isJoining = false,
  isBookmarkPending = false,
}: UserProgressHeaderProps) {
  const { user: currentUser } = useUser();
  const isOwnProfile = currentUser?.username === username;

  const targetDateObj = new Date(targetDate);
  const isOverdue = targetDateObj < new Date();
  const daysLeft = Math.ceil((targetDateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success('Progress link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const solvedPercentage = stats.totalQuestions
    ? (stats.solvedCount / stats.totalQuestions) * 100
    : 0;
  const revisionPercentage = stats.totalQuestions
    ? (stats.revisionCompletedCount / stats.totalQuestions) * 100
    : 0;
  const overallPercentage = (solvedPercentage + revisionPercentage) / 2;

  const profileUrl = isOwnProfile
    ? ROUTES.USER_PROFILE.OWN(username)
    : ROUTES.USER_PROFILE.PUBLIC(username);

  return (
    <div className={styles.header}>
      {/* Top row: sheet name + share + bookmark + join */}
      <div className={styles.topRow}>
        <h1 className={styles.sheetName}>{sheetName}</h1>
        <div className={styles.actionButtons}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            leftIcon={<FiShare2 />}
            className={styles.shareButton}
          >
            Share Progress
          </Button>
          {isAuthenticated && (
            <Tooltip content={isBookmarked ? 'Remove bookmark' : 'Bookmark this sheet'}>
              <button
                onClick={onToggleBookmark}
                disabled={isBookmarkPending}
                className={`${styles.bookmarkButton} ${isBookmarked ? styles.bookmarked : ''}`}
                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this sheet'}
              >
                {isBookmarked ? <FaBookmark /> : <FiBookmark />}
                {bookmarkCount > 0 && <span className={styles.bookmarkCount}>{bookmarkCount}</span>}
              </button>
            </Tooltip>
          )}
          {isAuthenticated && !hasJoinedSheet && (
            <Button
              variant="primary"
              size="sm"
              onClick={onJoinSheet}
              isLoading={isJoining}
              leftIcon={<FiLogIn />}
            >
              Join Sheet
            </Button>
          )}
        </div>
      </div>

      {/* User row: avatar + name + profile link */}
      <div className={styles.userRow}>
        <Link href={profileUrl} className={styles.userLink}>
          <Avatar name={username} size="sm" className={styles.userAvatar} />
          <span className={styles.username}>@{username}</span>
        </Link>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <span className={styles.stat}>
          {stats.solvedCount}/{stats.totalQuestions} solved
        </span>
        <span className={styles.separator}>•</span>
        <span className={styles.stat}>
          {stats.revisionCompletedCount}/{stats.totalQuestions} revised
        </span>
        <span className={styles.separator}>•</span>
        <span className={styles.stat}>{Math.round(overallPercentage)}% overall</span>
      </div>

      {/* Metadata row */}
      <div className={styles.metadataRow}>
        <span className={styles.metaItem}>
          <FiCalendar className={styles.metaIcon} />
          Joined {format(new Date(joinedAt), 'MMM d, yyyy')}
        </span>
        <span className={styles.separator}>•</span>
        <span className={styles.metaItem}>
          <FiClock className={styles.metaIcon} />
          Target {format(targetDateObj, 'MMM d, yyyy')}
          {isOverdue && <span className={styles.overdueBadge}>Overdue</span>}
          {!isOverdue && daysLeft >= 0 && (
            <span className={styles.daysLeft}>
              ({daysLeft === 0 ? 'Due today' : `${daysLeft} days left`})
            </span>
          )}
        </span>
        {(completedAt || isFullyCompleted) && (
          <>
            <span className={styles.separator}>•</span>
            <span className={styles.metaItem}>
              <FiCheckCircle className={styles.metaIcon} />
              {completedAt
                ? `Completed ${format(new Date(completedAt), 'MMM d, yyyy')}`
                : 'Fully completed!'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}