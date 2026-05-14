'use client';

import React, { useState, useEffect } from 'react';
import { FaChevronUp, FaChevronDown, FaRedo, FaBook, FaCalendarAlt, FaCheck, FaCheckCircle, FaCalendarPlus } from 'react-icons/fa';
import ConfidenceStars from '@/shared/components/ConfidenceStars';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import Button from '@/shared/components/Button';
import DatePicker from '@/shared/components/DatePicker';
import { useRescheduleRevision } from '@/features/revision/hooks/useRescheduleRevision';
import type { UserQuestionProgress, RevisionSchedule } from '@/shared/types';
import styles from './ProgressCard.module.css';
import Tooltip from '@/shared/components/Tooltip';

interface ProgressCardProps {
  progress?: UserQuestionProgress;
  revision?: RevisionSchedule;
  isLoading: boolean;
  onMarkRevised: () => void;
  isMarking?: boolean;
  onMarkSolved?: () => void;
  isMarkingSolved?: boolean;
  questionId?: string;
}

const formatLocalDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const ProgressCard: React.FC<ProgressCardProps> = ({
  progress,
  revision,
  isLoading,
  onMarkRevised,
  isMarking = false,
  onMarkSolved,
  isMarkingSolved = false,
  questionId,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [autoCollapseTriggered, setAutoCollapseTriggered] = useState(false);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const rescheduleMutation = useRescheduleRevision(questionId || '', revision?._id || '');

  useEffect(() => {
    if (!autoCollapseTriggered && !isCollapsed && !isLoading) {
      const timer = setTimeout(() => {
        setIsCollapsed(true);
        setAutoCollapseTriggered(true);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [autoCollapseTriggered, isCollapsed, isLoading]);

  const timeSpent = progress?.totalTimeSpent || 0;
  const confidence = progress?.confidenceLevel || 1;
  const attempts = progress?.attempts?.count || 0;
  const revisionsDone = progress?.revisionCount || 0;

  const schedule = revision?.schedule || [];
  const completedRevisions = revision?.completedRevisions || [];
  const totalRevisions = schedule.length;
  const completedCount = completedRevisions.length;

  const scheduleStatuses = revision?.scheduleStatuses || [];
  const pendingEntry = scheduleStatuses.find(item => item.status === 'Pending');
  const upcomingEntry = scheduleStatuses.find(item => item.status === 'Upcoming');
  const hasPendingRevision = !!pendingEntry;
  const hasUpcomingRevision = !!upcomingEntry;
  const hasActiveRevisions = hasPendingRevision || hasUpcomingRevision;

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return { value: minutes, unit: 'min' };
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return { value: hours, unit: hours === 1 ? 'hour' : 'hours' };
    }
    return { value: `${hours}.${Math.floor(mins / 6)}`, unit: 'hours' };
  };
  const timeDisplay = formatTime(timeSpent);

  const handleReschedule = async () => {
    if (!selectedDate) return;
    await rescheduleMutation.mutateAsync(selectedDate);
    setShowReschedulePicker(false);
    setSelectedDate(null);
  };

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h3>Your Progress & Revision</h3>
          <SkeletonLoader variant="text" width={20} height={20} />
        </div>
        <div className={styles.content}>
          <SkeletonLoader variant="text" width={100} height={24} />
          <SkeletonLoader variant="text" width={150} height={48} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <h3>Your Progress & Revision</h3>
        <button className={styles.toggle} aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
          {isCollapsed ? <FaChevronDown /> : <FaChevronUp />}
        </button>
      </div>
      {!isCollapsed && (
        <div className={styles.content}>
          <div className={styles.leftColumn}>
            {(!progress || progress?.status === 'Not Started') && onMarkSolved && (
              <Button
                variant="primary"
                size="md"
                onClick={onMarkSolved}
                isLoading={isMarkingSolved}
                leftIcon={<FaCheckCircle />}
                className={styles.markSolvedButton}
                fullWidth
              >
                Mark as Solved
              </Button>
            )}
            <div className={styles.metricRow}>
              <FaRedo className={styles.icon} />
              <span className={styles.metricValue}>{attempts}</span>
              <span className={styles.metricLabel}>attempts</span>
            </div>
            <div className={styles.metricRow}>
              <FaBook className={styles.icon} />
              <span className={styles.metricValue}>{revisionsDone}</span>
              <span className={styles.metricLabel}>revisions</span>
            </div>
            <div className={styles.metricRow}>
              <ConfidenceStars level={confidence} size={16} />
              <span className={styles.metricLabel}>confidence</span>
            </div>
            <div className={styles.metricRow}>
              <FaCalendarAlt className={styles.icon} />
              {hasPendingRevision ? (
                <>
                  <span className={styles.metricValue}>
                    {formatLocalDate(pendingEntry!.date)}
                  </span>
                  <span className={styles.metricLabel}>due today</span>
                </>
              ) : hasUpcomingRevision ? (
                <>
                  <span className={styles.metricValue}>
                    {formatLocalDate(upcomingEntry!.date)}
                  </span>
                  <span className={styles.metricLabel}>next revision</span>
                </>
              ) : (
                <span className={styles.metricLabel}>no upcoming revisions</span>
              )}
            </div>
            {totalRevisions > 0 && (
              <div className={styles.progressIndicator}>
                <span className={styles.progressText}>
                  {completedCount} of {totalRevisions} revisions done
                </span>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${(completedCount / totalRevisions) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {hasPendingRevision && (
              <Tooltip content="You need to spend at least 20 minutes or pass all test cases to complete this revision.">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMarkRevised}
                  leftIcon={<FaCheck />}
                  isLoading={isMarking}
                  className={styles.markButton}
                >
                  Mark as Revised
                </Button>
              </Tooltip>
            )}
            {!hasActiveRevisions && totalRevisions > 0 && revision?._id && (
              <div className={styles.rescheduleContainer}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowReschedulePicker(!showReschedulePicker)}
                  leftIcon={<FaCalendarPlus />}
                  className={styles.rescheduleButton}
                >
                  Reschedule
                </Button>
                {showReschedulePicker && (
                  <div className={styles.inlinePicker}>
                    <DatePicker
                      selected={selectedDate}
                      onChange={setSelectedDate}
                      minDate={new Date()}
                      placeholder="Select new start date"
                      size="sm"
                      fullWidth
                    />
                    <div className={styles.pickerActions}>
                      <Button size="sm" variant="outline" onClick={() => setShowReschedulePicker(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleReschedule}
                        isLoading={rescheduleMutation.isPending}
                        disabled={!selectedDate}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={styles.rightColumn}>
            <div className={styles.timeBlock}>
              <div className={styles.timeNumber}>{timeDisplay.value}</div>
              <div className={styles.timeLabel}>{timeDisplay.unit}</div>
              <div className={styles.timeSub}>total time spent</div>
            </div>
            {totalRevisions > 0 && (
              <div className={styles.revisionProgress}>
                <div className={styles.revisionCircles}>
                  {Array.from({ length: totalRevisions }).map((_, i) => (
                    <div
                      key={i}
                      className={`${styles.circle} ${i < completedCount ? styles.circleFilled : styles.circleEmpty}`}
                    />
                  ))}
                </div>
                <span className={styles.revisionLabel}>
                  {completedCount}/{totalRevisions} revisions
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};