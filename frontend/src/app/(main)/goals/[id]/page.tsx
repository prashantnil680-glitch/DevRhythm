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

// ------------------------------------------------------------------- //
//  Types – align with your actual API responses. Adjust as needed.    //
// ------------------------------------------------------------------- //

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

// ------------------------------------------------------------------- //
//  Pure helpers                                                       //
// ------------------------------------------------------------------- //

const formatDate = (dateString?: string): string => {
  if (!dateString) return '—';
  return format(new Date(dateString), 'MMM d, yyyy');
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

interface HeroMessage {
  icon: React.ReactNode;
  text: string;
}

function getHeroMessage(
  goal: Goal,
  daysLeft: number,
  completedPercentage: number
): HeroMessage {
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
}

// ------------------------------------------------------------------- //
//  RiverQuestionItem                                                  //
// ------------------------------------------------------------------- //

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
  const difficultyClass = styles[`riverDifficulty${questionMetadata.difficulty}`];
  const pattern = questionMetadata.pattern?.[0] || null;
  const tags = questionMetadata.tags?.slice(0, 2) || [];
  const remainingTags = (questionMetadata.tags?.length || 0) - tags.length;

  const href = `/questions/${questionMetadata.platformQuestionId || questionMetadata._id}`;

  if (isLoading) {
    return (
      <div className={styles.riverItem}>
        <div className={styles.riverNode} />
        <div className={styles.riverDate}>Loading progress...</div>
        <div className={styles.riverTitleLine}>
          <span className={styles.riverConnector}>╰─</span>
          <span className={styles.riverTitleLink}>{questionMetadata.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.riverItem}>
      <div
        className={clsx(styles.riverNode, styles.riverNodeGlow)}
        style={confidenceGlow(confidenceLevel)}
      />
      <div className={styles.riverDate}>
        {completed ? (solvedDisplay ? `Completed ${solvedDisplay}` : 'Completed') : 'Pending'}
      </div>
      <div className={styles.riverTitleLine}>
        <span className={styles.riverConnector}>╰─</span>
        <Link href={href} className={styles.riverTitleLink}>
          {questionMetadata.title}
        </Link>
        <span className={styles.riverStatus}>{completed ? 'Completed' : 'Target'}</span>
      </div>
      <div className={styles.riverMeta}>
        <span className={clsx(styles.riverDifficulty, difficultyClass)}>
          {questionMetadata.difficulty}
        </span>
        <PlatformIcon platform={questionMetadata.platform} size="sm" />
        <span>{questionMetadata.platform}</span>
        {pattern && <span className={styles.riverPattern}>· {pattern}</span>}
      </div>
      {tags.length > 0 && (
        <div className={styles.riverTagsRow}>
          {tags.map((tag) => (
            <span key={tag} className={styles.riverTag}>
              #{tag}
            </span>
          ))}
          {remainingTags > 0 && (
            <Tooltip content={questionMetadata.tags?.slice(2).join(', ')}>
              <span className={styles.riverTag}>+{remainingTags}</span>
            </Tooltip>
          )}
        </div>
      )}
      <div className={styles.riverMetricsRow}>
        <Tooltip content={`Total time spent: ${timeSpent} minutes`}>
          <span className={styles.riverMetric}>
            <FiClock className={styles.riverMetricIcon} /> {timeDisplay}
          </span>
        </Tooltip>
        <Tooltip content={`Attempts: ${attemptsCount}`}>
          <span className={styles.riverMetric}>
            <span className={styles.riverMetricIcon}>👣</span> {attemptsCount} att
          </span>
        </Tooltip>
        <Tooltip content={`Revisions: ${revisionCount}`}>
          <span className={styles.riverMetric}>
            <FiRefreshCw className={styles.riverMetricIcon} /> {revisionCount} rev
          </span>
        </Tooltip>
        {completedAt && (
          <Tooltip content={`Last activity: ${revisionFull}`}>
            <span className={styles.riverMetric}>
              <FiRefreshCw className={styles.riverMetricIcon} /> {revisionShort}
            </span>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- //
//  Main page component                                                //
// ------------------------------------------------------------------- //

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

  // Derived data
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

  const heroMessage = useMemo(
    () => (goal ? getHeroMessage(goal, daysLeft, completedPercentage) : null),
    [goal, daysLeft, completedPercentage]
  );

  // ----- Robust separation of pending vs completed questions -----
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

    // First build a map of target questions for fallback resolution
    const targetMap = new Map<string, TargetQuestion>();
    for (const q of goal.targetQuestions || []) {
      targetMap.set(q._id, q);
    }

    const result: { meta: QuestionMeta; completedAt?: string }[] = [];
    for (const cq of goal.completedQuestions) {
      let meta: QuestionMeta | undefined;
      // Try to extract question ID
      let qid: string | undefined;
      if (typeof cq.questionId === 'string') {
        qid = cq.questionId;
      } else if (cq.questionId && typeof cq.questionId === 'object') {
        qid = cq.questionId._id;
      }
      if (!qid) continue;

      // If we have a full object already, use it
      if (typeof cq.questionId === 'object' && cq.questionId.title) {
        meta = cq.questionId as unknown as QuestionMeta;
      } else {
        // Otherwise fallback to the targetQuestions list
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

  // ---------- early returns ----------
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
      return start; // e.g., "Apr 27, 2026"
    }
    return `${start} – ${end}`; // e.g., "Apr 27 – May 3, 2026"
  }

  // ---------- rendering ----------
  return (
    <div className={styles.container}>
      <Breadcrumb
        items={[
          // { label: 'Dashboard', href: ROUTES.DASHBOARD },
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
          <FiTrash2 /> Delete Goal
        </Button>
      </div>

      {/* Hero area */}
      <div className={styles.heroTwoColumns}>
        <div onMouseEnter={() => setAnimationKey((k) => k + 1)} className={styles.heroLeft}>
          <CircularProgress
            key={animationKey}
            progress={completedPercentage}
            size={120}
            strokeWidth={8}
            animate
          >
            <div className={styles.ringText}>
              <span className={styles.percentage}>{completedPercentage}%</span>
            </div>
          </CircularProgress>
          <div className={styles.heroFraction}>
            {goal.completedCount} / {goal.targetCount}{' '}
            {pluralize(goal.targetCount, 'problem', 'problems')}
          </div>
          <div className={styles.heroPercentText}>{completedPercentage}% completed</div>
        </div>
        <div className={styles.heroRight}>
          {heroMessage && (
            <div className={styles.heroMessage}>
              {heroMessage.icon}
              <span>{heroMessage.text}</span>
            </div>
          )}
          {!isCompleted && !isFailed && (
            <div className={styles.deadlineLarge}>
              {daysLeft > 0
                ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`
                : daysLeft === 0
                ? 'Ends today'
                : `Overdue by ${Math.abs(daysLeft)} days`}
            </div>
          )}
          {isCompleted && (
            <div className={styles.completedMessage}>
              Completed on {formatDate(goal.achievedAt || goal.endDate)}
            </div>
          )}
          <div className={styles.heroStatsGroup}>
            <div className={styles.heroStat}>
              <FiTarget />
              <span>{goal.targetCount} target · {goal.completedCount} completed</span>
            </div>
            {!isCompleted && !isFailed && remainingCount > 0 && (
              <div className={styles.heroAction}>
                <FiZap /> Solve {remainingCount} more{' '}
                {pluralize(remainingCount, 'question', 'questions')}!
              </div>
            )}
            {goal.totalTimeSpent != null && (
              <div className={styles.heroStat}>
                <FiClock />
                <span>
                  Total time spent:{' '}
                  {goal.totalTimeSpent < 60
                    ? `${goal.totalTimeSpent}m`
                    : `${Math.round(goal.totalTimeSpent / 60)}h`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard + question timeline */}
      <div className={styles.twoColumns}>
        <div className={styles.leftColumn}>
          <Card className={styles.detailsCard} noHover>
            <h2 className={styles.detailsTitle}>Goal Dashboard</h2>
            <div className={styles.detailsList}>
              <div className={styles.detailsRow}>
                <FiType className={styles.detailsIcon} />
                <span className={styles.detailsLabel}>Type</span>
                <span className={styles.detailsValue}>
                  {goal.goalType.charAt(0).toUpperCase() + goal.goalType.slice(1)}
                </span>
              </div>
              <div className={styles.detailsRow}>
                <FiFlag className={styles.detailsIcon} />
                <span className={styles.detailsLabel}>Status</span>
                <Badge
                  variant={isCompleted ? 'success' : isFailed ? 'error' : 'moss'}
                  size="sm"
                  className={styles.statusBadge}
                >
                  {goal.status}
                </Badge>
              </div>
              <div className={styles.detailsRow}>
                <FiCalendar className={styles.detailsIcon} />
                <span className={styles.detailsLabel}>Start date</span>
                <span className={styles.detailsValue}>{formatDate(goal.startDate)}</span>
              </div>
              <div className={styles.detailsRow}>
                <FiTarget className={styles.detailsIcon} />
                <span className={styles.detailsLabel}>Target date</span>
                <span className={styles.detailsValue}>{formatDate(goal.endDate)}</span>
              </div>
              <div className={styles.detailsDivider} />
              <div className={styles.detailsRow}>
                <FiClock className={styles.detailsIcon} />
                <span className={styles.detailsLabel}>Created</span>
                <span className={styles.detailsValue}>{formatDate(goal.createdAt)}</span>
              </div>
              <div className={styles.detailsRow}>
                <FiRefreshCw className={styles.detailsIcon} />
                <span className={styles.detailsLabel}>Updated</span>
                <span className={styles.detailsValue}>{formatDate(goal.updatedAt)}</span>
              </div>
            </div>
          </Card>
        </div>
        <div className={styles.rightColumn}>
          <Card className={styles.questionCard} noHover>
            <h2 className={styles.sectionTitle}>
              {isPlanned ? 'Question Timeline' : 'Progress Insights'}
            </h2>
            {!isPlanned && (
              <div className={styles.defaultInsight}>
                <p>
                  This {goal.goalType} goal doesn’t track specific questions. Solve any problem on
                  the platform to make progress.
                </p>
              </div>
            )}
            {isPlanned && (
              <div className={styles.plannedWrapper}>
                {pendingQuestions.length > 0 && (
                  <div className={styles.timeline}>
                    {pendingQuestions.map((q) => (
                      <RiverQuestionItem
                        key={q._id}
                        questionId={q._id}
                        questionMetadata={q}
                        completed={false}
                      />
                    ))}
                  </div>
                )}
                {completedQuestionData.length > 0 && (
                  <div className={styles.timeline} style={{ marginTop: '1.5rem' }}>
                    {completedQuestionData.map(({ meta, completedAt }) => (
                      <RiverQuestionItem
                        key={meta._id}
                        questionId={meta._id}
                        questionMetadata={meta}
                        completed
                        completedAt={completedAt}
                      />
                    ))}
                  </div>
                )}
                {pendingQuestions.length === 0 && completedQuestionData.length === 0 && (
                  <div className={styles.defaultInsight}>
                    <p>No questions associated with this planned goal.</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

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
        <SkeletonLoader variant="text" width={200} height={32} />
        <SkeletonLoader variant="custom" className={styles.skeletonButton} />
      </div>
      <div className={styles.heroTwoColumns}>
        <div className={styles.heroLeft}>
          <SkeletonLoader variant="custom" className={styles.skeletonRing} />
        </div>
        <div className={styles.heroRight}>
          <SkeletonLoader variant="text" width="80%" height={24} />
          <SkeletonLoader variant="text" width="60%" height={20} />
          <SkeletonLoader variant="text" width="70%" height={20} />
        </div>
      </div>
      <div className={styles.twoColumns}>
        <div className={styles.leftColumn}>
          <SkeletonLoader variant="custom" className={styles.skeletonMetadata} />
        </div>
        <div className={styles.rightColumn}>
          <SkeletonLoader variant="custom" className={styles.skeletonQuestions} />
        </div>
      </div>
    </div>
  );
}