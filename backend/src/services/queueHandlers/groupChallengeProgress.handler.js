const ActivityLog = require('../../models/ActivityLog');
const HeatmapData = require('../../models/HeatmapData');
const User = require('../../models/User');
const heatmapService = require('../heatmap.service');
const { updateUserActivity } = require('../user.service');
const { invalidateCache } = require('../../middleware/cache');
const { parseDate } = require('../../utils/helpers/date');

const handleGroupChallengeProgress = async (job) => {
  const { userId, groupId, challengeId, delta, newProgress, target, timestamp } = job.data;
  const activityDate = parseDate(timestamp || new Date());

  try {
    // Fetch user and timezone
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    const userTimeZone = user.preferences?.timezone || 'UTC';

    // --- Update user streak and active days using user timezone ---
    await updateUserActivity(userId, activityDate, userTimeZone);

    // --- Update heatmap – create if missing, using user timezone ---
    const year = activityDate.getUTCFullYear();
    let heatmap = await HeatmapData.findOne({ userId, year });
    if (!heatmap) {
      heatmap = await heatmapService.generateHeatmapData(userId, year, userTimeZone);
    }
    if (heatmap) {
      const dayEntry = heatmap.dailyData.find(
        (d) => new Date(d.date).toDateString() === activityDate.toDateString()
      );
      if (dayEntry) {
        dayEntry.studyGroupActivity += 1;
        dayEntry.totalActivities += 1;
        dayEntry.intensityLevel = Math.min(4, Math.floor(dayEntry.totalActivities / 3));
      }
      heatmap.lastUpdated = new Date();
      await heatmap.save();
      await invalidateCache(`heatmap:${userId}:${year}:*`);
    }

    // --- Create activity log ONLY if progress > 50% or ==100% ---
    // Note: newProgress is already a percentage (0‑100)
    if (newProgress > 50 || newProgress === 100) {
      await ActivityLog.create({
        userId,
        action: 'group_challenge_progress',
        targetId: groupId,
        targetModel: 'StudyGroup',
        metadata: {
          challengeId,
          delta,
          newProgress,
          target
        },
        timestamp: activityDate,
      });
    }

    console.log(`Group challenge progress processed for user ${userId} (progress: ${newProgress}%, target: ${target})`);
  } catch (error) {
    console.error('Error in groupChallengeProgress handler:', error);
    throw error;
  }
};

module.exports = { handleGroupChallengeProgress };