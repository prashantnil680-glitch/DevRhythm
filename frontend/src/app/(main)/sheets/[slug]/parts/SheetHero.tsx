'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  FiUsers,
  FiCalendar,
  FiEdit2,
  FiTrash2,
  FiLogOut,
  FiLogIn,
  FiClock,
  FiMoreVertical,
  FiBookmark,
  FiBookOpen,
} from 'react-icons/fi';
import { FaBookmark } from 'react-icons/fa';
import { Avatar } from '@/shared/components/Avatar';
import Button from '@/shared/components/Button';
import Badge from '@/shared/components/Badge';
import Tooltip from '@/shared/components/Tooltip';
import { ROUTES } from '@/shared/config';
import type { Sheet, Participant } from '@/features/sheets';
import styles from './SheetHero.module.css';

interface SheetHeroProps {
  sheet: Sheet;
  participants: Participant[];
  totalParticipants: number;
  hasJoined: boolean;
  isOwner: boolean;
  targetDate?: string;
  isAuthenticated: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onUpdateTargetDate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleBookmark: () => void;
  isBookmarkPending?: boolean;
}

export default function SheetHero({
  sheet,
  participants,
  totalParticipants,
  hasJoined,
  isOwner,
  targetDate,
  isAuthenticated,
  onJoin,
  onLeave,
  onUpdateTargetDate,
  onEdit,
  onDelete,
  onToggleBookmark,
  isBookmarkPending = false,
}: SheetHeroProps) {
  const [showMenu, setShowMenu] = useState(false);

  const {
    name,
    description,
    ownerId,
    createdAt,
    specialTag,
    originalSourceName,
    originalSourceUrl,
    slug,
    bookmarkCount,
    isBookmarked,
    totalQuestions,
  } = sheet;

  const formattedCreatedAt = format(new Date(createdAt), 'MMM d, yyyy');

  const ownerParticipant = participants.find(p => p.userId === ownerId);
  const ownerName = ownerParticipant?.username || 'Anonymous User';
  const ownerAvatar = ownerParticipant?.avatarUrl;
  const ownerDisplayName = ownerParticipant?.displayName || ownerName;

  const otherParticipants = participants.filter(p => p.userId !== ownerId);
  const otherParticipantsCount = otherParticipants.length;
  const displayParticipants = otherParticipants.slice(0, 4);
  const remainingParticipants = otherParticipantsCount - displayParticipants.length;

  const targetDateObj = targetDate ? new Date(targetDate) : null;
  const isOverdue = targetDateObj && targetDateObj < new Date();
  const daysLeft = targetDateObj
    ? Math.ceil((targetDateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const toggleMenu = () => setShowMenu(prev => !prev);
  const closeMenu = () => setShowMenu(false);

  const handleMenuAction = (callback: () => void) => {
    callback();
    closeMenu();
  };

  return (
    <div className={styles.hero}>
      {/* Top row: title + bookmark + primary actions + kebab menu */}
      <div className={styles.topRow}>
        <h1 className={styles.title}>{name}</h1>
        <div className={styles.actions}>
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
          {!hasJoined && !isOwner && (
            <Button variant="primary" size="sm" onClick={onJoin} leftIcon={<FiLogIn />}>
              Join
            </Button>
          )}
          {hasJoined && !isOwner && (
            <Button variant="outline" size="sm" onClick={onLeave} leftIcon={<FiLogOut />}>
              Leave
            </Button>
          )}
          {(isOwner || hasJoined) && (
            <div className={styles.menuWrapper}>
              <button className={styles.kebabButton} onClick={toggleMenu} aria-label="More actions">
                <FiMoreVertical />
              </button>
              {showMenu && (
                <div className={styles.menuDropdown}>
                  {isOwner && (
                    <>
                      <button onClick={() => handleMenuAction(onEdit)} className={styles.menuItem}>
                        <FiEdit2 /> Edit Sheet
                      </button>
                      <button onClick={() => handleMenuAction(onDelete)} className={styles.menuItem}>
                        <FiTrash2 /> Delete Sheet
                      </button>
                    </>
                  )}
                  {hasJoined && !isOwner && (
                    <button onClick={() => handleMenuAction(onLeave)} className={styles.menuItem}>
                      <FiLogOut /> Leave Sheet
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metadata row (owner, date, tags, source, total questions) */}
      <div className={styles.metadataRow}>
        <div className={styles.ownerInfo}>
          {ownerName !== 'Anonymous User' ? (
            <Link href={ROUTES.SHEETS.PROGRESS(slug, ownerName)} className={styles.ownerLink}>
              <Avatar src={ownerAvatar} name={ownerDisplayName} size="xs" className={styles.ownerAvatar} />
              <span>{ownerDisplayName}</span>
            </Link>
          ) : (
            <div className={styles.ownerInfo}>
              <Avatar src={ownerAvatar} name={ownerDisplayName} size="xs" className={styles.ownerAvatar} />
              <span>{ownerDisplayName}</span>
            </div>
          )}
        </div>
        <span className={styles.separator}>•</span>
        <span className={styles.date}>
          <FiCalendar size={12} /> {formattedCreatedAt}
        </span>
        {specialTag && (
          <>
            <span className={styles.separator}>•</span>
            <Badge variant="info" size="sm" className={styles.specialTag}>
              {specialTag}
            </Badge>
          </>
        )}
        {originalSourceName && (
          <>
            <span className={styles.separator}>•</span>
            <div className={styles.sourceBadge}>
              <span>Source:</span>
              {originalSourceUrl ? (
                <a href={originalSourceUrl} target="_blank" rel="noopener noreferrer">
                  {originalSourceName}
                </a>
              ) : (
                <span>{originalSourceName}</span>
              )}
            </div>
          </>
        )}
        <span className={styles.separator}>•</span>
        <span className={styles.totalQuestionsMeta}>
          <FiBookOpen size={14} className={styles.metaIcon} />
          <strong>{totalQuestions}</strong> questions
        </span>
      </div>

      {/* Description (optional) */}
      {description && <p className={styles.description}>{description}</p>}

      {/* Bottom row: participants + target date */}
      <div className={styles.bottomRow}>
        {otherParticipantsCount > 0 && (
          <div className={styles.participants}>
            <FiUsers className={styles.participantsIcon} />
            <span className={styles.participantCount}>
              {otherParticipantsCount} participant{otherParticipantsCount !== 1 && 's'}
            </span>
            <div className={styles.avatarGroup}>
              {displayParticipants.map((p, idx) => (
                <Link
                  key={p.userId}
                  href={ROUTES.SHEETS.PROGRESS(slug, p.username)}
                  className={styles.avatarLink}
                  title={`View ${p.username}'s progress`}
                >
                  <Avatar src={p.avatarUrl} name={p.username} size="xs" />
                </Link>
              ))}
              {remainingParticipants > 0 && <span className={styles.extraCount}>+{remainingParticipants}</span>}
            </div>
          </div>
        )}

        {hasJoined && targetDate && (
          <div className={styles.targetDateWrapper}>
            <FiClock className={styles.targetIcon} />
            <span className={styles.targetDate}>
              Target: {format(new Date(targetDate), 'MMM d, yyyy')}
            </span>
            {isOverdue && <Badge variant="error" size="sm">Overdue</Badge>}
            {daysLeft !== null && daysLeft >= 0 && !isOverdue && (
              <Badge variant="success" size="sm">{daysLeft} days left</Badge>
            )}
            <button onClick={onUpdateTargetDate} className={styles.updateTargetBtn} title="Update target date">
              <FiEdit2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}