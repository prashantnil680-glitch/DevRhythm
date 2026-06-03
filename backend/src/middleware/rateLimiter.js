const rateLimit = require('express-rate-limit');
const { client: redisClient } = require('../config/redis');
const config = require('../config');

const createMemoryLimiter = (windowMs, max) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      statusCode: 429,
      message: 'Too many requests, please try again later.',
      data: null,
      meta: {},
      error: { code: 'RATE_LIMIT_EXCEEDED' }
    }
  });
};

// Try to load Redis store
let RedisStore;
let redisStoreAvailable = false;
try {
  RedisStore = require('rate-limit-redis');
  redisStoreAvailable = true;
} catch (e) {
  console.warn('rate-limit-redis not installed, using memory store');
}

// Create a Redis limiter if possible, otherwise fallback to memory
const createRedisLimiter = (windowMs, max, keyPrefix) => {
  // Use Redis store if available and ready
  if (redisStoreAvailable && redisClient && redisClient.isReady) {
    try {
      return rateLimit({
        store: new RedisStore({
          sendCommand: (...args) => redisClient.sendCommand(args),
          prefix: `devrhythm:ratelimit:${keyPrefix}`
        }),
        windowMs,
        max,
        // Explicitly enable the Retry-After header (default is false, but we want it)
        skipHeaders: false,
        message: {
          success: false,
          statusCode: 429,
          message: 'Too many requests, please try again later.',
          data: null,
          meta: {},
          error: { code: 'RATE_LIMIT_EXCEEDED' }
        },
        // Optional: ensure Retry-After is set even if the store doesn't
        onLimitReached: (req, res, options) => {
          // Set Retry-After header to the number of seconds remaining in the window
          res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
        }
      });
    } catch (error) {
      console.warn(`Redis limiter failed for ${keyPrefix}, using memory:`, error.message);
    }
  }
  // Fallback to memory store
  return createMemoryLimiter(windowMs, max);
};

// ===== Predefined limiters (Redis-backed if possible) =====
const oauthLimiter = createRedisLimiter(15 * 60 * 1000, 200, 'oauth');
const tokenLimiter = createRedisLimiter(15 * 60 * 1000, 300, 'token');
const logoutLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'logout');
const userLimiter = createRedisLimiter(15 * 60 * 1000, 250, 'user');
const progressSnapshotLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'snapshot');
const notificationReadLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'notification');
const leaderboardLimiter = createRedisLimiter(15 * 60 * 1000, 300, 'leaderboard');
const publicLimiter = createRedisLimiter(60 * 1000, 60, 'public');

// Question endpoints
const questionCreateLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'question:create');
const questionUpdateLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'question:update');
const questionDeleteLimiter = createRedisLimiter(15 * 60 * 1000, 50, 'question:delete');
const leetcodeSearchLimiter = createRedisLimiter(60 * 1000, 100, 'leetcode:search');
const leetcodeFetchLimiter = createRedisLimiter(60 * 1000, 100, 'leetcode:fetch');

// Progress endpoints
const progressUpdateLimiter = createRedisLimiter(15 * 60 * 1000, 200, 'progress:update');

// Revision endpoints
const revisionCompleteLimiter = createRedisLimiter(15 * 60 * 1000, 200, 'revision:complete');

// Share endpoints
const shareCreateLimiter = createRedisLimiter(15 * 60 * 1000, 50, 'share:create');
const shareUpdateLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'share:update');
const shareDeleteLimiter = createRedisLimiter(15 * 60 * 1000, 50, 'share:delete');
const shareTokenLimiter = createRedisLimiter(15 * 60 * 1000, 300, 'share:token');
const shareUserLimiter = createRedisLimiter(15 * 60 * 1000, 300, 'share:user');
const shareRefreshLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'share:refresh');

// Follow endpoints
const followLimiter = createRedisLimiter(15 * 60 * 1000, 150, 'follow');
const unfollowLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'unfollow');
const followGetLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'follow:get');

// Group endpoints
const groupCreateLimiter = createRedisLimiter(15 * 60 * 1000, 30, 'group:create');
const groupUpdateLimiter = createRedisLimiter(15 * 60 * 1000, 60, 'group:update');
const groupDeleteLimiter = createRedisLimiter(15 * 60 * 1000, 20, 'group:delete');
const groupJoinLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'group:join');
const groupLeaveLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'group:leave');
const groupGoalLimiter = createRedisLimiter(15 * 60 * 1000, 60, 'group:goal');
const groupChallengeLimiter = createRedisLimiter(15 * 60 * 1000, 60, 'group:challenge');

// Heatmap endpoints
const heatmapGetLimiter = createRedisLimiter(60 * 60 * 1000, 500, 'heatmap:get');
const heatmapRefreshLimiter = createRedisLimiter(60 * 60 * 1000, 30, 'heatmap:refresh');
const heatmapExportLimiter = createRedisLimiter(60 * 60 * 1000, 20, 'heatmap:export');
const heatmapStatsLimiter = createRedisLimiter(60 * 60 * 1000, 1000, 'heatmap:stats');
const heatmapFilterLimiter = createRedisLimiter(60 * 60 * 1000, 500, 'heatmap:filter');

// Sheet
const progressLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'progress');
const rankParticipantsLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'rank-participants');

module.exports = {
  oauthLimiter,
  tokenLimiter,
  logoutLimiter,
  userLimiter,
  progressSnapshotLimiter,
  notificationReadLimiter,
  leaderboardLimiter,
  publicLimiter,

  questionCreateLimiter,
  questionUpdateLimiter,
  questionDeleteLimiter,
  leetcodeSearchLimiter,
  leetcodeFetchLimiter,

  progressUpdateLimiter,

  revisionCompleteLimiter,

  shareCreateLimiter,
  shareUpdateLimiter,
  shareDeleteLimiter,
  shareTokenLimiter,
  shareUserLimiter,
  shareRefreshLimiter,

  followLimiter,
  unfollowLimiter,
  followGetLimiter,

  groupCreateLimiter,
  groupUpdateLimiter,
  groupDeleteLimiter,
  groupJoinLimiter,
  groupLeaveLimiter,
  groupGoalLimiter,
  groupChallengeLimiter,

  heatmapGetLimiter,
  heatmapRefreshLimiter,
  heatmapExportLimiter,
  heatmapStatsLimiter,
  heatmapFilterLimiter,

  // Keep helpers for any custom use
  createMemoryLimiter,
  createRedisLimiter,
  progressLimiter,  
  rankParticipantsLimiter,
};