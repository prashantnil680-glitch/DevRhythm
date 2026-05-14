const cron = require('cron');
const Goal = require('../models/Goal');
const User = require('../models/User');
const { getEndOfDay } = require('../utils/helpers/date');

/**
 * Mark expired goals as failed using each user's timezone.
 * A goal is considered expired if its endDate (UTC) is before the user's local end of day.
 * Runs daily at midnight UTC.
 */
const markExpiredGoals = async () => {
  try {
    let skip = 0;
    const batchSize = 100;
    let totalUpdated = 0;

    while (true) {
      const goals = await Goal.find({
        status: 'active',
        goalType: { $in: ['daily', 'weekly'] }  // 'planned' handled separately
      })
        .skip(skip)
        .limit(batchSize)
        .lean();

      if (goals.length === 0) break;

      // Group by userId
      const userIds = [...new Set(goals.map(g => g.userId.toString()))];
      const users = await User.find({ _id: { $in: userIds } })
        .select('preferences.timezone')
        .lean();

      const timezoneMap = new Map();
      for (const user of users) {
        timezoneMap.set(user._id.toString(), user.preferences?.timezone || 'UTC');
      }

      const bulkOps = [];
      for (const goal of goals) {
        const userTz = timezoneMap.get(goal.userId.toString()) || 'UTC';
        const userLocalEndOfDay = getEndOfDay(new Date(), userTz);
        
        // Compare goal endDate (UTC) with user's local end of day
        if (goal.endDate < userLocalEndOfDay) {
          bulkOps.push({
            updateOne: {
              filter: { _id: goal._id },
              update: {
                $set: {
                  status: 'failed',
                  updatedAt: new Date()
                }
              }
            }
          });
        }
      }

      if (bulkOps.length > 0) {
        const result = await Goal.bulkWrite(bulkOps);
        totalUpdated += result.modifiedCount;
      }

      skip += batchSize;
    }

    if (totalUpdated > 0) {
      console.log(`[ExpiredGoals] Marked ${totalUpdated} expired goals as failed (user-timezone aware)`);
    }
  } catch (error) {
    console.error('[ExpiredGoals] Failed to mark expired goals:', error);
  }
};

const expiredGoalsJob = new cron.CronJob('0 0 * * *', markExpiredGoals); // runs daily at midnight UTC

const startExpiredGoalsJob = () => {
  expiredGoalsJob.start();
  console.log('Expired goals job started (user-timezone aware)');
};

const stopExpiredGoalsJob = () => {
  expiredGoalsJob.stop();
  console.log('Expired goals job stopped');
};

module.exports = { startExpiredGoalsJob, stopExpiredGoalsJob, markExpiredGoals };