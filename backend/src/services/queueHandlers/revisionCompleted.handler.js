// src/services/queueHandlers/revisionCompleted.handler.js
const User = require('../../models/User');
const Question = require('../../models/Question');
const UserQuestionProgress = require('../../models/UserQuestionProgress');
const HeatmapData = require('../../models/HeatmapData');
const Notification = require('../../models/Notification');
const Goal = require('../../models/Goal');
const { invalidateCache, invalidateDashboardCache } = require('../../middleware/cache');
const heatmapService = require('../heatmap.service');
const { parseDate } = require('../../utils/helpers/date');
const { updateUserActivity } = require('../user.service');
const { DateTime } = require('luxon');

const handleRevisionCompleted = async (job) => {
  const { userId, revisionId, questionId, completedAt, revisionIndex, status } = job.data;
  const revisionDate = parseDate(completedAt);

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    const userTimeZone = user.preferences?.timezone || 'UTC';

    await updateUserActivity(userId, revisionDate, userTimeZone);

    user.stats.totalRevisions = (user.stats.totalRevisions || 0) + 1;
    await user.save();
    await invalidateCache(`user:${userId}:profile`);

    // NOTE: revisionCount is now incremented synchronously in revisionActivity.service.js
    // No longer increment here to avoid double counting.
    // The following line has been removed:
    // if (progress) { progress.revisionCount += 1; ... }
    // const progress = await UserQuestionProgress.findOne({ userId, questionId });
    // if (progress) {
    //   progress.revisionCount += 1;
    //   progress.lastRevisedAt = revisionDate;
    //   await progress.save();
    //   await invalidateCache(`progress:*:user:${userId}:*`);
    // }

    const year = revisionDate.getUTCFullYear();
    let heatmap = await HeatmapData.findOne({ userId, year });
    if (!heatmap) {
      heatmap = await heatmapService.generateHeatmapData(userId, year, userTimeZone);
    }
    if (heatmap) {
      const dayEntry = heatmap.dailyData.find(d => new Date(d.date).toDateString() === revisionDate.toDateString());
      if (dayEntry) {
        dayEntry.revisionProblems += 1;
        dayEntry.totalActivities += 1;
        dayEntry.intensityLevel = Math.min(4, Math.floor(dayEntry.totalActivities / 3));
      }
      heatmap.lastUpdated = new Date();
      await heatmap.save();
      await invalidateCache(`heatmap:${userId}:${year}:*`);
    }

    const question = await Question.findById(questionId).select('title platformQuestionId');
    const questionTitle = question ? question.title : 'a question';
    const platformQuestionId = question ? question.platformQuestionId : null;

    await Notification.create({
      userId,
      type: 'revision_completed',
      title: 'Revision Completed',
      message: `You completed a revision for "${questionTitle}"`,
      data: {
        questionId,
        revisionId,
        revisionIndex,
        status,
      },
      channel: 'in-app',
      status: 'sent',
      scheduledAt: new Date(),
    });

    // Update planned goals if revision completed (and it counts as progress toward goal)
    const revisionLocal = DateTime.fromJSDate(revisionDate, { zone: userTimeZone });
    const revisionLocalMidnight = revisionLocal.startOf('day');
    const revisionLocalEnd = revisionLocal.endOf('day');
    const startUTC = revisionLocalMidnight.toUTC().toJSDate();
    const endUTC = revisionLocalEnd.toUTC().toJSDate();

    const activePlannedGoals = await Goal.find({
      userId,
      goalType: "planned",
      status: "active",
      targetQuestions: questionId,
      startDate: { $lte: endUTC },
      endDate: { $gte: startUTC },
    });

    const { jobQueue } = require('../queue.service');

    for (const goal of activePlannedGoals) {
      const alreadyCompleted = goal.completedQuestions.some(
        (cq) => cq.questionId.toString() === questionId.toString()
      );
      if (!alreadyCompleted) {
        goal.completedQuestions.push({
          questionId,
          platformQuestionId,
          completedAt: revisionDate
        });
        await goal.save();

        if (goal.completedQuestions.length === goal.targetQuestions.length) {
          const completedQuestionDetails = {
            questionId: questionId.toString(),
            platformQuestionId,
            title: questionTitle,
          };
          await jobQueue.add('goal.completed', {
            userId,
            goalId: goal._id,
            completedAt: goal.achievedAt || new Date(),
            goalType: goal.goalType,
            targetCount: goal.targetCount,
            completedCount: goal.completedCount,
            completedQuestionDetails,
          });
        }
      }
    }

    // Queue confidence increment
    await jobQueue.add('confidence.increment', {
      userId,
      questionId,
      action: "revision_completed",
    });

    await invalidateCache(`notifications:*:user:${userId}:*`);
    await invalidateDashboardCache(userId);
  } catch (error) {
    console.error('Error processing revision.completed:', error);
    throw error;
  }
};

module.exports = { handleRevisionCompleted };