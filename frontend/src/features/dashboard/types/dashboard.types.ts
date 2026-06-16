// ===== Summary =====
export interface DashboardSummary {
  totalSolved: number;
  masteryRate: number;
  currentStreak: number;
  longestStreak: number;
}

// ===== Productivity =====
export interface HeatmapSummary {
  yearlyProblems: number;
  activeDaysPercentage: number;
  consistencyScore: number;
}

export interface HeatmapDataPoint {
  date: string;
  activityCount: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
}

export interface WeeklyStudyTimeData {
  currentWeekMinutes: number;
  previousWeekMinutes: number;
  weekOverWeekChangePercent: number;
  monthlyAverageWeeklyMinutes: number;
  changeFromMonthlyAveragePercent: number;
}

export interface ProductivityData {
  heatmap: HeatmapSummary;
  weeklyStudyTime: WeeklyStudyTimeData;
  currentMonthHeatmap: HeatmapDataPoint[];
}

// ===== Goals =====
export interface CurrentGoal {
  _id?: string;
  goalType: 'daily' | 'weekly' | 'planned';
  targetCount: number;
  completedCount: number;
  completionPercentage: number;
  status: 'active' | 'completed' | 'failed';
  startDate: string;
  endDate: string;
}

export interface GoalGraphPoint {
  month: string;
  completed: number;
  average?: number;
}

export interface PlannedGoal {
  id: string;
  title: string;
  description: string;
  deadline: string;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  questions: Array<{
    id: string;
    platformQuestionId: string;
    title: string;
    totalTimeSpent: number;
    revisionCount: number;
    attemptsCount: number;
    lastPracticed: string;
    status: string;
  }>;
}

export interface GoalsData {
  current: {
    daily: CurrentGoal | null;
    weekly: CurrentGoal | null;
  };
  graph: {
    labels: string[];
    datasets: Array<{ label: string; data: number[] }>;
    comparisonAvg: number[];
  };
  planned: PlannedGoal[];
}

// ===== Revisions =====
export interface RevisionItem {
  _id: string;
  questionId: string;
  platformQuestionId: string;
  title: string;
  platform: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  scheduledDate: string;
  overdue: boolean;
  totalTimeSpent?: number;
  revisionCount?: number;
  attemptsCount?: number;
  lastPracticed?: string;
  status?: string;
}

export interface RevisionsData {
  pendingTodayCount: number;
  pendingToday: RevisionItem[];
  upcomingCount: number;
  upcoming: RevisionItem[];
  completionRate: {
    percentage: number;
    trend: number;
    completed: number;
    scheduled: number;
  };
  recent: RevisionItem[];
}

// ===== Activity =====
export interface ActivityItem {
  _id?: string;
  type: 'solved' | 'revision' | 'goal_achieved' | 'question_solved' | 'question_mastered' | 'revision_completed';
  questionId?: string;
  platformQuestionId?: string;
  title: string;
  platform?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  timestamp: string;
  totalTimeSpent?: number;
  revisionCount?: number;
  attemptsCount?: number;
  lastPracticed?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface RecentlySolvedItem {
  questionId: string;
  platformQuestionId: string;
  title: string;
  platform: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  solvedAt: string;
  totalTimeSpent: number;
  revisionCount: number;
  attemptsCount: number;
  lastPracticed: string;
  status: string;
}

export interface ActivityData {
  timeline: ActivityItem[];
  recentlySolved: RecentlySolvedItem[];
}

// ===== Daily Challenge =====
export interface DailyChallenge {
  date: string;
  title: string;
  titleSlug?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  link: string;
  tags?: string[];
  isActive?: boolean;
  todayGoal?: {
    targetCount: number;
    completedCount: number;
    completionPercentage: number;
    status: string;
  };
  currentStreak?: number;
  longestStreak?: number;
  platformQuestionId?: string;
  questionId?: string;
  totalTimeSpent?: number;
  revisionCount?: number;
  attemptsCount?: number;
  lastPracticed?: string | null;
  status?: 'Not Started' | 'Attempted' | 'Solved' | 'Mastered';
}

// ===== Notifications =====
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationsData {
  unreadCount: number;
  recent: NotificationItem[];
}

// ===== Insights =====
export interface WeakestPattern {
  patternName: string;
  slug: string;
  confidenceLevel: number;
  masteryRate: number;
  solvedCount: number;
}

export interface InsightsData {
  weakestPattern: WeakestPattern | null;
}

// ===== Full Dashboard Response =====
export interface DashboardResponse {
  summary: DashboardSummary;
  productivity: ProductivityData;
  goals: GoalsData;
  revisions: RevisionsData;
  activity: ActivityData;
  dailyChallenge: DailyChallenge;
  notifications: NotificationsData;
  insights: InsightsData;
  totalUsers: number;
}