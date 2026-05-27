import apiClient, { ApiClientResponse, buildQueryString } from '@/shared/lib/apiClient';
import type { Question, RevisionSchedule, UserQuestionProgress } from '@/shared/types';
import type { QuestionListResponse, QuestionStatistics } from '../types/question.types';

export const questionService = {
  async getQuestions(params?: {
    page?: number;
    limit?: number;
    platform?: string;
    difficulty?: string;
    pattern?: string;
    tags?: string[];
    search?: string;
    status?: string;
  }) {
    const query = buildQueryString(params);
    const response = await apiClient.get<{ questions: Question[] }>(`/questions${query}`) as ApiClientResponse<{ questions: Question[] }>;
    return {
      questions: response.data.questions,
      pagination: response.meta?.pagination,
    };
  },

  async getQuestionDetails(id: string) {
    const response = await apiClient.get<{
      question: Question;
      progress: UserQuestionProgress | null;
      revision: RevisionSchedule | null;
      codeExecutionHistory: any[];
      activityLogs: any[];
    }>(`/questions/${id}/details`);
    return response.data;
  },

  async fetchLeetCodeQuestion(
    url: string,
    signal?: AbortSignal
  ): Promise<{ title: string; difficulty: string; tags: string[]; link: string; description: string }> {
    const response = await apiClient.post<{
      title: string;
      difficulty: string;
      tags: string[];
      link: string;
      description: string;
    }>('/questions/fetch-leetcode', { url }, { signal });
    return response.data;
  },

  async searchLeetCodeQuestions(
    query: string,
    type: 'name' | 'tag' = 'name',
    signal?: AbortSignal
  ): Promise<{ results: Array<{ title: string; slug: string; difficulty: string; tags: string[]; url: string }> }> {
    const response = await apiClient.get('/questions/search-leetcode', {
      params: { q: query, type },
      signal,
    });
    return response.data;
  },

  async getQuestionById(id: string) {
    const response = await apiClient.get<{ question: Question }>(`/questions/${id}`);
    return response.data.question;
  },

  async getQuestionByPlatformId(platform: string, platformQuestionId: string): Promise<Question> {
    const response = await apiClient.get<{ question: Question }>(
      `/questions/platform/${platform}/${platformQuestionId}`
    );
    return response.data.question;
  },

  async getSimilarQuestions(id: string) {
    const response = await apiClient.get<{ similarQuestions: Question[] }>(`/questions/similar/${id}`);
    return response.data.similarQuestions;
  },

  async getPatterns() {
    const response = await apiClient.get<{ patterns: string[] }>('/questions/patterns');
    return response.data.patterns;
  },

  async getTags() {
    const response = await apiClient.get<{ tags: string[] }>('/questions/tags');
    return response.data.tags;
  },

  async getStatistics() {
    const response = await apiClient.get<{ statistics: QuestionStatistics }>('/questions/statistics');
    return response.data.statistics;
  },

  async getDeletedQuestions(params?: {
    page?: number;
    limit?: number;
    platform?: string;
    difficulty?: string;
    pattern?: string;
    tags?: string[];
    search?: string;
  }) {
    const query = buildQueryString(params);
    const response = await apiClient.get<QuestionListResponse>(`/questions/deleted${query}`);
    return response.data;
  },

  async createQuestion(data: any) {
    const response = await apiClient.post<{ question: Question }>('/questions', data);
    return response.data.question;
  },

  async updateQuestion(id: string, data: any) {
    const response = await apiClient.put<{ question: Question }>(`/questions/${id}`, data);
    return response.data.question;
  },

  async deleteQuestion(id: string) {
    await apiClient.delete(`/questions/${id}`);
  },

  async restoreQuestion(id: string) {
    const response = await apiClient.post<{ question: Question }>(`/questions/${id}/restore`);
    return response.data.question;
  },

  async permanentDeleteQuestion(id: string) {
    await apiClient.delete(`/questions/${id}/permanent`);
  },

    /**
   * Get paginated questions for a pattern slug (e.g., "hash-table")
   * GET /questions/pattern/:patternSlug
   */
  async getQuestionsByPattern(patternSlug: string, page: number = 1, limit: number = 15): Promise<{
    pattern: { name: string; slug: string; totalQuestions: number };
    questions: Array<{
      _id: string;
      title: string;
      problemLink: string;
      platform: string;
      platformQuestionId: string;
      difficulty: 'Easy' | 'Medium' | 'Hard';
      tags: string[];
      pattern: string[];
      userStatus?: 'Not Started' | 'Attempted' | 'Solved' | 'Mastered' | null;
      solvedAt?: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const query = buildQueryString({ page, limit });
    const response = await apiClient.get<{
      pattern: { name: string; slug: string; totalQuestions: number };
      questions: any[];
    }>(`/questions/pattern/${patternSlug}${query}`);
    
    // Extract pagination from meta (Vercel/backend convention)
    const pagination = (response as any).meta?.pagination || {
      page,
      limit,
      total: response.data.questions.length,
      pages: 1,
      hasNext: false,
      hasPrev: false,
    };
    
    return {
      pattern: response.data.pattern,
      questions: response.data.questions,
      pagination,
    };
  },
};