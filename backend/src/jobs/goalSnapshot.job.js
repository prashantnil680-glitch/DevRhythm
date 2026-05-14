const cron = require('cron');
const GoalSnapshotService = require('../services/goalSnapshot.service');
const User = require('../models/User');
const { getStartOfDay, getStartOfMonth } = require('../utils/helpers/date');

/**
 * Compute yesterday's monthly snapshot for all users, using each user's timezone.
 * Runs daily at 00:10 UTC.
 */
const updateDailySnapshot = async () => {
  try {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    console.log(`[GoalSnapshot] Running daily update for date: ${yesterday.toISOString()}`);

    // Fetch all active users with their timezone preferences
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
        const year = yesterday.getUTCFullYear();
        const month = yesterday.getUTCMonth() + 1;
        await GoalSnapshotService.generateUserSnapshot(user._id, year, month, 'monthly', userTz);
        totalProcessed++;
      }

      skip += batchSize;
    }

    console.log(`[GoalSnapshot] Daily monthly snapshots updated for ${totalProcessed} users (user-timezone aware).`);
  } catch (error) {
    console.error('[GoalSnapshot] Daily update failed:', error);
  }
};

/**
 * Compute previous month's snapshot for all users, using each user's timezone.
 * Also triggers yearly snapshot for the same year.
 * Runs on the 1st of every month at 00:15 UTC.
 */
const updateMonthlySnapshot = async () => {
  try {
    // First day of current month, then subtract one day to get last day of previous month
    const firstDayOfCurrentMonth = new Date();
    firstDayOfCurrentMonth.setUTCDate(1);
    firstDayOfCurrentMonth.setUTCHours(0, 0, 0, 0);

    const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth);
    lastDayOfPreviousMonth.setUTCDate(0); // goes to last day of previous month

    const previousMonthYear = lastDayOfPreviousMonth.getUTCFullYear();
    const previousMonthNumber = lastDayOfPreviousMonth.getUTCMonth() + 1;

    console.log(`[GoalSnapshot] Running monthly update for ${previousMonthYear}-${previousMonthNumber}`);

    // Fetch all active users with their timezone preferences
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
        // Monthly snapshot for previous month
        await GoalSnapshotService.generateUserSnapshot(
          user._id,
          previousMonthYear,
          previousMonthNumber,
          'monthly',
          userTz
        );
        // Yearly snapshot for the same year (if not already updated this month)
        await GoalSnapshotService.generateUserSnapshot(
          user._id,
          previousMonthYear,
          0,
          'yearly',
          userTz
        );
        totalProcessed++;
      }

      skip += batchSize;
    }

    console.log(`[GoalSnapshot] Monthly and yearly snapshots updated for ${totalProcessed} users (user-timezone aware).`);
  } catch (error) {
    console.error('[GoalSnapshot] Monthly update failed:', error);
  }
};

// Schedule jobs
const dailySnapshotJob = new cron.CronJob('10 0 * * *', updateDailySnapshot); // 00:10 UTC daily
const monthlySnapshotJob = new cron.CronJob('15 0 1 * *', updateMonthlySnapshot); // 00:15 UTC on 1st of each month

const startGoalSnapshotJob = () => {
  dailySnapshotJob.start();
  monthlySnapshotJob.start();
  console.log('Goal snapshot cron jobs started (user-timezone aware)');
};

const stopGoalSnapshotJob = () => {
  dailySnapshotJob.stop();
  monthlySnapshotJob.stop();
  console.log('Goal snapshot cron jobs stopped');
};

module.exports = {
  startGoalSnapshotJob,
  stopGoalSnapshotJob,
  updateDailySnapshot,
  updateMonthlySnapshot,
};