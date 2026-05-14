import { useQuery } from '@tanstack/react-query';
import { activityService } from '@/features/activity/services/activityService';
import type { AllActivityLogsResponse } from '@/features/activity/types/activity.types';

// Flatten grouped logs into a single array with the shape expected by RecentActivitySection
function flattenRecentLogs(logs: AllActivityLogsResponse, limit: number): any[] {
  const items: any[] = [];

  // Add solved items
  if (logs.question_solved) {
    Object.values(logs.question_solved).forEach(group => {
      group.solves_timeline.forEach(entry => {
        items.push({
          _id: entry._id,
          action: 'question_solved',
          metadata: {
            title: group.question.title,
            difficulty: group.question.difficulty,
            platform: group.question.platform,
            timeSpent: entry.timeSpent,
            isFirstSolve: entry.isFirstSolve,
          },
          timestamp: entry.timestamp,
          targetId: {
            platform: group.question.platform,
            platformQuestionId: group.question.platformQuestionId,
            _id: group.question._id,
          },
        });
      });
    });
  }

  // Add mastered items
  if (logs.question_mastered) {
    Object.values(logs.question_mastered).forEach(group => {
      group.solves_timeline.forEach(entry => {
        items.push({
          _id: entry._id,
          action: 'question_mastered',
          metadata: {
            title: group.question.title,
            difficulty: group.question.difficulty,
            platform: group.question.platform,
            timeSpent: entry.timeSpent,
            isFirstSolve: entry.isFirstSolve,
          },
          timestamp: entry.timestamp,
          targetId: {
            platform: group.question.platform,
            platformQuestionId: group.question.platformQuestionId,
            _id: group.question._id,
          },
        });
      });
    });
  }

  // Add revision items (both on_time and overdue)
  const addRevisionGroup = (group: any) => {
    if (!group) return;
    Object.values(group).forEach((g: any) => {
      g.revision_timeline.forEach((entry: any) => {
        items.push({
          _id: entry._id,
          action: 'revision_completed',
          metadata: {
            title: g.question.title,
            difficulty: g.question.difficulty,
            platform: g.question.platform,
            overdueCompleted: entry.overdueCompleted,
            scheduledDate: entry.scheduledDate,
            timeSpent: entry.timeSpent,
            confidenceAfter: entry.confidenceAfter,
          },
          timestamp: entry.timestamp,
          targetId: {
            platform: g.question.platform,
            platformQuestionId: g.question.platformQuestionId,
            _id: g.question._id,
          },
        });
      });
    });
  };

  if (logs.revision_completed?.on_time) addRevisionGroup(logs.revision_completed.on_time);
  if (logs.revision_completed?.overdue) addRevisionGroup(logs.revision_completed.overdue);

  // Add group activities (if needed)
  const groupActions = ['group_goal_progress', 'group_goal_completed', 'group_challenge_progress', 'group_challenge_completed'];
  groupActions.forEach(action => {
    const groupLogs = logs[action as keyof AllActivityLogsResponse];
    if (Array.isArray(groupLogs)) {
      groupLogs.forEach((log: any) => {
        items.push({
          _id: log._id,
          action: log.action,
          metadata: log.metadata,
          timestamp: log.timestamp,
          targetId: log.targetId,
        });
      });
    }
  });

  // Sort descending and limit
  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function useRecentActivity(userId?: string, isOwnProfile?: boolean, limit = 6) {
  return useQuery({
    queryKey: ['activity', 'recent', { limit }],
    queryFn: async () => {
      // Fetch extra to ensure we have enough after flattening
      const response = await activityService.getAllActivityLogs({ limit: limit * 2 });
      return flattenRecentLogs(response.data, limit);
    },
    enabled: isOwnProfile,
    staleTime: 2 * 60 * 1000,
  });
}