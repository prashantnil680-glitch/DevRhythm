'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  FiTarget,
  FiAlertCircle,
  FiCheckCircle,
  FiUsers,
  FiTrendingUp,
  FiAward,
  FiStar,
  FiInfo,
} from 'react-icons/fi';
import Badge from '@/shared/components/Badge';
import PlatformIcon from '@/shared/components/PlatformIcon';
import ProgressBar from '@/shared/components/ProgressBar';
import Button from '@/shared/components/Button';
import Tooltip from '@/shared/components/Tooltip';
import Pagination from '@/shared/components/Pagination';
import { useAllActivityLogs } from '@/features/activity/hooks/useActivityData';
import type {
  ActivityLogsParams,
  QuestionSolvedGroup,
  RevisionCompletedGroup,
  SolveTimelineEntry,
  RevisionTimelineEntry,
  GoalAchievedItem,
} from '@/features/activity/types/activity.types';
import { slugify } from '@/shared/lib/stringUtils';
import styles from './AllActivityLog.module.css';

type TabType = 'question_solved' | 'question_mastered' | 'revision_completed' | 'goal_achieved' | 'group';

const formatDateTime = (timestamp: string) => {
  try {
    return format(new Date(timestamp), 'MMM d, h:mm a');
  } catch {
    return '';
  }
};

const formatDateOnly = (timestamp: string) => {
  try {
    return format(new Date(timestamp), 'MMM d');
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

const getPatternSlug = (pattern?: string[], patternSlugs?: string[]): string | null => {
  if (patternSlugs && patternSlugs.length > 0) return patternSlugs[0];
  if (pattern && pattern.length > 0) return slugify(pattern[0]);
  return null;
};

// ========== Timeline Item (single row) ==========
interface TimelineItemProps {
  dotColor: 'green' | 'gold' | 'blue' | 'orange' | 'gray';
  dateTime: string;
  dateUrl: string;
  timeSpent?: number;
  isFirst?: boolean;
  isOverdue?: boolean;
  confidence?: number | null;
  scheduledDate?: string;
  extraText?: string;
}

function TimelineItem({
  dotColor,
  dateTime,
  dateUrl,
  timeSpent,
  isFirst,
  isOverdue,
  confidence,
  scheduledDate,
  extraText,
}: TimelineItemProps) {
  const tooltipContent = (
    <div className={styles.tooltipContent}>
      <div>{dateTime}</div>
      {timeSpent ? <div>Time: {formatTimeSpent(timeSpent)}</div> : null}
      {isFirst ? <div>First solve</div> : null}
      {isOverdue && scheduledDate ? (
        <div>Overdue (scheduled {formatDateTime(scheduledDate)})</div>
      ) : null}
      {!isOverdue && scheduledDate ? <div>On‑time revision</div> : null}
      {confidence !== undefined && confidence !== null ? (
        <div>Confidence: {confidence}/5</div>
      ) : null}
      {extraText ? <div>{extraText}</div> : null}
    </div>
  );

  const dotClass = styles[`dot${dotColor.charAt(0).toUpperCase() + dotColor.slice(1)}`];

  return (
    <div className={styles.timelineItem}>
      <Tooltip content={tooltipContent} placement="right" delay={200}>
        <div className={`${styles.timelineDot} ${dotClass}`} />
      </Tooltip>
      <div className={styles.timelineLabel}>
        <Link href={dateUrl} className={styles.dateLink}>
          {dateTime}
        </Link>
        <div className={styles.timelineDetail}>
          {timeSpent ? <span className={styles.duration}>{formatTimeSpent(timeSpent)}</span> : null}
          {isFirst && (
            <span className={styles.firstBadge}>
              <FiStar size={10} /> first
            </span>
          )}
          {isOverdue && (
            <span className={styles.overdueBadge}>
              <FiAlertCircle size={10} /> overdue
            </span>
          )}
          {extraText && <span className={styles.extraText}>{extraText}</span>}
        </div>
      </div>
    </div>
  );
}

// ========== Question Card ==========
interface QuestionCardProps {
  question: {
    _id: string;
    title: string;
    platform: string;
    platformQuestionId: string;
    difficulty: string;
    pattern?: string[];
    patternSlugs?: string[];
  };
  timeline: SolveTimelineEntry[] | RevisionTimelineEntry[];
  type: 'solve' | 'mastered' | 'revision';
}

function QuestionCard({ question, timeline, type }: QuestionCardProps) {
  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const difficulty = question.difficulty?.toLowerCase() ?? 'easy';

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <Link href={`/questions/${question.platformQuestionId}`} className={styles.cardTitle}>
          {question.title}
        </Link>
        <div className={styles.cardMeta}>
          <Link href={`/questions?platform=${encodeURIComponent(question.platform)}&page=1`} className={styles.platformLink}>
            <PlatformIcon platform={question.platform} size="sm" />
            <span className={styles.platformText}>{question.platform}</span>
          </Link>
          <Link href={`/questions?difficulty=${question.difficulty}&page=1`} className={styles.difficultyLink}>
            <Badge variant={difficulty as 'easy' | 'medium' | 'hard'} size="sm">
              {question.difficulty}
            </Badge>
          </Link>
          {/* Display ALL patterns as clickable badges */}
          {question.pattern && question.pattern.length > 0 && (
            <div className={styles.patternsList}>
              {question.pattern.map((p, idx) => {
                const slug = question.patternSlugs?.[idx] || slugify(p);
                return (
                  <Link key={p} href={`/patterns/${slug}`} className={styles.patternBadge}>
                    #{p}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className={styles.timelineList}>
        {sortedTimeline.map((entry) => {
          const isSolveEntry = 'isFirstSolve' in entry;
          const isRevisionEntry = 'overdueCompleted' in entry;
          const isOverdue = isRevisionEntry && (entry as RevisionTimelineEntry).overdueCompleted;
          const dotColor = isOverdue ? 'orange' : type === 'solve' ? 'green' : type === 'mastered' ? 'gold' : 'blue';
          const dateUrl = `/activity/${format(new Date(entry.timestamp), 'yyyy-MM-dd')}`;

          return (
            <TimelineItem
              key={`${entry._id}_${entry.timestamp}`}
              dotColor={dotColor}
              dateTime={formatDateTime(entry.timestamp)}
              dateUrl={dateUrl}
              timeSpent={entry.timeSpent}
              isFirst={isSolveEntry && (entry as SolveTimelineEntry).isFirstSolve}
              isOverdue={isOverdue}
              confidence={isRevisionEntry ? (entry as RevisionTimelineEntry).confidenceAfter : undefined}
              scheduledDate={isRevisionEntry ? (entry as RevisionTimelineEntry).scheduledDate : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

// ========== Goal Card ==========
function GoalCard({ goal, status }: { goal: GoalAchievedItem; status: 'completed' | 'failed' }) {
  const isCompleted = status === 'completed';
  const dotColor = isCompleted ? 'green' : 'gray';
  const goalDate = goal.achievedAt || goal.endDate;
  const dateUrl = `/activity/${format(new Date(goalDate), 'yyyy-MM-dd')}`;
  const progressPercent = Math.min(100, goal.completionPercentage || 0);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          {isCompleted ? '✓ Completed Goal' : '❌ Failed Goal'}
        </div>
      </div>
      <div className={styles.timelineList}>
        <TimelineItem
          dotColor={dotColor}
          dateTime={formatDateTime(goalDate)}
          dateUrl={dateUrl}
          extraText={`${goal.goalType}: ${goal.completedCount}/${goal.targetCount} completed`}
        />
        <div className={styles.goalProgressWrapper}>
          <ProgressBar value={progressPercent} max={100} size="sm" showValue rounded />
          <span className={styles.goalDateRange}>
            {formatDateOnly(goal.startDate)} – {formatDateOnly(goal.endDate)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ========== Group Card (single card, multiple items) ==========
function GroupCard({ items }: { items: any[] }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>Study Group Activity</div>
      </div>
      <div className={styles.timelineList}>
        {items.map((item) => {
          let icon = <FiUsers />;
          let text = '';
          if (item.action === 'group_goal_progress') {
            icon = <FiTrendingUp />;
            text = `Goal progress: +${item.metadata.delta} → ${item.metadata.newProgress}/${item.metadata.target}`;
          } else if (item.action === 'group_goal_completed') {
            icon = <FiTarget />;
            text = `Goal completed!`;
          } else if (item.action === 'group_challenge_progress') {
            icon = <FiTrendingUp />;
            text = `Challenge progress: ${item.metadata.newProgress}%`;
          } else if (item.action === 'group_challenge_completed') {
            icon = <FiAward />;
            text = `Challenge completed!`;
          }
          const dateUrl = `/activity/${format(new Date(item.timestamp), 'yyyy-MM-dd')}`;
          return (
            <TimelineItem
              key={item._id}
              dotColor="blue"
              dateTime={formatDateTime(item.timestamp)}
              dateUrl={dateUrl}
              extraText={`${icon} ${text}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ========== Main Component ==========
export default function AllActivityLog() {
  const [activeTab, setActiveTab] = useState<TabType>('question_solved');
  const [pageSolved, setPageSolved] = useState(1);
  const [pageMastered, setPageMastered] = useState(1);
  const [pageRevisionsOnTime, setPageRevisionsOnTime] = useState(1);
  const [pageRevisionsOverdue, setPageRevisionsOverdue] = useState(1);
  const [goalPage, setGoalPage] = useState(1);
  const [groupVisibleCount, setGroupVisibleCount] = useState(6);
  const limit = 6;

  // Solved
  const solvedParams: ActivityLogsParams = { action: 'question_solved', page: pageSolved, limit };
  const { data: solvedData, isLoading: solvedLoading, error: solvedError } = useAllActivityLogs(solvedParams);
  const solvedLogs = solvedData?.logs;
  const solvedPagination = solvedData?.pagination;
  const solvedTotalPages = solvedPagination?.pages || 1;

  // Mastered
  const masteredParams: ActivityLogsParams = { action: 'question_mastered', page: pageMastered, limit };
  const { data: masteredData, isLoading: masteredLoading, error: masteredError } = useAllActivityLogs(masteredParams);
  const masteredLogs = masteredData?.logs;
  const masteredPagination = masteredData?.pagination;
  const masteredTotalPages = masteredPagination?.pages || 1;

  // Revisions: on‑time & overdue
  const onTimeParams: ActivityLogsParams = { action: 'revision_completed', type: 'on_time', page: pageRevisionsOnTime, limit };
  const { data: onTimeData, isLoading: onTimeLoading, error: onTimeError } = useAllActivityLogs(onTimeParams);
  const onTimeLogs = onTimeData?.logs?.revision_completed?.on_time;
  const onTimePagination = onTimeData?.pagination;
  const onTimeTotalPages = onTimePagination?.pages || 1;

  const overdueParams: ActivityLogsParams = { action: 'revision_completed', type: 'overdue', page: pageRevisionsOverdue, limit };
  const { data: overdueData, isLoading: overdueLoading, error: overdueError } = useAllActivityLogs(overdueParams);
  const overdueLogs = overdueData?.logs?.revision_completed?.overdue;
  const overduePagination = overdueData?.pagination;
  const overdueTotalPages = overduePagination?.pages || 1;

  // Revisions disclaimer message
  const messageParams: ActivityLogsParams = { action: 'revision_completed', limit: 1 };
  const { data: messageData } = useAllActivityLogs(messageParams);
  const revisionMessage = messageData?.logs?.revision_completed?.message;

  // Goals
  const goalsParams: ActivityLogsParams = { action: 'goal_achieved', goalPage, goalLimit: limit };
  const { data: goalsData, isLoading: goalsLoading, error: goalsError } = useAllActivityLogs(goalsParams);
  const goalsLogs = goalsData?.logs?.goal_achieved;
  const goalsTotalPages = goalsLogs?.pagination?.pages || 1;

  // Group
  const { data: groupData, isLoading: groupLoading, error: groupError } = useAllActivityLogs(
    activeTab === 'group' ? { limit: 50 } : undefined
  );
  const groupLogs = groupData?.logs;

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPageSolved(1);
    setPageMastered(1);
    setPageRevisionsOnTime(1);
    setPageRevisionsOverdue(1);
    setGoalPage(1);
    setGroupVisibleCount(6);
  };

  // Render helpers
  const renderSolvedTab = () => {
    const groups = solvedLogs?.question_solved;
    if (solvedLoading) return <div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div>;
    if (solvedError || !groups || Object.keys(groups).length === 0) return <div className={styles.emptyState}>No solved questions found</div>;
    const cards = Object.values(groups).map((group: QuestionSolvedGroup) => (
      <QuestionCard key={group.question._id} question={group.question} timeline={group.solves_timeline} type="solve" />
    ));
    return (
      <>
        {cards}
        {solvedTotalPages > 1 && (
          <div className={styles.paginationWrapper}>
            <Pagination currentPage={pageSolved} totalPages={solvedTotalPages} siblingCount={0} onPageChange={setPageSolved} showFirstLast showPrevNext size="md" />
          </div>
        )}
      </>
    );
  };

  const renderMasteredTab = () => {
    const groups = masteredLogs?.question_mastered;
    if (masteredLoading) return <div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div>;
    if (masteredError || !groups || Object.keys(groups).length === 0) return <div className={styles.emptyState}>No mastered questions found</div>;
    const cards = Object.values(groups).map((group: QuestionSolvedGroup) => (
      <QuestionCard key={group.question._id} question={group.question} timeline={group.solves_timeline} type="mastered" />
    ));
    return (
      <>
        {cards}
        {masteredTotalPages > 1 && (
          <div className={styles.paginationWrapper}>
            <Pagination currentPage={pageMastered} totalPages={masteredTotalPages} onPageChange={setPageMastered} showFirstLast showPrevNext size="md" />
          </div>
        )}
      </>
    );
  };

  const renderRevisionsTab = () => {
    if (onTimeLoading || overdueLoading) {
      return (
        <div className={styles.revisionsGrid}>
          <div className={styles.revisionsColumn}><div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div></div>
          <div className={styles.revisionsColumn}><div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div></div>
        </div>
      );
    }
    const hasOnTime = onTimeLogs && Object.keys(onTimeLogs).length > 0;
    const hasOverdue = overdueLogs && Object.keys(overdueLogs).length > 0;
    return (
      <>
        <div className={styles.revisionsGrid}>
          <div className={styles.revisionsColumn}>
            <div className={styles.columnHeader}><FiCheckCircle size={14} /> On‑time</div>
            {!hasOnTime && <div className={styles.emptyState}>No on‑time revisions</div>}
            {hasOnTime && Object.values(onTimeLogs).map((group: RevisionCompletedGroup) => (
              <QuestionCard key={group.question._id} question={group.question} timeline={group.revision_timeline} type="revision" />
            ))}
            {onTimeTotalPages > 1 && (
              <div className={styles.paginationWrapper}>
                <Pagination currentPage={pageRevisionsOnTime} totalPages={onTimeTotalPages} onPageChange={setPageRevisionsOnTime} showFirstLast showPrevNext size="sm" />
              </div>
            )}
          </div>
          <div className={styles.revisionsColumn}>
            <div className={styles.columnHeader}><FiAlertCircle size={14} /> Overdue</div>
            {!hasOverdue && <div className={styles.emptyState}>No overdue revisions</div>}
            {hasOverdue && Object.values(overdueLogs).map((group: RevisionCompletedGroup) => (
              <QuestionCard key={group.question._id} question={group.question} timeline={group.revision_timeline} type="revision" />
            ))}
            {overdueTotalPages > 1 && (
              <div className={styles.paginationWrapper}>
                <Pagination currentPage={pageRevisionsOverdue} totalPages={overdueTotalPages} onPageChange={setPageRevisionsOverdue} showFirstLast showPrevNext size="sm" />
              </div>
            )}
          </div>
        </div>
        {revisionMessage && (
          <div className={styles.disclaimerMessage}>
            <FiInfo size={14} />
            <span>{revisionMessage}</span>
          </div>
        )}
      </>
    );
  };

  const renderGoalsTab = () => {
    const completed = goalsLogs?.completed || [];
    const failed = goalsLogs?.failed || [];
    if (goalsLoading) return <div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div>;
    if (goalsError || (completed.length === 0 && failed.length === 0)) return <div className={styles.emptyState}>No goals completed or failed</div>;
    return (
      <>
        {completed.map(goal => <GoalCard key={goal._id} goal={goal} status="completed" />)}
        {failed.map(goal => <GoalCard key={goal._id} goal={goal} status="failed" />)}
        {goalsTotalPages > 1 && (
          <div className={styles.paginationWrapper}>
            <Pagination currentPage={goalPage} totalPages={goalsTotalPages} onPageChange={setGoalPage} showFirstLast showPrevNext size="md" />
          </div>
        )}
      </>
    );
  };

  const renderGroupTab = () => {
    const allItems = [
      ...(groupLogs?.group_goal_progress || []),
      ...(groupLogs?.group_goal_completed || []),
      ...(groupLogs?.group_challenge_progress || []),
      ...(groupLogs?.group_challenge_completed || []),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const visibleItems = allItems.slice(0, groupVisibleCount);
    if (groupLoading) return <div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div>;
    if (groupError || allItems.length === 0) return <div className={styles.emptyState}>No group activity yet</div>;
    return (
      <>
        <GroupCard items={visibleItems} />
        {groupVisibleCount < allItems.length && (
          <div className={styles.loadMore}>
            <Button variant="outline" size="sm" onClick={() => setGroupVisibleCount(prev => prev + 6)}>Load More</Button>
          </div>
        )}
      </>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'question_solved': return renderSolvedTab();
      case 'question_mastered': return renderMasteredTab();
      case 'revision_completed': return renderRevisionsTab();
      case 'goal_achieved': return renderGoalsTab();
      case 'group': return renderGroupTab();
      default: return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>All Activity Log</h3>
      </div>
      <div className={styles.tabs}>
        {(['question_solved', 'question_mastered', 'revision_completed', 'goal_achieved', 'group'] as TabType[]).map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {tab === 'question_solved' ? 'Solved' : tab === 'question_mastered' ? 'Mastered' : tab === 'revision_completed' ? 'Revisions' : tab === 'goal_achieved' ? 'Goals' : 'Group'}
          </button>
        ))}
      </div>
      <div className={styles.content}>{renderContent()}</div>
    </div>
  );
}

export { QuestionCard, GoalCard, GroupCard };
