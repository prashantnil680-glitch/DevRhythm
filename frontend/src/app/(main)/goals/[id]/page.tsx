'use client';
import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import {
  FiCalendar,
  FiClock,
  FiFlag,
  FiTrash2,
  FiType,
  FiTarget,
  FiAward,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import clsx from 'clsx';
import { useGoal, useDeleteGoal } from '@/features/goal';
import { useQuestionProgress } from '@/features/progress/hooks/useQuestionProgress';
import Breadcrumb from '@/shared/components/Breadcrumb';
import Card from '@/shared/components/Card';
import Button from '@/shared/components/Button';
import Modal from '@/shared/components/Modal';
import Badge from '@/shared/components/Badge';
import CircularProgress from '@/shared/components/CircularProgress';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import Tooltip from '@/shared/components/Tooltip';
import PlatformIcon from '@/shared/components/PlatformIcon';
import { formatDateForDisplay } from '@/shared/lib/dateUtils';
import { ROUTES } from '@/shared/config';
import styles from './GoalDetail.module.css';

interface QuestionMeta {
  _id: string;
  title: string;
  platformQuestionId?: string;
  platform: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags?: string[];
  pattern?: string[];
}

interface TargetQuestion {
  _id: string;
  title: string;
  platformQuestionId?: string;
  platform: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags?: string[];
  pattern?: string[];
}

interface CompletedQuestionEntry {
  questionId: string | { _id: string; title?: string; platform?: string; difficulty?: string };
  completedAt?: string;
}

interface Goal {
  _id: string;
  goalType: 'daily' | 'planned' | 'weekly';
  status: 'active' | 'completed' | 'failed';
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  targetCount: number;
  completedCount: number;
  completionPercentage: number;
  achievedAt?: string;
  totalTimeSpent?: number | null;
  targetQuestions?: TargetQuestion[];
  completedQuestions?: CompletedQuestionEntry[];
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '—';
  return format(new Date(dateString), 'MMM d, yyyy');
};

const formatDateShort = (dateString?: string): string => {
  if (!dateString) return '—';
  return format(new Date(dateString), 'MMM d');
};

const pluralize = (count: number, singular: string, plural: string) =>
  count === 1 ? singular : plural;

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

const confidenceGlow = (level: number): React.CSSProperties => ({
  '--glow-spread': `${level * 4}px`,
  '--glow-size': `${level * 2}px`,
  '--glow-opacity': 0.2 + level * 0.08,
} as React.CSSProperties);

interface RiverQuestionItemProps {
  questionId: string;
  questionMetadata: QuestionMeta;
  completed: boolean;
  completedAt?: string;
}

function RiverQuestionItem({
  questionId,
  questionMetadata,
  completed,
  completedAt,
}: RiverQuestionItemProps) {
  const { data: progress, isLoading } = useQuestionProgress(questionId);

  const timeSpent = progress?.totalTimeSpent ?? 0;
  const attemptsCount = progress?.attempts?.count ?? 0;
  const revisionCount = progress?.revisionCount ?? 0;
  const confidenceLevel = progress?.confidenceLevel ?? 3;

  const solvedDate = safeParseDate(completedAt);
  const solvedDisplay = solvedDate ? formatDateForDisplay(solvedDate) : null;
  const lastActivityDate = solvedDate;
  const revisionShort = lastActivityDate ? formatShortRelativeTime(lastActivityDate) : 'N/A';
  const revisionFull = lastActivityDate
    ? formatDistanceToNow(lastActivityDate, { addSuffix: true })
    : 'N/A';

  const timeDisplay = timeSpent < 60 ? `${timeSpent}m` : `${Math.round(timeSpent / 60)}h`;
  const difficultyClass = styles[`timelineDifficulty${questionMetadata.difficulty}`];
  const pattern = questionMetadata.pattern?.[0] || null;
  const tags = questionMetadata.tags?.slice(0, 2) || [];
  const remainingTags = (questionMetadata.tags?.length || 0) - tags.length;

  const href = `/questions/${questionMetadata.platformQuestionId}`;

  if (isLoading) {
    return <div className={styles.timelineItemSkeleton}>Loading...</div>;
  }

  return (
    <div className={styles.timelineItem}>
      <div
        className={clsx(styles.timelineNode, completed && styles.timelineNodeCompleted)}
        style={confidenceGlow(confidenceLevel)}
      />
      <div className={styles.timelineContent}>
        <div className={styles.timelineTop}>
          <Link href={href} className={styles.timelineTitle}>
            {questionMetadata.title}
          </Link>
          <span className={clsx(styles.timelineDifficulty, difficultyClass)}>
            {questionMetadata.difficulty}
          </span>
          <div className={styles.timelineTags}>
            {tags.map(tag => (
              <span key={tag} className={styles.timelineTag}>#{tag}</span>
            ))}
            {remainingTags > 0 && (
              <Tooltip content={questionMetadata.tags?.slice(2).join(', ')}>
                <span className={styles.timelineTag}>+{remainingTags}</span>
              </Tooltip>
            )}
          </div>
          <div className={styles.timelineStatus}>
            {completed ? (
              <span className={styles.statusCompleted}>✓ Completed {solvedDisplay || ''}</span>
            ) : (
              <span className={styles.statusPending}>○ Pending</span>
            )}
          </div>
        </div>
        <div className={styles.timelineMetrics}>
          <span className={styles.metric}>
            <FiClock className={styles.metricIcon} /> {timeDisplay}
          </span>
          <span className={styles.metric}>
            <span className={styles.metricIcon}>👣</span> {attemptsCount} att
          </span>
          <span className={styles.metric}>
            <FiRefreshCw className={styles.metricIcon} /> {revisionCount} rev
          </span>
          {completedAt && (
            <span className={styles.metric}>
              <FiRefreshCw className={styles.metricIcon} /> {revisionShort}
            </span>
          )}
          <span className={styles.metricPlatform}>
            <PlatformIcon platform={questionMetadata.platform} size="sm" />
            {questionMetadata.platform}
          </span>
          {pattern && <span className={styles.metricPattern}>· {pattern}</span>}
        </div>
      </div>
    </div>
  );
}

export default function GoalDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { data, isLoading, error } = useGoal(id);
  const goal = data as Goal | null;
  const deleteMutation = useDeleteGoal();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  const handleDelete = () => {
    if (!goal) return;
    deleteMutation.mutate(goal._id, {
      onSuccess: () => router.push('/goals'),
    });
    setIsDeleteModalOpen(false);
  };

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const endDate = goal ? new Date(goal.endDate!) : null;
  const daysLeft = endDate ? differenceInDays(endDate, today) : 0;
  const completedPercentage = goal ? Math.round(goal.completionPercentage) : 0;
  const remainingCount = goal ? goal.targetCount - goal.completedCount : 0;
  const isCompleted = goal?.status === 'completed';
  const isFailed = goal?.status === 'failed';
  const isPlanned = goal?.goalType === 'planned';

  const pendingQuestions = useMemo(() => {
    if (!isPlanned || !goal?.targetQuestions) return [];

    const completedIds = new Set<string>();
    for (const cq of goal.completedQuestions || []) {
      let id: string | undefined;
      if (typeof cq.questionId === 'string') {
        id = cq.questionId;
      } else if (cq.questionId && typeof cq.questionId === 'object') {
        id = cq.questionId._id;
      }
      if (id) completedIds.add(id);
    }

    return goal.targetQuestions.filter((q) => !completedIds.has(q._id));
  }, [isPlanned, goal?.targetQuestions, goal?.completedQuestions]);

  const completedQuestionData = useMemo(() => {
    if (!isPlanned || !goal?.completedQuestions) return [];

    const targetMap = new Map<string, TargetQuestion>();
    for (const q of goal.targetQuestions || []) {
      targetMap.set(q._id, q);
    }

    const result: { meta: QuestionMeta; completedAt?: string }[] = [];
    for (const cq of goal.completedQuestions) {
      let meta: QuestionMeta | undefined;
      let qid: string | undefined;
      if (typeof cq.questionId === 'string') {
        qid = cq.questionId;
      } else if (cq.questionId && typeof cq.questionId === 'object') {
        qid = cq.questionId._id;
      }
      if (!qid) continue;

      if (typeof cq.questionId === 'object' && cq.questionId.title) {
        meta = cq.questionId as unknown as QuestionMeta;
      } else {
        const fallback = targetMap.get(qid);
        if (fallback) {
          meta = {
            _id: fallback._id,
            title: fallback.title,
            platformQuestionId: fallback.platformQuestionId,
            platform: fallback.platform,
            difficulty: fallback.difficulty,
            tags: fallback.tags,
            pattern: fallback.pattern,
          };
        }
      }
      if (meta) {
        result.push({ meta, completedAt: cq.completedAt });
      }
    }
    return result;
  }, [isPlanned, goal?.completedQuestions, goal?.targetQuestions]);

  const allQuestions = useMemo(() => {
    const pending = pendingQuestions.map(q => ({
      ...q,
      completed: false,
      completedAt: undefined,
    }));
    const completed = completedQuestionData.map(({ meta, completedAt }) => ({
      ...meta,
      completed: true,
      completedAt,
    }));
    return [...pending, ...completed];
  }, [pendingQuestions, completedQuestionData]);

  if (isLoading) return <GoalDetailSkeleton />;
  if (error || !goal) {
    return (
      <div className={styles.errorContainer}>
        <p>Goal not found or you don’t have permission to view it.</p>
        <Button onClick={() => router.push('/goals')}>Back to Goals</Button>
      </div>
    );
  }

  function getGoalHeading(goal: Goal): string {
    const start = formatDate(goal.startDate);
    const end = formatDate(goal.endDate);
    if (goal.goalType === 'daily') {
      return start;
    }
    return `${start} – ${end}`;
  }

  const getHeroMessage = (goal: Goal): { icon: React.ReactNode; text: string } | null => {
    const isCompleted = goal.status === 'completed';
    const isFailed = goal.status === 'failed';
    if (isCompleted) {
      const early = differenceInDays(goal.endDate!, new Date()) > 0;
      return early
        ? { icon: <FiAward />, text: `Completed ${Math.abs(daysLeft)} days early!` }
        : { icon: <FiCheckCircle />, text: 'Goal completed!' };
    }
    if (isFailed) {
      return { icon: <FiAlertCircle />, text: 'Missed the deadline. Next time!' };
    }
    if (daysLeft === 0) {
      return { icon: <FiAlertCircle />, text: 'Ends today! Solve remaining problems.' };
    }
    if (daysLeft < 0) {
      return { icon: <FiAlertCircle />, text: `Overdue by ${Math.abs(daysLeft)} days` };
    }
    if (completedPercentage >= 75 && daysLeft === 1) {
      return { icon: <FiTrendingUp />, text: 'Almost there! 1 day left.' };
    }
    if (completedPercentage === 0 && daysLeft === 1) {
      return { icon: <FiZap />, text: 'Start now – there’s still time!' };
    }
    if (goal.goalType === 'daily') {
      return { icon: <FiTarget />, text: `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` };
    }
    return { icon: <FiTrendingUp />, text: `Keep going! ${daysLeft} days left` };
  };

  const heroMessage = getHeroMessage(goal);
  const totalQuestions = allQuestions.length;

  return (
    <div className={styles.container}>
      <Breadcrumb
        items={[
          { label: 'Home', href: ROUTES.HOME },
          { label: 'Goals', href: ROUTES.GOALS.ROOT },
          { label: 'Goal Details' },
        ]}
        renderLink={(item, props) => (
          <Link href={item.href!} className={props.className}>
            {props.children}
          </Link>
        )}
      />

      <div className={styles.header}>
        <h1 className={styles.title}>{getGoalHeading(goal)}</h1>
        <Button
          variant="error"
          size="sm"
          onClick={() => setIsDeleteModalOpen(true)}
          className={styles.deleteButton}
        >
          <FiTrash2 /> Delete
        </Button>
      </div>

      <div className={styles.heroRow} onMouseEnter={() => setAnimationKey(k => k + 1)}>
        <div className={styles.heroRing}>
          <CircularProgress
            key={animationKey}
            progress={completedPercentage}
            size={80}
            strokeWidth={7}
            animate
          >
            <div className={styles.ringText}>
              <span className={styles.ringPercentage}>{completedPercentage}%</span>
            </div>
          </CircularProgress>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroMainStats}>
            <span className={styles.heroCount}>
              {goal.completedCount} / {goal.targetCount}
            </span>
            <span className={styles.heroLabel}>completed</span>
            <span className={styles.heroDivider}>•</span>
            <Badge variant={isCompleted ? 'success' : isFailed ? 'error' : 'moss'} size="sm">
              {goal.status}
            </Badge>
            <span className={styles.heroDivider}>•</span>
            {heroMessage && (
              <span className={styles.heroMessage}>
                {heroMessage.icon} {heroMessage.text}
              </span>
            )}
          </div>
          <div className={styles.heroMeta}>
            <span className={styles.heroMetaItem}>
              <FiType className={styles.heroMetaIcon} />
              <span className={styles.heroMetaLabel}>Type:</span>
              {goal.goalType.charAt(0).toUpperCase() + goal.goalType.slice(1)}
            </span>
            <span className={styles.heroMetaDivider}>|</span>
            <span className={styles.heroMetaItem}>
              <FiCalendar className={styles.heroMetaIcon} />
              <span className={styles.heroMetaLabel}>Start:</span>
              {formatDateShort(goal.startDate)}
            </span>
            <span className={styles.heroMetaDivider}>|</span>
            <span className={styles.heroMetaItem}>
              <FiTarget className={styles.heroMetaIcon} />
              <span className={styles.heroMetaLabel}>End:</span>
              {formatDateShort(goal.endDate)}
            </span>
            <span className={styles.heroMetaDivider}>|</span>
            <span className={styles.heroMetaItem}>
              <FiClock className={styles.heroMetaIcon} />
              <span className={styles.heroMetaLabel}>Created:</span>
              {formatDateShort(goal.createdAt)}
            </span>
            {goal.totalTimeSpent != null && (
              <>
                <span className={styles.heroMetaDivider}>|</span>
                <span className={styles.heroMetaItem}>
                  <FiClock className={styles.heroMetaIcon} />
                  <span className={styles.heroMetaLabel}>Total:</span>
                  {goal.totalTimeSpent < 60
                    ? `${goal.totalTimeSpent}m`
                    : `${Math.round(goal.totalTimeSpent / 60)}h`}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <Card className={styles.timelineCard} noHover>
        <div className={styles.timelineHeader}>
          <h2 className={styles.timelineTitle}>
            {isPlanned ? 'Question Timeline' : 'Progress Insights'}
          </h2>
          {isPlanned && totalQuestions > 0 && (
            <span className={styles.timelineSummary}>
              {totalQuestions} questions · {completedQuestionData.length} completed · {pendingQuestions.length} pending
            </span>
          )}
        </div>
        {!isPlanned && (
          <div className={styles.defaultInsight}>
            <p>
              This {goal.goalType} goal doesn’t track specific questions. Solve any problem on
              the platform to make progress.
            </p>
          </div>
        )}
        {isPlanned && (
          <div className={styles.timelineList}>
            {allQuestions.length === 0 && (
              <div className={styles.defaultInsight}>No questions associated with this planned goal.</div>
            )}
            {allQuestions.map((q) => (
              <RiverQuestionItem
                key={q._id}
                questionId={q._id}
                questionMetadata={q}
                completed={q.completed}
                completedAt={q.completedAt}
              />
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete goal"
        size="sm"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="error" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      >
        <p>Are you sure you want to delete this goal? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}

function GoalDetailSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.skeletonBreadcrumb} />
      <div className={styles.header}>
        <SkeletonLoader variant="text" width={200} height={28} />
        <SkeletonLoader variant="custom" className={styles.skeletonButton} />
      </div>
      <div className={styles.skeletonHeroRow}>
        <SkeletonLoader variant="custom" className={styles.skeletonRing} />
        <div className={styles.skeletonHeroStats}>
          <SkeletonLoader variant="text" width="60%" height={20} />
          <SkeletonLoader variant="text" width="80%" height={16} />
        </div>
      </div>
      <div className={styles.skeletonTimelineCard}>
        <SkeletonLoader variant="text" width="30%" height={24} />
        <SkeletonLoader variant="text" width="100%" height={40} />
        <SkeletonLoader variant="text" width="100%" height={40} />
        <SkeletonLoader variant="text" width="100%" height={40} />
      </div>
    </div>
  );
}