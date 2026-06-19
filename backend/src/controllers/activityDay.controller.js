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
//  HELPERS
// ----------------------------------------------------------------------

/**
 * Sorts grouped items by the latest timestamp in their timeline.
 * @param {Object} grouped - Object with question IDs as keys and { question, solves_timeline } or { question, revision_timeline }
 * @param {string} timelineKey - The key of the timeline array ('solves_timeline' or 'revision_timeline')
 * @returns {Object} New object with keys sorted by latest timestamp (descending)
 */
function sortGroupedByLatestTimestamp(grouped, timelineKey) {
  if (!grouped || typeof grouped !== 'object') return grouped;
  const entries = Object.entries(grouped);
  if (entries.length === 0) return grouped;

  const withLatest = entries.map(([key, value]) => {
    const timeline = value[timelineKey] || [];
    let latest = null;
    if (timeline.length > 0) {
      latest = new Date(Math.max(...timeline.map(item => new Date(item.timestamp).getTime())));
    }
    return { key, value, latest };
  });

  withLatest.sort((a, b) => {
    if (a.latest === null && b.latest === null) return 0;
    if (a.latest === null) return 1;
    if (b.latest === null) return -1;
    return b.latest.getTime() - a.latest.getTime();
  });

  const sorted = {};
  for (const item of withLatest) {
    sorted[item.key] = item.value;
  }
  return sorted;
}

const groupQuestionLogs = (logs) => {
  const grouped = {};
  for (const log of logs) {
    let questionId;
    let questionObj;

    if (!log.targetId || !log.targetId._id) {
      questionId = `deleted_${log._id}`;
      questionObj = {
        _id: null,
        title: 'Deleted problem',
        platform: 'Unknown',
        platformQuestionId: null,
        difficulty: 'Unknown',
        pattern: [],
        patternSlugs: [],
      };
    } else {
      questionId = log.targetId._id.toString();
      questionObj = { ...log.targetId };
      if (questionObj.pattern && Array.isArray(questionObj.pattern)) {
        questionObj.patternSlugs = questionObj.pattern.map(p => slugify(p));
      } else {
        questionObj.pattern = [];
        questionObj.patternSlugs = [];
      }
    }

    if (!grouped[questionId]) {
      grouped[questionId] = {
        question: questionObj,
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
    let questionId;
    let questionObj;

    if (!log.targetId || !log.targetId._id) {
      questionId = `deleted_${log._id}`;
      questionObj = {
        _id: null,
        title: 'Deleted problem',
        platform: 'Unknown',
        platformQuestionId: null,
        difficulty: 'Unknown',
        pattern: [],
        patternSlugs: [],
      };
    } else {
      questionId = log.targetId._id.toString();
      questionObj = { ...log.targetId };
      if (questionObj.pattern && Array.isArray(questionObj.pattern)) {
        questionObj.patternSlugs = questionObj.pattern.map(p => slugify(p));
      } else {
        questionObj.pattern = [];
        questionObj.patternSlugs = [];
      }
    }

    if (!grouped[questionId]) {
      grouped[questionId] = {
        question: questionObj,
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
    { $unwind: { path: '$targetId', preserveNullAndEmptyArrays: true } },
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
  logs = logs.map(log => {
    if (log.targetId && log.targetId.pattern && Array.isArray(log.targetId.pattern)) {
      log.targetId.patternSlugs = log.targetId.pattern.map(p => slugify(p));
    } else if (log.targetId) {
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

// Helper to count unique questions from a grouped object
const countUniqueQuestions = (grouped) => {
  return Object.keys(grouped).length;
};

// Merge revision completions into solved questions
const mergeRevisionsIntoSolved = (questionSolved, revisionOnTime, revisionOverdue) => {
  const merged = { ...questionSolved };

  const addRevisionAsSolve = (revisionGroup) => {
    for (const [qid, group] of Object.entries(revisionGroup)) {
      if (!merged[qid]) {
        // Create a new solved entry based on the revision group
        merged[qid] = {
          question: group.question,
          solves_timeline: group.revision_timeline.map(rev => ({
            _id: rev._id,
            timestamp: rev.timestamp,
            timeSpent: rev.timeSpent,
            isFirstSolve: false,
          })),
        };
      } else {
        // Optionally, add revision timeline entries to existing solves (avoid duplicates)
        // We'll add only if the timestamp is not already present (simple check by timestamp)
        const existingTimestamps = new Set(merged[qid].solves_timeline.map(t => t.timestamp.toISOString()));
        for (const rev of group.revision_timeline) {
          if (!existingTimestamps.has(rev.timestamp.toISOString())) {
            merged[qid].solves_timeline.push({
              _id: rev._id,
              timestamp: rev.timestamp,
              timeSpent: rev.timeSpent,
              isFirstSolve: false,
            });
          }
        }
        // Re‑sort timeline
        merged[qid].solves_timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }
    }
  };

  addRevisionAsSolve(revisionOnTime);
  addRevisionAsSolve(revisionOverdue);

  return merged;
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

    const localDateStr = DateTime.now().setZone(timeZone).toFormat('yyyy-MM-dd');
    const localDayOfWeek = DateTime.now().setZone(timeZone).toFormat('cccc');

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
      logs = logs.map(log => {
        if (log.targetId && log.targetId.pattern && Array.isArray(log.targetId.pattern)) {
          log.targetId.patternSlugs = log.targetId.pattern.map(p => slugify(p));
        } else if (log.targetId) {
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

    // ----- SORT GROUPED DATA BY LATEST TIMESTAMP -----
    if (grouped.question_solved) {
      grouped.question_solved = sortGroupedByLatestTimestamp(grouped.question_solved, 'solves_timeline');
    }
    if (grouped.question_mastered) {
      grouped.question_mastered = sortGroupedByLatestTimestamp(grouped.question_mastered, 'solves_timeline');
    }
    if (grouped.revision_completed) {
      if (grouped.revision_completed.on_time) {
        grouped.revision_completed.on_time = sortGroupedByLatestTimestamp(grouped.revision_completed.on_time, 'revision_timeline');
      }
      if (grouped.revision_completed.overdue) {
        grouped.revision_completed.overdue = sortGroupedByLatestTimestamp(grouped.revision_completed.overdue, 'revision_timeline');
      }
    }
    // ------------------------------------------------

    // Merge revision completions into solved questions
    const mergedSolved = mergeRevisionsIntoSolved(
      grouped.question_solved,
      grouped.revision_completed.on_time,
      grouped.revision_completed.overdue
    );

    // Also sort mergedSolved by latest timestamp (since it may contain new groups from revisions)
    const mergedSorted = sortGroupedByLatestTimestamp(mergedSolved, 'solves_timeline');

    // Recalculate solved count from merged object
    const uniqueSolved = countUniqueQuestions(mergedSorted);
    const uniqueMastered = countUniqueQuestions(grouped.question_mastered);
    const uniqueRevisedOnTime = countUniqueQuestions(grouped.revision_completed.on_time);
    const uniqueRevisedOverdue = countUniqueQuestions(grouped.revision_completed.overdue);
    const uniqueRevisedTotal = uniqueRevisedOnTime + uniqueRevisedOverdue;

    const { date: _, dayOfWeek: __, ...summaryWithoutDate } = summary;
    const response = {
      ...summaryWithoutDate,
      problemsSolved: uniqueSolved,
      problemsMastered: uniqueMastered,
      revisionsCompleted: uniqueRevisedTotal,
      date: localDateStr,
      dayOfWeek: localDayOfWeek,
      todayStudyTimeInMinutes: summary.studyTimeMinutes,
      ...grouped,
      question_solved: mergedSorted,   // override with merged and sorted version
    };

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

    const outputDate = date;
    const localDateTime = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: timeZone });
    const outputDayOfWeek = localDateTime.toFormat('cccc');

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
      logs = logs.map(log => {
        if (log.targetId && log.targetId.pattern && Array.isArray(log.targetId.pattern)) {
          log.targetId.patternSlugs = log.targetId.pattern.map(p => slugify(p));
        } else if (log.targetId) {
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

    // ----- SORT GROUPED DATA BY LATEST TIMESTAMP -----
    if (grouped.question_solved) {
      grouped.question_solved = sortGroupedByLatestTimestamp(grouped.question_solved, 'solves_timeline');
    }
    if (grouped.question_mastered) {
      grouped.question_mastered = sortGroupedByLatestTimestamp(grouped.question_mastered, 'solves_timeline');
    }
    if (grouped.revision_completed) {
      if (grouped.revision_completed.on_time) {
        grouped.revision_completed.on_time = sortGroupedByLatestTimestamp(grouped.revision_completed.on_time, 'revision_timeline');
      }
      if (grouped.revision_completed.overdue) {
        grouped.revision_completed.overdue = sortGroupedByLatestTimestamp(grouped.revision_completed.overdue, 'revision_timeline');
      }
    }
    // ------------------------------------------------

    // Merge revision completions into solved questions
    const mergedSolved = mergeRevisionsIntoSolved(
      grouped.question_solved,
      grouped.revision_completed.on_time,
      grouped.revision_completed.overdue
    );

    // Also sort mergedSolved by latest timestamp (since it may contain new groups from revisions)
    const mergedSorted = sortGroupedByLatestTimestamp(mergedSolved, 'solves_timeline');

    // Recalculate solved count from merged object
    const uniqueSolved = countUniqueQuestions(mergedSorted);
    const uniqueMastered = countUniqueQuestions(grouped.question_mastered);
    const uniqueRevisedOnTime = countUniqueQuestions(grouped.revision_completed.on_time);
    const uniqueRevisedOverdue = countUniqueQuestions(grouped.revision_completed.overdue);
    const uniqueRevisedTotal = uniqueRevisedOnTime + uniqueRevisedOverdue;

    const { date: _, dayOfWeek: __, ...summaryWithoutDate } = summary;
    const response = {
      ...summaryWithoutDate,
      problemsSolved: uniqueSolved,
      problemsMastered: uniqueMastered,
      revisionsCompleted: uniqueRevisedTotal,
      date: outputDate,
      dayOfWeek: outputDayOfWeek,
      todayStudyTimeInMinutes: summary.studyTimeMinutes,
      ...grouped,
      question_solved: mergedSorted,
    };

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(formatResponse(`Activity for ${date} retrieved successfully`, response, { timezone: timeZone }));
  } catch (error) {
    next(error);
  }
};

// Cache middlewares (only for today endpoint)
const todayCache = cache(300, 'activity:today');

module.exports = {
  getTodayActivity: [todayCache, getTodayActivity],
  getDayActivityByDate: [getDayActivityByDate],
};