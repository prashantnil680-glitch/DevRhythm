const ActivityLog = require('../models/ActivityLog');
const RevisionSchedule = require('../models/RevisionSchedule');
const Follow = require('../models/Follow');
const Goal = require('../models/Goal');
const { formatResponse } = require('../utils/helpers/response');
const { getPaginationParams, paginate } = require('../utils/helpers/pagination');
const { getStartOfDay, getEndOfDay } = require('../utils/helpers/date');
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

/**
 * Helper to split revision logs into on_time / overdue and compute ratio.
 * @param {Array} logs - Array of revision log objects (each must have a `metadata.overdueCompleted` flag).
 * @returns {Object} - { on_time, overdue, ratio, message }
 */
const processRevisionLogs = (logs) => {
  const onTime = logs.filter(log => !log.metadata?.overdueCompleted);
  const overdue = logs.filter(log => log.metadata?.overdueCompleted === true);
  const total = logs.length;
  const onTimeCount = onTime.length;
  const overdueCount = overdue.length;

  let message = null;
  if (overdueCount > onTimeCount && total > 0) {
    message = 'Most users complete revisions on time to stay consistent with their learning flow.';
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
 * Fetch revision logs directly from RevisionSchedule (for 'revision_completed' action).
 * Supports pagination, date filtering, and sorting.
 */
const getRevisionLogsFromSchedules = async (userId, { startDate, endDate, page, limit, skip, sortBy, sortOrder }) => {
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
          difficulty: '$targetId.difficulty'
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

  const logs = await RevisionSchedule.aggregate(pipeline);
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
 * Fetch completed and failed goals for the user with pagination.
 * @param {string} userId - User ID
 * @param {number} page - Page number (default 1)
 * @param {number} limit - Items per page (default 20, max 100)
 * @returns {Promise<{completed: Array, failed: Array, pagination: Object}>}
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

/**
 * Get activity logs for the authenticated user, grouped by action.
 * For 'revision_completed', fetches data from RevisionSchedule.
 * All other actions come from ActivityLog.
 * For 'goal_achieved', we fetch from Goal model (completed & failed) with its own pagination.
 * For 'group_goal_progress' and 'group_challenge_progress', we filter to keep only logs where progress > 50% or ==100%.
 */
const getActivityLogs = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { action, startDate, endDate, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;

    // Separate pagination for goals (default 1, 20)
    const goalPage = parseInt(req.query.goalPage) || 1;
    const goalLimit = parseInt(req.query.goalLimit) || 20;

    const timeZone = req.userTimeZone;

    const dateFilter = {};
    if (startDate) dateFilter.start = getStartOfDay(new Date(startDate), timeZone);
    if (endDate) dateFilter.end = getEndOfDay(new Date(endDate), timeZone);

    // Initialize grouped result with all action keys as empty arrays
    const grouped = Object.fromEntries(ALL_ACTIONS.map(k => [k, []]));

    // Handle revision_completed separately
    if (!action || action === 'revision_completed') {
      const { logs, total } = await getRevisionLogsFromSchedules(req.user._id, {
        startDate: dateFilter.start,
        endDate: dateFilter.end,
        page,
        limit,
        skip,
        sortBy,
        sortOrder
      });
      grouped.revision_completed = logs;
      if (action === 'revision_completed') {
        const pagination = paginate(total, page, limit);
        const processed = processRevisionLogs(logs);
        return res.json(formatResponse('Activity logs retrieved successfully', { revision_completed: processed }, { pagination }));
      }
    }

    // Handle goal_achieved: fetch from Goal model with its own pagination
    if (!action || action === 'goal_achieved') {
      const goalData = await getGoalStatusArrays(req.user._id, goalPage, goalLimit);
      grouped.goal_achieved = goalData; // includes completed, failed, and pagination
    }

    // Build query for ActivityLog (exclude revision_completed and goal_achieved if not specifically requested)
    const query = { userId: req.user._id };
    if (action) {
      if (action !== 'revision_completed' && action !== 'goal_achieved') {
        query.action = action;
      } else {
        query.action = { $nin: ['revision_completed', 'goal_achieved'] };
      }
    } else {
      query.action = { $nin: ['revision_completed', 'goal_achieved'] };
    }

    if (dateFilter.start) query.timestamp = { $gte: dateFilter.start };
    if (dateFilter.end) query.timestamp = { ...query.timestamp, $lte: dateFilter.end };

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'targetId',
          select: 'title platform platformQuestionId difficulty'
        })
        .lean(),
      ActivityLog.countDocuments(query)
    ]);

    // Group logs by action
    for (const log of logs) {
      const actionType = log.action;
      if (grouped.hasOwnProperty(actionType)) {
        grouped[actionType].push(log);
      } else {
        grouped[actionType] = [log];
      }
    }

    // Process revision_completed grouping if it exists (when no specific action filter)
    if (grouped.revision_completed && Array.isArray(grouped.revision_completed)) {
      grouped.revision_completed = processRevisionLogs(grouped.revision_completed);
    }

    // Filter group_goal_progress: keep only where progress > 50% or ==100%
    if (grouped.group_goal_progress && Array.isArray(grouped.group_goal_progress)) {
      grouped.group_goal_progress = grouped.group_goal_progress.filter(log => {
        const newProgress = log.metadata?.newProgress;
        const target = log.metadata?.target;
        if (newProgress === undefined || target === undefined) return false;
        const percentage = (newProgress / target) * 100;
        return percentage > 50 || percentage === 100;
      });
    }

    // Filter group_challenge_progress: keep only where progress > 50% or ==100% (newProgress is already percentage)
    if (grouped.group_challenge_progress && Array.isArray(grouped.group_challenge_progress)) {
      grouped.group_challenge_progress = grouped.group_challenge_progress.filter(log => {
        const newProgress = log.metadata?.newProgress;
        if (newProgress === undefined) return false;
        return newProgress > 50 || newProgress === 100;
      });
    }

    res.json(formatResponse('Activity logs retrieved successfully', grouped, { pagination: paginate(total, page, limit) }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's solved questions from followed users, grouped by user, with pagination.
 * Returns an object keyed by user ID, each containing user info and an array of solved questions.
 * Pagination metadata follows the existing format (page, limit, total, pages, hasNext, hasPrev).
 */
const getTodayGroupedFeed = async (req, res, next) => {
  try {
    const timeZone = req.userTimeZone || 'UTC';
    const todayStart = getStartOfDay(new Date(), timeZone);
    const todayEnd = getEndOfDay(new Date(), timeZone);

    // Pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // cap at 100
    const skip = (page - 1) * limit;

    // 1. Get list of users the authenticated user follows
    const following = await Follow.find({ followerId: req.user._id, isActive: true }).distinct('followedId');
    if (following.length === 0) {
      return res.json(formatResponse('No activity from followed users', { users: {} }, {
        pagination: { page, limit, total: 0, pages: 0, hasNext: false, hasPrev: false },
        timezone: timeZone
      }));
    }

    // 2. Aggregation pipeline: group logs per user, paginate, and collect solved questions
    const pipeline = [
      {
        $match: {
          userId: { $in: following },
          action: 'question_solved',
          timestamp: { $gte: todayStart, $lte: todayEnd }
        }
      },
      // Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDoc'
        }
      },
      { $unwind: '$userDoc' },
      // Lookup question details (minimal fields)
      {
        $lookup: {
          from: 'questions',
          localField: 'targetId',
          foreignField: '_id',
          as: 'questionDoc'
        }
      },
      { $unwind: { path: '$questionDoc', preserveNullAndEmptyArrays: true } },
      // Group by user
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
                difficulty: '$questionDoc.difficulty'
              },
              solvedAt: '$timestamp',
              timeSpent: { $ifNull: ['$metadata.timeSpent', 0] }
            }
          },
          latestSolve: { $max: '$timestamp' }
        }
      },
      // Sort users by most recent solve (descending)
      { $sort: { latestSolve: -1 } },
      // Pagination using $facet
      {
        $facet: {
          metadata: [{ $count: 'totalUsers' }],
          users: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ];

    const result = await ActivityLog.aggregate(pipeline);
    const totalUsers = result[0]?.metadata[0]?.totalUsers || 0;
    const usersArray = result[0]?.users || [];

    // Convert array back to object keyed by user ID (matches required structure)
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