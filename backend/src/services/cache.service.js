const { client: redisClient } = require('../config/redis');

const CACHE_PREFIX = 'devrhythm:cache';
const TTL_ONE_MINUTE = 60;
const TTL_FIVE_MINUTES = 300;
const TTL_ONE_HOUR = 3600;

const get = async (key) => {
  const value = await redisClient.get(`${CACHE_PREFIX}:${key}`);
  return value ? JSON.parse(value) : null;
};

const set = async (key, value, ttl = TTL_ONE_MINUTE) => {
  await redisClient.setex(`${CACHE_PREFIX}:${key}`, ttl, JSON.stringify(value));
};

const del = async (key) => {
  await redisClient.del(`${CACHE_PREFIX}:${key}`);
};

const delPattern = async (pattern) => {
  const keys = await redisClient.keys(`${CACHE_PREFIX}:${pattern}*`);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

const getUserCache = async (userId) => {
  return get(`user:${userId}:profile`);
};

const setUserCache = async (userId, data) => {
  await set(`user:${userId}:profile`, data, TTL_FIVE_MINUTES);
};

const invalidateUserCache = async (userId) => {
  await delPattern(`user:${userId}:`);
};

const getLeaderboardCache = async (type, period) => {
  return get(`leaderboard:${type}:${period}`);
};

const setLeaderboardCache = async (type, period, data) => {
  await set(`leaderboard:${type}:${period}`, data, TTL_ONE_MINUTE);
};

const invalidateLeaderboardCache = async (type, period) => {
  await del(`leaderboard:${type}:${period}`);
};

module.exports = {
  get,
  set,
  del,
  delPattern,
  getUserCache,
  setUserCache,
  invalidateUserCache,
  getLeaderboardCache,
  setLeaderboardCache,
  invalidateLeaderboardCache,
  TTL_ONE_MINUTE,
  TTL_FIVE_MINUTES,
  TTL_ONE_HOUR
};