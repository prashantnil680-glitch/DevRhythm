'use client';

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { FiCheck, FiAlertCircle } from 'react-icons/fi';
import { differenceInDays } from 'date-fns';
import { useMarkRevision } from '@/features/revision/hooks/useMarkRevision';
import Button from '@/shared/components/Button';
import Tooltip from '@/shared/components/Tooltip';
import type { RevisionSchedule } from '@/shared/types';
import styles from './RevisionTimelinePanel.module.css';

const formatLocalDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getDaysRemainingLocal = (scheduledDate: string): number => {
  const scheduled = new Date(scheduledDate);
  const today = new Date();
  const localScheduled = new Date(scheduled.getFullYear(), scheduled.getMonth(), scheduled.getDate());
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return differenceInDays(localScheduled, localToday);
};

const getUpcomingLabel = (daysRemaining: number): string => {
  if (daysRemaining === 1) return 'Tomorrow';
  if (daysRemaining > 1) return `in ${daysRemaining} days`;
  return 'Upcoming';
};

interface RevisionTimelinePanelProps {
  revision?: RevisionSchedule;
  questionId: string;
}

export const RevisionTimelinePanel: React.FC<RevisionTimelinePanelProps> = ({
  revision,
  questionId,
}) => {
  const [optimisticRevision, setOptimisticRevision] = useState(revision);
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);
  const [lineHeight, setLineHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const markMutation = useMarkRevision(questionId);

  useEffect(() => {
    setOptimisticRevision(revision);
    setOptimisticIndex(null);
  }, [revision]);

  const scheduleStatuses = optimisticRevision?.scheduleStatuses || [];
  const schedule = optimisticRevision?.schedule || [];
  const currentIndex = optimisticRevision?.currentRevisionIndex ?? 0;

  const lastCompletedIndex = (() => {
    for (let i = scheduleStatuses.length - 1; i >= 0; i--) {
      if (scheduleStatuses[i].status === 'Completed') return i;
    }
    return -1;
  })();

  const updateLineHeightToLastCompleted = useCallback(() => {
    if (!containerRef.current) return;
    if (lastCompletedIndex !== -1 && itemRefs.current[lastCompletedIndex]) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const itemRect = itemRefs.current[lastCompletedIndex]!.getBoundingClientRect();
      const bottom = itemRect.bottom - containerRect.top;
      setLineHeight(bottom);
    } else {
      setLineHeight(0);
    }
  }, [lastCompletedIndex]);

  useLayoutEffect(() => {
    // Delay to ensure DOM is fully painted
    const timer = setTimeout(() => {
      updateLineHeightToLastCompleted();
    }, 50);
    return () => clearTimeout(timer);
  }, [updateLineHeightToLastCompleted, optimisticRevision]);

  const handleMouseEnter = (idx: number) => {
    if (!containerRef.current || !itemRefs.current[idx]) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const itemRect = itemRefs.current[idx]!.getBoundingClientRect();
    const bottom = itemRect.bottom - containerRect.top;
    setLineHeight(bottom);
  };

  const handleMouseLeave = () => {
    updateLineHeightToLastCompleted();
  };

  const handleMarkRevised = useCallback(
    async (targetDate: string) => {
      const targetIndex = schedule.findIndex((d) => d === targetDate);
      if (targetIndex === -1) return;

      const newCompleted = [
        ...(optimisticRevision?.completedRevisions || []),
        {
          date: targetDate,
          completedAt: new Date().toISOString(),
          status: 'completed' as const,
        },
      ];
      const newCurrentIndex = targetIndex === currentIndex ? currentIndex + 1 : currentIndex;
      const newStatus = newCurrentIndex >= schedule.length ? 'completed' : 'active';

      const updatedStatuses = scheduleStatuses.map((item, idx) => {
        if (idx === targetIndex) {
          return { ...item, status: 'Completed' };
        }
        if (idx === newCurrentIndex && newStatus === 'active') {
          return { ...item, status: 'Pending' };
        }
        return item;
      });

      setOptimisticRevision({
        ...optimisticRevision!,
        completedRevisions: newCompleted,
        currentRevisionIndex: newCurrentIndex,
        status: newStatus,
        scheduleStatuses: updatedStatuses,
      });
      setOptimisticIndex(targetIndex);

      try {
        await markMutation.mutateAsync();
      } catch (error) {
        setOptimisticRevision(revision);
        setOptimisticIndex(null);
        console.error('Failed to mark revision:', error);
      }
    },
    [schedule, currentIndex, optimisticRevision, revision, markMutation, scheduleStatuses]
  );

  const getAnimationDelay = (idx: number) => `${idx * 0.08}s`;

  if (!optimisticRevision) {
    return <p className={styles.empty}>No schedule yet. Solve to generate.</p>;
  }

  return (
    <div className={styles.timelineContainer} ref={containerRef}>
      <div
        className={styles.verticalLine}
        style={{ height: `${lineHeight}px` }}
      />
      <div className={styles.timeline}>
        {scheduleStatuses.map((item, idx) => {
          const { status, date } = item;
          const formattedDate = formatLocalDate(date);
          const isCompleted = status === 'Completed';
          const isPending = status === 'Pending';
          const isOverdue = status === 'Overdue';
          const isUpcoming = status === 'Upcoming';
          const showButton = status === 'Pending';

          let statusLabel = status;
          if (isPending) statusLabel = 'Pending Today';
          else if (isUpcoming) {
            const daysRemaining = getDaysRemainingLocal(date);
            statusLabel = getUpcomingLabel(daysRemaining);
          } else if (isOverdue) statusLabel = 'Overdue';
          else if (isCompleted) statusLabel = 'Completed';

          return (
            <div
              key={idx}
              ref={(el) => { itemRefs.current[idx] = el; }}
              className={styles.timelineItem}
              style={{ animationDelay: getAnimationDelay(idx) }}
              onMouseEnter={() => handleMouseEnter(idx)}
              onMouseLeave={handleMouseLeave}
            >
              <div
                className={`${styles.marker} ${
                  isCompleted ? styles.completed : isPending ? styles.pending : styles.upcoming
                } ${optimisticIndex === idx ? styles.pulse : ''}`}
              >
                {isCompleted && <FiCheck className={styles.checkIcon} />}
                {isOverdue && <FiAlertCircle className={styles.alertIcon} />}
                {!isCompleted && !isOverdue && <div className={styles.innerDot} />}
              </div>
              <div className={styles.content}>
                <div className={styles.date}>{formattedDate}</div>
                <div className={styles.statusRow}>
                  <span
                    className={`${styles.status} ${
                      isCompleted
                        ? styles.statusCompleted
                        : isPending
                        ? styles.statusPending
                        : isOverdue
                        ? styles.statusOverdue
                        : styles.statusUpcoming
                    }`}
                  >
                    {statusLabel}
                  </span>
                  {showButton && (
                    <Tooltip content="Spend 20+ minutes or pass all test cases to complete this revision.">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkRevised(date)}
                        isLoading={markMutation.isPending && optimisticIndex === idx}
                        className={styles.markButton}
                      >
                        Mark as Revised
                      </Button>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};