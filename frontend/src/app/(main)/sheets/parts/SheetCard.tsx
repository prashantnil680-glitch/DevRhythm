'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { FiUsers, FiCalendar, FiExternalLink, FiTag, FiBookmark, FiLogIn } from 'react-icons/fi';
import { FaBookmark } from 'react-icons/fa';
import clsx from 'clsx';
import Card from '@/shared/components/Card';
import Button from '@/shared/components/Button';
import { Avatar } from '@/shared/components/Avatar';
import Badge from '@/shared/components/Badge';
import Tooltip from '@/shared/components/Tooltip';
import { ROUTES } from '@/shared/config';
import type { SheetWithStats } from '@/features/sheets';
import styles from './SheetCard.module.css';

interface SheetCardProps {
  sheet: SheetWithStats;
  isOwner: boolean;
  isJoined: boolean;
  onJoin: () => void;
  onToggleBookmark: () => void;
  isAuthenticated: boolean;
  isBookmarkPending?: boolean;
  className?: string;
}

export default function SheetCard({
  sheet,
  isOwner,
  isJoined,
  onJoin,
  onToggleBookmark,
  isAuthenticated,
  isBookmarkPending = false,
  className,
}: SheetCardProps) {
  const {
    name,
    description,
    ownerId,
    ownerDisplayName,
    createdAt,
    participantCount,
    participants,
    slug,
    specialTag,
    originalSourceName,
    originalSourceUrl,
    bookmarkCount,
    isBookmarked,
  } = sheet;

  const formattedDate = format(new Date(createdAt), 'MMM d, yyyy');

  const ownerName = ownerDisplayName || 'Anonymous User';
  const displayName = ownerDisplayName || ownerName;

  let ownerAvatar: string | undefined;
  if (ownerDisplayName && participants.length) {
    const matchedParticipant = participants.find(p =>
      p.displayName === ownerDisplayName || p.username === ownerDisplayName
    );
    ownerAvatar = matchedParticipant?.avatarUrl;
  }

  const otherParticipants = participants;
  const displayParticipants = participants.slice(0, 4);
  const remainingCount = Math.max(0, participantCount - 4);

  const showViewButton = isOwner || isJoined;
  const buttonText = showViewButton ? 'View' : 'Join';
  const buttonVariant = showViewButton ? 'outline' : 'primary';
  const buttonIcon = buttonText === 'Join' ? <FiLogIn /> : undefined;

  const handleAction = () => {
    if (showViewButton) {
      window.location.href = ROUTES.SHEETS.DETAIL(slug);
    } else {
      onJoin();
    }
  };

  const hasParticipants = participants.length > 0;
  const hasTag = !!specialTag;
  const hasSource = !!originalSourceName;
  const showMetadata = hasParticipants || hasTag || hasSource;

  const participantText = participantCount === 1
    ? '1 participant joined this sheet'
    : `${participantCount} participants joined this sheet`;

  return (
    <Card className={clsx(styles.card, className)} noHover>
      <div className={styles.cardContent}>
        {/* Top row: title + action buttons */}
        <div className={styles.topRow}>
          <h3 className={styles.sheetTitle}>
            <Link href={ROUTES.SHEETS.DETAIL(slug)} className={styles.titleLink}>
              {name}
            </Link>
          </h3>
          <div className={styles.actionGroup}>
            <Button
              variant={buttonVariant}
              size="sm"
              onClick={handleAction}
              className={styles.actionButton}
              leftIcon={buttonIcon}
            >
              {buttonText}
            </Button>
            {isAuthenticated && (
              <Tooltip content={isBookmarked ? 'Remove bookmark' : 'Bookmark this sheet'}>
                <button
                  onClick={onToggleBookmark}
                  disabled={isBookmarkPending}
                  className={clsx(styles.bookmarkButton, isBookmarked && styles.bookmarked)}
                  aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                >
                  {isBookmarked ? <FaBookmark /> : <FiBookmark />}
                  {bookmarkCount > 0 && <span className={styles.bookmarkCount}>{bookmarkCount}</span>}
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Owner + date row */}
        <div className={styles.ownerRow}>
          {ownerName !== 'Anonymous User' ? (
            <Link
              href={ROUTES.SHEETS.PROGRESS(slug, ownerName)}
              className={styles.ownerLink}
              title={`View ${ownerName}'s progress`}
            >
              <Avatar src={ownerAvatar} name={ownerName} size="xs" className={styles.ownerAvatar} />
              <span className={styles.ownerName}>{ownerName}</span>
            </Link>
          ) : (
            <div className={styles.ownerAvatarWrapper}>
              <Avatar src={ownerAvatar} name={ownerName} size="xs" className={styles.ownerAvatar} />
              <span className={styles.ownerName}>{ownerName}</span>
            </div>
          )}
          <span className={styles.separator}>•</span>
          <span>
            <FiCalendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
            {formattedDate}
          </span>
        </div>

        {/* Description */}
        {description && <p className={styles.description}>{description}</p>}

        {/* Metadata row (participants, tag, source) */}
        {showMetadata && (
          <div className={styles.metadataRow}>
            {/* Participant avatars + count text */}
            {hasParticipants && (
              <div className={styles.participantGroup}>
                <FiUsers size={12} className={styles.participantIcon} />
                <span className={styles.participantText}>{participantText}</span>
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
                  {remainingCount > 0 && <span className={styles.extraCount}>+{remainingCount}</span>}
                </div>
              </div>
            )}

            {/* Special tag */}
            {hasTag && (
              <Badge variant="info" size="sm" className={styles.specialTag}>
                <FiTag className={styles.tagIcon} />
                {specialTag}
              </Badge>
            )}

            {/* Source badge */}
            {hasSource && (
              <div className={styles.sourceBadge}>
                <span>Source:</span>
                {originalSourceUrl ? (
                  <a
                    href={originalSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.sourceLink}
                  >
                    {originalSourceName}
                    <FiExternalLink size={10} style={{ marginLeft: '0.25rem' }} />
                  </a>
                ) : (
                  <span>{originalSourceName}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}