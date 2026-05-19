const { DateTime } = require('luxon');
const heatmapService = require('../services/heatmap.service');
const ActivityLog = require('../models/ActivityLog');
const RevisionSchedule = require('../models/RevisionSchedule');
const Goal = require('../models/Goal');
const { formatResponse } = require('../utils/helpers/response');
const { getStartOfDay, getEndOfDay, formatDate } = require('../utils/helpers/date');
const { slugify } = require('../utils/helpers/string');
const AppError = require('../utils/errors/AppError');
const Joi = require('joi');
const { cache } = require('../middleware/cache');

// ----------------------------------------------------------------------
//  HELPERS (same as in activity.controller)
// ----------------------------------------------------------------------

const groupQuestionLogs = (logs) => {
  const grouped = {};
  for (const log of logs) {
    if (!log.targetId || !log.targetId._id) continue;
    const questionId = log.targetId._id.toString();
    if (!grouped[questionId]) {
      grouped[questionId] = {
        question: { ...log.targetId },
        solves_timeline: []
      };
    }
    grouped[questionId].solves_timeline.push({
      _id: log._id,
      timestamp: log.timestamp,
      timeSpent: log.metadata?.timeSpent || 0,
      isFirstSolve: log.metadata?.isFirstSolve || false
    });
  }
  for (const qid in grouped) {
    grouped[qid].solves_timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  return grouped;
};

const groupRevisionLogs = (logs) => {
  const grouped = {};
  for (const log of logs) {
    if (!log.targetId || !log.targetId._id) continue;
    const questionId = log.targetId._id.toString();
    if (!grouped[questionId]) {
      grouped[questionId] = {
        question: { ...log.targetId },
        revision_timeline: []
      };
    }
    grouped[questionId].revision_timeline.push({
      _id: log._id,
      timestamp: log.timestamp,
      overdueCompleted: log.metadata?.overdueCompleted || false,
      outOfOrder: log.metadata?.outOfOrder || false,
      timeSpent: log.metadata?.timeSpent || 0,
      confidenceAfter: log.metadata?.confidenceAfter || null,
      scheduledDate: log.metadata?.scheduledDate,
      revisionIndex: log.metadata?.revisionIndex
    });
  }
  for (const qid in grouped) {
    grouped[qid].revision_timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  return grouped;
};

const processRevisionLogs = (logs) => {
  const onTime = logs.filter(log => !log.metadata?.overdueCompleted);
  const overdue = logs.filter(log => log.metadata?.overdueCompleted === true);
  const total = logs.length;
  const onTimeCount = onTime.length;
  const overdueCount = overdue.length;
  let message = null;
  if (overdueCount > onTimeCount && total > 0) {
    message = 'Most users complete revisions on time to stay consistent with their learning flow. Try solving on time or reschedule in your preferences.';
  }
  return {
    on_time: onTime,
    overdue: overdue,
    ratio: {
      on_time: total ? parseFloat((onTimeCount / total).toFixed(2)) : 0,
      overdue: total ? parseFloat((overdueCount / total).toFixed(2)) : 0,
      counts: { on_time: onTimeCount, overdue: overdueCount, total }
    },
    message
  };
};

// FIXED: filter by completedAt AFTER unwinding, so only revisions on the exact day are returned
const fetchRevisionLogsForDate = async (userId, startDate, endDate) => {
  const pipeline = [
    { $match: { userId } },
    { $unwind: '$completedRevisions' },
    {
      $match: {
        'completedRevisions.status': 'completed',
        'completedRevisions.completedAt': { $gte: startDate, $lte: endDate }
      }
    },
    { $sort: { 'completedRevisions.completedAt': -1 } },
    {
      $lookup: {
        from: 'questions',
        localField: 'questionId',
        foreignField: '_id',
        as: 'targetId'
      }
    },
    { $unwind: '$targetId' },
    {
      $project: {
        _id: '$_id',
        userId: 1,
        action: { $literal: 'revision_completed' },
        targetId: {
          _id: '$targetId._id',
          title: '$targetId.title',
          platform: '$targetId.platform',
          platformQuestionId: '$targetId.platformQuestionId',
          difficulty: '$targetId.difficulty',
          pattern: '$targetId.pattern'
        },
        targetModel: { $literal: 'Question' },
        metadata: {
          revisionIndex: '$completedRevisions.revisionIndex',
          scheduledDate: '$completedRevisions.date',
          overdueCompleted: { $ifNull: ['$completedRevisions.overdueCompleted', false] },
          outOfOrder: { $ifNull: ['$completedRevisions.outOfOrder', false] },
          timeSpent: '$completedRevisions.timeSpent',
          confidenceAfter: '$completedRevisions.confidenceAfter'
        },
        timestamp: '$completedRevisions.completedAt'
      }
    }
  ];
  let logs = await RevisionSchedule.aggregate(pipeline);
  logs = logs.filter(log => log.targetId && log.targetId._id);
  logs = logs.map(log => {
    if (log.targetId?.pattern && Array.isArray(log.targetId.pattern)) {
      log.targetId.patternSlugs = log.targetId.pattern.map(p => slugify(p));
    } else {
      log.targetId.pattern = [];
      log.targetId.patternSlugs = [];
    }
    return log;
  });
  return logs;
};

const fetchGoalsForDate = async (userId, startDate, endDate) => {
  const goals = await Goal.find({
    userId,
    $or: [
      { status: 'completed', achievedAt: { $gte: startDate, $lte: endDate } },
      { status: 'failed', endDate: { $gte: startDate, $lte: endDate } }
    ]
  }).lean();
  const formatGoal = (goal) => ({
    _id: goal._id,
    goalType: goal.goalType,
    targetCount: goal.targetCount,
    completedCount: goal.completedCount,
    startDate: goal.startDate,
    endDate: goal.endDate,
    completionPercentage: goal.completionPercentage,
    status: goal.status,
    achievedAt: goal.achievedAt || null,
    completedQuestions: goal.completedQuestions?.map(cq => ({
      questionId: cq.questionId,
      completedAt: cq.completedAt,
      platformQuestionId: cq.platformQuestionId
    }))
  });
  const completed = goals.filter(g => g.status === 'completed').map(formatGoal);
  const failed = goals.filter(g => g.status === 'failed').map(formatGoal);
  return { completed, failed };
};

// ----------------------------------------------------------------------
//  MAIN CONTROLLERS
// ----------------------------------------------------------------------

const getTodayActivity = async (req, res, next) => {
  try {
    const timeZone = req.userTimeZone || 'UTC';
    const now = new Date();
    const dayStart = getStartOfDay(now, timeZone);
    const dayEnd = getEndOfDay(now, timeZone);
    const userId = req.user._id;

    // Use luxon for reliable local date formatting
    const localDateStr = DateTime.now().setZone(timeZone).toFormat('yyyy-MM-dd');
    const localDayOfWeek = DateTime.now().setZone(timeZone).toFormat('cccc');

    // Fetch all actions for today
    const [questionSolvedLogs, questionMasteredLogs, revisionLogs, groupGoalProgress, groupGoalCompleted, groupChallengeProgress, groupChallengeCompleted] = await Promise.all([
      ActivityLog.find({ userId, action: 'question_solved', timestamp: { $gte: dayStart, $lte: dayEnd } })
        .populate({ path: 'targetId', select: 'title platform platformQuestionId difficulty pattern' })
        .lean(),
      ActivityLog.find({ userId, action: 'question_mastered', timestamp: { $gte: dayStart, $lte: dayEnd } })
        .populate({ path: 'targetId', select: 'title platform platformQuestionId difficulty pattern' })
        .lean(),
      fetchRevisionLogsForDate(userId, dayStart, dayEnd),
      ActivityLog.find({ userId, action: 'group_goal_progress', timestamp: { $gte: dayStart, $lte: dayEnd } }).lean(),
      ActivityLog.find({ userId, action: 'group_goal_completed', timestamp: { $gte: dayStart, $lte: dayEnd } }).lean(),
      ActivityLog.find({ userId, action: 'group_challenge_progress', timestamp: { $gte: dayStart, $lte: dayEnd } }).lean(),
      ActivityLog.find({ userId, action: 'group_challenge_completed', timestamp: { $gte: dayStart, $lte: dayEnd } }).lean()
    ]);

    const dayData = await heatmapService.getDayData(userId, now, timeZone);
    const summary = dayData || {
      problemsSolved: 0,
      revisionsCompleted: 0,
      studyTimeMinutes: 0,
      goalAchieved: false,
      goalTarget: 0,
      goalCompletion: 0,
      submissions: 0,
      testCaseExecutions: 0,
      passedCount: 0,
      failedCount: 0,
      activityBreakdown: { easy: 0, medium: 0, hard: 0, leetcode: 0, hackerrank: 0, codeforces: 0, other: 0 }
    };

    const { completed: completedGoals, failed: failedGoals } = await fetchGoalsForDate(userId, dayStart, dayEnd);

    const processQuestionLogs = (logs) => {
      logs = logs.filter(log => log.targetId && log.targetId._id);
      logs = logs.map(log => {
        if (log.targetId?.pattern && Array.isArray(log.targetId.pattern)) {
          log.targetId.patternSlugs = log.targetId.pattern.map(p => slugify(p));
        } else {
          log.targetId.pattern = [];
          log.targetId.patternSlugs = [];
        }
        return log;
      });
      return groupQuestionLogs(logs);
    };

    const grouped = {
      question_solved: processQuestionLogs(questionSolvedLogs),
      question_mastered: processQuestionLogs(questionMasteredLogs),
      revision_completed: (() => {
        const { on_time, overdue, ratio, message } = processRevisionLogs(revisionLogs);
        return { on_time: groupRevisionLogs(on_time), overdue: groupRevisionLogs(overdue), ratio, message };
      })(),
      goal_achieved: { completed: completedGoals, failed: failedGoals },
      group_goal_progress: groupGoalProgress,
      group_goal_completed: groupGoalCompleted,
      group_challenge_progress: groupChallengeProgress,
      group_challenge_completed: groupChallengeCompleted
    };

    // Exclude the UTC date and dayOfWeek from summary
    const { date: _, dayOfWeek: __, ...summaryWithoutDate } = summary;
    const response = {
      ...summaryWithoutDate,
      date: localDateStr,
      dayOfWeek: localDayOfWeek,
      todayStudyTimeInMinutes: summary.studyTimeMinutes,
      ...grouped
    };

    // Prevent any external caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(formatResponse('Today\'s activity retrieved successfully', response, { timezone: timeZone }));
  } catch (error) {
    next(error);
  }
};

const getDayActivityByDate = async (req, res, next) => {
  try {
    const { date } = req.params;
    const timeZone = req.userTimeZone || 'UTC';
    const userId = req.user._id;

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new AppError('Invalid date format. Use YYYY-MM-DD', 400);
    }
    const dayStart = getStartOfDay(targetDate, timeZone);
    const dayEnd = getEndOfDay(targetDate, timeZone);

    // Use the original date string for display
    const outputDate = date;
    // Compute correct day of week from the input date in the user's timezone
    const localDateTime = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: timeZone });
    const outputDayOfWeek = localDateTime.toFormat('cccc');

    // Fetch all actions for the specific day
    const [questionSolvedLogs, questionMasteredLogs, revisionLogs, groupGoalProgress, groupGoalCompleted, groupChallengeProgress, groupChallengeCompleted] = await Promise.all([
      ActivityLog.find({ userId, action: 'question_solved', timestamp: { $gte: dayStart, $lte: dayEnd } })
        .populate({ path: 'targetId', select: 'title platform platformQuestionId difficulty pattern' })
        .lean(),
      ActivityLog.find({ userId, action: 'question_mastered', timestamp: { $gte: dayStart, $lte: dayEnd } })
        .populate({ path: 'targetId', select: 'title platform platformQuestionId difficulty pattern' })
        .lean(),
      fetchRevisionLogsForDate(userId, dayStart, dayEnd),
      ActivityLog.find({ userId, action: 'group_goal_progress', timestamp: { $gte: dayStart, $lte: dayEnd } }).lean(),
      ActivityLog.find({ userId, action: 'group_goal_completed', timestamp: { $gte: dayStart, $lte: dayEnd } }).lean(),
      ActivityLog.find({ userId, action: 'group_challenge_progress', timestamp: { $gte: dayStart, $lte: dayEnd } }).lean(),
      ActivityLog.find({ userId, action: 'group_challenge_completed', timestamp: { $gte: dayStart, $lte: dayEnd } }).lean()
    ]);

    const dayData = await heatmapService.getDayData(userId, targetDate, timeZone);
    const summary = dayData || {
      problemsSolved: 0,
      revisionsCompleted: 0,
      studyTimeMinutes: 0,
      goalAchieved: false,
      goalTarget: 0,
      goalCompletion: 0,
      submissions: 0,
      testCaseExecutions: 0,
      passedCount: 0,
      failedCount: 0,
      activityBreakdown: { easy: 0, medium: 0, hard: 0, leetcode: 0, hackerrank: 0, codeforces: 0, other: 0 }
    };

    const { completed: completedGoals, failed: failedGoals } = await fetchGoalsForDate(userId, dayStart, dayEnd);

    const processQuestionLogs = (logs) => {
      logs = logs.filter(log => log.targetId && log.targetId._id);
      logs = logs.map(log => {
        if (log.targetId?.pattern && Array.isArray(log.targetId.pattern)) {
          log.targetId.patternSlugs = log.targetId.pattern.map(p => slugify(p));
        } else {
          log.targetId.pattern = [];
          log.targetId.patternSlugs = [];
        }
        return log;
      });
      return groupQuestionLogs(logs);
    };

    const grouped = {
      question_solved: processQuestionLogs(questionSolvedLogs),
      question_mastered: processQuestionLogs(questionMasteredLogs),
      revision_completed: (() => {
        const { on_time, overdue, ratio, message } = processRevisionLogs(revisionLogs);
        return { on_time: groupRevisionLogs(on_time), overdue: groupRevisionLogs(overdue), ratio, message };
      })(),
      goal_achieved: { completed: completedGoals, failed: failedGoals },
      group_goal_progress: groupGoalProgress,
      group_goal_completed: groupGoalCompleted,
      group_challenge_progress: groupChallengeProgress,
      group_challenge_completed: groupChallengeCompleted
    };

    // Exclude the UTC date and dayOfWeek from summary
    const { date: _, dayOfWeek: __, ...summaryWithoutDate } = summary;
    const response = {
      ...summaryWithoutDate,
      date: outputDate,
      dayOfWeek: outputDayOfWeek,
      todayStudyTimeInMinutes: summary.studyTimeMinutes,
      ...grouped
    };

    // Prevent any external caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(formatResponse(`Activity for ${date} retrieved successfully`, response, { timezone: timeZone }));
  } catch (error) {
    next(error);
  }
};

// Apply caching
const todayCache = cache(300, 'activity:today');        // 5 minutes
const dayCache = cache(3600, 'activity:day');          // 1 hour

module.exports = {
  getTodayActivity: [todayCache, getTodayActivity],
  getDayActivityByDate: [dayCache, getDayActivityByDate],
};