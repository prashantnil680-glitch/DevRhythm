'use client';

import { memo } from 'react';
import Link from 'next/link';
import { format, endOfDay, differenceInHours } from 'date-fns';
import { FiExternalLink } from 'react-icons/fi';
import Card from '@/shared/components/Card';
import Badge from '@/shared/components/Badge';
import Button from '@/shared/components/Button';
import type { DailyChallenge } from '@/features/dashboard';
import styles from './DailyChallengeCard.module.css';

interface DailyChallengeCardProps {
  dailyChallenge: DailyChallenge;
  isLoading?: boolean;
}

const getHoursLeftToday = (): number => {
  const now = new Date();
  const endOfToday = endOfDay(now);
  const hoursLeft = differenceInHours(endOfToday, now);
  return Math.max(0, hoursLeft);
};

function DailyChallengeCard({ dailyChallenge, isLoading }: DailyChallengeCardProps) {
  if (isLoading) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.skeletonContent} />
      </Card>
    );
  }

  if (!dailyChallenge) {
    return (
      <Card className={styles.container} noHover>
        <div className={styles.errorState}>Unable to load today&apos;s challenge</div>
      </Card>
    );
  }

  const formattedDate = dailyChallenge.date
    ? format(new Date(dailyChallenge.date), 'MMM d, yyyy')
    : '—';
  const internalLink = dailyChallenge.platformQuestionId
    ? `/questions/${dailyChallenge.platformQuestionId}`
    : '#';
  const isActive = dailyChallenge.isActive ?? false;
  const hoursLeft = getHoursLeftToday();
  const showTimeLeft = isActive && hoursLeft > 0;
  const baseTimeLeftText = showTimeLeft ? `${hoursLeft}h left` : 'Expired';

  let timeBadgeClass = styles.timeBadgeInfo;
  let timeLeftText = baseTimeLeftText;
  if (!showTimeLeft) {
    timeBadgeClass = styles.timeBadgeExpired;
  } else if (hoursLeft <= 1) {
    timeBadgeClass = styles.timeBadgeUrgent;
    timeLeftText = `⚠️ Hurry! ${hoursLeft}h left`;
  } else if (hoursLeft <= 6) {
    timeBadgeClass = styles.timeBadgeWarning;
    timeLeftText = `⚠️ ${hoursLeft}h left`;
  } else {
    timeBadgeClass = styles.timeBadgeInfo;
  }

  const difficulty =
    dailyChallenge.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard' | undefined;

  const status = dailyChallenge.status || 'Not Started';
  const statusVariant: 'default' | 'warning' | 'success' =
    status === 'Not Started'
      ? 'default'
      : status === 'Attempted'
      ? 'warning'
      : 'success';

  return (
    <Card className={styles.container} noHover>
      <div className={styles.topRow}>
        <div className={styles.podBadge}>
          <span>POD</span>
        </div>
        <div className={styles.dateBadge}>{formattedDate}</div>
      </div>

      <div className={styles.middleSection}>
        <div className={styles.titleSection}>
          <Link href={internalLink} className={styles.titleLink}>
            <h2 className={styles.problemTitle}>{dailyChallenge.title}</h2>
          </Link>
        </div>

        <div className={styles.infoBlock}>
          <div className={styles.infoRow}>
            <span className={timeBadgeClass}>{timeLeftText}</span>
            {difficulty && (
              <Badge variant={difficulty} size="sm">
                {dailyChallenge.difficulty}
              </Badge>
            )}
          </div>
          <div className={styles.divider} />
          <div className={styles.infoRow}>
            <Badge variant={statusVariant} size="sm">
              {status}
            </Badge>
          </div>
        </div>
      </div>

      <div className={styles.bottomRow}>
        <Button
          variant="outline"
          size="md"
          className={styles.leetcodeButton}
          onClick={() =>
            dailyChallenge.link && window.open(dailyChallenge.link, '_blank', 'noopener noreferrer')
          }
          disabled={!dailyChallenge.link}
        >
          Solve on LeetCode <FiExternalLink size={14} />
        </Button>
      </div>
    </Card>
  );
}

export default memo(DailyChallengeCard);