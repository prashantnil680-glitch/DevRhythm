'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import Card from '@/shared/components/Card';
import { Avatar } from '@/shared/components/Avatar';
import Badge from '@/shared/components/Badge';
import PlatformIcon from '@/shared/components/PlatformIcon';
import Tooltip from '@/shared/components/Tooltip';
import { useSocialFeed } from '@/features/activity/hooks/useActivityData';
import styles from './SocialFeed.module.css';

export default function SocialFeed() {
  const { data, isLoading, error } = useSocialFeed({ limit: 10 });

  if (isLoading) {
    return (
      <Card className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Social Feed</h3>
        </div>
        <div className={styles.skeletonList}>
          <div className={styles.skeletonUser}>
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonName} />
              <div className={styles.skeletonItem} />
              <div className={styles.skeletonItem} />
            </div>
          </div>
          <div className={styles.skeletonUser}>
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonName} />
              <div className={styles.skeletonItem} />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (error || !data?.users || Object.keys(data.users).length === 0) {
    return (
      <Card className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Social Feed</h3>
        </div>
        <div className={styles.emptyState}>
          <Tooltip content={error?.message || 'No activity from followed users today'}>
            <span>📭 No activity from followed users today</span>
          </Tooltip>
        </div>
      </Card>
    );
  }

  const formatTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const formatTimeSpent = (minutes: number) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const users = Object.values(data.users);

  return (
    <Card className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Social Feed</h3>
      </div>

      <div className={styles.feedList}>
        {users.map((user) => (
          <div key={user.userInfo._id} className={styles.userGroup}>
            <div className={styles.userHeader}>
              <Link href={`/user/${user.userInfo.username}`} className={styles.userLink}>
                <Avatar
                  src={user.userInfo.avatarUrl}
                  name={user.userInfo.displayName}
                  size="sm"
                />
                <div className={styles.userInfo}>
                  <span className={styles.displayName}>{user.userInfo.displayName}</span>
                  <span className={styles.username}>@{user.userInfo.username}</span>
                </div>
              </Link>
            </div>

            <div className={styles.timeline}>
              {user.solvedToday.map((item, idx) => (
                <div key={item._id} className={styles.timelineItem}>
                  <div className={styles.timelineConnector}>
                    {idx === user.solvedToday.length - 1 ? '╰─' : '├─'}
                  </div>
                  <div className={styles.timelineContent}>
                    <Link
                      href={`/questions/${item.question.platformQuestionId}`}
                      className={styles.questionLink}
                    >
                      <span className={styles.questionTitle}>{item.question.title}</span>
                    </Link>
                    <div className={styles.metaRow}>
                      <Badge
                        variant={item.question.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'}
                        size="sm"
                      >
                        {item.question.difficulty}
                      </Badge>
                      <PlatformIcon platform={item.question.platform} size="sm" />
                      {item.timeSpent > 0 && (
                        <span className={styles.timeSpent}>{formatTimeSpent(item.timeSpent)}</span>
                      )}
                      <span className={styles.timestamp}>{formatTimeAgo(item.solvedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}