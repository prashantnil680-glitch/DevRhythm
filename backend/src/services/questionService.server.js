const { serverFetch } = require('@/shared/lib/serverApiClient');
const { buildQueryString } = require('@/shared/lib/apiClient');
const { client: redisClient } = require('../../config/redis');
const Question = require('../../models/Question');

const platforms = [
  'LeetCode',
  'Codeforces',
  'HackerRank',
  'AtCoder',
  'CodeChef',
  'GeeksForGeeks',
  'Other',
];

const getCacheKey = (slug) => `ssr:question:${slug}`;

const questionServiceServer = {
  async getQuestions(params) {
    const query = buildQueryString(params);
    return serverFetch(`/questions${query}`);
  },

  async getQuestionByPlatformId(platform, platformQuestionId) {
    const data = await serverFetch(
      `/questions/platform/${platform}/${platformQuestionId}`,
      { cache: 'no-store' }
    );
    return data.question;
  },

  async getQuestionById(id) {
    const data = await serverFetch(`/questions/${id}`, { cache: 'no-store' });
    return data.question;
  },

  async getQuestionBySlug(slug) {
    if (redisClient) {
      try {
        const cacheKey = getCacheKey(slug);
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        console.warn(`[questionServiceServer] Redis get error for slug ${slug}:`, err.message);
      }
    }

    const question = await Question.findOne({
      isActive: true,
      $or: platforms.map(p => ({ platform: p, platformQuestionId: slug }))
    }).lean();

    if (!question) {
      throw new Error(`Question with slug "${slug}" not found`);
    }

    if (redisClient) {
      try {
        const cacheKey = getCacheKey(slug);
        await redisClient.setEx(cacheKey, 300, JSON.stringify(question));
      } catch (err) {
        console.warn(`[questionServiceServer] Redis set error for slug ${slug}:`, err.message);
      }
    }

    return question;
  },

  async getPatterns() {
    const data = await serverFetch('/questions/patterns');
    return data.patterns;
  },

  async getTags() {
    const data = await serverFetch('/questions/tags');
    return data.tags;
  },

  async getStatistics() {
    const data = await serverFetch('/questions/statistics');
    return data.statistics;
  },

  async getSimilarQuestions(id) {
    const data = await serverFetch(`/questions/similar/${id}?limit=9`, { cache: 'no-store' });
    return data.similarQuestions;
  },

  async getDeletedQuestions(params) {
    const query = buildQueryString(params);
    return serverFetch(`/questions/deleted${query}`);
  },
};

module.exports = { questionServiceServer };