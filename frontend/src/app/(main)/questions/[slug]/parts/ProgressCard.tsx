'use client';

import React, { useState, useEffect } from 'react';
import { FaChevronUp, FaChevronDown, FaRedo, FaCalendarAlt, FaCheck, FaCheckCircle, FaCalendarPlus } from 'react-icons/fa';
import ConfidenceStars from '@/shared/components/ConfidenceStars';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import Button from '@/shared/components/Button';
import DatePicker from '@/shared/components/DatePicker';
import { useRescheduleRevision } from '@/features/revision/hooks/useRescheduleRevision';
import type { UserQuestionProgress, RevisionSchedule } from '@/shared/types';
import Tooltip from '@/shared/components/Tooltip';
import styles from './ProgressCard.module.css';

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
  return date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
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

  // Auto-collapse after 10 seconds (only once)
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
  const noActiveRevisions = !hasActiveRevisions && totalRevisions > 0;

  const formatTime = (minutes: number) => {
    if (minutes < 60) return { value: minutes, unit: 'min' };
    const hours = minutes / 60;
    const rounded = Math.round(hours * 10) / 10;
    return { value: rounded, unit: 'hours' };
  };
  const timeDisplay = formatTime(timeSpent);
  const revisionPercentage = totalRevisions > 0 ? (completedCount / totalRevisions) * 100 : 0;

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
          <div className={styles.tileGrid}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={styles.tile}>
                <SkeletonLoader variant="text" width={60} height={32} />
                <SkeletonLoader variant="text" width={40} height={14} />
              </div>
            ))}
          </div>
          <SkeletonLoader variant="text" width={120} height={20} />
          <div className={styles.progressRow}>
            <SkeletonLoader variant="text" width="100%" height={6} />
          </div>
          <div className={styles.actions}>
            <SkeletonLoader variant="custom" width={120} height={32} />
            <SkeletonLoader variant="custom" width={120} height={32} />
            <SkeletonLoader variant="custom" width={100} height={32} />
          </div>
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
          {/* 4‑tile grid */}
          <div className={styles.tileGrid}>
            <div className={styles.tile}>
              <div className={styles.tileValue}>{timeDisplay.value}</div>
              <div className={styles.tileLabel}>{timeDisplay.unit} spent</div>
            </div>
            <div className={styles.tile}>
              <div className={styles.tileValue}>
                {hasPendingRevision
                  ? formatLocalDate(pendingEntry!.date)
                  : hasUpcomingRevision
                  ? formatLocalDate(upcomingEntry!.date)
                  : '—'}
              </div>
              <div className={styles.tileLabel}>next revision</div>
            </div>
            <div className={styles.tile}>
              <div className={styles.tileValue}>{attempts}</div>
              <div className={styles.tileLabel}>attempts</div>
            </div>
            <div className={styles.tile}>
              <div className={styles.tileValue}>{Math.round(revisionPercentage)}%</div>
              <div className={styles.tileLabel}>revision done</div>
            </div>
          </div>

          {/* Confidence stars */}
          <div className={styles.confidenceRow}>
            <span className={styles.confidenceLabel}>Confidence:</span>
            <ConfidenceStars level={confidence} size={16} />
          </div>

          {/* Revision progress bar + circles */}
          {totalRevisions > 0 && (
            <div className={styles.progressRow}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${revisionPercentage}%` }} />
              </div>
              <div className={styles.progressStats}>
                <span>{completedCount}/{totalRevisions} revisions</span>
                <div className={styles.revisionCircles}>
                  {Array.from({ length: totalRevisions }).map((_, i) => (
                    <div
                      key={i}
                      className={`${styles.circle} ${i < completedCount ? styles.circleFilled : styles.circleEmpty}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className={styles.actions}>
            {hasPendingRevision && (
              <Button
                variant="outline"
                size="sm"
                onClick={onMarkRevised}
                leftIcon={<FaCheck />}
                isLoading={isMarking}
                className={styles.actionButton}
              >
                Mark as Revised
              </Button>
            )}

            {(!progress || progress.status === 'Not Started') && onMarkSolved && (
              <Button
                variant="primary"
                size="sm"
                onClick={onMarkSolved}
                isLoading={isMarkingSolved}
                leftIcon={<FaCheckCircle />}
                className={styles.actionButton}
              >
                Mark as Solved
              </Button>
            )}

            {/* Reschedule button – only when no active revisions and there is a schedule */}
            {noActiveRevisions && revision?._id && (
              <div className={styles.rescheduleWrapper}>
                <Button
                  variant="ghost"
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
                      <Button size="sm" variant="primary" onClick={handleReschedule} isLoading={rescheduleMutation.isPending} disabled={!selectedDate}>
                        Apply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};