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
import Card from '@/shared/components/Card';
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

// ========== Generic Timeline Item Renderer ==========
interface TimelineItemProps {
  dotClass: string;
  labelContent: React.ReactNode;
  tooltipContent: React.ReactNode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function TimelineItem({ dotClass, labelContent, tooltipContent, onMouseEnter, onMouseLeave }: TimelineItemProps) {
  return (
    <div className={styles.timelineItem} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <Tooltip content={tooltipContent} placement="right" delay={200}>
        <div className={`${styles.timelineDot} ${dotClass}`} />
      </Tooltip>
      <div className={styles.timelineLabel}>{labelContent}</div>
    </div>
  );
}

// ========== Timeline Wrapper ==========
interface TimelineWrapperProps {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement>;
  fillHeight: number;
}

function TimelineWrapper({ children, containerRef, fillHeight }: TimelineWrapperProps) {
  return (
    <div ref={containerRef} className={styles.timeline} style={{ '--fill-height': `${fillHeight}px` } as React.CSSProperties}>
      <div className={styles.timelineBase} />
      <div className={styles.timelineFill} />
      <div className={styles.timelineItems}>{children}</div>
    </div>
  );
}

// ========== Question Card (Solved / Mastered / Revisions) ==========
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [fillHeight, setFillHeight] = useState(0);
  const sortedTimeline = [...timeline].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const handleItemHover = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const items = container.querySelectorAll(`.${styles.timelineItem}`);
    if (items[index]) {
      const rect = items[index].getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const height = rect.top + rect.height / 2 - containerRect.top;
      setFillHeight(height);
    }
  };
  const handleLeave = () => setFillHeight(0);

  const patternSlug = getPatternSlug(question.pattern, question.patternSlugs);
  // fallback for missing difficulty
  const difficulty = question.difficulty?.toLowerCase() ?? 'easy';

  return (
    <div className={styles.timelineCard}>
      <div className={styles.cardHeader}>
        <Link href={`/questions/${question.platformQuestionId}`} className={styles.cardTitle}>
          {question.title}
        </Link>
        <div className={styles.cardMeta}>
          <PlatformIcon platform={question.platform} size="sm" />
          <Badge variant={difficulty as 'easy' | 'medium' | 'hard'} size="sm">
            {question.difficulty || 'Easy'}
          </Badge>
          {patternSlug && (
            <Link href={`/patterns/${patternSlug}`} className={styles.patternBadge}>
              #{question.pattern?.[0] || patternSlug}
            </Link>
          )}
        </div>
      </div>

      <TimelineWrapper containerRef={containerRef} fillHeight={fillHeight}>
        {sortedTimeline.map((entry, idx) => {
          const isSolveEntry = 'isFirstSolve' in entry;
          const isRevisionEntry = 'overdueCompleted' in entry;
          const isOverdue = isRevisionEntry && (entry as RevisionTimelineEntry).overdueCompleted;
          let dotClass = '';
          if (isRevisionEntry && isOverdue) dotClass = styles.warning;

          const tooltipContent = (
            <div className={styles.tooltipContent}>
              <div>{formatDateTime(entry.timestamp)}</div>
              {entry.timeSpent > 0 && <div>Time: {formatTimeSpent(entry.timeSpent)}</div>}
              {isSolveEntry && (entry as SolveTimelineEntry).isFirstSolve && <div>First solve</div>}
              {isRevisionEntry && isOverdue && (
                <div>Overdue (scheduled {formatDateTime((entry as RevisionTimelineEntry).scheduledDate)})</div>
              )}
              {isRevisionEntry && !isOverdue && <div>On-time revision</div>}
              {isRevisionEntry && (entry as RevisionTimelineEntry).confidenceAfter && (
                <div>Confidence: {(entry as RevisionTimelineEntry).confidenceAfter}/5</div>
              )}
            </div>
          );

          // Link to the specific day of the event
          const eventDate = format(new Date(entry.timestamp), 'yyyy-MM-dd');
          const dateUrl = `/activity/${eventDate}`;

          const labelContent = (
            <>
              <Link href={dateUrl} className={styles.dateLink}>
                {formatDateTime(entry.timestamp)}
              </Link>
              <div className={styles.timelineDetail}>
                {entry.timeSpent > 0 && <span className={styles.duration}>{formatTimeSpent(entry.timeSpent)}</span>}
                {isSolveEntry && (entry as SolveTimelineEntry).isFirstSolve && (
                  <span className={styles.firstBadge}><FiStar size={10} /> first</span>
                )}
                {isRevisionEntry && isOverdue && (
                  <span className={styles.overdueBadge}><FiAlertCircle size={10} /> overdue</span>
                )}
              </div>
            </>
          );

          return (
            <TimelineItem
              key={`${entry._id}_${entry.timestamp}`}
              dotClass={dotClass}
              labelContent={labelContent}
              tooltipContent={tooltipContent}
              onMouseEnter={() => handleItemHover(idx)}
              onMouseLeave={handleLeave}
            />
          );
        })}
      </TimelineWrapper>
    </div>
  );
}

// ========== Goal Card ==========
function GoalCard({ goal, status }: { goal: GoalAchievedItem; status: 'completed' | 'failed' }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fillHeight, setFillHeight] = useState(0);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    const container = containerRef.current;
    const it = itemRef.current;
    if (!container || !it) return;
    const containerRect = container.getBoundingClientRect();
    const itemRect = it.getBoundingClientRect();
    const height = itemRect.top + itemRect.height / 2 - containerRect.top;
    setFillHeight(height);
  };
  const handleMouseLeave = () => setFillHeight(0);

  const isCompleted = status === 'completed';
  const dotClass = isCompleted ? '' : styles.failed;
  const tooltipContent = `${isCompleted ? 'Completed' : 'Failed'} goal: ${goal.goalType} – ${goal.completionPercentage}%`;

  // Link to the day the goal was achieved (or end date if failed)
  const goalDate = goal.achievedAt || goal.endDate;
  const dateUrl = `/activity/${format(new Date(goalDate), 'yyyy-MM-dd')}`;

  const labelContent = (
    <>
      <Link href={dateUrl} className={styles.dateLink}>
        {formatDateTime(goalDate)}
      </Link>
      <div className={styles.timelineDetail}>
        <span>{goal.completedCount}/{goal.targetCount} completed</span>
        <div className={styles.goalProgressInline}>
          <ProgressBar value={goal.completionPercentage} max={100} size="sm" showValue={false} rounded />
        </div>
        <span className={styles.goalProgressBar}>
          {formatDateOnly(goal.startDate)} – {formatDateOnly(goal.endDate)}
        </span>
      </div>
    </>
  );

  return (
    <div className={styles.timelineCard}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>{isCompleted ? 'Completed Goal' : 'Failed Goal'}</div>
      </div>
      <div ref={itemRef}>
        <TimelineWrapper containerRef={containerRef} fillHeight={fillHeight}>
          <TimelineItem
            dotClass={dotClass}
            labelContent={labelContent}
            tooltipContent={tooltipContent}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        </TimelineWrapper>
      </div>
    </div>
  );
}

// ========== Group Card ==========
function GroupCard({ items }: { items: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fillHeight, setFillHeight] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleItemHover = (index: number) => {
    if (!containerRef.current) return;
    const itemsDOM = containerRef.current.querySelectorAll(`.${styles.timelineItem}`);
    if (itemsDOM[index]) {
      const rect = itemsDOM[index].getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const height = rect.top + rect.height / 2 - containerRect.top;
      setFillHeight(height);
    }
    setHoveredIndex(index);
  };
  const handleLeave = () => {
    setFillHeight(0);
    setHoveredIndex(null);
  };

  return (
    <div className={styles.timelineCard}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>Study Group Activity</div>
      </div>
      <TimelineWrapper containerRef={containerRef} fillHeight={fillHeight}>
        {items.map((item, idx) => {
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
          const eventDate = format(new Date(item.timestamp), 'yyyy-MM-dd');
          const dateUrl = `/activity/${eventDate}`;

          const tooltipContent = `${item.action} at ${formatDateTime(item.timestamp)}`;
          const labelContent = (
            <>
              <Link href={dateUrl} className={styles.dateLink}>
                {formatDateTime(item.timestamp)}
              </Link>
              <div className={styles.timelineDetail}>
                {icon} {text}
              </div>
            </>
          );
          return (
            <TimelineItem
              key={item._id}
              dotClass={styles.diamond}
              labelContent={labelContent}
              tooltipContent={tooltipContent}
              onMouseEnter={() => handleItemHover(idx)}
              onMouseLeave={handleLeave}
            />
          );
        })}
      </TimelineWrapper>
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

  // Solved tab query
  const solvedParams: ActivityLogsParams = {
    action: 'question_solved',
    page: pageSolved,
    limit,
  };
  const { data: solvedData, isLoading: solvedLoading, error: solvedError } = useAllActivityLogs(solvedParams);
  const solvedLogs = solvedData?.logs;
  const solvedPagination = solvedData?.pagination;
  const solvedTotalPages = solvedPagination?.pages || 1;

  // Mastered tab query
  const masteredParams: ActivityLogsParams = {
    action: 'question_mastered',
    page: pageMastered,
    limit,
  };
  const { data: masteredData, isLoading: masteredLoading, error: masteredError } = useAllActivityLogs(masteredParams);
  const masteredLogs = masteredData?.logs;
  const masteredPagination = masteredData?.pagination;
  const masteredTotalPages = masteredPagination?.pages || 1;

  // Revisions: On‑time
  const onTimeParams: ActivityLogsParams = {
    action: 'revision_completed',
    type: 'on_time',
    page: pageRevisionsOnTime,
    limit,
  };
  const { data: onTimeData, isLoading: onTimeLoading, error: onTimeError } = useAllActivityLogs(onTimeParams);
  const onTimeLogs = onTimeData?.logs?.revision_completed?.on_time;
  const onTimePagination = onTimeData?.pagination;
  const onTimeTotalPages = onTimePagination?.pages || 1;

  // Revisions: Overdue
  const overdueParams: ActivityLogsParams = {
    action: 'revision_completed',
    type: 'overdue',
    page: pageRevisionsOverdue,
    limit,
  };
  const { data: overdueData, isLoading: overdueLoading, error: overdueError } = useAllActivityLogs(overdueParams);
  const overdueLogs = overdueData?.logs?.revision_completed?.overdue;
  const overduePagination = overdueData?.pagination;
  const overdueTotalPages = overduePagination?.pages || 1;

  // Fetch combined revisions data for disclaimer message
  const messageParams: ActivityLogsParams = {
    action: 'revision_completed',
    limit: 1,
  };
  const { data: messageData } = useAllActivityLogs(messageParams);
  const revisionMessage = messageData?.logs?.revision_completed?.message;

  // Goals tab query
  const goalsParams: ActivityLogsParams = {
    action: 'goal_achieved',
    goalPage,
    goalLimit: limit,
  };
  const { data: goalsData, isLoading: goalsLoading, error: goalsError } = useAllActivityLogs(goalsParams);
  const goalsLogs = goalsData?.logs?.goal_achieved;
  const goalsTotalPages = goalsLogs?.pagination?.pages || 1;

  // Group tab query
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

  // ---- Solved Tab ----
  const renderSolvedTab = () => {
    const groups = solvedLogs?.question_solved;
    if (solvedLoading) return <React.Fragment key="solved-loading"><div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div></React.Fragment>;
    if (solvedError || !groups || Object.keys(groups).length === 0) return <React.Fragment key="solved-empty"><div className={styles.emptyState}>No solved questions found</div></React.Fragment>;
    
    const cards = Object.values(groups).map((group: QuestionSolvedGroup) => (
      <QuestionCard key={group.question._id} question={group.question} timeline={group.solves_timeline} type="solve" />
    ));
    const pagination = solvedTotalPages > 1 && (
      <div key="pagination" className={styles.paginationWrapper}>
        <Pagination currentPage={pageSolved} totalPages={solvedTotalPages} onPageChange={setPageSolved} showFirstLast showPrevNext size="md" />
      </div>
    );
    return (
      <React.Fragment key="solved-tab">
        {cards}
        {pagination}
      </React.Fragment>
    );
  };

  // ---- Mastered Tab ----
  const renderMasteredTab = () => {
    const groups = masteredLogs?.question_mastered;
    if (masteredLoading) return <React.Fragment key="mastered-loading"><div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div></React.Fragment>;
    if (masteredError || !groups || Object.keys(groups).length === 0) return <React.Fragment key="mastered-empty"><div className={styles.emptyState}>No mastered questions found</div></React.Fragment>;
    
    const cards = Object.values(groups).map((group: QuestionSolvedGroup) => (
      <QuestionCard key={group.question._id} question={group.question} timeline={group.solves_timeline} type="mastered" />
    ));
    const pagination = masteredTotalPages > 1 && (
      <div key="pagination" className={styles.paginationWrapper}>
        <Pagination currentPage={pageMastered} totalPages={masteredTotalPages} onPageChange={setPageMastered} showFirstLast showPrevNext size="md" />
      </div>
    );
    return (
      <React.Fragment key="mastered-tab">
        {cards}
        {pagination}
      </React.Fragment>
    );
  };

  // ---- Revisions Tab (two columns + message) ----
  const renderRevisionsTab = () => {
    if (onTimeLoading || overdueLoading) {
      return (
        <React.Fragment key="revisions-loading">
          <div className={styles.revisionsGrid}>
            <div className={styles.revisionsColumn}><div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div></div>
            <div className={styles.revisionsColumn}><div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div></div>
          </div>
        </React.Fragment>
      );
    }

    const onTimeGroups = onTimeLogs;
    const overdueGroups = overdueLogs;

    const hasOnTime = onTimeGroups && Object.keys(onTimeGroups).length > 0;
    const hasOverdue = overdueGroups && Object.keys(overdueGroups).length > 0;

    return (
      <React.Fragment key="revisions-tab">
        <div className={styles.revisionsGrid}>
          <div className={styles.revisionsColumn}>
            <div className={styles.cardHeader} style={{ paddingLeft: 0, marginBottom: '0.5rem' }}>
              <span className={styles.cardTitle} style={{ fontSize: '0.9rem' }}><FiCheckCircle size={14} /> On‑time</span>
            </div>
            {!hasOnTime && <div className={styles.emptyState}>No on‑time revisions</div>}
            {hasOnTime && Object.values(onTimeGroups).map((group: RevisionCompletedGroup) => (
              <QuestionCard key={group.question._id} question={group.question} timeline={group.revision_timeline} type="revision" />
            ))}
            {onTimeTotalPages > 1 && (
              <div className={styles.paginationWrapper}>
                <Pagination currentPage={pageRevisionsOnTime} totalPages={onTimeTotalPages} onPageChange={setPageRevisionsOnTime} showFirstLast showPrevNext size="sm" />
              </div>
            )}
          </div>

          <div className={styles.revisionsColumn}>
            <div className={styles.cardHeader} style={{ paddingLeft: 0, marginBottom: '0.5rem' }}>
              <span className={styles.cardTitle} style={{ fontSize: '0.9rem' }}><FiAlertCircle size={14} /> Overdue</span>
            </div>
            {!hasOverdue && <div className={styles.emptyState}>No overdue revisions</div>}
            {hasOverdue && Object.values(overdueGroups).map((group: RevisionCompletedGroup) => (
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
      </React.Fragment>
    );
  };

  // ---- Goals Tab ----
  const renderGoalsTab = () => {
    const completed = goalsLogs?.completed || [];
    const failed = goalsLogs?.failed || [];
    if (goalsLoading) return <React.Fragment key="goals-loading"><div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div></React.Fragment>;
    if (goalsError || (completed.length === 0 && failed.length === 0)) return <React.Fragment key="goals-empty"><div className={styles.emptyState}>No goals completed or failed</div></React.Fragment>;
    return (
      <React.Fragment key="goals-tab">
        {completed.map(goal => <GoalCard key={goal._id} goal={goal} status="completed" />)}
        {failed.map(goal => <GoalCard key={goal._id} goal={goal} status="failed" />)}
        {goalsTotalPages > 1 && (
          <div className={styles.paginationWrapper}>
            <Pagination currentPage={goalPage} totalPages={goalsTotalPages} onPageChange={setGoalPage} showFirstLast showPrevNext size="md" />
          </div>
        )}
      </React.Fragment>
    );
  };

  // ---- Group Tab ----
  const renderGroupTab = () => {
    const allItems = [
      ...(groupLogs?.group_goal_progress || []),
      ...(groupLogs?.group_goal_completed || []),
      ...(groupLogs?.group_challenge_progress || []),
      ...(groupLogs?.group_challenge_completed || []),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const visibleItems = allItems.slice(0, groupVisibleCount);

    if (groupLoading) return <React.Fragment key="group-loading"><div className={styles.skeletonList}><div className={styles.skeletonItem} /><div className={styles.skeletonItem} /></div></React.Fragment>;
    if (groupError || allItems.length === 0) return <React.Fragment key="group-empty"><div className={styles.emptyState}>No group activity yet</div></React.Fragment>;

    return (
      <React.Fragment key="group-tab">
        <GroupCard items={visibleItems} />
        {groupVisibleCount < allItems.length && (
          <div className={styles.loadMore}>
            <Button variant="outline" size="sm" onClick={() => setGroupVisibleCount(prev => prev + 6)}>Load More</Button>
          </div>
        )}
      </React.Fragment>
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
    <Card className={styles.container}>
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
    </Card>
  );
}

export { QuestionCard, GoalCard, GroupCard };
