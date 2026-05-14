const ActivityLog = require('../models/ActivityLog');
const RevisionSchedule = require('../models/RevisionSchedule');
const Follow = require('../models/Follow');
const Goal = require('../models/Goal');
const Question = require('../models/Question');
const { formatResponse } = require('../utils/helpers/response');
const { getPaginationParams, paginate } = require('../utils/helpers/pagination');
const { getStartOfDay, getEndOfDay } = require('../utils/helpers/date');
const { slugify } = require('../utils/helpers/string');
const AppError = require('../utils/errors/AppError');

// All possible action values from ActivityLog schema
const ALL_ACTIONS = [
  'question_solved',
  'question_mastered',
  'revision_completed',
  'goal_achieved',
  'group_goal_progress',
  'group_goal_completed',
  'group_challenge_progress',
  'group_challenge_completed'
];

// ----------------------------------------------------------------------
//  HELPERS
// ----------------------------------------------------------------------

/**
 * Split revision logs into on_time / overdue and compute ratio.
 * Returns { on_time: [], overdue: [], ratio: {}, message }
 */
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

/**
 * Group revision logs by question ID (for on_time or overdue array).
 * Returns object keyed by questionId: { question: {...}, revision_timeline: [...] }
 */
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

/**
 * Fetch revision logs from RevisionSchedule (paginated).
 * Returns { logs, total }
 */
const getRevisionLogsFromSchedules = async (userId, { startDate, endDate, page = 1, limit = 20, sortBy = 'timestamp', sortOrder = 'desc' }) => {
  const skip = (page - 1) * limit;
  const matchStage = { userId };
  if (startDate || endDate) {
    matchStage['completedRevisions.completedAt'] = {};
    if (startDate) matchStage['completedRevisions.completedAt'].$gte = startDate;
    if (endDate) matchStage['completedRevisions.completedAt'].$lte = endDate;
  }

  const pipeline = [
    { $match: matchStage },
    { $unwind: '$completedRevisions' },
    { $match: { 'completedRevisions.status': 'completed' } },
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
    },
    { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } },
    { $skip: skip },
    { $limit: limit }
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

  const totalPipeline = [
    { $match: matchStage },
    { $unwind: '$completedRevisions' },
    { $match: { 'completedRevisions.status': 'completed' } },
    { $count: 'total' }
  ];
  const totalResult = await RevisionSchedule.aggregate(totalPipeline);
  const total = totalResult.length ? totalResult[0].total : 0;

  return { logs, total };
};

/**
 * Group question logs (solved/mastered) by question ID.
 * Returns object keyed by questionId: { question: {...}, solves_timeline: [...] }
 */
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

/**
 * Get question logs (solved/mastered) with pagination and grouping.
 * Returns { grouped, total } where total is number of logs (for pagination).
 */
const getGroupedQuestionLogs = async (userId, action, startDate, endDate, page, limit, sortBy = 'timestamp', sortOrder = 'desc') => {
  const effectiveLimit = Math.min(limit, 100);
  const skip = (page - 1) * effectiveLimit;
  const matchStage = { userId, action };
  if (startDate) matchStage.timestamp = { $gte: startDate };
  if (endDate) matchStage.timestamp = { ...matchStage.timestamp, $lte: endDate };

  const query = ActivityLog.find(matchStage)
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip(skip)
    .limit(effectiveLimit)
    .populate({
      path: 'targetId',
      select: 'title platform platformQuestionId difficulty pattern'
    })
    .lean();

  let logs = await query;
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

  const total = await ActivityLog.countDocuments(matchStage);
  const grouped = groupQuestionLogs(logs);
  return { grouped, total };
};

/**
 * Fetch completed and failed goals with pagination.
 */
const getGoalStatusArrays = async (userId, page = 1, limit = 20) => {
  const effectiveLimit = Math.min(limit, 100);
  const skip = (page - 1) * effectiveLimit;

  const [goals, total] = await Promise.all([
    Goal.find({ userId, status: { $in: ['completed', 'failed'] } })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(effectiveLimit)
      .lean(),
    Goal.countDocuments({ userId, status: { $in: ['completed', 'failed'] } })
  ]);

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

  const pages = Math.ceil(total / effectiveLimit);
  const hasNext = page < pages;
  const hasPrev = page > 1;

  return {
    completed,
    failed,
    pagination: {
      page,
      limit: effectiveLimit,
      total,
      pages,
      hasNext,
      hasPrev
    }
  };
};

// ----------------------------------------------------------------------
//  MAIN CONTROLLER
// ----------------------------------------------------------------------

const getActivityLogs = async (req, res, next) => {
  try {
    const { action, startDate, endDate, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
    const timeZone = req.userTimeZone;
    const dateFilter = {};
    if (startDate) dateFilter.start = getStartOfDay(new Date(startDate), timeZone);
    if (endDate) dateFilter.end = getEndOfDay(new Date(endDate), timeZone);

    // ----- SPECIFIC ACTION (full paginated view) -----
    if (action === 'question_solved' || action === 'question_mastered') {
      const { page, limit } = getPaginationParams(req);
      const { grouped, total } = await getGroupedQuestionLogs(
        req.user._id, action, dateFilter.start, dateFilter.end, page, limit, sortBy, sortOrder
      );
      const responseData = { [action]: grouped };
      const paginationMeta = paginate(total, page, limit);
      return res.json(formatResponse('Activity logs retrieved successfully', responseData, { pagination: paginationMeta }));
    }

    if (action === 'revision_completed') {
      const { page, limit } = getPaginationParams(req);
      const { type } = req.query; // 'on_time' or 'overdue'

      // If type is specified, fetch only that category and wrap it under that key
      if (type === 'on_time' || type === 'overdue') {
        const overdueFlag = (type === 'overdue');
        const matchStage = { userId: req.user._id };
        matchStage['completedRevisions.overdueCompleted'] = overdueFlag;
        if (dateFilter.start) matchStage['completedRevisions.completedAt'] = { $gte: dateFilter.start };
        if (dateFilter.end) matchStage['completedRevisions.completedAt'] = { ...matchStage['completedRevisions.completedAt'], $lte: dateFilter.end };

        const skip = (page - 1) * limit;
        const pipeline = [
          { $match: matchStage },
          { $unwind: '$completedRevisions' },
          { $match: { 'completedRevisions.status': 'completed' } },
          { $sort: { 'completedRevisions.completedAt': sortOrder === 'asc' ? 1 : -1 } },
          { $skip: skip },
          { $limit: limit },
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

        const totalPipeline = [
          { $match: matchStage },
          { $unwind: '$completedRevisions' },
          { $match: { 'completedRevisions.status': 'completed' } },
          { $count: 'total' }
        ];
        const totalResult = await RevisionSchedule.aggregate(totalPipeline);
        const total = totalResult.length ? totalResult[0].total : 0;

        const grouped = groupRevisionLogs(logs);
        // Wrap the grouped object under the requested type key
        const responseData = { revision_completed: { [type]: grouped } };
        const paginationMeta = paginate(total, page, limit);
        return res.json(formatResponse('Activity logs retrieved successfully', responseData, { pagination: paginationMeta }));
      }

      // Default (no type) – return both categories with ratio/message
      const { logs, total } = await getRevisionLogsFromSchedules(req.user._id, {
        startDate: dateFilter.start,
        endDate: dateFilter.end,
        page,
        limit,
        sortBy,
        sortOrder
      });
      const { on_time: onTimeRaw, overdue: overdueRaw, ratio, message } = processRevisionLogs(logs);
      const onTimeGrouped = groupRevisionLogs(onTimeRaw);
      const overdueGrouped = groupRevisionLogs(overdueRaw);
      const responseData = {
        revision_completed: {
          on_time: onTimeGrouped,
          overdue: overdueGrouped,
          ratio,
          message
        }
      };
      const paginationMeta = paginate(total, page, limit);
      return res.json(formatResponse('Activity logs retrieved successfully', responseData, { pagination: paginationMeta }));
    }

    if (action === 'goal_achieved') {
      const goalPage = parseInt(req.query.goalPage) || 1;
      const goalLimit = parseInt(req.query.goalLimit) || 20;
      const goalData = await getGoalStatusArrays(req.user._id, goalPage, goalLimit);
      const responseData = { goal_achieved: goalData };
      return res.json(formatResponse('Activity logs retrieved successfully', responseData, { pagination: goalData.pagination }));
    }

    // ----- COMBINED FEED (no action) – limited items per action, grouped consistently -----
    const limitPerAction = 5;

    // 1. question_solved
    const qSolvedQuery = { userId: req.user._id, action: 'question_solved' };
    if (dateFilter.start) qSolvedQuery.timestamp = { $gte: dateFilter.start };
    if (dateFilter.end) qSolvedQuery.timestamp = { ...qSolvedQuery.timestamp, $lte: dateFilter.end };
    let qSolvedLogs = await ActivityLog.find(qSolvedQuery)
      .sort({ timestamp: -1 })
      .limit(limitPerAction)
      .populate({ path: 'targetId', select: 'title platform platformQuestionId difficulty pattern' })
      .lean();
    qSolvedLogs = qSolvedLogs.filter(log => log.targetId && log.targetId._id);
    qSolvedLogs = qSolvedLogs.map(log => {
      if (log.targetId?.pattern && Array.isArray(log.targetId.pattern)) {
        log.targetId.patternSlugs = log.targetId.pattern.map(p => slugify(p));
      } else {
        log.targetId.pattern = [];
        log.targetId.patternSlugs = [];
      }
      return log;
    });
    const groupedSolved = groupQuestionLogs(qSolvedLogs);

    // 2. question_mastered
    const qMasteredQuery = { userId: req.user._id, action: 'question_mastered' };
    if (dateFilter.start) qMasteredQuery.timestamp = { $gte: dateFilter.start };
    if (dateFilter.end) qMasteredQuery.timestamp = { ...qMasteredQuery.timestamp, $lte: dateFilter.end };
    let qMasteredLogs = await ActivityLog.find(qMasteredQuery)
      .sort({ timestamp: -1 })
      .limit(limitPerAction)
      .populate({ path: 'targetId', select: 'title platform platformQuestionId difficulty pattern' })
      .lean();
    qMasteredLogs = qMasteredLogs.filter(log => log.targetId && log.targetId._id);
    qMasteredLogs = qMasteredLogs.map(log => {
      if (log.targetId?.pattern && Array.isArray(log.targetId.pattern)) {
        log.targetId.patternSlugs = log.targetId.pattern.map(p => slugify(p));
      } else {
        log.targetId.pattern = [];
        log.targetId.patternSlugs = [];
      }
      return log;
    });
    const groupedMastered = groupQuestionLogs(qMasteredLogs);

    // 3. revision_completed
    const { logs: revisionLogs } = await getRevisionLogsFromSchedules(req.user._id, {
      startDate: dateFilter.start,
      endDate: dateFilter.end,
      page: 1,
      limit: limitPerAction,
      sortBy,
      sortOrder
    });
    const { on_time: onTimeRaw, overdue: overdueRaw, ratio, message } = processRevisionLogs(revisionLogs);
    const onTimeGrouped = groupRevisionLogs(onTimeRaw);
    const overdueGrouped = groupRevisionLogs(overdueRaw);

    // 4. goal_achieved (latest 5 completed and 5 failed)
    const goalData = await getGoalStatusArrays(req.user._id, 1, limitPerAction);
    const goalAchieved = {
      completed: goalData.completed,
      failed: goalData.failed
    };

    // 5. group_goal_progress (latest 5, filter >50% or 100%)
    const groupGoalProgressQuery = { userId: req.user._id, action: 'group_goal_progress' };
    if (dateFilter.start) groupGoalProgressQuery.timestamp = { $gte: dateFilter.start };
    if (dateFilter.end) groupGoalProgressQuery.timestamp = { ...groupGoalProgressQuery.timestamp, $lte: dateFilter.end };
    let groupGoalProgressLogs = await ActivityLog.find(groupGoalProgressQuery)
      .sort({ timestamp: -1 })
      .limit(limitPerAction)
      .lean();
    groupGoalProgressLogs = groupGoalProgressLogs.filter(log => {
      const newProgress = log.metadata?.newProgress;
      const target = log.metadata?.target;
      if (newProgress === undefined || target === undefined) return false;
      const percentage = (newProgress / target) * 100;
      return percentage > 50 || percentage === 100;
    });

    // 6. group_goal_completed (latest 5)
    const groupGoalCompletedQuery = { userId: req.user._id, action: 'group_goal_completed' };
    if (dateFilter.start) groupGoalCompletedQuery.timestamp = { $gte: dateFilter.start };
    if (dateFilter.end) groupGoalCompletedQuery.timestamp = { ...groupGoalCompletedQuery.timestamp, $lte: dateFilter.end };
    const groupGoalCompletedLogs = await ActivityLog.find(groupGoalCompletedQuery)
      .sort({ timestamp: -1 })
      .limit(limitPerAction)
      .lean();

    // 7. group_challenge_progress (latest 5, filter >50% or 100%)
    const groupChallengeProgressQuery = { userId: req.user._id, action: 'group_challenge_progress' };
    if (dateFilter.start) groupChallengeProgressQuery.timestamp = { $gte: dateFilter.start };
    if (dateFilter.end) groupChallengeProgressQuery.timestamp = { ...groupChallengeProgressQuery.timestamp, $lte: dateFilter.end };
    let groupChallengeProgressLogs = await ActivityLog.find(groupChallengeProgressQuery)
      .sort({ timestamp: -1 })
      .limit(limitPerAction)
      .lean();
    groupChallengeProgressLogs = groupChallengeProgressLogs.filter(log => {
      const newProgress = log.metadata?.newProgress;
      if (newProgress === undefined) return false;
      return newProgress > 50 || newProgress === 100;
    });

    // 8. group_challenge_completed (latest 5)
    const groupChallengeCompletedQuery = { userId: req.user._id, action: 'group_challenge_completed' };
    if (dateFilter.start) groupChallengeCompletedQuery.timestamp = { $gte: dateFilter.start };
    if (dateFilter.end) groupChallengeCompletedQuery.timestamp = { ...groupChallengeCompletedQuery.timestamp, $lte: dateFilter.end };
    const groupChallengeCompletedLogs = await ActivityLog.find(groupChallengeCompletedQuery)
      .sort({ timestamp: -1 })
      .limit(limitPerAction)
      .lean();

    const combinedData = {
      question_solved: groupedSolved,
      question_mastered: groupedMastered,
      revision_completed: {
        on_time: onTimeGrouped,
        overdue: overdueGrouped,
        ratio,
        message
      },
      goal_achieved: goalAchieved,
      group_goal_progress: groupGoalProgressLogs,
      group_goal_completed: groupGoalCompletedLogs,
      group_challenge_progress: groupChallengeProgressLogs,
      group_challenge_completed: groupChallengeCompletedLogs
    };

    res.json(formatResponse('Recent activity retrieved successfully', combinedData, {
      limited: true,
      limitPerAction
    }));
  } catch (error) {
    next(error);
  }
};

// ----------------------------------------------------------------------
//  TODAY GROUPED FEED (unchanged)
// ----------------------------------------------------------------------

const getTodayGroupedFeed = async (req, res, next) => {
  try {
    const timeZone = req.userTimeZone || 'UTC';
    const todayStart = getStartOfDay(new Date(), timeZone);
    const todayEnd = getEndOfDay(new Date(), timeZone);

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const following = await Follow.find({ followerId: req.user._id, isActive: true }).distinct('followedId');
    if (following.length === 0) {
      return res.json(formatResponse('No activity from followed users', { users: {} }, {
        pagination: { page, limit, total: 0, pages: 0, hasNext: false, hasPrev: false },
        timezone: timeZone
      }));
    }

    const pipeline = [
      {
        $match: {
          userId: { $in: following },
          action: 'question_solved',
          timestamp: { $gte: todayStart, $lte: todayEnd }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDoc'
        }
      },
      { $unwind: '$userDoc' },
      {
        $lookup: {
          from: 'questions',
          localField: 'targetId',
          foreignField: '_id',
          as: 'questionDoc'
        }
      },
      { $unwind: { path: '$questionDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$userId',
          userInfo: {
            $first: {
              _id: '$userDoc._id',
              username: '$userDoc.username',
              displayName: '$userDoc.displayName',
              avatarUrl: '$userDoc.avatarUrl'
            }
          },
          solvedToday: {
            $push: {
              _id: '$_id',
              question: {
                _id: '$questionDoc._id',
                title: '$questionDoc.title',
                platform: '$questionDoc.platform',
                platformQuestionId: '$questionDoc.platformQuestionId',
                difficulty: '$questionDoc.difficulty',
                pattern: '$questionDoc.pattern'
              },
              solvedAt: '$timestamp',
              timeSpent: { $ifNull: ['$metadata.timeSpent', 0] }
            }
          },
          latestSolve: { $max: '$timestamp' }
        }
      },
      { $sort: { latestSolve: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalUsers' }],
          users: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ];

    const result = await ActivityLog.aggregate(pipeline);
    const totalUsers = result[0]?.metadata[0]?.totalUsers || 0;
    let usersArray = result[0]?.users || [];

    usersArray = usersArray.map(user => {
      if (user.solvedToday && Array.isArray(user.solvedToday)) {
        user.solvedToday = user.solvedToday.map(solve => {
          if (solve.question && solve.question.pattern && Array.isArray(solve.question.pattern)) {
            solve.question.patternSlugs = solve.question.pattern.map(p => slugify(p));
          } else {
            solve.question.pattern = [];
            solve.question.patternSlugs = [];
          }
          return solve;
        });
      }
      return user;
    });

    const usersObject = {};
    for (const user of usersArray) {
      usersObject[user._id.toString()] = {
        userInfo: user.userInfo,
        solvedToday: user.solvedToday
      };
    }

    const pages = Math.ceil(totalUsers / limit);
    const hasNext = page < pages;
    const hasPrev = page > 1;

    res.json(formatResponse('Today\'s solved questions from followed users retrieved', { users: usersObject }, {
      pagination: { page, limit, total: totalUsers, pages, hasNext, hasPrev },
      timezone: timeZone
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActivityLogs,
  getTodayGroupedFeed
};