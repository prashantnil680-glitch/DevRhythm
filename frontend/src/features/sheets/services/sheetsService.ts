import apiClient, { buildQueryString, ApiClientResponse } from '@/shared/lib/apiClient';
import type {
  GetSheetsParams,
  SheetsListResponse,
  SheetDetailsResponse,
  CreateSheetRequest,
  JoinSheetRequest,
  UpdateTargetDateRequest,
  UpdateSheetRequest,
  UserSheetProgress,
  UserProgress,
  ProgressChartData,
  SheetMembership,
  SheetWithStats,
  AggregatedChartData,
  RankResponse,
} from '../types/sheets.types';

export const sheetService = {
  /**
   * Get paginated list of sheets with optional filters.
   * GET /api/v1/sheets
   */
  async getSheets(params?: GetSheetsParams): Promise<SheetsListResponse> {
    const query = buildQueryString(params);
    const response = await apiClient.get<SheetWithStats[]>(`/sheets${query}`) as ApiClientResponse<SheetWithStats[]>;
    return {
      sheets: response.data,
      pagination: response.meta?.pagination || {
        page: params?.page || 1,
        limit: params?.limit || 20,
        total: response.data.length,
        pages: 1,
      },
    };
  },

/**
   * Get a single sheet by slug with optional filtering and pagination.
   * GET /api/v1/sheets/:slug
   */
  async getSheetBySlug(slug: string, params?: {
    page?: number;
    limit?: number;
    search?: string;
    solveStatus?: string;
    revisionStatus?: string;
    difficulty?: string;
  }): Promise<SheetDetailsResponse> {
    const query = buildQueryString(params);
    const response = await apiClient.get<SheetDetailsResponse>(`/sheets/${slug}${query}`);
    return response.data;
  },

  /**
   * Join a sheet as the authenticated user.
   * POST /api/v1/sheets/:slug/join
   */
  async joinSheet(slug: string, targetDate: string): Promise<{ membership: SheetMembership }> {
    const payload: JoinSheetRequest = { targetDate };
    const response = await apiClient.post<{ membership: SheetMembership }>(
      `/sheets/${slug}/join`,
      payload
    );
    return response.data;
  },

  /**
   * Leave a sheet (remove membership and progress).
   * DELETE /api/v1/sheets/:slug/leave
   */
  async leaveSheet(slug: string): Promise<void> {
    await apiClient.delete(`/sheets/${slug}/leave`);
  },

  /**
   * Update the authenticated user's target date for a sheet.
   * PATCH /api/v1/sheets/:slug/target-date
   */
  async updateTargetDate(slug: string, targetDate: string): Promise<{ membership: SheetMembership }> {
    const payload: UpdateTargetDateRequest = { targetDate };
    const response = await apiClient.patch<{ membership: SheetMembership }>(
      `/sheets/${slug}/target-date`,
      payload
    );
    return response.data;
  },

  /**
   * Get current user's progress in a sheet.
   * GET /api/v1/sheets/:slug/progress/me
   */
  async getMyProgress(slug: string): Promise<UserSheetProgress> {
    const response = await apiClient.get<UserSheetProgress>(`/sheets/${slug}/progress/me`);
    return response.data;
  },

  /**
   * Get another user's progress in a sheet.
   * GET /api/v1/sheets/:slug/progress/:username
   */
  async getUserProgress(slug: string, username: string, params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'solved' | 'unsolved' | 'all';
    revisionStatus?: 'completed' | 'pending' | 'all';
    difficulty?: 'easy' | 'medium' | 'hard';
    sortBy?: 'title' | 'difficulty' | 'lastUpdated' | 'solved' | 'revisionCompleted';
    sortOrder?: 'asc' | 'desc';
  }): Promise<UserProgress> {
    const query = buildQueryString(params);
    const response = await apiClient.get<UserProgress>(`/sheets/${slug}/progress/${username}${query}`);
    return response.data;
  },

  /**
   * Get current user's progress chart data.
   * GET /api/v1/sheets/:slug/progress/me/chart
   */
  async getMyProgressChart(slug: string): Promise<ProgressChartData> {
    const response = await apiClient.get<ProgressChartData>(`/sheets/${slug}/progress/me/chart`);
    return response.data;
  },

  /**
   * Get another user's progress chart data.
   * GET /api/v1/sheets/:slug/progress/:username/chart
   */
  async getUserProgressChart(slug: string, username: string): Promise<ProgressChartData> {
    const response = await apiClient.get<ProgressChartData>(`/sheets/${slug}/progress/${username}/chart`);
    return response.data;
  },

  /**
   * Create a sheet manually.
   * POST /api/v1/sheets
   */
  async createSheet(data: CreateSheetRequest): Promise<{ sheet: any }> {
    const response = await apiClient.post<{ sheet: any }>('/sheets', data);
    return response.data;
  },

  /**
   * Import a sheet from an uploaded file (Excel, CSV, JSON).
   * Sends multipart/form-data.
   * POST /api/v1/sheets/import
   */
  async importSheet(formData: FormData): Promise<{ sheet: any; totalRows: number; matchedCount: number }> {
    const response = await apiClient.post<{
      sheet: any;
      totalRows: number;
      matchedCount: number;
    }>('/sheets/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Update sheet metadata (owner only).
   * PUT /api/v1/sheets/:slug
   */
  async updateSheet(slug: string, updates: UpdateSheetRequest): Promise<{ sheet: any }> {
    const response = await apiClient.put<{ sheet: any }>(`/sheets/${slug}`, updates);
    return response.data;
  },

  /**
   * Soft-delete a sheet (owner only).
   * DELETE /api/v1/sheets/:slug
   * Returns a warning message for UX.
   */
  async deleteSheet(slug: string): Promise<{ warning?: string }> {
    const response = await apiClient.delete<{ warning?: string }>(`/sheets/${slug}`);
    return response.data;
  },

  // ========== BOOKMARK METHODS ==========

  /**
   * Get user's bookmarked sheets, most recent first.
   * GET /api/v1/sheets/bookmarks
   */
  async getBookmarkedSheets(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<SheetsListResponse> {
    const query = buildQueryString(params);
    const response = await apiClient.get<SheetWithStats[]>(`/sheets/bookmarks${query}`) as ApiClientResponse<SheetWithStats[]>;
    return {
      sheets: response.data,
      pagination: response.meta?.pagination || {
        page: params?.page || 1,
        limit: params?.limit || 20,
        total: response.data.length,
        pages: 1,
      },
    };
  },

  /**
   * Toggle bookmark for a sheet.
   * POST /api/v1/sheets/:slug/bookmark
   */
  async toggleBookmark(slug: string): Promise<{ isBookmarked: boolean; bookmarkCount: number }> {
    const response = await apiClient.post<{ isBookmarked: boolean; bookmarkCount: number }>(
      `/sheets/${slug}/bookmark`
    );
    return response.data;
  },
  async getSheetsCount(): Promise<{ total: number }> {
    const response = await apiClient.get('/sheets/count');
    return response.data;
  },

  async getAggregatedProgress(slug: string): Promise<AggregatedChartData> {
    const response = await apiClient.get<AggregatedChartData>(`/sheets/${slug}/progress/chart`);
    return response.data;
  },

  async getSheetRank(slug: string): Promise<RankResponse> {
    const response = await apiClient.get<RankResponse>(`/sheets/${slug}/rank`);
    return response.data;
  },

  async getSheetParticipants(slug: string, params?: { page?: number; limit?: number }): Promise<{ participants: any[]; pagination: any }> {
    const query = buildQueryString(params);
    const res = await apiClient.get(`/sheets/${slug}/participants${query}`);
    const data = (res as any).data;
    const meta = (res as any).meta;
    return {
      participants: data,
      pagination: meta?.pagination || {
        page: params?.page || 1,
        limit: params?.limit || 20,
        total: data.length,
        totalPages: 1,
      },
    };
  },

  /**
   * Create a sheet asynchronously (with progress tracking).
   * POST /api/v1/sheets/async
   */
  async createSheetAsync(data: any): Promise<{ data: { jobId: string } }> {
    const response = await apiClient.post<{ jobId: string }>('/sheets/async', data);
    return response;
  },

  /**
   * Get progress of an async sheet creation job.
   * GET /api/v1/sheets/create/progress/:jobId
   */
  async getSheetCreateProgress(jobId: string): Promise<any> {
    const response = await apiClient.get(`/sheets/create/progress/${jobId}`);
    return response.data;
  },

  /**
   * Get current user's draft for a given type.
   * GET /api/v1/sheets/drafts?type=manual|import
   */
  async getDraft(type: 'manual' | 'import'): Promise<any> {
    const response = await apiClient.get(`/sheets/drafts`, { params: { type } });
    return response.data;
  },

  /**
   * Save or update current user's draft.
   * POST /api/v1/sheets/drafts
   */
  async saveDraft(type: 'manual' | 'import', data: any): Promise<{ draftId: string; updatedAt: string }> {
    const response = await apiClient.post('/sheets/drafts', { type, data });
    return response.data;
  },

  /**
   * Delete current user's draft for a given type.
   * DELETE /api/v1/sheets/drafts?type=manual|import
   */
  async deleteDraft(type: 'manual' | 'import'): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete('/sheets/drafts', { params: { type } });
    return response.data;
  },

  /**
   * Upload a file to Cloudinary and store metadata.
   * POST /api/v1/sheets/upload-file
   */
  async uploadFile(file: File): Promise<{ publicId: string; fileName: string; url: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/sheets/upload-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Delete an uploaded file from Cloudinary.
   * DELETE /api/v1/sheets/uploaded-files/:publicId
   */
  async deleteUploadedFile(publicId: string): Promise<void> {
    await apiClient.delete(`/sheets/uploaded-files/${publicId}`);
  },
};