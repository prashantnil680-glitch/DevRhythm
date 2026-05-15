/**
 * Type definitions for all backend models and API request/response bodies.
 */

import type {
  ID,
  ISODateString,
  Difficulty,
  Platform,
  QuestionStatus,
  GoalType,
  GoalStatus,
  RevisionStatus,
  Privacy,
  ShareType,
  PeriodType,
  StudyGroupPrivacy,
  StudyGroupRole,
  ChallengeType,
  ChallengeStatus,
  EngagementLevel,
  SyncStatus,
  Timestamp,
} from './common.types';

// ===== Nested Interfaces =====

/** Saved code inside UserQuestionProgress */
export interface SavedCode {
  language: string;
  code: string;
  lastUpdated: ISODateString;
}

/** Attempts data inside UserQuestionProgress */
export interface Attempts {
  count: number;
  lastAttemptAt?: ISODateString;
  firstAttemptAt?: ISODateString;
  solvedAt?: ISODateString;
  masteredAt?: ISODateString;
}

/** Difficulty breakdown inside PatternMastery */
export interface DifficultyBreakdown {
  solved: number;
  mastered: number;
  totalTime: number;
  successRate: number; // 0-100
}

/** Platform distribution record */
export type PlatformDistribution = Record<Platform, number>;

/** Trend data inside PatternMastery */
export interface Trend {
  last7Days: {
    solved: number;
    mastered: number;
    successRate: number;
  };
  last30Days: {
    solved: number;
    mastered: number;
    successRate: number;
  };
  improvementRate: number;
}

/** Recent question info inside PatternMastery */
export interface PatternRecentQuestion {
  questionProgressId: ID;
  questionId: ID;
  title: string;
  problemLink?: string;
  platform: Platform;
  difficulty: Difficulty;
  solvedAt: ISODateString;
  status: 'Solved' | 'Mastered';
  timeSpent?: number;
  platformQuestionId?: string;
}
/** Daily data inside HeatmapData */
export interface HeatmapDailyData {
  date: ISODateString;
  dayOfWeek: number; // 0-6
  totalActivities: number;
  newProblemsSolved: number;
  revisionProblems: number;
  totalSubmissions: number;
  totalTimeSpent: number;
  difficultyBreakdown: {
    easy: number;
    medium: number;
    hard: number;
  };
  platformBreakdown: {
    leetcode: number;
    hackerrank: number;
    codeforces: number;
    other: number;
  };
  studyGroupActivity: number;
  dailyGoalAchieved: boolean;
  goalTarget: number;
  goalCompletion: number; // 0-100
  intensityLevel: 0 | 1 | 2 | 3 | 4;
  streakCount: number;
}

/** Performance summary inside HeatmapData */
export interface HeatmapPerformance {
  totalYearlyActivities: number;
  totalProblemsSolved: number;
  totalRevisionsCompleted: number;
  totalTimeInvested: number;
  averageDailyActivities: number;
  bestPerformingDay: {
    date: ISODateString;
    activityCount: number;
  };
  mostActiveDayOfWeek: {
    day: number; // 0-6
    averageActivity: number;
  };
  maximumDailyActivity: number;
  monthlyDistribution: Array<{
    month: number; // 1-12
    activityCount: number;
    problemsSolved: number;
  }>;
}

/** Consistency summary inside HeatmapData */
export interface HeatmapConsistency {
  activeDaysCount: number;
  consistencyScore: number; // 0-100
  currentStreak: number;
  longestStreak: number;
  breakDays: number;
  engagementLevel: EngagementLevel;
}

/** Cached render data inside HeatmapData */
export interface HeatmapCachedRenderData {
  colorScale: string[];
  monthLabels: string[];
  weekLabels: string[];
  tooltipData: Array<{
    date: ISODateString;
    summary: string;
    details: string;
  }>;
  currentDayIndex: number;
}

/** Filter views inside HeatmapData */
export interface HeatmapFilterViews {
  allActivity: number[];
  newProblemsOnly: number[];
  revisionsOnly: number[];
  studyGroupOnly: number[];
  platformViews: {
    leetcode: number[];
    hackerrank: number[];
    codeforces: number[];
  };
  difficultyViews: {
    easy: number[];
    medium: number[];
    hard: number[];
  };
}

/** Stats panel inside HeatmapData */
export interface HeatmapStatsPanel {
  currentStreak: number;
  longestStreak: number;
  yearlyProblems: number;
  activeDays: {
    count: number;
    total: number;
    percentage: number;
  };
  goalCompletion: {
    percentage: number;
    achievedDays: number;
    totalDays: number;
  };
}

/** SharedData inside Share */
export interface SharedData {
  userInfo: {
    username: string;
    displayName: string;
    avatarUrl?: string;
    totalSolved: number;
    streak: {
      current: number;
      longest: number;
    };
  };
  questions?: Array<{
    title: string;
    problemLink?: string;
    platform: Platform;
    difficulty: Difficulty;
    solvedDate: ISODateString;
    tags: string[];
    pattern?: string;
  }>;
  totalSolved: number;
  breakdown: {
    easy: number;
    medium: number;
    hard: number;
  };
  platformBreakdown: {
    LeetCode: number;
    HackerRank: number;
    CodeForces: number;
    Other: number;
  };
  dateRange?: {
    start: ISODateString;
    end: ISODateString;
  };
}

/** Study group member */
export interface StudyGroupMember {
  userId: ID;
  role: StudyGroupRole;
  joinedAt: ISODateString;
}

/** Study group goal */
export interface StudyGroupGoal {
  description: string;
  targetCount: number;
  currentCount: number;
  deadline?: ISODateString;
  status: 'active' | 'completed' | 'failed';
  createdAt: ISODateString;
  participants: Array<{
    userId: ID;
    progress: number;
    completed: boolean;
    completedAt?: ISODateString;
  }>;
}

/** Study group challenge */
export interface StudyGroupChallenge {
  name: string;
  description?: string;
  challengeType: ChallengeType;
  target: number;
  startDate: ISODateString;
  endDate: ISODateString;
  participants: Array<{
    userId: ID;
    progress: number; // 0-100
    completed: boolean;
    completedAt?: ISODateString;
  }>;
  status: ChallengeStatus;
  createdAt: ISODateString;
}

// ===== Main Model Interfaces =====

export interface User extends Timestamp {
  _id: ID;
  authProvider: 'google' | 'github';
  providerId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  streak: {
    current: number;
    longest: number;
    lastActiveDate?: ISODateString;
  };
  stats: {
    totalSolved: number;
    masteryRate: number; // 0-100
    totalRevisions: number;
    totalTimeSpent: number;
    activeDays: number;
  };
  preferences: {
    timezone: string;
    notifications: {
      revisionReminders: boolean;
      goalTracking: boolean;
      socialInteractions: boolean;
      weeklyReports: boolean;
    };
    dailyGoal: number;
    weeklyGoal: number;
  };
  lastOnline: ISODateString;
  accountCreated: ISODateString;
  followersCount: number;
  followingCount: number;
  privacy: Privacy;
  isActive: boolean;
  isOnline?: boolean;
}

export interface Question extends Timestamp {
  _id: ID;
  title: string;
  problemLink: string;
  platform: Platform;
  platformQuestionId: string;
  difficulty: Difficulty;
  tags: string[];
  pattern?: string[];
  solutionLinks: string[];
  similarQuestions: ID[];
  contentRef?: string;
  isActive: boolean;
  testCases?: Array<{
    stdin: string;
    expected: string;
    isDefault?: boolean; // optional, backend may set it
  }>;
  createdBy?: ID;          // user ID who created the question (only for manual)
  source?: 'manual' | 'leetcode'; // where the question came from
  starterCode?: Record<string, string>;
  fullRunnerCode?: Record<string, string>;
  isSolved?: boolean;
  userStatus?: QuestionStatus;
}

export interface UserQuestionProgress extends Timestamp {
  _id: ID;
  userId: ID;
  questionId: {
    _id: ID;
    title: string;
    problemLink: string;
    platform: Platform;
    platformQuestionId?: string;
    difficulty: Difficulty;
    tags: string[];
    pattern?: string;
  };
  status: QuestionStatus;
  attempts: Attempts;
  notes?: string;
  keyInsights?: string;
  savedCode?: SavedCode;
  lastRevisedAt?: ISODateString;
  revisionCount: number;
  totalTimeSpent: number;
  lastFullCode?: string;
  confidenceLevel: number;
  personalDifficulty?: Difficulty;
  personalContentRef?: string;
  customTestCases?: Array<{
    stdin: string;
    expected: string;
    createdAt?: ISODateString;
    updatedAt?: ISODateString;
  }>;
}

export interface PublicProgressItem {
  _id: ID;
  questionId: {
    _id: ID;
    title: string;
    problemLink: string;
    platform: Platform;
    platformQuestionId?: string;
    difficulty: Difficulty;
    tags: string[];
    pattern?: string;
  };
  status: 'Solved' | 'Mastered';
  solvedAt: ISODateString;
  attempts: {
    count: number;
    lastAttemptAt: ISODateString;
    firstAttemptAt: ISODateString;
  };
  revisionCount: number;
  totalTimeSpent: number;
  confidenceLevel: number;
}

export interface Goal extends Timestamp {
  _id: ID;
  userId: ID;
  goalType: GoalType;
  targetCount: number;
  completedCount: number;
  startDate: ISODateString;
  endDate: ISODateString;
  status: GoalStatus;
  completionPercentage: number; // 0-100
  achievedAt?: ISODateString;
  // Planned goal specific fields
  targetQuestions?: Array<ID | Question>;
  completedQuestions?: Array<{
    questionId: ID | Question;
    platformQuestionId?: string;
    completedAt?: ISODateString;
  }>;
}

export interface RevisionSchedule extends Timestamp {
  _id: ID;
  userId: ID;
  questionId: ID;
  schedule: ISODateString[];
  completedRevisions: Array<{
    date: ISODateString;
    completedAt: ISODateString;
    status: 'completed' | 'skipped';
  }>;
  currentRevisionIndex: number;
  status: RevisionStatus;
  overdueCount: number;
  baseDate: ISODateString;
  currentStatus?: string;
  scheduleStatuses?: Array<{
    date: ISODateString;
    status: string;
  }>;
}

export interface PatternMastery extends Timestamp {
  _id: ID;
  userId: ID;
  patternName: string;
  patternSlug: string;
  solvedCount: number;
  masteredCount: number;
  totalAttempts: number;
  successfulAttempts: number;
  successRate: number;
  masteryRate: number;
  confidenceLevel: number;
  totalTimeSpent: number;
  averageTimePerQuestion: number;
  lastPracticed?: ISODateString;
  lastUpdated: ISODateString;
  recentQuestions: PatternRecentQuestion[];
  difficultyBreakdown: {
    easy: DifficultyBreakdown;
    medium: DifficultyBreakdown;
    hard: DifficultyBreakdown;
  };
  platformDistribution: PlatformDistribution;
  trend: Trend;
}

export interface HeatmapData extends Timestamp {
  _id: ID;
  userId: ID;
  year: number;
  weekCount: number; // 1-53
  firstDate: ISODateString;
  lastDate: ISODateString;
  dailyData: HeatmapDailyData[];
  performance: HeatmapPerformance;
  consistency: HeatmapConsistency;
  lastUpdated: ISODateString;
  updateFrequency: number;
  syncStatus: SyncStatus;
  cachedRenderData?: HeatmapCachedRenderData;
  filterViews?: HeatmapFilterViews;
  statsPanel: HeatmapStatsPanel;
}

export interface Share extends Timestamp {
  _id: ID;
  userId: ID;
  shareType: ShareType;
  periodType?: PeriodType; // required if shareType === 'period'
  startDate?: ISODateString; // required if shareType === 'period'
  endDate?: ISODateString; // required if shareType === 'period'
  customPeriodName?: string;
  sharedData: SharedData;
  privacy: Privacy;
  shareToken?: string;
  accessCount: number;
  lastAccessedAt?: ISODateString;
  expiresAt: ISODateString;
}

export interface StudyGroup extends Timestamp {
  _id: ID;
  name: string;
  description?: string;
  createdBy: ID;
  members: StudyGroupMember[];
  goals: StudyGroupGoal[];
  challenges: StudyGroupChallenge[];
  privacy: StudyGroupPrivacy;
  lastActivityAt: ISODateString;
}

export interface Follow extends Timestamp {
  _id: ID;
  followerId: ID;
  followedId: ID;
  action: 'follow' | 'unfollow';
  isActive: boolean;
}

// ===== API Request Body Types =====

/** Body for creating a question */
export interface CreateQuestionRequest {
  title: string;
  problemLink: string;
  platform: Platform;
  platformQuestionId: string;
  difficulty: Difficulty;
  tags?: string[];
  pattern?: string | string[];
  solutionLinks?: string[];
  similarQuestions?: ID[];
  contentRef?: string;
}

/** Body for updating a question */
export type UpdateQuestionRequest = Partial<CreateQuestionRequest>;

/** Body for creating a goal */
export interface CreateGoalRequest {
  goalType: GoalType;
  targetCount: number;
  startDate: ISODateString;
  endDate: ISODateString;
}

/** Body for updating a goal */
export interface UpdateGoalRequest {
  targetCount?: number;
  startDate?: ISODateString;
  endDate?: ISODateString;
}

/** Body for incrementing/decrementing goal progress */
export interface AdjustGoalProgressRequest {
  amount?: number; // default 1
}

/** Body for setting goal progress directly */
export interface SetGoalProgressRequest {
  completedCount: number;
}

/** Body for creating/updating question progress */
export interface CreateOrUpdateProgressRequest {
  status?: QuestionStatus;
  notes?: string;
  keyInsights?: string;
  savedCode?: SavedCode;
  confidenceLevel?: number; // 1-5
  timeSpent?: number; // minutes
}

/** Body for updating code only */
export interface UpdateCodeRequest {
  language: string;
  code: string;
}

/** Body for updating notes only */
export interface UpdateNotesRequest {
  notes?: string;
  keyInsights?: string;
}

/** Body for updating confidence */
export interface UpdateConfidenceRequest {
  confidenceLevel: number; // 1-5
}

/** Body for recording an attempt */
export interface RecordAttemptRequest {
  timeSpent?: number; // minutes
  successful?: boolean;
}

/** Body for recording a revision */
export interface RecordRevisionRequest {
  timeSpent?: number; // minutes
  confidenceLevel?: number; // 1-5
}

/** Body for creating a revision schedule */
export interface CreateRevisionRequest {
  baseDate?: ISODateString;
  schedule?: ISODateString[]; // exactly 5 dates
}

/** Body for completing a revision */
export interface CompleteRevisionRequest {
  completedAt?: ISODateString;
  status?: 'completed' | 'skipped';
  confidenceLevel?: number; // 1-5
}

/** Body for rescheduling a revision */
export interface RescheduleRevisionRequest {
  newDate: ISODateString;
  revisionIndex: number; // 0-4
}

/** Body for creating a share */
export interface CreateShareRequest {
  shareType: ShareType;
  periodType?: PeriodType; // required if shareType === 'period'
  startDate?: ISODateString; // required if shareType === 'period'
  endDate?: ISODateString; // required if shareType === 'period'
  customPeriodName?: string;
  privacy?: Privacy; // default 'link-only'
  expiresInDays?: number; // 1-365, default 30
  includeQuestions?: boolean; // default true
  questionLimit?: number; // 1-100, default 50
}

/** Body for updating a share */
export interface UpdateShareRequest {
  privacy?: Privacy;
  expiresInDays?: number;
  customPeriodName?: string;
}

/** Body for refreshing a share */
export interface RefreshShareRequest {
  includeQuestions?: boolean;
  questionLimit?: number;
}

/** Body for creating a study group */
export interface CreateStudyGroupRequest {
  name: string;
  description?: string;
  privacy?: StudyGroupPrivacy; // default 'invite-only'
}

/** Body for updating a study group */
export interface UpdateStudyGroupRequest {
  name?: string;
  description?: string;
  privacy?: StudyGroupPrivacy;
}

/** Body for creating a group goal */
export interface CreateGroupGoalRequest {
  description: string;
  targetCount: number;
  deadline: ISODateString;
}

/** Body for updating group goal progress */
export interface UpdateGroupGoalProgressRequest {
  progress: number; // 0-targetCount
}

/** Body for creating a group challenge */
export interface CreateGroupChallengeRequest {
  name: string;
  description?: string;
  challengeType: ChallengeType;
  target: number;
  startDate: ISODateString;
  endDate: ISODateString;
}

/** Body for updating group challenge progress */
export interface UpdateGroupChallengeProgressRequest {
  progress: number; // 0-100
}

/** Body for updating user profile */
export interface UpdateUserRequest {
  displayName?: string;
  preferences?: {
    timezone?: string;
    notifications?: {
      revisionReminders?: boolean;
      goalTracking?: boolean;
      socialInteractions?: boolean;
      weeklyReports?: boolean;
    };
    dailyGoal?: number;
    weeklyGoal?: number;
  };
  privacy?: Privacy;
}

/** Body for refreshing heatmap data */
export interface RefreshHeatmapRequest {
  year?: number;
  forceFullRefresh?: boolean;
}

/** Body for exporting heatmap */
export interface ExportHeatmapRequest {
  year?: number;
  format?: 'json' | 'csv';
  includeDetails?: boolean;
}

/** User notification */
export interface Notification extends Timestamp {
  _id: ID;
  userId: ID;
  type:
    | 'revision_reminder_daily'
    | 'revision_reminder_urgent'
    | 'goal_completion'
    | 'streak_reminder'
    | 'new_follower'
    | 'weekly_report'
    | 'question_solved'
    | 'question_mastered'
    | 'revision_completed'
    | 'pod_solved'      // ✅ added
    | 'pod_available';  // ✅ added
  title: string;
  message: string;
  data: Record<string, any>; // flexible, based on type
  channel: 'in-app' | 'email' | 'both';
  status: 'pending' | 'sent' | 'failed';
  scheduledAt: ISODateString;
  sentAt?: ISODateString;
  readAt?: ISODateString;
  expiresAt?: ISODateString;
}

// ===== New types for Revision Dashboard =====

/**
 * Detailed revision statistics for the dashboard.
 * Returned by GET /revisions/stats?detailed=true
 */
export interface RevisionDashboardStats {
  summary: {
    totalActiveSchedules: number;
    completionRate: number;
    revisionStreak: { current: number; longest: number };
    totalOverdueSchedules: number;
  };
  byRevisionIndex: Array<{
    index: number;
    stage: string; // "1st review", "2nd review", etc.
    totalQuestions: number;
    completed: number;
  }>;
  byDifficulty: Array<{
    difficulty: 'Easy' | 'Medium' | 'Hard';
    totalRevisions: number;
    completionRate: number;
  }>;
  byPlatform: Array<{
    platform: string;
    totalRevisions: number;
    completionRate: number;
  }>;
  byPattern: Array<{
    patternName: string;
    totalRevisions: number;
    completed: number;
    completionRate: number;
  }>;
  trends: {
    daily: Array<{
      date: string; // YYYY-MM-DD
      completed: number;
      avgConfidence: number;
      totalTimeSpent: number;
    }>;
  };
  overdueDistribution: any;
  questionLevelDetails: Array<{
    _id: string;
    title: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    status: string;
    nextRevisionDue: string;
  }>;
}

/**
 * Response for GET /revisions/upcoming with pagination.
 */
export interface UpcomingRevisionsListResponse {
  upcomingRevisions: Array<{
    _id: string;
    date: string;
    count: number;
    questions: Array<{
      _id: string;
      questionId: {
        _id: string;
        title: string;
        difficulty: string;
        platform: string;
      };
      revisionIndex: number;
    }>;
  }>;
  stats?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Response for GET /revisions/overdue with pagination.
 */
export interface OverdueRevisionsListResponse {
  revisions: Array<{
    _id: string;
    questionId: {
      _id: string;
      title: string;
      difficulty: string;
      platform: string;
    };
    scheduledDate: string;
    revisionIndex: number;
    status: string;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}