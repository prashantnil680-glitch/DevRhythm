/**
 * src/utils/atomicUpdate.js
 *
 * Atomic MongoDB update helpers to prevent race conditions.
 * All functions use atomic operators with safe concurrency handling.
 */

const User = require('../models/User');
const UserQuestionProgress = require('../models/UserQuestionProgress');

/**
 * Increment user stats atomically and recalculate mastery rate.
 * @param {string} userId
 * @param {number} deltaSolved
 * @param {number} deltaTimeSpent
 * @param {number} totalActiveQuestions
 * @returns {Promise<object|null>}
 */
async function atomicIncrementUserStats(userId, deltaSolved, deltaTimeSpent, totalActiveQuestions) {
  if (!userId) throw new Error('userId is required');
  if (deltaSolved < 0 || deltaTimeSpent < 0) throw new Error('Deltas must be non-negative');

  const user = await User.findById(userId).select('stats.totalSolved stats.totalTimeSpent');
  if (!user) return null;

  const newTotalSolved = (user.stats.totalSolved || 0) + deltaSolved;
  // Cap mastery rate at 100
  const rawMastery = totalActiveQuestions > 0 ? (newTotalSolved / totalActiveQuestions) * 100 : 0;
  const newMasteryRate = Math.min(100, rawMastery);

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    {
      $inc: { 'stats.totalSolved': deltaSolved, 'stats.totalTimeSpent': deltaTimeSpent },
      $set: { 'stats.masteryRate': Math.min(100, Math.round(newMasteryRate * 100) / 100) },
    },
    { new: true, fields: { 'stats.totalSolved': 1, 'stats.totalTimeSpent': 1, 'stats.masteryRate': 1 } }
  );

  return updatedUser?.stats || null;
}

/**
 * Atomically update question progress for a solve event.
 * Returns { progress: object, isFirstSolve: boolean }
 */
async function atomicUpdateQuestionProgressOnSolve(userId, questionId, solvedAt, timeSpent) {
  if (!userId || !questionId) throw new Error('userId and questionId are required');

  await UserQuestionProgress.updateOne(
    { userId, questionId },
    {
      $inc: { totalTimeSpent: timeSpent, 'attempts.count': 1 },
      $set: {
        'attempts.lastAttemptAt': solvedAt,
        updatedAt: solvedAt,
        solvedToday: true,
        lastActivityDate: solvedAt,
      },
      $setOnInsert: {
        userId,
        questionId,
        status: 'Not Started',
        revisionCount: 0,
        confidenceLevel: 0,
        'attempts.firstAttemptAt': solvedAt,
      },
    },
    { upsert: true }
  );

  const statusUpdateResult = await UserQuestionProgress.updateOne(
    {
      userId,
      questionId,
      status: { $nin: ['Solved', 'Mastered'] },
    },
    {
      $set: {
        status: 'Solved',
        'attempts.solvedAt': solvedAt,
        updatedAt: solvedAt,
      },
    }
  );

  const isFirstSolve = statusUpdateResult.modifiedCount > 0;

  if (isFirstSolve) {
    await UserQuestionProgress.updateOne(
      { userId, questionId, 'attempts.firstAttemptAt': { $exists: false } },
      { $set: { 'attempts.firstAttemptAt': solvedAt } }
    );
  }

  const progress = await UserQuestionProgress.findOne({ userId, questionId }).lean();
  return { progress, isFirstSolve };
}

/**
 * Generic atomic increment with retry for high‑contention scenarios.
 * @param {Function} model - Mongoose model
 * @param {object} filter - Query filter
 * @param {object} update - Update operators
 * @param {number} maxRetries - Default 3
 * @returns {Promise<object>} Updated document
 */
async function atomicIncrementWithRetry(model, filter, update, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    const doc = await model.findOne(filter).lean();
    if (!doc) return null;

    const version = doc.__v || 0;
    const updateWithVersion = {
      ...update,
      $inc: { ...(update.$inc || {}), __v: 1 },
      $set: { ...(update.$set || {}), updatedAt: new Date() },
    };

    const updated = await model.findOneAndUpdate(
      { ...filter, __v: version },
      updateWithVersion,
      { new: true }
    );
    if (updated) return updated;
    lastError = new Error('Version conflict, retrying');
    await new Promise(resolve => setTimeout(resolve, 10 * (i + 1)));
  }
  throw lastError || new Error('Atomic update failed after retries');
}

module.exports = {
  atomicIncrementUserStats,
  atomicUpdateQuestionProgressOnSolve,
  atomicIncrementWithRetry,
};