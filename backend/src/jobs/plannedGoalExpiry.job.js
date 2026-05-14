const cron = require('cron');
const Goal = require('../models/Goal');
const User = require('../models/User');
const { getEndOfDay } = require('../utils/helpers/date');

/**
 * Mark expired planned goals as failed using each user's timezone.
 * A planned goal is considered expired if its endDate (UTC) is before the user's local end of day.
 * Runs daily at midnight UTC.
 */
const markExpiredPlannedGoals = async () => {
  try {
    let skip = 0;
    const batchSize = 100;
    let totalUpdated = 0;

    while (true) {
      const goals = await Goal.find({
        goalType: 'planned',
        status: 'active'
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
      console.log(`[PlannedGoalExpiry] Marked ${totalUpdated} expired planned goals as failed (user-timezone aware)`);
    }
  } catch (error) {
    console.error('[PlannedGoalExpiry] Failed to mark expired planned goals:', error);
  }
};

const plannedGoalExpiryJob = new cron.CronJob('0 0 * * *', markExpiredPlannedGoals); // daily at midnight UTC

const startPlannedGoalExpiryJob = () => {
  plannedGoalExpiryJob.start();
  console.log('Planned goal expiry job started (user-timezone aware)');
};

const stopPlannedGoalExpiryJob = () => {
  plannedGoalExpiryJob.stop();
  console.log('Planned goal expiry job stopped');
};

module.exports = {
  startPlannedGoalExpiryJob,
  stopPlannedGoalExpiryJob,
  markExpiredPlannedGoals
};