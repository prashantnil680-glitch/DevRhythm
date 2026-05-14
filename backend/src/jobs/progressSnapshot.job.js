const cron = require('cron');
const ProgressSnapshot = require('../models/ProgressSnapshot');
const User = require('../models/User');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const { getEndOfDay, getEndOfWeek, getEndOfMonth } = require('../utils/helpers/date');

/**
 * Generate daily snapshot for a single user using their timezone.
 * @param {ObjectId} userId
 * @param {string} timeZone
 */
const generateDailySnapshotForUser = async (userId, timeZone) => {
  const snapshotDate = getEndOfDay(new Date(), timeZone);
  
  // Check if snapshot already exists for this period
  const existing = await ProgressSnapshot.findOne({
    userId,
    snapshotPeriod: 'daily',
    snapshotDate: { $gte: new Date(snapshotDate.getTime() - 24 * 60 * 60 * 1000) }
  });
  
  if (existing) return;

  // Fetch user's progress data (simplified, you can enhance with actual aggregates)
  const progressStats = await UserQuestionProgress.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalSolved: { $sum: { $cond: [{ $in: ['$status', ['Solved', 'Mastered']] }, 1, 0] } },
        totalRevisions: { $sum: '$revisionCount' },
        totalTimeSpent: { $sum: '$totalTimeSpent' },
        masterySum: { $sum: '$confidenceLevel' },
        masteryCount: { $sum: { $cond: [{ $gt: ['$confidenceLevel', 0] }, 1, 0] } }
      }
    }
  ]);

  const stats = progressStats[0] || {};
  const masteryPercentage = stats.masteryCount ? (stats.masterySum / stats.masteryCount) * 20 : 0; // Convert confidence 0-5 to 0-100

  const snapshot = new ProgressSnapshot({
    userId,
    snapshotDate,
    snapshotPeriod: 'daily',
    overallProgress: {
      totalProblemsSolved: stats.totalSolved || 0,
      totalRevisionsCompleted: stats.totalRevisions || 0,
      totalStudyTimeSpent: stats.totalTimeSpent || 0,
      masteryPercentage: Math.min(100, masteryPercentage),
      activeDaysCount: 0 // Would need separate calculation
    },
    consistency: {
      currentStreak: 0,
      longestStreak: 0,
      consistencyScore: 0,
      accountAgeDays: 0
    }
  });
  await snapshot.save();
};

/**
 * Generate weekly snapshot for a single user using their timezone.
 */
const generateWeeklySnapshotForUser = async (userId, timeZone) => {
  const snapshotDate = getEndOfWeek(new Date(), timeZone);
  
  const existing = await ProgressSnapshot.findOne({
    userId,
    snapshotPeriod: 'weekly',
    snapshotDate: { $gte: new Date(snapshotDate.getTime() - 7 * 24 * 60 * 60 * 1000) }
  });
  
  if (existing) return;

  // Similar aggregate as daily (simplified)
  const progressStats = await UserQuestionProgress.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalSolved: { $sum: { $cond: [{ $in: ['$status', ['Solved', 'Mastered']] }, 1, 0] } },
        totalRevisions: { $sum: '$revisionCount' },
        totalTimeSpent: { $sum: '$totalTimeSpent' }
      }
    }
  ]);

  const stats = progressStats[0] || {};
  const snapshot = new ProgressSnapshot({
    userId,
    snapshotDate,
    snapshotPeriod: 'weekly',
    overallProgress: {
      totalProblemsSolved: stats.totalSolved || 0,
      totalRevisionsCompleted: stats.totalRevisions || 0,
      totalStudyTimeSpent: stats.totalTimeSpent || 0,
      masteryPercentage: 0,
      activeDaysCount: 0
    },
    consistency: {
      currentStreak: 0,
      longestStreak: 0,
      consistencyScore: 0,
      accountAgeDays: 0
    }
  });
  await snapshot.save();
};

/**
 * Generate monthly snapshot for a single user using their timezone.
 */
const generateMonthlySnapshotForUser = async (userId, timeZone) => {
  const snapshotDate = getEndOfMonth(new Date(), timeZone);
  
  const existing = await ProgressSnapshot.findOne({
    userId,
    snapshotPeriod: 'monthly',
    snapshotDate: { $gte: new Date(snapshotDate.getTime() - 30 * 24 * 60 * 60 * 1000) }
  });
  
  if (existing) return;

  const progressStats = await UserQuestionProgress.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalSolved: { $sum: { $cond: [{ $in: ['$status', ['Solved', 'Mastered']] }, 1, 0] } },
        totalRevisions: { $sum: '$revisionCount' },
        totalTimeSpent: { $sum: '$totalTimeSpent' }
      }
    }
  ]);

  const stats = progressStats[0] || {};
  const snapshot = new ProgressSnapshot({
    userId,
    snapshotDate,
    snapshotPeriod: 'monthly',
    overallProgress: {
      totalProblemsSolved: stats.totalSolved || 0,
      totalRevisionsCompleted: stats.totalRevisions || 0,
      totalStudyTimeSpent: stats.totalTimeSpent || 0,
      masteryPercentage: 0,
      activeDaysCount: 0
    },
    consistency: {
      currentStreak: 0,
      longestStreak: 0,
      consistencyScore: 0,
      accountAgeDays: 0
    }
  });
  await snapshot.save();
};

/**
 * Generate snapshots for all active users, using each user's timezone.
 * @param {Function} generatorFn - Function to call for each user (daily, weekly, monthly)
 */
const generateForAllUsers = async (generatorFn) => {
  let skip = 0;
  const batchSize = 100;
  let totalProcessed = 0;

  while (true) {
    const users = await User.find({ isActive: true })
      .select('_id preferences.timezone')
      .skip(skip)
      .limit(batchSize)
      .lean();

    if (users.length === 0) break;

    for (const user of users) {
      const userTz = user.preferences?.timezone || 'UTC';
      await generatorFn(user._id, userTz);
      totalProcessed++;
    }

    skip += batchSize;
  }

  return totalProcessed;
};

const generateDailySnapshot = async () => {
  try {
    const count = await generateForAllUsers(generateDailySnapshotForUser);
    console.log(`[ProgressSnapshot] Daily snapshots generated for ${count} users (user-timezone aware)`);
  } catch (error) {
    console.error('[ProgressSnapshot] Daily snapshot job failed:', error);
  }
};

const generateWeeklySnapshot = async () => {
  try {
    const count = await generateForAllUsers(generateWeeklySnapshotForUser);
    console.log(`[ProgressSnapshot] Weekly snapshots generated for ${count} users (user-timezone aware)`);
  } catch (error) {
    console.error('[ProgressSnapshot] Weekly snapshot job failed:', error);
  }
};

const generateMonthlySnapshot = async () => {
  try {
    const count = await generateForAllUsers(generateMonthlySnapshotForUser);
    console.log(`[ProgressSnapshot] Monthly snapshots generated for ${count} users (user-timezone aware)`);
  } catch (error) {
    console.error('[ProgressSnapshot] Monthly snapshot job failed:', error);
  }
};

const dailySnapshotJob = new cron.CronJob('0 0 * * *', generateDailySnapshot);
const weeklySnapshotJob = new cron.CronJob('0 0 * * 0', generateWeeklySnapshot);
const monthlySnapshotJob = new cron.CronJob('0 0 1 * *', generateMonthlySnapshot);

const startSnapshotJobs = () => {
  dailySnapshotJob.start();
  weeklySnapshotJob.start();
  monthlySnapshotJob.start();
  console.log('Progress snapshot jobs started (user-timezone aware)');
};

const stopSnapshotJobs = () => {
  dailySnapshotJob.stop();
  weeklySnapshotJob.stop();
  monthlySnapshotJob.stop();
  console.log('Progress snapshot jobs stopped');
};

module.exports = {
  startSnapshotJobs,
  stopSnapshotJobs,
  generateDailySnapshot,
  generateWeeklySnapshot,
  generateMonthlySnapshot
};