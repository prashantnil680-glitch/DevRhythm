const { DateTime } = require('luxon');
const User = require("../../models/User");
const Question = require("../../models/Question");
const PatternMastery = require("../../models/PatternMastery");
const RevisionSchedule = require("../../models/RevisionSchedule");
const Goal = require("../../models/Goal");
const ActivityLog = require("../../models/ActivityLog");
const HeatmapData = require("../../models/HeatmapData");
const Notification = require("../../models/Notification");
const UserQuestionProgress = require("../../models/UserQuestionProgress");
const {
  invalidateUserCache,
  invalidateCache,
  invalidateDashboardCache,
} = require("../../middleware/cache");
const { getStartOfDay, parseDate } = require("../../utils/helpers/date");
const heatmapService = require("../heatmap.service");
const { updateUserActivity } = require("../user.service");
const { client: redisClient } = require("../../config/redis");
const constants = require("../../config/constants");
const leetcodeService = require("../leetcode.service");
const SheetService = require("../sheet.service");

const getGoalDailySolveKey = (userId, dateStr) => `goal:solved:daily:${userId}:${dateStr}`;

const handleQuestionSolved = async (job) => {
  const { userId, questionId, progressId, timeSpent = 0, solvedAt } = job.data;
  const solvedDate = parseDate(solvedAt);
  if (isNaN(solvedDate.getTime())) {
    throw new Error(`Invalid solvedAt date: ${solvedAt}`);
  }

  try {
    const question = await Question.findById(questionId);
    if (!question) throw new Error("Question not found");

    let isPod = false;
    let dailyProblem = null;
    try {
      dailyProblem = await leetcodeService.getDailyProblem();
      if (dailyProblem && dailyProblem.titleSlug === question.platformQuestionId) {
        isPod = true;
      }
    } catch (err) {
      console.warn(`[question.solved] Failed to check daily problem: ${err.message}`);
    }

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    const userTimeZone = user.preferences?.timezone || "UTC";

    let progress = await UserQuestionProgress.findOne({ userId, questionId });
    const todayStartUTC = getStartOfDay(new Date(), userTimeZone);
    const wasSolvedToday = progress?.solvedToday && progress?.lastActivityDate >= todayStartUTC;

    let solvedTodayChanged = false;
    if (!wasSolvedToday) {
      if (progress) {
        progress.solvedToday = true;
        progress.lastActivityDate = solvedDate;
        solvedTodayChanged = true;
      }
    }

    const isFirstSolve = !progress || progress.status !== "Solved";

    user.stats.totalTimeSpent += timeSpent;

    await updateUserActivity(userId, solvedDate, userTimeZone);
    await user.save();

    // Update sheet progress for this solve
    await SheetService.updateSheetProgressOnSolve(userId, questionId);
    await invalidateUserCache(userId);

    const updateData = {
      $inc: {
        totalTimeSpent: timeSpent,
        ...(isFirstSolve ? { "attempts.count": 1 } : {}),
      },
      $set: {
        status: "Solved",
        "attempts.solvedAt": solvedDate,
        "attempts.lastAttemptAt": solvedDate,
        updatedAt: solvedDate,
        solvedToday: true,
        lastActivityDate: solvedDate,
      },
      $setOnInsert: {
        "attempts.firstAttemptAt": solvedDate,
      },
    };
    progress = await UserQuestionProgress.findOneAndUpdate(
      { userId, questionId },
      updateData,
      { upsert: true, new: true }
    );

    // ========== PATTERN MASTERY UPDATE WITH VERSION ERROR RETRY ==========
    if (question.pattern && Array.isArray(question.pattern) && question.pattern.length > 0) {
      for (const patternName of question.pattern) {
        let retries = 3;
        while (retries > 0) {
          try {
            let pattern = await PatternMastery.findOne({ userId, patternName });
            if (!pattern) {
              pattern = new PatternMastery({
                userId,
                patternName,
                patternSlug: patternName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-'),
                title: patternName,
                description: `Problems using the ${patternName} pattern`,
                solvedCount: 0,
                masteredCount: 0,
                totalAttempts: 0,
                successfulAttempts: 0,
                recentQuestions: [],
              });
            } else {
              if (!pattern.title) pattern.title = patternName;
              if (!pattern.description) pattern.description = `Problems using the ${patternName} pattern`;
            }

            if (isFirstSolve) pattern.solvedCount += 1;
            pattern.totalAttempts += 1;
            pattern.successfulAttempts += 1;

            if (pattern.successfulAttempts > pattern.totalAttempts) {
              pattern.successfulAttempts = pattern.totalAttempts;
            }

            pattern.successRate = pattern.totalAttempts > 0 ? (pattern.successfulAttempts / pattern.totalAttempts) * 100 : 0;
            const totalPatternQuestions = await Question.countDocuments({ pattern: patternName });
            pattern.masteryRate = totalPatternQuestions > 0 ? (pattern.masteredCount / totalPatternQuestions) * 100 : 0;
            pattern.confidenceLevel = pattern.masteryRate >= 80 ? 5 : pattern.masteryRate >= 60 ? 4 : pattern.masteryRate >= 40 ? 3 : pattern.masteryRate >= 20 ? 2 : 1;
            pattern.lastPracticed = solvedDate;
            pattern.lastUpdated = new Date();

            // Add recent question (avoid duplicates)
            const existingIdx = pattern.recentQuestions.findIndex(rq => rq.questionId?.toString() === questionId);
            if (existingIdx !== -1) pattern.recentQuestions.splice(existingIdx, 1);
            pattern.recentQuestions.unshift({
              questionProgressId: progressId,
              questionId,
              platformQuestionId: question.platformQuestionId,
              title: question.title,
              problemLink: question.problemLink,
              platform: question.platform,
              difficulty: question.difficulty,
              solvedAt: solvedDate,
              status: "Solved",
              timeSpent,
            });
            if (pattern.recentQuestions.length > 10) pattern.recentQuestions.pop();

            await pattern.save();
            break; // success
          } catch (err) {
            if (err.name === 'VersionError' && retries > 1) {
              retries--;
              await new Promise(resolve => setTimeout(resolve, 100));
              continue;
            }
            throw err;
          }
        }
      }
      await invalidateCache(`pattern-mastery:*:user:${userId}:*`);
    }
    // ========== END PATTERN MASTERY UPDATE ==========

    const solvedLocal = DateTime.fromJSDate(solvedDate, { zone: userTimeZone });
    const solvedLocalMidnight = solvedLocal.startOf('day');
    const solvedLocalEnd = solvedLocal.endOf('day');
    const startUTC = solvedLocalMidnight.toUTC().toJSDate();
    const endUTC = solvedLocalEnd.toUTC().toJSDate();

    const activePlannedGoals = await Goal.find({
      userId,
      goalType: "planned",
      status: "active",
      targetQuestions: questionId,
      startDate: { $lte: endUTC },
      endDate: { $gte: startUTC },
    });

    for (const goal of activePlannedGoals) {
      const alreadyCompleted = goal.completedQuestions.some(
        (cq) => cq.questionId.toString() === questionId.toString()
      );
      if (!alreadyCompleted) {
        goal.completedQuestions.push({
          questionId,
          platformQuestionId: question.platformQuestionId,
          completedAt: solvedDate
        });
        await goal.save();

        if (goal.completedQuestions.length === goal.targetQuestions.length) {
          const completedQuestionDetails = {
            questionId: questionId.toString(),
            platformQuestionId: question.platformQuestionId,
            title: question.title,
          };
          const { jobQueue } = require("../queue.service");
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

    const existingRevision = await RevisionSchedule.findOne({ userId, questionId });

    if (!existingRevision) {
      const scheduleDays = constants.REVISION_SCHEDULE;
      const scheduleUTC = scheduleDays.map(days => {
        const localDate = solvedLocal.startOf('day').plus({ days });
        return localDate.toUTC().toJSDate();
      });
      await RevisionSchedule.create({
        userId,
        questionId,
        schedule: scheduleUTC,
        baseDate: solvedLocalMidnight.toUTC().toJSDate(),
        status: "active",
        currentRevisionIndex: 0,
        completedRevisions: []
      });
    } else {
      if (existingRevision.completedRevisions.length === 0 && existingRevision.currentRevisionIndex !== 0) {
        existingRevision.currentRevisionIndex = 0;
        existingRevision.completedRevisions = [];
        existingRevision.updatedAt = new Date();
        await existingRevision.save();
      }
    }
    await invalidateCache(`revisions:*:user:${userId}:*`);
    await invalidateCache(`question-details:*:${questionId}:*`);

    if (isPod) {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const existingPodNotification = await Notification.findOne({
        userId,
        type: 'pod_solved',
        'data.questionId': questionId.toString(),
        createdAt: { $gte: oneDayAgo }
      });

      if (!existingPodNotification) {
        await Notification.create({
          userId,
          type: 'pod_solved',
          title: 'Daily Problem Solved!',
          message: `You solved today's POD: "${question.title}"`,
          data: {
            questionId,
            platformQuestionId: question.platformQuestionId,
            title: question.title,
            difficulty: question.difficulty,
            link: dailyProblem?.link || question.problemLink,
          },
          channel: 'in-app',
          status: 'sent',
          scheduledAt: new Date(),
        });
        await invalidateCache(`notifications:${userId}:*`);
        console.log(`[question.solved] Created pod_solved notification for user ${userId}`);
      } else {
        console.log(`[question.solved] Skipping duplicate pod_solved notification for user ${userId}, question ${questionId}`);
      }
    }

    // Daily/weekly goals update
    if (!wasSolvedToday) {
      let isGoalRelated = false;

      const dayStart = getStartOfDay(solvedDate, userTimeZone);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      dayEnd.setUTCMilliseconds(-1);

      const activeDailyWeekly = await Goal.findOne({
        userId,
        goalType: { $in: ["daily", "weekly"] },
        status: "active",
        startDate: { $lte: dayEnd },
        endDate: { $gte: dayStart },
      });
      if (activeDailyWeekly) {
        isGoalRelated = true;
      } else {
        const plannedGoal = await Goal.findOne({
          userId,
          goalType: "planned",
          status: "active",
          targetQuestions: questionId,
          startDate: { $lte: dayEnd },
          endDate: { $gte: dayStart },
        });
        if (plannedGoal) isGoalRelated = true;
      }

      if (isGoalRelated) {
        const dateStr = solvedLocal.toFormat('yyyy-MM-dd');
        const redisKey = getGoalDailySolveKey(userId, dateStr);
        await redisClient.incr(redisKey);
        await redisClient.expire(redisKey, 90 * 86400);
      }

      const dailyGoal = await Goal.findOne({
        userId,
        goalType: "daily",
        startDate: { $lte: dayStart },
        endDate: { $gte: dayStart },
        status: "active",
      });
      if (dailyGoal) {
        dailyGoal.completedCount += 1;
        await dailyGoal.save();
        if (dailyGoal.completedCount >= dailyGoal.targetCount) {
          const { jobQueue } = require("../queue.service");
          await jobQueue.add('goal.completed', {
            userId,
            goalId: dailyGoal._id,
            completedAt: new Date(),
            goalType: dailyGoal.goalType,
            targetCount: dailyGoal.targetCount,
            completedCount: dailyGoal.completedCount,
            triggerQuestionId: questionId,
          });
        }
      }
      await invalidateCache(`goals:*:user:${userId}:*`);
    }

    await ActivityLog.create({
      userId,
      action: "question_solved",
      targetId: questionId,
      targetModel: "Question",
      metadata: {
        title: question.title,
        platformQuestionId: question.platformQuestionId,
        difficulty: question.difficulty,
        platform: question.platform,
        pattern: question.pattern,
        timeSpent,
        isFirstSolve,
      },
      timestamp: solvedDate,
    });

    const year = solvedDate.getUTCFullYear();
    let heatmap = await HeatmapData.findOne({ userId, year });
    if (!heatmap) {
      heatmap = await heatmapService.generateHeatmapData(userId, year, userTimeZone);
    }
    if (heatmap) {
      const activityDateStr = solvedDate.toISOString().split("T")[0];
      const dayEntry = heatmap.dailyData.find((d) => d.date.toISOString().split("T")[0] === activityDateStr);
      if (dayEntry) {
        dayEntry.totalActivities += 1;
        dayEntry.totalSubmissions += 1;
        dayEntry.totalTimeSpent += timeSpent;
        if (isFirstSolve) dayEntry.newProblemsSolved += 1;
        dayEntry.intensityLevel = Math.min(4, Math.floor(dayEntry.totalActivities / 3));
      }
      heatmap.lastUpdated = new Date();
      await heatmap.save();
      await invalidateCache(`heatmap:*:user:${userId}:*`);
    }

    if (isFirstSolve) {
      await Notification.create({
        userId,
        type: "question_solved",
        title: "Problem Solved!",
        message: `You solved "${question.title}"`,
        data: {
          questionId,
          platformQuestionId: question.platformQuestionId,
          title: question.title,
          difficulty: question.difficulty,
          platform: question.platform,
          timeSpent,
        },
        channel: "in-app",
        status: "sent",
        scheduledAt: new Date(),
      });

      const solvedCount = user.stats.totalSolved;
      const milestones = [1, 10, 25, 50, 100, 250, 500, 1000];
      if (milestones.includes(solvedCount)) {
        await Notification.create({
          userId,
          type: "goal_completion",
          title: "Milestone Achieved!",
          message: `Congratulations! You've solved ${solvedCount} problems.`,
          data: { milestone: solvedCount },
          channel: "in-app",
          status: "sent",
          scheduledAt: new Date(),
        });
      }
    }

    const { jobQueue } = require("../queue.service");
    await jobQueue.add('confidence.increment', {
      userId,
      questionId,
      action: "question_solved",
    });

    await invalidateCache(`notifications:*:user:${userId}:*`);
    await invalidateDashboardCache(userId);
  } catch (error) {
    console.error(`[question.solved] Error processing for user ${userId}:`, error);
    throw error;
  }
};

module.exports = { handleQuestionSolved };