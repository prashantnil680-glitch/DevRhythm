const { client: redisClient } = require('../config/redis');

// Default TTL in seconds – configurable via environment variable
const DEFAULT_TTL = Math.max(5, parseInt(process.env.CACHE_TTL_DEFAULT) || 30);

// Helper to get keys by pattern using KEYS command (use SCAN for production with many keys)
const getKeys = async (pattern) => {
  if (!redisClient) return [];
  try {
    // ioredis provides keys(pattern) directly
    const result = await redisClient.keys(pattern);
    return result;
  } catch (err) {
    console.warn('Error getting keys:', err);
    return [];
  }
};

const cache = (duration = DEFAULT_TTL, keyPrefix = '') => {
  return async (req, res, next) => {
    if (!redisClient) return next();
    if (req.method !== 'GET') return next();

    let cacheKey = '';
    try {
      if (req.user && req.user._id) {
        cacheKey = `devrhythm:cache:${keyPrefix}:user:${req.user._id}:${req.originalUrl}`;
        if (req.userTimeZone) {
          cacheKey += `:tz:${req.userTimeZone}`;
        }
      } else {
        cacheKey = `devrhythm:cache:${keyPrefix}:${req.originalUrl}`;
      }

      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const originalJson = res.json;
      res.json = function(data) {
        // ioredis: use setex (lowercase) or set with EX option
        redisClient.setex(cacheKey, duration, JSON.stringify(data));
        originalJson.call(this, data);
      };
      next();
    } catch (error) {
      console.warn('Cache middleware error:', error.message);
      next();
    }
  };
};

const invalidateCache = async (pattern) => {
  if (!redisClient) return;
  try {
    const keys = await getKeys(`devrhythm:cache:${pattern}*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.warn('Cache invalidation error:', error.message);
  }
};

const invalidateUserCache = async (userId) => {
  await invalidateCache(`user:${userId}:`);
  await invalidateCache(`notifications:${userId}:`);
  await invalidateCache(`progress-snapshots:${userId}:`);
  await invalidateCache(`leaderboards:user:${userId}:`);
  await invalidateCache(`goal-chart:user:${userId}:*`);
};

const invalidateQuestionCache = async (questionId, platform, platformQuestionId) => {
  await invalidateCache('questions:*');
  await invalidateCache(`question:${questionId}`);
  await invalidateCache(`question:platform:${platform}:${platformQuestionId}`);
  await invalidateCache('questions:patterns');
  await invalidateCache('questions:tags');
  await invalidateCache('questions:statistics');
};

const invalidateProgressCache = async (userId) => {
  await invalidateCache(`progress:*:user:${userId}:*`);
  await invalidateCache(`progress:list:user:${userId}:*`);
  await invalidateCache(`progress:stats:user:${userId}:*`);
  await invalidateCache(`progress:recent:user:${userId}:*`);
  await invalidateCache(`progress:question:*:user:${userId}:*`);
};

const invalidateGoalChartCache = async (userId) => {
  await invalidateCache(`goal-chart:user:${userId}:*`);
};

const invalidateDashboardCache = async (userId) => {
  await invalidateCache(`dashboard:user:${userId}`);
};

const invalidateSheetCache = async (sheetId, slug = null) => {
  await invalidateCache(`sheet:${sheetId}:*`);
  if (slug) {
    await invalidateCache(`sheet:${slug}:*`);
  }
  await invalidateCache('sheets:list:*');
};

module.exports = {
  cache,
  invalidateCache,
  invalidateUserCache,
  invalidateQuestionCache,
  invalidateProgressCache,
  invalidateGoalChartCache,
  invalidateDashboardCache,
  invalidateSheetCache,
};