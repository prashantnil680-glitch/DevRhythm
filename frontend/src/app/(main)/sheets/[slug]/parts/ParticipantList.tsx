'use client';

import Link from 'next/link';
import { FiUsers, FiChevronRight } from 'react-icons/fi';
import { Avatar } from '@/shared/components/Avatar';
import { ROUTES } from '@/shared/config';
import styles from './ParticipantList.module.css';

interface Participant {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  totalQuestionsSolved: number;
}

interface ParticipantListProps {
  participants: Participant[];
  sheetSlug: string;
  isLoading?: boolean;
}

export default function ParticipantList({ participants, sheetSlug, isLoading }: ParticipantListProps) {
  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.skeletonRow} />
        <div className={styles.skeletonRow} />
        <div className={styles.skeletonRow} />
      </div>
    );
  }

  if (!participants.length) {
    return (
      <div className={styles.emptyState}>
        <FiUsers className={styles.emptyIcon} />
        <p>No participants yet. Be the first to join!</p>
      </div>
    );
  }

  const getRankClass = (rank: number): string => {
    if (rank === 1) return styles.rankGold;
    if (rank === 2) return styles.rankSilver;
    if (rank === 3) return styles.rankBronze;
    return '';
  };

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {participants.map((participant) => {
          const displayPrimary = participant.displayName && participant.displayName !== participant.username
            ? participant.displayName
            : participant.username;
          const displaySecondary = participant.displayName && participant.displayName !== participant.username
            ? participant.username
            : null;

          return (
            <Link
              key={participant.userId}
              href={ROUTES.SHEETS.PROGRESS(sheetSlug, participant.username)}
              className={styles.rowLink}
            >
              <div className={styles.row}>
                <div className={`${styles.rank} ${getRankClass(participant.rank)}`}>
                  <span className={styles.rankNumber}>#{participant.rank}</span>
                </div>
                <div className={styles.avatarWrapper}>
                  <Avatar
                    src={participant.avatarUrl}
                    name={displayPrimary}
                    size="md"
                  />
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.displayName}>{displayPrimary}</span>
                  {displaySecondary && (
                    <span className={styles.username}>@{displaySecondary}</span>
                  )}
                </div>
                <div className={styles.stats}>
                  <span className={styles.solvedCount}>
                    {participant.totalQuestionsSolved} Solved
                  </span>
                </div>
                <FiChevronRight className={styles.chevron} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}