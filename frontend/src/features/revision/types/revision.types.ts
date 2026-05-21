import type { RevisionSchedule } from '@/shared/types';

export interface RevisionListResponse {
  revisions: RevisionSchedule[];
  pagination: any;
}

export interface TodayRevisionsResponse {
  pendingRevisions: Array<{
    _id: string;
    questionId: any;
    scheduledDate: string;
    revisionIndex: number;
    overdue: boolean;
  }>;
  stats: any;
}

export interface UpcomingRevisionsResponse {
  upcomingRevisions: Array<{
    _id: string;
    date: string;
    count: number;
    questions: any[];
  }>;
  stats: any;
}

export interface OverdueRevisionsResponse {
  revisions: RevisionSchedule[];
  pagination: any;
}

export interface RevisionStats {
  totalActive: number;
  totalCompleted: number;
  totalOverdue: number;
  completionRate: number;
}


export interface RevisionDashboardStats {
  summary: {
    totalActiveSchedules: number;
    totalCompletedSchedules: number;
    totalOverdueSchedules: number;
    totalRevisionsCompleted: number;
    totalRevisionsScheduled: number;
    totalRevisionsPending: number;
    completionRate: number;
    averageOverdueDays: number;
    maxOverdueDays: number;
    revisionStreak: { current: number; longest: number };
  };
  byRevisionIndex: Array<{
    index: number;
    totalQuestions: number;
    completed: number;
    completionRate: number;
    skipped: number;
    averageTimeSpent: number;
    averageConfidenceAfter: number | null;
    dropoutRate: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      completed: number;
      timeSpent: number;
      avgConfidence: number | null;
    }>;
    weekly: any[];
    monthly: any[];
  };
  overdueDistribution: Record<string, number>;
  byDifficulty: Record<string, {
    totalRevisions: number;
    completed: number;
    totalTimeSpent: number;
    confidenceSum: number;
    confidenceCount: number;
    overdueCount: number;
    completionRate: number;
    averageTimeSpent: string;
    averageConfidenceAfter: string | null;
  }>;
  byPlatform: Record<string, {
    totalRevisions: number;
    completed: number;
    totalTimeSpent: number;
    confidenceSum: number;
    confidenceCount: number;
    overdueCount: number;
    completionRate: number;
    averageTimeSpent: string;
    averageConfidenceAfter: string | null;
  }>;
  byPattern: Array<{
    patternName: string;
    slug: string;
    totalRevisions: number;
    completed: number;
    totalTimeSpent: number;
    confidenceSum: number;
    confidenceCount: number;
    overdueCount: number;
    completionRate: number;
    averageTimeSpent: string;
    averageConfidenceAfter: string | null;
  }>;
  timeStats: {
    totalMinutesSpent: number;
    averageMinutesPerRevision: string;
    averageMinutesPerDay: number;
    mostProductiveDay: string | null;
    mostProductiveDayMinutes: number;
    timeByDifficulty: Record<string, number>;
  };
  confidenceStats: {
    overallAverageAfter: number | null;
    confidenceDistributionAfter: Record<number, number>;
    confidenceImprovementByRevisionIndex: any[];
  };
  overdueRevisions?: any[];
  upcomingRevisions?: any[];
}

export interface UpcomingRevisionsListResponse {
  upcomingRevisions: Array<{
    _id: string;
    date: string;
    count: number;
    questions: Array<{
      _id: string;
      questionId: {
        _id: string;
        platformQuestionId: string;
        title: string;
        difficulty: string;
        platform: string;
      };
      revisionIndex: number;
      status: string;
      scheduledDate?: string;      
      totalTimeSpent?: number;     
      attempts?: number;           
      confidenceAfter?: number;           
    }>;
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

export interface OverdueRevisionsListResponse {
  revisions: Array<{
    _id: string;
    questionId: string | null;
    schedule: string[];
    currentRevisionIndex: number;
    status: string;
    platformQuestionId?: string;   
    title?: string;                
    difficulty?: string;           
    platform?: string;             
    scheduledDate?: string;        
    totalTimeSpent?: number;       
    confidenceAfter?: number | null; 
    overdue?: boolean;             
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