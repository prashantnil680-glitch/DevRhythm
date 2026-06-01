module.exports = {
  DIFFICULTY: {
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard'
  },
  STATUS: {
    NOT_STARTED: 'Not Started',
    ATTEMPTED: 'Attempted',
    SOLVED: 'Solved',
    MASTERED: 'Mastered'
  },
  PLATFORMS: ['LeetCode', 'Codeforces', 'HackerRank', 'AtCoder', 'CodeChef', 'Other'],
  REVISION_SCHEDULE: [1, 3, 7, 14, 30],
  PRIVACY_SETTINGS: ['public', 'private', 'link-only'],
  NOTIFICATION_TYPES: {
    REVISION_DAILY: 'revision_reminder_daily',
    REVISION_URGENT: 'revision_reminder_urgent',
    GOAL_COMPLETION: 'goal_completion',
    STREAK_REMINDER: 'streak_reminder',
    NEW_FOLLOWER: 'new_follower',
    WEEKLY_REPORT: 'weekly_report',
    POD_AVAILABLE: 'pod_available',
    POD_SOLVED: 'pod_solved',      
    SHEET_IMPORT_COMPLETED: 'sheet_import_completed', 
    SHEET_IMPORT_FAILED: 'sheet_import_failed',      
  },
  LEADERBOARD_TYPES: ['weekly', 'monthly'],
  SNAPSHOT_PERIODS: ['daily', 'weekly', 'monthly'],
  DEFAULT_DAILY_GOAL: 3,
  DEFAULT_WEEKLY_GOAL: 15,
  MAX_DAILY_GOAL: 50,
  MAX_WEEKLY_GOAL: 100,

  // Goal snapshot configuration
  GOAL_SNAPSHOT_PERIODS: ['monthly', 'yearly'],
  GOAL_SNAPSHOT_RETENTION_DAYS: 1095,
  GOAL_CHART_CACHE_TTL_SECONDS: 3600,
  GOAL_CHART_DEFAULT_MONTHS_BACK: 12,
  GOAL_CHART_MAX_MONTHS_BACK: 36,
  GOAL_RELATED_SOLVE_REDIS_TTL_DAYS: 90,
};