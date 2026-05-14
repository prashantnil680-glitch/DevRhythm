/**
 * Activity Dashboard – TypeScript definitions
 * Based on updated API responses from activity.controller.js
 */

// ========== Hero / Today's Activity ==========
export interface TodayActivityResponse {
  date: string;
  dayOfWeek: string;
  problemsSolved: number;
  revisionsCompleted: number;
  studyTimeMinutes: number;
  goalAchieved: boolean;
  goalTarget: number;
  goalCompletion: number;
  submissions: number;
  testCaseExecutions: number;
  passedCount: number;
  failedCount: number;
  activityBreakdown: {
    easy: number;
    medium: number;
    hard: number;
    leetcode: number;
    hackerrank: number;
    codeforces: number;
    other: number;
  };
  // New grouped fields (same as in AllActivityLogsResponse)
  question_solved?: Record<string, QuestionSolvedGroup>;
  question_mastered?: Record<string, QuestionMasteredGroup>;
  revision_completed?: RevisionCompletedResponse;
  goal_achieved?: {
    completed: GoalAchievedItem[];
    failed: GoalAchievedItem[];
  };
  group_goal_progress?: any[];
  group_goal_completed?: any[];
  group_challenge_progress?: any[];
  group_challenge_completed?: any[];
}

export interface SolvedQuestionItem {
  _id: string;
  questionId?: string;
  platformQuestionId: string;
  title: string;
  platform: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  solvedAt: string;
  timeSpent: number;
}

export interface RevisionCompletedItem {
  _id: string;
  questionId?: string;
  platformQuestionId: string;
  title: string;
  platform: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  completedAt: string;
  timeSpent: number;
  confidenceAfter: number | null;
  overdueCompleted: boolean;
  outOfOrder: boolean;
}

// ========== Daily Trend (30 days) ==========
export interface DailyTrendResponse {
  labels: string[];
  problemsSolved: number[];
  revisionsCompleted: number[];
  studyTimeMinutes: number[];
  goalCompletionRate: number[];
}

// ========== Monthly Trend (12 months) ==========
export interface MonthlyTrendResponse {
  labels: string[];
  problemsSolved: number[];
  goalsCompleted: number[];
  revisionCompletionRate: number[];
  comparison: {
    avgGoalsCompleted: number[];
    userAhead?: boolean[];
  } | null;
}

// ========== Social Feed ==========
export interface SocialFeedResponse {
  users: Record<string, SocialFeedUser>;
}

export interface SocialFeedUser {
  userInfo: {
    _id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  solvedToday: SocialFeedSolvedItem[];
}

export interface SocialFeedSolvedItem {
  _id: string;
  question: {
    _id: string;
    title: string;
    platform: string;
    platformQuestionId: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    pattern?: string[];
    patternSlugs?: string[];
  };
  solvedAt: string;
  timeSpent: number;
}

// ========== Timeline Entry Types ==========
export interface TimelineEntry {
  _id: string;
  timestamp: string;
  timeSpent: number;
}

export interface SolveTimelineEntry extends TimelineEntry {
  isFirstSolve: boolean;
}

export interface RevisionTimelineEntry extends TimelineEntry {
  overdueCompleted: boolean;
  outOfOrder: boolean;
  confidenceAfter: number | null;
  scheduledDate: string;
  revisionIndex: number;
}

export interface QuestionSummary {
  _id: string;
  title: string;
  platform: string;
  platformQuestionId: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  pattern?: string[];
  patternSlugs?: string[];
}

export interface QuestionSolvedGroup {
  question: QuestionSummary;
  solves_timeline: SolveTimelineEntry[];
}

export type QuestionMasteredGroup = QuestionSolvedGroup;

export interface RevisionCompletedGroup {
  question: QuestionSummary;
  revision_timeline: RevisionTimelineEntry[];
}

// ========== Goal Types ==========
export interface GoalAchievedItem {
  _id: string;
  goalType: 'daily' | 'weekly' | 'planned';
  targetCount: number;
  completedCount: number;
  startDate: string;
  endDate: string;
  completionPercentage: number;
  status: 'completed' | 'failed';
  achievedAt: string | null;
  completedQuestions: Array<{
    questionId: string;
    completedAt: string;
    platformQuestionId?: string;
  }>;
}

export interface ActivityPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ========== Group Activity Types ==========
export interface GroupGoalProgressItem {
  _id: string;
  userId: string;
  action: 'group_goal_progress';
  targetId: { _id: string };
  targetModel: 'StudyGroup';
  metadata: {
    goalId: string;
    delta: number;
    newProgress: number;
    target: number;
  };
  timestamp: string;
}

export interface GroupGoalCompletedItem {
  _id: string;
  userId: string;
  action: 'group_goal_completed';
  targetId: { _id: string };
  targetModel: 'StudyGroup';
  metadata: {
    goalId: string;
    target: number;
  };
  timestamp: string;
}

export interface GroupChallengeProgressItem {
  _id: string;
  userId: string;
  action: 'group_challenge_progress';
  targetId: { _id: string };
  targetModel: 'StudyGroup';
  metadata: {
    challengeId: string;
    newProgress: number;
    target: number;
  };
  timestamp: string;
}

export interface GroupChallengeCompletedItem {
  _id: string;
  userId: string;
  action: 'group_challenge_completed';
  targetId: { _id: string };
  targetModel: 'StudyGroup';
  metadata: {
    challengeId: string;
    target: number;
  };
  timestamp: string;
}

// ========== Main Response Types ==========
export interface RevisionCompletedResponse {
  on_time?: Record<string, RevisionCompletedGroup>;
  overdue?: Record<string, RevisionCompletedGroup>;
  ratio?: {
    on_time: number;
    overdue: number;
    counts: { on_time: number; overdue: number; total: number };
  };
  message?: string | null;
}

export interface AllActivityLogsResponse {
  question_solved?: Record<string, QuestionSolvedGroup>;
  question_mastered?: Record<string, QuestionMasteredGroup>;
  revision_completed?: RevisionCompletedResponse;
  goal_achieved?: {
    completed: GoalAchievedItem[];
    failed: GoalAchievedItem[];
    pagination: ActivityPagination;
  };
  group_goal_progress?: GroupGoalProgressItem[];
  group_goal_completed?: GroupGoalCompletedItem[];
  group_challenge_progress?: GroupChallengeProgressItem[];
  group_challenge_completed?: GroupChallengeCompletedItem[];
}

// ========== Request Parameters ==========
export interface DailyTrendParams {
  days?: number;
}

export interface MonthlyTrendParams {
  months?: number;
  includeComparison?: boolean;
}

export interface ActivityLogsParams {
  action?: 'question_solved' | 'question_mastered' | 'revision_completed' | 'goal_achieved' | 'group_goal_progress';
  type?: 'on_time' | 'overdue';
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: 'timestamp' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  goalPage?: number;
  goalLimit?: number;
}

export interface SocialFeedParams {
  page?: number;
  limit?: number;
}