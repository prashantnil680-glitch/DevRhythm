/**
 * Centralized route constants matching the frontend file structure.
 * Use these for navigation and link generation.
 */

export const ROUTES = {
  // Public home
  HOME: '/',

  // Auth group (no layout prefix needed)
  LOGIN: '/login',
  AUTH: {
    CALLBACK: '/auth/callback',
  },

  // Main authenticated area
  DASHBOARD: '/dashboard',

  // Activity Dashboard
  ACTIVITY: {
    ROOT: '/activity',
    /** Activity page for a specific date (YYYY-MM-DD) */
    BY_DATE: (date: string) => `/activity/${date}`,
  },

  // User profile pages
  USER_PROFILE: {
    /** Public profile (any user) */
    PUBLIC: (username: string) => `/user/${username}`,
    /** Own profile (requires authentication) */
    OWN: (username: string) => `/user/u/${username}`,
  },

  USERS: {
    // Dynamic: /users/:username
    DETAIL: (username: string) => `/user/${username}`,
    FOLLOWING: (username: string) => `/users/${username}/following`,
    FOLLOWERS: (username: string) => `/users/${username}/followers`,
    SHARES: (username: string) => `/users/${username}/shares`,
  },

  LEADERBOARD: {
    STREAKS: '/leaderboard/streaks',
    SOLVED: '/leaderboard/solved',
  },

  SEARCH: {
    USERS: '/search/users',
  },

  QUESTIONS: {
    ROOT: '/questions',
    CREATE: '/questions/create',
    DETAIL: (id: string) => `/questions/${id}`,
    EDIT: (id: string) => `/questions/${id}/edit`,
    DELETED: '/questions/deleted',
    PATTERNS: '/questions/patterns',
    TAGS: '/questions/tags',
  },

  PROGRESS: '/progress',

  REVISIONS: {
    ROOT: '/revisions',
    TODAY: '/revisions/today',
    UPCOMING: '/revisions/upcoming',
    OVERDUE: '/revisions/overdue',
  },

  GOALS: {
    ROOT: '/goals',
    CREATE: '/goals/create',
    DETAIL: (id: string) => `/goals/${id}`,
  },

  HEATMAP: {
    ROOT: '/heatmap',
    YEAR: (year: number | string) => `/heatmap/${year}`,
  },

  PATTERNS: {
    ROOT: '/patterns',
    RECOMMENDATIONS: '/patterns/recommendations',
    DETAIL: (patternName: string) => `/patterns/${encodeURIComponent(patternName)}`,
  },

  SHARES: {
    ROOT: '/shares',
    CREATE: '/shares/create',
    BY_TOKEN: (token: string) => `/shares/${token}`,
  },

  GROUPS: {
    ROOT: '/groups',
    MY: '/groups/my',
    CREATE: '/groups/create',
    DETAIL: (groupId: string) => `/groups/${groupId}`,
  },

  NOTIFICATIONS: {
    ROOT: '/notifications',
  },

  SHEETS: {
    ROOT: '/sheets',
    CREATE: '/sheets/create',
    DETAIL: (slug: string) => `/sheets/${slug}`,
    PROGRESS: (slug: string, username: string) => `/sheets/${slug}/progress/${username}`,
  },
} as const;