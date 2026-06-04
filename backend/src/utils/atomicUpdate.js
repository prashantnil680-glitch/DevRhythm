/**
 * src/utils/atomicUpdate.js
 *
 * Atomic MongoDB update helpers to prevent race conditions.
 * All functions use atomic operators with safe concurrency handling.
 */

const User = require('../models/User');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const HeatmapData = require('../models/HeatmapData');

/**
 * Increment user stats atomically and recalculate mastery rate.
 */
async function atomicIncrementUserStats(userId, deltaSolved, deltaTimeSpent, totalActiveQuestions) {
  if (!userId) throw new Error('userId is required');
  if (deltaSolved < 0 || deltaTimeSpent < 0) throw new Error('Deltas must be non-negative');

  const user = await User.findById(userId).select('stats.totalSolved stats.totalTimeSpent');
  if (!user) return null;

  const newTotalSolved = (user.stats.totalSolved || 0) + deltaSolved;
  const newMasteryRate = totalActiveQuestions > 0 ? (newTotalSolved / totalActiveQuestions) * 100 : 0;

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    {
      $inc: { 'stats.totalSolved': deltaSolved, 'stats.totalTimeSpent': deltaTimeSpent },
      $set: { 'stats.masteryRate': Math.round(newMasteryRate * 100) / 100 },
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

  // Step 1: Always update attempts count, last attempt time, and total time.
  // Use $setOnInsert only for fields that should never be overwritten after creation.
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

  // Step 2: Conditionally set status to 'Solved' only if not already Solved or Mastered.
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

  // Step 3: Fetch the final document.
  const progress = await UserQuestionProgress.findOne({ userId, questionId }).lean();

  return { progress, isFirstSolve };
}

/**
 * Atomically increment a day's activity in HeatmapData.
 */
async function atomicIncrementHeatmapDay(userId, year, dayStart, increments, setOnInsert = {}) {
  if (!userId || !year || !dayStart) throw new Error('userId, year, dayStart are required');

  const defaultDay = {
    date: dayStart,
    dayOfWeek: dayStart.getUTCDay(),
    totalActivities: 0,
    newProblemsSolved: 0,
    revisionProblems: 0,
    totalSubmissions: 0,
    totalTimeSpent: 0,
    difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
    platformBreakdown: { leetcode: 0, hackerrank: 0, codeforces: 0, other: 0 },
    studyGroupActivity: 0,
    dailyGoalAchieved: false,
    goalTarget: 0,
    goalCompletion: 0,
    intensityLevel: 0,
    streakCount: 0,
    testCaseExecutions: 0,
    passedCount: 0,
    failedCount: 0,
    timeSpentEvents: 0,
    ...setOnInsert,
  };

  const update = {
    $inc: increments,
    $setOnInsert: defaultDay,
    $set: { lastUpdated: new Date() },
  };

  const result = await HeatmapData.findOneAndUpdate(
    { userId, year, 'dailyData.date': dayStart },
    update,
    { new: true, upsert: true }
  );

  return result;
}

/**
 * Generic atomic increment with retry for high‑contention scenarios.
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
  atomicIncrementHeatmapDay,
  atomicIncrementWithRetry,
};