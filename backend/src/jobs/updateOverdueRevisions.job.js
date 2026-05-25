const cron = require('cron');
const RevisionSchedule = require('../models/RevisionSchedule');
const User = require('../models/User');
const { getStartOfDay } = require('../utils/helpers/date');

/**
 * Cron job to update overdue revisions using each user's timezone.
 * - Advances currentRevisionIndex to the first schedule date >= today (user local).
 * - Does NOT add any completedRevisions entries.
 * - Updates overdueCount, status, overdueActive based on the new pending date.
 * Runs every hour.
 */
const updateOverdueRevisions = async () => {
  try {
    let skip = 0;
    const batchSize = 100;
    let processed = 0;

    while (true) {
      const schedules = await RevisionSchedule.find({
        status: { $in: ['active', 'overdue'] },
        $expr: {
          $and: [
            { $lt: ['$currentRevisionIndex', { $size: '$schedule' }] },
            { $lt: [{ $arrayElemAt: ['$schedule', '$currentRevisionIndex'] }, new Date()] }
          ]
        }
      })
        .skip(skip)
        .limit(batchSize)
        .lean();

      if (schedules.length === 0) break;

      // Collect unique user IDs
      const userIds = [...new Set(schedules.map(s => s.userId.toString()))];
      const users = await User.find({ _id: { $in: userIds } })
        .select('preferences.timezone')
        .lean();

      const timezoneMap = new Map();
      for (const user of users) {
        timezoneMap.set(user._id.toString(), user.preferences?.timezone || 'UTC');
      }

      for (const rev of schedules) {
        const userTz = timezoneMap.get(rev.userId.toString()) || 'UTC';
        const todayStart = getStartOfDay(new Date(), userTz);

        // Find first index where schedule date >= todayStart
        let newIndex = rev.currentRevisionIndex;
        for (let i = rev.currentRevisionIndex; i < rev.schedule.length; i++) {
          if (rev.schedule[i] >= todayStart) {
            newIndex = i;
            break;
          }
        }
        // If all remaining dates are < todayStart, keep the last index
        if (newIndex === rev.currentRevisionIndex && rev.schedule[rev.currentRevisionIndex] < todayStart) {
          newIndex = rev.schedule.length - 1;
        }

        const update = {
          $set: {
            currentRevisionIndex: newIndex,
            updatedAt: new Date()
          }
        };

        // Recalculate state based on the new pending date
        if (newIndex < rev.schedule.length) {
          const pendingDue = rev.schedule[newIndex];
          const daysOverdue = Math.floor((todayStart - pendingDue) / (1000 * 60 * 60 * 24));
          update.$set.overdueCount = daysOverdue > 0 ? daysOverdue : 0;
          update.$set.overdueActive = daysOverdue > 0;
          update.$set.status = daysOverdue > 0 ? 'overdue' : 'active';
        } else {
          update.$set.status = 'completed';
          update.$set.overdueActive = false;
          update.$set.overdueCount = 0;
        }

        await RevisionSchedule.updateOne({ _id: rev._id }, update);
        processed++;
      }

      skip += batchSize;
    }

    if (processed > 0) {
      console.log(`[OverdueRevisions] Updated ${processed} overdue revision schedules (user-timezone aware).`);
    }
  } catch (error) {
    console.error('[OverdueRevisions] Job failed:', error);
  }
};

// Schedule every hour at minute 0
const overdueJob = new cron.CronJob('0 * * * *', updateOverdueRevisions);

const startOverdueRevisionsJob = () => {
  overdueJob.start();
  // console.log('Overdue revisions job started (user-timezone aware)');
};

const stopOverdueRevisionsJob = () => {
  overdueJob.stop();
};

module.exports = {
  startOverdueRevisionsJob,
  stopOverdueRevisionsJob,
  updateOverdueRevisions,
};