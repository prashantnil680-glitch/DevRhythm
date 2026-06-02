import type { ID, ISODateString, Difficulty, Platform } from '@/shared/types';

// ===== Core Sheet Types =====

/**
 * Represents a sheet (curated list of questions).
 * Matches the response from GET /api/v1/sheets and GET /api/v1/sheets/:slug.
 */
export interface Sheet {
  _id: ID;
  name: string;
  slug: string;
  description: string;
  ownerId: ID;
  questions: ID[];
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  specialTag?: string;
  originalSourceName?: string;
  originalSourceUrl?: string;
  bookmarkCount: number;      
  isBookmarked: boolean;      
}

export interface Participant {
  userId: ID;
  username: string;
  avatarUrl?: string;
}

/**
 * Sheet with additional computed fields (participant count) for listing pages.
 */
export interface SheetWithStats extends Sheet {
  participantCount: number;
  participants: Participant[];
}

/**
 * Question information embedded within sheet responses.
 * Minimal fields needed for display.
 */
export interface SheetQuestion {
  _id: ID;
  title: string;
  problemLink: string;
  platform: Platform;
  platformQuestionId: string;
  difficulty: Difficulty;
  tags: string[];
  tagsSlugs: string[];
}

// ===== Tag Grouping =====

/**
 * A group of questions sharing the same set of tags.
 * Used for visual grouping on the sheet details page.
 */
export interface TagGroup {
  tags: string[];
  questions: SheetQuestion[];
}

// ===== Participant & Membership =====

/**
 * Minimal participant information (for listing avatars).
 */
export interface Participant {
  userId: ID;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

/**
 * Full membership information (internal use).
 */
export interface SheetMembership {
  _id: ID;
  sheetId: ID;
  userId: ID;
  targetDate: ISODateString;
  joinedAt: ISODateString;
  completedAt: ISODateString | null;
}

/**
 * Per‑question progress of a user within a sheet.
 */
export interface SheetProgress {
  _id: ID;
  sheetId: ID;
  userId: ID;
  questionId: ID;
  solved: boolean;
  revisionCompleted: boolean;
  lastUpdated: ISODateString;
}

// ===== Statistics & Aggregates =====

/**
 * Aggregated stats for a sheet (returned with sheet details).
 */
export interface SheetStats {
  totalParticipants: number;
  perQuestionParticipantCounts: Record<string, number>;  
  perQuestionSolvedCounts: Record<string, number>;       
}

// ===== Current User's Progress (within a sheet) =====

/**
 * Detailed progress of the current user within a sheet.
 * Returned by GET /api/v1/sheets/:slug/progress/me
 */
export interface UserSheetProgress {
  joinedAt: ISODateString;
  targetDate: ISODateString;
  completedAt: ISODateString | null;
  solvedCount: number;
  revisionCompletedCount: number;
  totalQuestions: number;
 details: UserProgressDetail[];
}

// ===== Another User's Progress (public view) =====

/**
 * Progress of a specific user in a sheet, including per‑question status.
 * Returned by GET /api/v1/sheets/:slug/progress/:username
 */
export interface UserProgress {
  userId: ID;
  joinedAt: ISODateString;
  targetDate: ISODateString;
  completedAt: ISODateString | null;
  isFullyCompleted: boolean;
  progress: Array<{
    question: SheetQuestion;
    solved: boolean;
    revisionCompleted: boolean;
    lastUpdated: ISODateString | null;
  }>;
  stats: {
    solvedCount: number;
    revisionCompletedCount: number;
    totalQuestions: number;
    completionPercentage: number; // (solved+revision) / (totalQuestions*2) * 100
  };
  shareLink: string;
}

// ===== Chart Data =====
export interface AggregatedChartData {
  chart: {
    type: string;
    labels: string[];
    datasets: Array<{ data: number[] }>;
  };
  metadata: {
    totalQuestions: number;
    totalParticipants: number;
    totalProgressRecords: number;
    solvedPercentage: number;
    revisionCompletedPercentage: number;
  };
}

export interface RankEntry {
  rank: number;
  _id: string;
  solvedCount: number;
  revisionCompletedCount: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface RankResponse {
  topRanks: RankEntry[];
  currentUser: RankEntry;
}

/**
 * Chart‑ready data for a user's progress.
 * Returned by GET /api/v1/sheets/:slug/progress/me/chart and /:username/chart
 */
export interface ProgressChartData {
  solved: {
    count: number;
    remaining: number;
    percentage: number;
  };
  revision: {
    completed: number;
    remaining: number;
    percentage: number;
  };
  totalQuestions: number;
}

// ===== API Request / Response Types =====

/**
 * Parameters for GET /api/v1/sheets (listing).
 */
export interface GetSheetsParams {
  search?: string;
  ownerId?: string;
  sortBy?: 'createdAt' | 'name' | 'updatedAt' | 'bookmarkCount'; 
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  mySheets?: boolean;
}

/**
 * Response shape for GET /api/v1/sheets.
 */
export interface SheetsListResponse {
  sheets: SheetWithStats[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Response shape for GET /api/v1/sheets/:slug.
 */
export interface SheetDetailsResponse {
  sheet: Sheet;
  questions: SheetQuestion[];
  participants: Participant[];
  stats: SheetStats;
  hasJoined: boolean;
  currentUserProgress: UserSheetProgress | null;
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
 * Request body for POST /api/v1/sheets (manual creation).
 */
export interface CreateSheetRequest {
  name: string;
  description?: string;
  questions: string[];          // Array of titles, platformQuestionIds, or ObjectIds
  targetDate: ISODateString;    // ISO date string, must be future
}

/**
 * Request body for POST /api/v1/sheets/:slug/join.
 */
export interface JoinSheetRequest {
  targetDate: ISODateString;
}

/**
 * Request body for PATCH /api/v1/sheets/:slug/target-date.
 */
export interface UpdateTargetDateRequest {
  targetDate: ISODateString;
}

/**
 * Request body for PUT /api/v1/sheets/:slug (update sheet metadata).
 */
export interface UpdateSheetRequest {
  name?: string;
  description?: string;
  questions?: string[];         // Array of identifiers
  specialTag?: string;
  originalSourceName?: string;
  originalSourceUrl?: string;
}

/**
 * Request body for POST /api/v1/sheets/import (multipart form data).
 * The file is attached as 'file', metadata as fields.
 */
export interface ImportSheetRequest {
  sheetName: string;
  description?: string;
  targetDate: ISODateString;
  // file: File (handled separately as FormData)
}

/**
 * Error response when duplicate sheet name conflict (409).
 */
export interface DuplicateSheetErrorData {
  existingSheetSlug: string;
}

/**
 * Error response when some questions cannot be resolved (400).
 */
export interface UnresolvedIdentifiersErrorData {
  unresolved: string[];
}

export interface UserProgressDetail {
  questionId: ID;
  solved: boolean;
  revisionCompleted: boolean;
}
