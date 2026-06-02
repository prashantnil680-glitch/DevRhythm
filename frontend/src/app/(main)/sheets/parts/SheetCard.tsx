'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { FiUsers, FiCalendar, FiExternalLink, FiTag } from 'react-icons/fi';
import clsx from 'clsx';
import Card from '@/shared/components/Card';
import Button from '@/shared/components/Button';
import { Avatar } from '@/shared/components/Avatar';
import Badge from '@/shared/components/Badge';
import { ROUTES } from '@/shared/config';
import type { SheetWithStats } from '@/features/sheets';
import styles from './SheetCard.module.css';

interface SheetCardProps {
  sheet: SheetWithStats;
  isOwner: boolean;
  isJoined: boolean;
  onJoin: () => void;
  className?: string;
}

export default function SheetCard({ sheet, isOwner, isJoined, onJoin, className }: SheetCardProps) {
  const {
    name,
    description,
    ownerId,
    createdAt,
    participantCount,
    participants,
    slug,
    specialTag,
    originalSourceName,
    originalSourceUrl,
  } = sheet;

  const formattedDate = format(new Date(createdAt), 'MMM d, yyyy');

  const ownerParticipant = participants.find(p => p.userId === ownerId);
  const ownerName = ownerParticipant?.username || 'Anonymous User';
  const displayName = ownerParticipant?.displayName || ownerName;
  const ownerAvatar = ownerParticipant?.avatarUrl;

  // Exclude owner from participant display to avoid duplication (owner is already shown separately)
  const otherParticipants = participants.filter(p => p.userId !== ownerId);
  const displayParticipants = otherParticipants.slice(0, 4);
  const remainingCount = Math.max(0, participantCount - 1 - 4); // subtract owner and shown ones

  const showViewButton = isOwner || isJoined;
  const buttonText = showViewButton ? 'View' : 'Join';
  const buttonVariant = showViewButton ? 'outline' : 'primary';

  const handleAction = () => {
    if (showViewButton) {
      window.location.href = ROUTES.SHEETS.DETAIL(slug);
    } else {
      onJoin();
    }
  };

  // Determine if metadata row should be shown (any of participants, tag, source)
  const hasParticipants = otherParticipants.length > 0;
  const hasTag = !!specialTag;
  const hasSource = !!originalSourceName;
  const showMetadata = hasParticipants || hasTag || hasSource;

  return (
    <Card className={clsx(styles.card, className)} noHover>
      <div className={styles.cardContent}>
        {/* Top row: title + action */}
        <div className={styles.topRow}>
          <h3 className={styles.sheetTitle}>
            <Link href={ROUTES.SHEETS.DETAIL(slug)} className={styles.titleLink}>
              {name}
            </Link>
          </h3>
          <Button
            variant={buttonVariant}
            size="sm"
            onClick={handleAction}
            className={styles.actionButton}
          >
            {buttonText}
          </Button>
        </div>

        {/* Owner + date row (always shown) */}
        <div className={styles.ownerRow}>
          {ownerName !== 'Anonymous User' ? (
            <Link
              href={ROUTES.SHEETS.PROGRESS(slug, ownerName)}
              className={styles.ownerLink}
              title={`View ${ownerName}'s progress`}
            >
              <Avatar src={ownerAvatar} name={ownerName} size="xs" className={styles.ownerAvatar} />
              <span className={styles.ownerName}>{displayName}</span>
            </Link>
          ) : (
            <div className={styles.ownerAvatarWrapper}>
              <Avatar src={ownerAvatar} name={ownerName} size="xs" className={styles.ownerAvatar} />
              <span className={styles.ownerName}>{displayName}</span>
            </div>
          )}
          <span className={styles.separator}>•</span>
          <span>
            <FiCalendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
            {formattedDate}
          </span>
        </div>

        {/* Description – only if present */}
        {description && <p className={styles.description}>{description}</p>}

        {/* Metadata row – only if at least one of participants, tag, source exists */}
        {showMetadata && (
          <div className={styles.metadataRow}>
            {/* Participant avatars – only if there are participants besides owner */}
            {hasParticipants && (
              <div className={styles.participantGroup}>
                <FiUsers size={12} style={{ marginRight: '0.25rem' }} />
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