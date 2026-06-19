/**
 * src/middleware/rateLimiter.js
 *
 * Rate limiters for various endpoints.
 * Uses Redis store when available, falls back to memory store.
 * Deprecated onLimitReached replaced with handler.
 */

const rateLimit = require('express-rate-limit');
const { client: redisClient } = require('../config/redis');
const config = require('../config');

/**
 * Builds the standard error response for rate‑limit exceeded.
 * @param {number} retryAfterSeconds - Seconds to wait before retrying.
 * @returns {Object} Standard error response object.
 */
const buildRateLimitErrorResponse = (retryAfterSeconds) => ({
  success: false,
  statusCode: 429,
  message: 'Too many requests, please try again later.',
  data: null,
  meta: {},
  error: { code: 'RATE_LIMIT_EXCEEDED' },
});

/**
 * Handler for rate‑limit exceeded events.
 * Sets Retry-After header and sends JSON error response.
 * @param {Request} req - Express request.
 * @param {Response} res - Express response.
 * @param {Function} next - Next middleware.
 * @param {Object} options - Rate‑limit options (contains windowMs).
 */
const rateLimitHandler = (req, res, next, options) => {
  const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json(buildRateLimitErrorResponse(retryAfterSeconds));
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

/**
 * Creates a memory‑based rate limiter (fallback).
 * @param {number} windowMs - Time window in milliseconds.
 * @param {number} max - Maximum number of requests per window.
 * @returns {Function} Express middleware.
 */
const createMemoryLimiter = (windowMs, max) => {
  return rateLimit({
    windowMs,
    max,
    handler: rateLimitHandler,
  });
};

/**
 * Creates a Redis‑backed rate limiter if Redis is available, else falls back to memory.
 * @param {number} windowMs - Time window in milliseconds.
 * @param {number} max - Maximum number of requests per window.
 * @param {string} keyPrefix - Prefix for Redis keys (e.g., 'oauth').
 * @returns {Function} Express middleware.
 */
const createRedisLimiter = (windowMs, max, keyPrefix) => {
  if (redisStoreAvailable && redisClient && redisClient.isReady) {
    try {
      return rateLimit({
        store: new RedisStore({
          sendCommand: (...args) => redisClient.sendCommand(args),
          prefix: `devrhythm:ratelimit:${keyPrefix}`,
        }),
        windowMs,
        max,
        skipHeaders: false,
        handler: rateLimitHandler,
      });
    } catch (error) {
      console.warn(`Redis limiter failed for ${keyPrefix}, using memory:`, error.message);
    }
  }
  return createMemoryLimiter(windowMs, max);
};

// ===== Predefined limiters (Redis‑backed if possible) =====
const oauthLimiter = createRedisLimiter(15 * 60 * 1000, 200, 'oauth');
const tokenLimiter = createRedisLimiter(15 * 60 * 1000, 300, 'token');
const logoutLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'logout');
const userLimiter = createRedisLimiter(20 * 60 * 1000, 350, 'user');
const progressSnapshotLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'snapshot');
const notificationReadLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'notification');
const leaderboardLimiter = createRedisLimiter(15 * 60 * 1000, 300, 'leaderboard');
const publicLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'public');

// Question endpoints
const questionCreateLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'question:create');
const questionUpdateLimiter = createRedisLimiter(15 * 60 * 1000, 100, 'question:update');
const questionDeleteLimiter = createRedisLimiter(15 * 60 * 1000, 50, 'question:delete');
const leetcodeSearchLimiter = createRedisLimiter(60 * 1000, 100, 'leetcode:search');
const leetcodeFetchLimiter = createRedisLimiter(60 * 1000, 100, 'leetcode:fetch');

// Progress endpoints
const progressUpdateLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'progress:update');

// Revision endpoints
const revisionCompleteLimiter = createRedisLimiter(15 * 60 * 1000, 200, 'revision:complete');
const revisionStatsLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'revision-stats');

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
const heatmapRefreshLimiter = createRedisLimiter(60 * 60 * 1000, 100, 'heatmap:refresh');  // ↑ 30 → 100
const heatmapExportLimiter = createRedisLimiter(60 * 60 * 1000, 20, 'heatmap:export');
const heatmapStatsLimiter = createRedisLimiter(60 * 60 * 1000, 1000, 'heatmap:stats');
const heatmapFilterLimiter = createRedisLimiter(60 * 60 * 1000, 500, 'heatmap:filter');

// Sheet
const progressLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'progress');
const rankParticipantsLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'rank-participants');

// Code execution async limiters
const codeExecuteAsyncLimiter = createRedisLimiter(60 * 1000, 10, 'code:execute-async');
const codeResultPollLimiter = createRedisLimiter(60 * 1000, 30, 'code:result-poll');

// Pattern Mastery limiter
const patternMasteryLimiter = createRedisLimiter(15 * 60 * 1000, 500, 'pattern-mastery');

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
  revisionStatsLimiter,

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

  progressLimiter,
  rankParticipantsLimiter,

  codeExecuteAsyncLimiter,
  codeResultPollLimiter,

  patternMasteryLimiter,

  // Keep helpers for any custom use (if needed)
  createMemoryLimiter,
  createRedisLimiter,
};