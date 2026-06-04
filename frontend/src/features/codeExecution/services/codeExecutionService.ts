import apiClient from '@/shared/lib/apiClient';

export const codeExecutionService = {
  async execute(data: any) {
    const response = await apiClient.post('/code/execute', data);
    return response.data; // returns { data: { jobId, status }, success, ... }
  },

  async getResult(jobId: string) {
    const response = await apiClient.get(`/code/result/${jobId}`);
    return response.data;
  },

  async getHistory(questionId: string, params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams();
    query.set('questionId', questionId);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const response = await apiClient.get(`/code/history?${query.toString()}`);
    return response.data;
  },
};