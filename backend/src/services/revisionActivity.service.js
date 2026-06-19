const { client: redisClient } = require('../config/redis');
const RevisionSchedule = require('../models/RevisionSchedule');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const User = require('../models/User');
const Question = require('../models/Question');
const ActivityLog = require('../models/ActivityLog');
const { getStartOfDay, getEndOfDay, formatDate, isToday } = require('../utils/helpers/date');
const { slugify } = require('../utils/helpers/string');
const { invalidateCache } = require('../middleware/cache');
const heatmapService = require('./heatmap.service');
const { updateUserActivity } = require('./user.service');

// ========== Helper: Check if user already has any active past‑revision session ==========
const userHasActiveSession = async (userId) => {
  const pattern = `revision:session:${userId}:*:*`;
  let cursor = 0;
  let keys = [];
  do {
    const reply = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = parseInt(reply[0]);
    keys.push(...reply[1]);
  } while (cursor !== 0);
  return keys.length > 0;
};

// ========== Helper: Redis key for daily activity ==========
const getRevisionActivityKey = (userId, questionId, date) => {
  const dateStr = formatDate(date);
  return `revision:activity:${userId}:${questionId}:${dateStr}`;
};

// ========== Record time spent for a day (frontend heartbeat) ==========
const recordTimeSpent = async (userId, questionId, date, minutes) => {
  const key = getRevisionActivityKey(userId, questionId, date);
  await redisClient.hincrby(key, 'timeSpent', minutes);
  await redisClient.expire(key, 86400);
};

// ========== Record code submission for a day ==========
const recordCodeSubmission = async (userId, questionId, date) => {
  const key = getRevisionActivityKey(userId, questionId, date);
  await redisClient.hset(key, 'codeSubmitted', 'true');
  await redisClient.expire(key, 86400);
};

// ========== Get daily activity ==========
const getRevisionActivity = async (userId, questionId, date) => {
  const key = getRevisionActivityKey(userId, questionId, date);
  const data = await redisClient.hgetall(key);
  return {
    timeSpent: parseInt(data.timeSpent) || 0,
    codeSubmitted: data.codeSubmitted === 'true',
  };
};

// ========== Get user timezone ==========
const getUserTimeZone = async (userId) => {
  const user = await User.findById(userId).select('preferences.timezone');
  return user?.preferences?.timezone || 'UTC';
};

// ========== Update revision state ==========
const updateRevisionState = (revision, timeZone) => {
  const todayStart = getStartOfDay(new Date(), timeZone);
  const idx = revision.currentRevisionIndex;

  if (idx >= revision.schedule.length) {
    revision.status = 'completed';
    revision.overdueActive = false;
    revision.overdueCount = 0;
    return;
  }

  const pendingDue = revision.schedule[idx];
  const daysOverdue = Math.floor((todayStart - pendingDue) / (1000 * 60 * 60 * 24));
  revision.overdueCount = daysOverdue > 0 ? daysOverdue : 0;
  revision.overdueActive = daysOverdue > 0;
  revision.status = daysOverdue > 0 ? 'overdue' : 'active';
};

// ========== Standard completion (current pending revision) ==========
const checkAndCompleteRevision = async (userId, questionId, date, source = 'auto', options = {}) => {
  const { targetDate = null, allowOverdue = false } = options;
  const timeZone = await getUserTimeZone(userId);
  const todayStart = getStartOfDay(date, timeZone);
  const todayEnd = getEndOfDay(date, timeZone);

  const revision = await RevisionSchedule.findOne({
    userId,
    questionId,
    status: { $in: ['active', 'overdue'] }
  });

  if (!revision) {
    return { completed: false, message: 'No active revision schedule found', skippedCount: 0 };
  }

  let targetIndex = null;
  if (targetDate) {
    const targetDayStart = getStartOfDay(targetDate, timeZone);
    for (let i = 0; i < revision.schedule.length; i++) {
      if (getStartOfDay(revision.schedule[i], timeZone).getTime() === targetDayStart.getTime()) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex === null) {
      return { completed: false, message: 'No revision scheduled for the given date', skippedCount: 0 };
    }
  } else {
    targetIndex = revision.currentRevisionIndex;
  }

  const scheduledDate = revision.schedule[targetIndex];
  const alreadyCompleted = revision.completedRevisions.some(cr =>
    getStartOfDay(cr.date, timeZone).getTime() === getStartOfDay(scheduledDate, timeZone).getTime()
  );

  if (alreadyCompleted) {
    return { completed: true, message: 'Revision already completed', skippedCount: 0, overdueCompleted: false };
  }

  const isFuture = scheduledDate > todayEnd;
  const isOverdue = scheduledDate < todayStart;

  if (isFuture) {
    return { completed: false, message: 'Cannot complete a revision scheduled for a future date.', skippedCount: 0 };
  }

  if (source === 'manual' && targetIndex === revision.currentRevisionIndex && !isFuture) {
    const activity = await getRevisionActivity(userId, questionId, date);
    const conditionsMet = activity.timeSpent >= 20 || activity.codeSubmitted;
    if (!conditionsMet) {
      return { completed: false, message: 'Please spend at least 20 minutes or submit passing code before marking this revision as complete.', skippedCount: 0 };
    }
  }

  if (isOverdue && !allowOverdue) {
    return { completed: false, message: 'This revision is overdue. Please add ?overdue=true to complete it.', skippedCount: 0 };
  }

  const progress = await UserQuestionProgress.findOne({ userId, questionId });
  const confidenceAfter = progress?.confidenceLevel || null;
  const activity = await getRevisionActivity(userId, questionId, date);

  const outOfOrder = (targetIndex !== revision.currentRevisionIndex);

  // Add completion entry
  revision.completedRevisions.push({
    date: revision.schedule[targetIndex],
    completedAt: new Date(),
    status: 'completed',
    timeSpent: activity.timeSpent,
    confidenceAfter,
    overdueCompleted: isOverdue,
    skipped: false,
    outOfOrder,
  });

  // Advance index if this was the current pending revision
  if (targetIndex === revision.currentRevisionIndex) {
    let nextIndex = revision.currentRevisionIndex + 1;
    while (nextIndex < revision.schedule.length &&
           revision.completedRevisions.some(cr => getStartOfDay(cr.date, timeZone).getTime() === getStartOfDay(revision.schedule[nextIndex], timeZone).getTime())) {
      nextIndex++;
    }
    revision.currentRevisionIndex = nextIndex;
  }

  updateRevisionState(revision, timeZone);
  revision.updatedAt = new Date();
  await revision.save();

  // ========== SYNC UPDATES ==========
  await User.updateOne(
    { _id: userId },
    { $inc: { 'stats.totalRevisions': 1 } }
  );

  await UserQuestionProgress.updateOne(
    { userId, questionId },
    {
      $inc: { revisionCount: 1 },
      $set: { lastRevisedAt: new Date() }
    },
    { upsert: true }
  );

  const currentConfidence = progress?.confidenceLevel || 0;
  let newConfidence = currentConfidence + 0.25;
  if (newConfidence > 5) newConfidence = 5;
  await UserQuestionProgress.updateOne(
    { userId, questionId },
    { $set: { confidenceLevel: newConfidence } }
  );

  await heatmapService.incrementDailyActivityDirect(
    userId,
    new Date(),
    timeZone,
    {
      totalActivities: 1,
      totalSubmissions: 1,
      revisionProblems: 1,
    },
    false,
    null,
    null
  );

  await updateUserActivity(userId, new Date(), timeZone);
  // ========== END SYNC UPDATES ==========

  await invalidateCache(`revisions:*:user:${userId}:*`);

  // ========== Invalidate question details cache ==========
  const question = await Question.findById(questionId).select('platform platformQuestionId').lean();
  if (question) {
    await invalidateCache(`question-details:*:user:${userId}:*/questions/${questionId}/details*`);
    await invalidateCache(`question-details:platform:*:user:${userId}:*/platform/${question.platform}/${question.platformQuestionId}/details*`);
  }
  // =========================================================

  console.log(`[DEBUG] Revision completed successfully. overdueCompleted=${isOverdue}, outOfOrder=${targetIndex !== revision.currentRevisionIndex}`);

  return {
    completed: true,
    message: outOfOrder
      ? `Completed revision for ${getStartOfDay(revision.schedule[targetIndex], timeZone).toDateString()} (out of order).`
      : 'Great, your revision is done.',
    skippedCount: 0,
    overdueCompleted: isOverdue,
    outOfOrder,
  };
};

// ========== Past Revision Session Management ==========

const getRevisionSessionKey = (userId, questionId, targetDate) => {
  const dateStr = formatDate(targetDate);
  return `revision:session:${userId}:${questionId}:${dateStr}`;
};

const startRevisionSession = async (userId, questionId, targetDate) => {
  const hasActive = await userHasActiveSession(userId);
  if (hasActive) {
    throw new Error('You already have an active revision session for another question. Please complete or cancel it first.');
  }

  const key = getRevisionSessionKey(userId, questionId, targetDate);
  const session = { activeSeconds: 0, testPassed: false };
  await redisClient.setex(key, 1200, JSON.stringify(session));
  console.log(`[revision.session] Session created for user ${userId}, question ${questionId}, date ${targetDate}`);
  return session;
};

const getRevisionSession = async (userId, questionId, targetDate) => {
  const key = getRevisionSessionKey(userId, questionId, targetDate);
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

const deleteRevisionSession = async (userId, questionId, targetDate) => {
  const key = getRevisionSessionKey(userId, questionId, targetDate);
  await redisClient.del(key);
};

const addActiveSecondsToSession = async (userId, questionId, targetDate, seconds) => {
  const key = getRevisionSessionKey(userId, questionId, targetDate);
  let session = await getRevisionSession(userId, questionId, targetDate);
  if (!session) return false;

  session.activeSeconds += seconds;
  await redisClient.setex(key, 1200, JSON.stringify(session));

  if (session.activeSeconds >= 1200 || session.testPassed === true) {
    const result = await completePastRevision(userId, questionId, targetDate);
    return result.completed;
  }
  return false;
};

const markTestPassedForQuestion = async (userId, questionId) => {
  const pattern = `revision:session:${userId}:${questionId}:*`;
  let cursor = 0;
  let keys = [];
  do {
    const reply = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = parseInt(reply[0]);
    keys.push(...reply[1]);
  } while (cursor !== 0);

  for (const key of keys) {
    const data = await redisClient.get(key);
    if (data) {
      const session = JSON.parse(data);
      if (!session.testPassed) {
        session.testPassed = true;
        await redisClient.setex(key, 1200, JSON.stringify(session));
      }
      if (session.activeSeconds >= 1200 || session.testPassed) {
        const parts = key.split(':');
        const targetDateStr = parts[parts.length - 1];
        if (targetDateStr) {
          const targetDate = new Date(targetDateStr);
          await completePastRevision(userId, questionId, targetDate);
        }
      }
    }
  }
};

const completePastRevision = async (userId, questionId, targetDate, confidence = null, auto = false) => {
  const timeZone = await getUserTimeZone(userId);
  const todayStart = getStartOfDay(new Date(), timeZone);
  const targetDayStart = getStartOfDay(targetDate, timeZone);

  if (targetDayStart >= todayStart) {
    return { completed: false, message: 'Cannot complete a future or today’s revision with this endpoint. Use the standard completion endpoint.' };
  }

  const revision = await RevisionSchedule.findOne({
    userId,
    questionId,
    status: { $in: ['active', 'overdue'] }
  });
  if (!revision) {
    return { completed: false, message: 'No active revision schedule found' };
  }

  let targetIndex = -1;
  for (let i = 0; i < revision.schedule.length; i++) {
    if (getStartOfDay(revision.schedule[i], timeZone).getTime() === targetDayStart.getTime()) {
      targetIndex = i;
      break;
    }
  }
  if (targetIndex === -1) {
    return { completed: false, message: 'No revision scheduled on the given date' };
  }

  const alreadyCompleted = revision.completedRevisions.some(cr =>
    getStartOfDay(cr.date, timeZone).getTime() === targetDayStart.getTime()
  );
  if (alreadyCompleted) {
    return { completed: true, message: 'Revision already completed' };
  }

  const session = await getRevisionSession(userId, questionId, targetDate);
  if (!session) {
    return { completed: false, message: 'Revision session not started. Please open the question page first.' };
  }

  const conditionMet = session.activeSeconds >= 1200 || session.testPassed === true;
  if (!conditionMet) {
    const remainingSeconds = Math.max(0, 1200 - session.activeSeconds);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    return {
      completed: false,
      message: `You need to spend at least 20 active minutes on this question. ${remainingMinutes} more minute(s) required or pass all test cases.`
    };
  }

  const activity = await getRevisionActivity(userId, questionId, new Date());

  revision.completedRevisions.push({
    date: revision.schedule[targetIndex],
    completedAt: new Date(),
    status: 'completed',
    timeSpent: activity.timeSpent,
    confidenceAfter: confidence && confidence >= 1 && confidence <= 5 ? confidence : null,
    overdueCompleted: true,
    skipped: false,
    outOfOrder: false,
  });

  updateRevisionState(revision, timeZone);
  revision.updatedAt = new Date();
  await revision.save();

  // ========== SYNC UPDATES ==========
  await User.updateOne(
    { _id: userId },
    { $inc: { 'stats.totalRevisions': 1 } }
  );

  await UserQuestionProgress.updateOne(
    { userId, questionId },
    {
      $inc: { revisionCount: 1 },
      $set: { lastRevisedAt: new Date() }
    },
    { upsert: true }
  );

  const progress = await UserQuestionProgress.findOne({ userId, questionId });
  const currentConfidence = progress?.confidenceLevel || 0;
  let newConfidence = currentConfidence + 0.25;
  if (newConfidence > 5) newConfidence = 5;
  await UserQuestionProgress.updateOne(
    { userId, questionId },
    { $set: { confidenceLevel: newConfidence } }
  );

  await heatmapService.incrementDailyActivityDirect(
    userId,
    new Date(),
    timeZone,
    {
      totalActivities: 1,
      totalSubmissions: 1,
      revisionProblems: 1,
    },
    false,
    null,
    null
  );

  await updateUserActivity(userId, new Date(), timeZone);
  // ========== END SYNC UPDATES ==========

  const completionDate = new Date();
  await heatmapService.incrementDailyActivity({
    userId,
    date: completionDate,
    timeZone,
    increments: {
      totalActivities: 1,
      revisionProblems: 1,
      totalSubmissions: 1,
    }
  });

  await deleteRevisionSession(userId, questionId, targetDate);
  await invalidateCache(`revisions:*:user:${userId}:*`);

  // ========== NEW: Invalidate question details cache ==========
  const question = await Question.findById(questionId).select('platform platformQuestionId').lean();
  if (question) {
    await invalidateCache(`question-details:*:user:${userId}:*/questions/${questionId}/details*`);
    await invalidateCache(`question-details:platform:*:user:${userId}:*/platform/${question.platform}/${question.platformQuestionId}/details*`);
  }
  // =========================================================

  // Create activity log for this overdue revision completion
  await ActivityLog.create({
    userId,
    action: 'revision_completed',
    targetId: questionId,
    targetModel: 'Question',
    metadata: {
      revisionIndex: targetIndex,
      scheduledDate: revision.schedule[targetIndex],
      overdueCompleted: true,
      outOfOrder: false,
      timeSpent: activity.timeSpent,
      confidenceAfter: confidence && confidence >= 1 && confidence <= 5 ? confidence : null,
    },
    timestamp: completionDate,
  });

  return {
    completed: true,
    message: `Past revision for ${formatDate(targetDate)} marked as completed.`,
    revision,
  };
};

/**
 * Retrieve all revisions completed on a specific day, with full question details.
 * Includes pattern and patternSlugs for each question.
 */
const getDayRevisions = async (userId, date, timeZone) => {
  const targetDateStart = getStartOfDay(date, timeZone);
  const targetDateEnd = getEndOfDay(date, timeZone);

  const schedules = await RevisionSchedule.aggregate([
    { $match: { userId } },
    { $unwind: '$completedRevisions' },
    {
      $match: {
        'completedRevisions.completedAt': {
          $gte: targetDateStart,
          $lte: targetDateEnd,
        },
        'completedRevisions.status': 'completed',
      },
    },
    {
      $lookup: {
        from: 'questions',
        localField: 'questionId',
        foreignField: '_id',
        as: 'question',
      },
    },
    { $unwind: '$question' },
    {
      $project: {
        questionId: '$question._id',
        platformQuestionId: '$question.platformQuestionId',
        title: '$question.title',
        platform: '$question.platform',
        difficulty: '$question.difficulty',
        pattern: '$question.pattern',
        completedAt: '$completedRevisions.completedAt',
        timeSpent: '$completedRevisions.timeSpent',
        confidenceAfter: '$completedRevisions.confidenceAfter',
        status: '$completedRevisions.status',
        overdueCompleted: '$completedRevisions.overdueCompleted',
        outOfOrder: '$completedRevisions.outOfOrder',
      },
    },
    { $sort: { completedAt: -1 } },
  ]);

  // Add patternSlugs to each schedule item
  for (const schedule of schedules) {
    if (schedule.pattern && Array.isArray(schedule.pattern)) {
      schedule.patternSlugs = schedule.pattern.map(p => slugify(p));
    } else {
      schedule.patternSlugs = [];
      schedule.pattern = [];
    }
  }

  return schedules;
};

// ========== NEW FUNCTION: Complete all past revision sessions for a question ==========
/**
 * Find all active revision sessions for a specific question (created by /complete-past),
 * mark them as `testPassed = true`, and attempt to complete each one.
 * This is typically called after a user successfully runs code that passes all test cases.
 *
 * @param {string} userId - User ObjectId
 * @param {string} questionId - Question ObjectId
 * @returns {Promise<{ completed: number, failed: number }>}
 */
async function completeAllPastSessionsForQuestion(userId, questionId) {
  const pattern = `revision:session:${userId}:${questionId}:*`;
  let cursor = 0;
  let keys = [];
  do {
    const reply = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = parseInt(reply[0]);
    keys.push(...reply[1]);
  } while (cursor !== 0);

  let completedCount = 0;
  let failedCount = 0;

  for (const key of keys) {
    const parts = key.split(':');
    const targetDateStr = parts[parts.length - 1];
    if (!targetDateStr) continue;

    const targetDate = new Date(targetDateStr);
    if (isNaN(targetDate.getTime())) continue;

    let session = await getRevisionSession(userId, questionId, targetDate);
    if (session && !session.testPassed) {
      session.testPassed = true;
      await redisClient.setex(key, 1200, JSON.stringify(session));
    }

    try {
      const result = await completePastRevision(userId, questionId, targetDate, null, true);
      if (result.completed) {
        completedCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      console.error(`[RevisionActivity] Failed to complete past session for ${targetDateStr}:`, err.message);
      failedCount++;
    }
  }

  return { completed: completedCount, failed: failedCount };
}

// ========== NEW FUNCTION: Add time to all active past sessions ==========
/**
 * Add active seconds to ALL active revision sessions for a user+question
 * (including past dates). For any session that reaches or exceeds 1200 seconds,
 * automatically complete the revision for that date.
 *
 * @param {string} userId - User ObjectId
 * @param {string} questionId - Question ObjectId
 * @param {number} seconds - Seconds to add (usually 60 per heartbeat)
 * @returns {Promise<{ updated: number, completed: number }>}
 */
async function addActiveSecondsToAllSessions(userId, questionId, seconds) {
  const pattern = `revision:session:${userId}:${questionId}:*`;
  let cursor = 0;
  let keys = [];
  do {
    const reply = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = parseInt(reply[0]);
    keys.push(...reply[1]);
  } while (cursor !== 0);

  let updatedCount = 0;
  let completedCount = 0;

  for (const key of keys) {
    const parts = key.split(':');
    const targetDateStr = parts[parts.length - 1];
    if (!targetDateStr) continue;

    const targetDate = new Date(targetDateStr);
    if (isNaN(targetDate.getTime())) continue;

    const completed = await addActiveSecondsToSession(userId, questionId, targetDate, seconds);
    updatedCount++;
    if (completed) {
      completedCount++;
    }
  }

  return { updated: updatedCount, completed: completedCount };
}

// ========== EXPORTS ==========
module.exports = {
  recordTimeSpent,
  recordCodeSubmission,
  getRevisionActivity,
  checkAndCompleteRevision,
  completePastRevision,
  startRevisionSession,
  getRevisionSession,
  markTestPassedForQuestion,
  addActiveSecondsToSession,
  deleteRevisionSession,
  getDayRevisions,
  completeAllPastSessionsForQuestion,
  addActiveSecondsToAllSessions,
};