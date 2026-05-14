// Activity Feature – Barrel Export

// Types
export * from './types/activity.types';

// Services
export { activityService } from './services/activityService';
export type { default as ActivityService } from './services/activityService';

// Hooks
export {
  activityKeys,
  useDailyTrend,
  useMonthlyTrend,
  useTodayActivity,
  useSocialFeed,
  useAllActivityLogs,
} from './hooks/useActivityData';