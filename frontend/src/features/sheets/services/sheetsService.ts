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
   * Get a single sheet by slug.
   * Optional authentication via apiClient (token is added if present).
   * GET /api/v1/sheets/:slug
   */
  async getSheetBySlug(slug: string): Promise<SheetDetailsResponse> {
    const response = await apiClient.get<SheetDetailsResponse>(`/sheets/${slug}`);
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
  async getUserProgress(slug: string, username: string): Promise<UserProgress> {
    const response = await apiClient.get<UserProgress>(`/sheets/${slug}/progress/${username}`);
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
  async getSheetsCount(): Promise<{ count: number }> {
    const response = await apiClient.get('/sheets/count');
    return response.data;
  },
};