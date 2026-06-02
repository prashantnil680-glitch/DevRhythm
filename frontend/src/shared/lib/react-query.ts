import { QueryClient, DefaultOptions } from '@tanstack/react-query';

const staleTime = 1 * 60 * 1000; // 1 minutes
const gcTime = 10 * 60 * 1000; // 10 minutes (formerly cacheTime)

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime,
    gcTime,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
};

export const queryClient = new QueryClient({ defaultOptions });

// ===== Query Key Factories =====
// These help with consistent cache management and invalidation.

export const questionsKeys = {
  all: ['questions'] as const,
  lists: () => [...questionsKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...questionsKeys.lists(), filters] as const,
  details: () => [...questionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...questionsKeys.details(), id] as const,
  patterns: () => [...questionsKeys.all, 'patterns'] as const,
  tags: () => [...questionsKeys.all, 'tags'] as const,
  statistics: () => [...questionsKeys.all, 'statistics'] as const,
};

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (idOrUsername: string) => [...userKeys.details(), idOrUsername] as const,
  me: () => [...userKeys.all, 'me'] as const,
  stats: (id: string) => [...userKeys.all, 'stats', id] as const,
  topStreaks: (params: Record<string, any>) => [...userKeys.all, 'topStreaks', params] as const,
  topSolved: (params: Record<string, any>) => [...userKeys.all, 'topSolved', params] as const,
  search: (query: string) => [...userKeys.all, 'search', query] as const,
  progress: (userId: string, params?: Record<string, any>) => [...userKeys.all, 'progress', userId, params] as const,
};

export const progressKeys = {
  all: ['progress'] as const,
  lists: () => [...progressKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...progressKeys.lists(), filters] as const,
  details: () => [...progressKeys.all, 'detail'] as const,
  detail: (questionId: string) => [...progressKeys.details(), questionId] as const,
  stats: () => [...progressKeys.all, 'stats'] as const,
  recent: (limit?: number) => [...progressKeys.all, 'recent', { limit }] as const,
};

export const revisionKeys = {
  all: ['revisions'] as const,
  lists: () => [...revisionKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...revisionKeys.lists(), filters] as const,
  today: (date?: string) => [...revisionKeys.all, 'today', date] as const,
  upcoming: (start?: string, end?: string) => [...revisionKeys.all, 'upcoming', { start, end }] as const,
  overdue: (filters?: Record<string, any>) => [...revisionKeys.all, 'overdue', filters] as const,
  question: (questionId: string) => [...revisionKeys.all, 'question', questionId] as const,
  stats: () => [...revisionKeys.all, 'stats'] as const,
  // New keys for dashboard
  detailedStats: () => [...revisionKeys.all, 'detailed'] as const,
  upcomingList: (page: number, limit: number) => [...revisionKeys.all, 'upcomingList', { page, limit }] as const,
  overdueList: (page: number, limit: number) => [...revisionKeys.all, 'overdueList', { page, limit }] as const,
};

export const goalKeys = {
  all: ['goals'] as const,
  lists: () => [...goalKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...goalKeys.lists(), filters] as const,
  current: (date?: string) => [...goalKeys.all, 'current', date] as const,
  stats: (filters?: Record<string, any>) => [...goalKeys.all, 'stats', filters] as const,
  history: (period: string) => [...goalKeys.all, 'history', period] as const,
  detail: (id: string) => [...goalKeys.all, 'detail', id] as const,
  chartData: (params?: Record<string, any>) => [...goalKeys.all, 'chartData', params] as const,
  plannedLists: () => [...goalKeys.all, 'planned', 'list'] as const,
  plannedList: (filters?: Record<string, any>) => [...goalKeys.plannedLists(), filters] as const,
  plannedDetail: (id: string) => [...goalKeys.all, 'planned', 'detail', id] as const,
  completedFailed: (params?: Record<string, any>) => [...goalKeys.all, 'completedFailed', params] as const,
};

export const heatmapKeys = {
  all: ['heatmap'] as const,
  detail: (year: number) => [...heatmapKeys.all, String(year)] as const,
  stats: (year: number) => [...heatmapKeys.all, 'stats', String(year)] as const,
  filtered: (year: number, viewType: string) => [...heatmapKeys.all, 'filtered', String(year), viewType] as const,
};

export const patternKeys = {
  all: ['patterns'] as const,
  lists: () => [...patternKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...patternKeys.lists(), filters] as const,
  stats: () => [...patternKeys.all, 'stats'] as const,
  recommendations: (focus: string, limit?: number) => [...patternKeys.all, 'recommendations', focus, limit] as const,
  weakest: (metric: string, limit?: number) => [...patternKeys.all, 'weakest', metric, limit] as const,
  strongest: (metric: string, limit?: number) => [...patternKeys.all, 'strongest', metric, limit] as const,
  detail: (patternName: string) => [...patternKeys.all, 'detail', patternName] as const,
};

export const shareKeys = {
  all: ['shares'] as const,
  lists: () => [...shareKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...shareKeys.lists(), filters] as const,
  stats: () => [...shareKeys.all, 'stats'] as const,
  detail: (id: string) => [...shareKeys.all, 'detail', id] as const,
  byToken: (token: string) => [...shareKeys.all, 'token', token] as const,
  userPublic: (username: string) => [...shareKeys.all, 'user', username] as const,
};

export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...groupKeys.lists(), filters] as const,
  my: (filters?: Record<string, any>) => [...groupKeys.all, 'my', filters] as const,
  userPublic: (userId: string, filters?: Record<string, any>) => [...groupKeys.all, 'user', userId, filters] as const,
  detail: (id: string) => [...groupKeys.all, 'detail', id] as const,
  activity: (groupId: string, limit?: number) => [...groupKeys.all, 'activity', groupId, limit] as const,
  stats: (groupId: string) => [...groupKeys.all, 'stats', groupId] as const,
};

export const followKeys = {
  all: ['follow'] as const,
  following: (userId: string, filters?: Record<string, any>) => [...followKeys.all, 'following', userId, filters] as const,
  followers: (userId: string, filters?: Record<string, any>) => [...followKeys.all, 'followers', userId, filters] as const,
  status: (userId: string, targetId: string) => [...followKeys.all, 'status', userId, targetId] as const,
  suggestions: (limit?: number) => [...followKeys.all, 'suggestions', limit] as const,
  mutual: (userId: string, targetId: string) => [...followKeys.all, 'mutual', userId, targetId] as const,
  stats: () => [...followKeys.all, 'stats'] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...notificationKeys.lists(), filters] as const,
  unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
  detail: (id: string) => [...notificationKeys.all, 'detail', id] as const,
};

export const codeExecutionKeys = {
  all: ['codeExecution'] as const,
  history: (questionId: string, params?: any) => [...codeExecutionKeys.all, 'history', questionId, params] as const,
};

export const sheetsKeys = {
  all: ['sheets'] as const,
  lists: () => [...sheetsKeys.all, 'list'] as const,
  list: (params?: Record<string, any>) => [...sheetsKeys.lists(), params] as const,
  details: () => [...sheetsKeys.all, 'detail'] as const,
  detail: (slug: string) => [...sheetsKeys.details(), slug] as const,
  progress: (slug: string, username?: string) => [...sheetsKeys.detail(slug), 'progress', username ?? 'me'] as const,
  chart: (slug: string, username?: string) => [...sheetsKeys.detail(slug), 'chart', username ?? 'me'] as const,
  bookmarks: (params?: Record<string, any>) => [...sheetsKeys.all, 'bookmarks', params] as const,
};