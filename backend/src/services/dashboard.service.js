const { DateTime } = require('luxon');
const Goal = require('../models/Goal');
const RevisionSchedule = require('../models/RevisionSchedule');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const HeatmapData = require('../models/HeatmapData');
const Notification = require('../models/Notification');
const PatternMastery = require('../models/PatternMastery');
const Question = require('../models/Question');
const GoalSnapshotService = require('./goalSnapshot.service');
const leetcodeService = require('./leetcode.service');
const revisionService = require('./revision.service');
const { calculateIntensityLevel } = require('./heatmap.service');
const { getStartOfDay, getEndOfDay, getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth, formatDate } = require('../utils/helpers/date');
const { slugify } = require('../utils/helpers/string');
const { computeUserStats, computeUserStreak } = require('./userStats.service');

const computeConfidence = (solvedCount) => Math.min(5, 1 + Math.floor((solvedCount || 0) / 5));

// Helper to convert UTC to localised ISO string
const toLocalISOString = (utcDate, timeZone) => {
  if (!utcDate) return null;
  const dt = DateTime.fromJSDate(new Date(utcDate), { zone: 'UTC' });
  return dt.setZone(timeZone).toISO({ includeOffset: true });
};

const getUserStats = async (user) => {
  const userId = user._id;
  const timeZone = user.preferences?.timezone || 'UTC';
  const computedStats = await computeUserStats(userId, timeZone);
  const computedStreak = await computeUserStreak(userId, timeZone);
  return {
    totalSolved: computedStats.totalSolved,
    masteryRate: computedStats.masteryRate,
    currentStreak: computedStreak.currentStreak,
    longestStreak: computedStreak.longestStreak,
  };
};

const getCurrentGoals = async (userId, timeZone) => {
  const now = new Date();
  const todayStart = getStartOfDay(now, timeZone);
  const todayEnd = getEndOfDay(now, timeZone);
  const [dailyGoal, weeklyGoal] = await Promise.all([
    Goal.findOne({
      userId,
      goalType: 'daily',
      startDate: { $lte: todayEnd },
      endDate: { $gte: todayStart },
      status: 'active'
    }).lean(),
    Goal.findOne({
      userId,
      goalType: 'weekly',
      startDate: { $lte: todayEnd },
      endDate: { $gte: todayStart },
      status: 'active'
    }).lean()
  ]);
  return {
    daily: dailyGoal ? {
      target: dailyGoal.targetCount,
      completed: dailyGoal.completedCount,
      percent: dailyGoal.completionPercentage
    } : null,
    weekly: weeklyGoal ? {
      target: weeklyGoal.targetCount,
      completed: weeklyGoal.completedCount,
      percent: weeklyGoal.completionPercentage
    } : null
  };
};

const getGoalGraph = async (userId, timeZone) => {
  try {
    const chartData = await GoalSnapshotService.getChartData(userId, 'monthly', {
      months: 6,
      includeComparison: true,
      timeZone
    });
    return {
      labels: chartData.labels,
      datasets: [
        { label: 'Goals Completed', data: chartData.user.goalsCompleted },
        { label: 'Goal Related Solved', data: chartData.user.questionsSolvedGoalRelated }
      ],
      comparisonAvg: chartData.comparison?.avgGoalsCompleted || null
    };
  } catch (error) {
    console.error('Error fetching goal graph:', error);
    return { labels: [], datasets: [], comparisonAvg: null };
  }
};

const getRevisionsData = async (userId, timeZone) => {
  const todayStart = getStartOfDay(new Date(), timeZone);
  const todayEnd = getEndOfDay(new Date(), timeZone);
  const nextWeekEnd = getEndOfDay(new Date(todayStart.getTime() + 7 * 86400000));

  const pendingCountResult = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    { $project: { nextDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] } } },
    { $match: { nextDue: { $gte: todayStart, $lte: todayEnd } } },
    { $count: 'count' }
  ]);
  const pendingTodayCount = pendingCountResult[0]?.count || 0;

  const pendingList = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    { $addFields: { nextDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] } } },
    { $match: { nextDue: { $gte: todayStart, $lte: todayEnd } } },
    { $sort: { nextDue: 1 } },
    { $limit: 5 },
    { $lookup: { from: 'questions', localField: 'questionId', foreignField: '_id', as: 'question' } },
    { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
    { $match: { 'question._id': { $exists: true } } },
    {
      $lookup: {
        from: 'userquestionprogresses',
        let: { qId: '$question._id' },
        pipeline: [
          { $match: { $expr: { $and: [ { $eq: ['$userId', userId] }, { $eq: ['$questionId', '$$qId'] } ] } } },
          { $limit: 1 }
        ],
        as: 'progress'
      }
    },
    { $unwind: { path: '$progress', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: '$_id',
        questionId: '$question._id',
        platformQuestionId: '$question.platformQuestionId',
        title: '$question.title',
        platform: '$question.platform',
        difficulty: '$question.difficulty',
        scheduledDate: '$nextDue',
        overdue: { $lt: ['$nextDue', todayStart] },
        totalTimeSpent: { $ifNull: ['$progress.totalTimeSpent', 0] },
        revisionCount: { $ifNull: ['$progress.revisionCount', 0] },
        attemptsCount: { $ifNull: ['$progress.attempts.count', 0] },
        lastPracticed: {
          $ifNull: [
            '$progress.lastRevisedAt',
            { $ifNull: ['$progress.updatedAt', '$progress.attempts.lastAttemptAt'] }
          ]
        },
        status: { $ifNull: ['$progress.status', 'Not Started'] }
      }
    }
  ]);

  const convertedPendingList = pendingList.map(item => ({
    ...item,
    scheduledDate: toLocalISOString(item.scheduledDate, timeZone)
  }));

  const upcomingCountResult = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    { $project: { nextDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] } } },
    { $match: { nextDue: { $gt: todayEnd, $lte: nextWeekEnd } } },
    { $count: 'count' }
  ]);
  const upcomingCount = upcomingCountResult[0]?.count || 0;

  return { pendingTodayCount, pendingToday: convertedPendingList, upcomingCount };
};

const getRecentActivity = async (userId, timeZone) => {
  const solved = await UserQuestionProgress.find({
    userId,
    status: { $in: ['Solved', 'Mastered'] },
    'attempts.solvedAt': { $exists: true }
  })
    .sort({ 'attempts.solvedAt': -1 })
    .limit(10)
    .populate('questionId', '_id platformQuestionId title platform difficulty')
    .lean();

  const solvedItems = solved
    .filter(s => s.questionId !== null)
    .map(s => ({
      type: 'solved',
      questionId: s.questionId._id,
      platformQuestionId: s.questionId.platformQuestionId,
      title: s.questionId.title,
      platform: s.questionId.platform,
      difficulty: s.questionId.difficulty,
      timestamp: s.attempts.solvedAt,
      totalTimeSpent: s.totalTimeSpent || 0,
      revisionCount: s.revisionCount || 0,
      attemptsCount: s.attempts?.count || 0,
      lastPracticed: s.lastRevisedAt || s.updatedAt || s.attempts?.lastAttemptAt || null,
      status: s.status
    }));

  const revisions = await RevisionSchedule.aggregate([
    { $match: { userId } },
    { $unwind: '$completedRevisions' },
    { $match: { 'completedRevisions.status': 'completed' } },
    { $sort: { 'completedRevisions.completedAt': -1 } },
    { $limit: 10 },
    { $lookup: { from: 'questions', localField: 'questionId', foreignField: '_id', as: 'question' } },
    { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
    { $match: { 'question._id': { $exists: true } } },
    {
      $lookup: {
        from: 'userquestionprogresses',
        let: { qId: '$question._id' },
        pipeline: [
          { $match: { $expr: { $and: [ { $eq: ['$userId', userId] }, { $eq: ['$questionId', '$$qId'] } ] } } },
          { $limit: 1 }
        ],
        as: 'progress'
      }
    },
    { $unwind: { path: '$progress', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        questionId: '$question._id',
        platformQuestionId: '$question.platformQuestionId',
        title: '$question.title',
        platform: '$question.platform',
        difficulty: '$question.difficulty',
        timestamp: '$completedRevisions.completedAt',
        totalTimeSpent: { $ifNull: ['$progress.totalTimeSpent', 0] },
        revisionCount: { $ifNull: ['$progress.revisionCount', 0] },
        attemptsCount: { $ifNull: ['$progress.attempts.count', 0] },
        lastPracticed: {
          $ifNull: [
            '$progress.lastRevisedAt',
            { $ifNull: ['$progress.updatedAt', '$progress.attempts.lastAttemptAt'] }
          ]
        },
        status: { $ifNull: ['$progress.status', 'Not Started'] }
      }
    }
  ]);

  const revisionItems = revisions.map(r => ({
    type: 'revision',
    questionId: r.questionId,
    platformQuestionId: r.platformQuestionId,
    title: r.title,
    platform: r.platform,
    difficulty: r.difficulty,
    timestamp: r.timestamp,
    totalTimeSpent: r.totalTimeSpent,
    revisionCount: r.revisionCount,
    attemptsCount: r.attemptsCount,
    lastPracticed: r.lastPracticed,
    status: r.status
  }));

  const all = [...solvedItems, ...revisionItems];
  all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return all.slice(0, 10);
};

const getHeatmapSummary = async (userId) => {
  const year = new Date().getFullYear();
  const heatmap = await HeatmapData.findOne({ userId, year }).lean();
  if (!heatmap?.statsPanel) {
    return { yearlyProblems: 0, activeDaysPercentage: 0, consistencyScore: 0 };
  }
  const totalDaysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
  const activeDays = heatmap.dailyData?.filter(day => day.totalActivities > 0).length || 0;
  const consistencyScore = totalDaysInYear > 0 ? Math.round((activeDays / totalDaysInYear) * 1000) / 10 : 0;
  return {
    yearlyProblems: heatmap.statsPanel.yearlyProblems || 0,
    activeDaysPercentage: heatmap.statsPanel.activeDays?.percentage || 0,
    consistencyScore: consistencyScore
  };
};

const getDailyProblem = async (userId, refresh = false) => {
  try {
    const daily = await leetcodeService.getDailyProblem(refresh);
    if (!daily) return null;
    const todayUTC = new Date().toISOString().split('T')[0];
    const isActive = daily.date === todayUTC;
    const question = await Question.findOne({
      platform: 'LeetCode',
      platformQuestionId: daily.titleSlug,
      isActive: true
    }).lean();
    let progress = null;
    let questionId = null;
    if (question) {
      questionId = question._id;
      progress = await UserQuestionProgress.findOne({ userId, questionId }).lean();
    }
    return {
      title: daily.title,
      link: daily.link,
      difficulty: daily.difficulty,
      date: daily.date,
      isActive,
      platformQuestionId: daily.titleSlug,
      questionId,
      totalTimeSpent: progress?.totalTimeSpent || 0,
      revisionCount: progress?.revisionCount || 0,
      attemptsCount: progress?.attempts?.count || 0,
      lastPracticed: progress?.lastRevisedAt || progress?.updatedAt || progress?.attempts?.lastAttemptAt || null,
      status: progress?.status || 'Not Started'
    };
  } catch (error) {
    console.error('Error fetching daily problem:', error);
    return null;
  }
};

const getUnreadNotificationsCount = async (userId) => {
  return Notification.countDocuments({ userId, readAt: null });
};

const getRecentNotifications = async (userId) => {
  const notifications = await Notification.find({ userId, status: 'sent' })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  return notifications.map(n => ({
    id: n._id,
    type: n.type,
    title: n.title,
    message: n.message,
    createdAt: n.createdAt,
    read: !!n.readAt
  }));
};

const getRecentRevisions = async (userId, timeZone) => {
  const todayStart = getStartOfDay(new Date(), timeZone);
  const todayEnd = getEndOfDay(new Date(), timeZone);

  const pendingItems = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    { $addFields: { nextDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] } } },
    { $match: { nextDue: { $gte: todayStart, $lte: todayEnd } } },
    { $lookup: { from: 'questions', localField: 'questionId', foreignField: '_id', as: 'question' } },
    { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
    { $match: { 'question._id': { $exists: true } } },
    {
      $lookup: {
        from: 'userquestionprogresses',
        let: { qId: '$question._id' },
        pipeline: [
          { $match: { $expr: { $and: [ { $eq: ['$userId', userId] }, { $eq: ['$questionId', '$$qId'] } ] } } },
          { $limit: 1 }
        ],
        as: 'progress'
      }
    },
    { $unwind: { path: '$progress', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        questionId: '$question._id',
        platformQuestionId: '$question.platformQuestionId',
        title: '$question.title',
        platform: '$question.platform',
        difficulty: '$question.difficulty',
        date: '$nextDue',
        isPending: { $literal: true },
        totalTimeSpent: { $ifNull: ['$progress.totalTimeSpent', 0] },
        revisionCount: { $ifNull: ['$progress.revisionCount', 0] },
        attemptsCount: { $ifNull: ['$progress.attempts.count', 0] },
        lastPracticed: {
          $ifNull: [
            '$progress.lastRevisedAt',
            { $ifNull: ['$progress.updatedAt', '$progress.attempts.lastAttemptAt'] }
          ]
        },
        status: { $ifNull: ['$progress.status', 'Not Started'] }
      }
    }
  ]);

  const pendingQuestionIds = new Set(pendingItems.map(item => item.questionId.toString()));

  const completedRevisions = await RevisionSchedule.aggregate([
    { $match: { userId } },
    { $unwind: '$completedRevisions' },
    { $match: { 'completedRevisions.status': 'completed' } },
    { $sort: { 'completedRevisions.completedAt': -1 } },
    { $limit: 10 },
    { $lookup: { from: 'questions', localField: 'questionId', foreignField: '_id', as: 'question' } },
    { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
    { $match: { 'question._id': { $exists: true } } },
    {
      $lookup: {
        from: 'userquestionprogresses',
        let: { qId: '$question._id' },
        pipeline: [
          { $match: { $expr: { $and: [ { $eq: ['$userId', userId] }, { $eq: ['$questionId', '$$qId'] } ] } } },
          { $limit: 1 }
        ],
        as: 'progress'
      }
    },
    { $unwind: { path: '$progress', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        questionId: '$question._id',
        platformQuestionId: '$question.platformQuestionId',
        title: '$question.title',
        platform: '$question.platform',
        difficulty: '$question.difficulty',
        date: '$completedRevisions.completedAt',
        totalTimeSpent: { $ifNull: ['$progress.totalTimeSpent', 0] },
        revisionCount: { $ifNull: ['$progress.revisionCount', 0] },
        attemptsCount: { $ifNull: ['$progress.attempts.count', 0] },
        lastPracticed: {
          $ifNull: [
            '$progress.lastRevisedAt',
            { $ifNull: ['$progress.updatedAt', '$progress.attempts.lastAttemptAt'] }
          ]
        },
        status: { $ifNull: ['$progress.status', 'Not Started'] }
      }
    }
  ]);

  const result = [...pendingItems];
  const used = new Set(pendingQuestionIds);
  for (const rev of completedRevisions) {
    if (result.length >= 5) break;
    const idStr = rev.questionId.toString();
    if (!used.has(idStr)) {
      used.add(idStr);
      result.push({ ...rev, isPending: false });
    }
  }

  return result.slice(0, 5).map(item => ({
    ...item,
    date: toLocalISOString(item.date, timeZone)
  }));
};

const getRecentlySolved = async (userId) => {
  const solved = await UserQuestionProgress.find({
    userId,
    status: { $in: ['Solved', 'Mastered'] },
    'attempts.solvedAt': { $exists: true }
  })
    .sort({ 'attempts.solvedAt': -1 })
    .limit(5)
    .populate('questionId', '_id platformQuestionId title platform difficulty')
    .lean();

  return solved
    .filter(s => s.questionId !== null)
    .map(s => ({
      questionId: s.questionId._id,
      platformQuestionId: s.questionId.platformQuestionId,
      title: s.questionId.title,
      platform: s.questionId.platform,
      difficulty: s.questionId.difficulty,
      solvedAt: s.attempts.solvedAt,
      totalTimeSpent: s.totalTimeSpent || 0,
      revisionCount: s.revisionCount || 0,
      attemptsCount: s.attempts?.count || 0,
      lastPracticed: s.lastRevisedAt || s.updatedAt || s.attempts?.lastAttemptAt || null,
      status: s.status
    }));
};

const getWeeklyStudyTime = async (userId, timeZone) => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const heatmap = await HeatmapData.findOne({ userId, year }).select('dailyData').lean();
  if (!heatmap?.dailyData) return {
    currentWeekMinutes: 0,
    previousWeekMinutes: 0,
    weekOverWeekChangePercent: 0,
    monthlyAverageWeeklyMinutes: 0,
    changeFromMonthlyAveragePercent: 0
  };

  const weekStartCurrent = getStartOfWeek(now, timeZone);
  const todayEnd = getEndOfDay(now, timeZone);
  const weekStartPrevious = new Date(weekStartCurrent);
  weekStartPrevious.setDate(weekStartPrevious.getDate() - 7);
  const weekEndPrevious = new Date(weekStartCurrent);
  weekEndPrevious.setDate(weekEndPrevious.getDate() - 1);
  weekEndPrevious.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  let currentWeek = 0;
  let previousWeek = 0;
  let last30Days = 0;

  for (const day of heatmap.dailyData) {
    const dayDate = new Date(day.date);
    if (dayDate >= weekStartCurrent && dayDate <= todayEnd) {
      currentWeek += day.totalTimeSpent || 0;
    }
    if (dayDate >= weekStartPrevious && dayDate <= weekEndPrevious) {
      previousWeek += day.totalTimeSpent || 0;
    }
    if (dayDate >= thirtyDaysAgo && dayDate <= todayEnd) {
      last30Days += day.totalTimeSpent || 0;
    }
  }

  const monthlyAverageWeekly = last30Days / 4;
  let weekOverWeekChange = null;
  if (previousWeek > 0) {
    weekOverWeekChange = ((currentWeek - previousWeek) / previousWeek) * 100;
  } else if (currentWeek > 0 && previousWeek === 0) {
    weekOverWeekChange = 100;
  }
  let changeFromMonthlyAvg = null;
  if (monthlyAverageWeekly > 0) {
    changeFromMonthlyAvg = ((currentWeek - monthlyAverageWeekly) / monthlyAverageWeekly) * 100;
  } else if (currentWeek > 0 && monthlyAverageWeekly === 0) {
    changeFromMonthlyAvg = 100;
  }

  return {
    currentWeekMinutes: Math.round(currentWeek),
    previousWeekMinutes: Math.round(previousWeek),
    weekOverWeekChangePercent: weekOverWeekChange !== null ? Math.round(weekOverWeekChange) : null,
    monthlyAverageWeeklyMinutes: Math.round(monthlyAverageWeekly),
    changeFromMonthlyAveragePercent: changeFromMonthlyAvg !== null ? Math.round(changeFromMonthlyAvg) : null
  };
};

const getRevisionCompletionRate = async (userId, timeZone) => {
  const now = new Date();
  const todayStart = getStartOfDay(now, timeZone);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(todayStart);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const scheduledLast7 = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    { $project: { nextDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] } } },
    { $match: { nextDue: { $gte: sevenDaysAgo, $lt: todayStart } } },
    { $count: 'count' }
  ]);
  const scheduledPrev7 = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    { $project: { nextDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] } } },
    { $match: { nextDue: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
    { $count: 'count' }
  ]);

  const scheduledLast = scheduledLast7[0]?.count || 0;
  const scheduledPrev = scheduledPrev7[0]?.count || 0;

  const completedLast7 = await RevisionSchedule.aggregate([
    { $match: { userId } },
    { $unwind: '$completedRevisions' },
    { $match: { 'completedRevisions.completedAt': { $gte: sevenDaysAgo, $lt: todayStart }, 'completedRevisions.status': 'completed' } },
    { $count: 'count' }
  ]);
  const completedPrev7 = await RevisionSchedule.aggregate([
    { $match: { userId } },
    { $unwind: '$completedRevisions' },
    { $match: { 'completedRevisions.completedAt': { $gte: fourteenDaysAgo, $lt: sevenDaysAgo }, 'completedRevisions.status': 'completed' } },
    { $count: 'count' }
  ]);

  const lastCompleted = completedLast7[0]?.count || 0;
  const prevCompleted = completedPrev7[0]?.count || 0;

  const lastRate = scheduledLast ? (lastCompleted / scheduledLast) * 100 : 0;
  const prevRate = scheduledPrev ? (prevCompleted / scheduledPrev) * 100 : 0;
  let trend = 0;
  if (lastRate > prevRate) trend = 1;
  else if (lastRate < prevRate) trend = -1;

  return { percentage: Math.round(lastRate), trend, completed: lastCompleted, scheduled: scheduledLast };
};

const getUpcomingRevisionsList = async (userId, timeZone, limit = 5) => {
  const todayEnd = getEndOfDay(new Date(), timeZone);
  const nextWeekEnd = getEndOfDay(new Date(todayEnd.getTime() + 7 * 86400000));

  const upcoming = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    { $addFields: { nextDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] } } },
    { $match: { nextDue: { $gt: todayEnd, $lte: nextWeekEnd } } },
    { $sort: { nextDue: 1 } },
    { $limit: limit },
    { $lookup: { from: 'questions', localField: 'questionId', foreignField: '_id', as: 'question' } },
    { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
    { $match: { 'question._id': { $exists: true } } },
    {
      $lookup: {
        from: 'userquestionprogresses',
        let: { qId: '$question._id' },
        pipeline: [
          { $match: { $expr: { $and: [ { $eq: ['$userId', userId] }, { $eq: ['$questionId', '$$qId'] } ] } } },
          { $limit: 1 }
        ],
        as: 'progress'
      }
    },
    { $unwind: { path: '$progress', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: '$_id',
        questionId: '$question._id',
        platformQuestionId: '$question.platformQuestionId',
        title: '$question.title',
        platform: '$question.platform',
        difficulty: '$question.difficulty',
        scheduledDate: '$nextDue',
        totalTimeSpent: { $ifNull: ['$progress.totalTimeSpent', 0] },
        revisionCount: { $ifNull: ['$progress.revisionCount', 0] },
        attemptsCount: { $ifNull: ['$progress.attempts.count', 0] },
        lastPracticed: {
          $ifNull: [
            '$progress.lastRevisedAt',
            { $ifNull: ['$progress.updatedAt', '$progress.attempts.lastAttemptAt'] }
          ]
        },
        status: { $ifNull: ['$progress.status', 'Not Started'] }
      }
    }
  ]);

  return upcoming.map(item => ({
    ...item,
    scheduledDate: toLocalISOString(item.scheduledDate, timeZone)
  }));
};

const getActivePlannedGoals = async (userId, limit = 2) => {
  const goals = await Goal.find({ userId, goalType: 'planned', status: 'active' })
    .populate('targetQuestions', '_id platformQuestionId title')
    .sort({ endDate: 1 })
    .limit(limit)
    .lean();

  // Filter out goals that have null targetQuestions (e.g., deleted questions)
  const validGoals = goals.filter(goal => goal.targetQuestions && goal.targetQuestions.length > 0 && goal.targetQuestions.every(q => q !== null));

  const allQuestionIds = validGoals.flatMap(goal => goal.targetQuestions.map(q => q._id).filter(id => id));
  const progressMap = new Map();
  if (allQuestionIds.length) {
    const progresses = await UserQuestionProgress.find({
      userId,
      questionId: { $in: allQuestionIds }
    }).lean();
    for (const p of progresses) {
      progressMap.set(p.questionId.toString(), p);
    }
  }

  const formatDateRange = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    const startStr = startDate.toLocaleDateString(undefined, options);
    const endStr = endDate.toLocaleDateString(undefined, options);
    return `${startStr} – ${endStr}`;
  };

  return validGoals.map(goal => ({
    id: goal._id,
    title: formatDateRange(goal.startDate, goal.endDate),
    description: goal.targetQuestions.length === 1
      ? `Solve ${goal.targetQuestions[0]?.title || 'a problem'}`
      : `Solve ${goal.targetQuestions.length} problems`,
    deadline: goal.endDate,
    progress: {
      completed: goal.completedQuestions.length,
      total: goal.targetQuestions.length,
      percentage: Math.round((goal.completedQuestions.length / goal.targetQuestions.length) * 100)
    },
    questions: goal.targetQuestions.map(q => {
      if (!q) return null;
      const prog = progressMap.get(q._id.toString());
      return {
        id: q._id,
        platformQuestionId: q.platformQuestionId,
        title: q.title,
        totalTimeSpent: prog?.totalTimeSpent || 0,
        revisionCount: prog?.revisionCount || 0,
        attemptsCount: prog?.attempts?.count || 0,
        lastPracticed: prog?.lastRevisedAt || prog?.updatedAt || prog?.attempts?.lastAttemptAt || null,
        status: prog?.status || 'Not Started'
      };
    }).filter(q => q !== null)
  }));
};

const getTopWeakestPattern = async (userId) => {
  const patterns = await PatternMastery.find({ userId })
    .select('patternName confidenceLevel masteryRate solvedCount')
    .lean();
  if (!patterns.length) return null;
  patterns.forEach(p => p.confidenceLevel = computeConfidence(p.solvedCount));
  patterns.sort((a, b) => {
    if (a.confidenceLevel !== b.confidenceLevel) return a.confidenceLevel - b.confidenceLevel;
    return a.solvedCount - b.solvedCount;
  });
  const weakest = patterns[0];
  return {
    patternName: weakest.patternName,
    slug: slugify(weakest.patternName),
    confidenceLevel: weakest.confidenceLevel,
    masteryRate: Math.round(weakest.masteryRate),
    solvedCount: weakest.solvedCount
  };
};

const getCurrentMonthHeatmap = async (userId, timeZone) => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startOfMonth = getStartOfDay(new Date(Date.UTC(year, month, 1)), timeZone);
  const endOfMonth = getEndOfDay(new Date(Date.UTC(year, month + 1, 0)), timeZone);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const heatmap = await HeatmapData.findOne({ userId, year }).select('dailyData').lean();
  if (!heatmap?.dailyData) {
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const localDate = new Date(Date.UTC(year, month, d));
      const dateStr = localDate.toISOString().split('T')[0];
      result.push({ date: dateStr, activityCount: 0, intensityLevel: 0 });
    }
    return result;
  }

  const activityMap = new Map();
  for (let d = 1; d <= daysInMonth; d++) {
    const localDate = new Date(Date.UTC(year, month, d));
    const localDateStr = localDate.toISOString().split('T')[0];
    const dayStartUTC = getStartOfDay(localDate, timeZone);
    const dayEndUTC = getEndOfDay(localDate, timeZone);
    let total = 0;
    for (const day of heatmap.dailyData) {
      const dayDate = new Date(day.date);
      if (dayDate >= dayStartUTC && dayDate <= dayEndUTC) {
        total += day.totalActivities || 0;
      }
    }
    activityMap.set(localDateStr, total);
  }

  const result = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const localDate = new Date(Date.UTC(year, month, d));
    const localDateStr = localDate.toISOString().split('T')[0];
    const activityCount = activityMap.get(localDateStr) || 0;
    result.push({
      date: localDateStr,
      activityCount,
      intensityLevel: calculateIntensityLevel(activityCount)
    });
  }

  const todayLocal = DateTime.now().setZone(timeZone).toFormat('yyyy-MM-dd');
  for (const day of result) {
    if (day.date > todayLocal) {
      day.activityCount = 0;
      day.intensityLevel = 0;
    }
  }
  return result;
};

const getDailyTrend = async (userId, days = 30, timeZone = 'UTC') => {
  const now = new Date();
  const endDate = getEndOfDay(now, timeZone);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);
  const year = endDate.getUTCFullYear();
  let heatmap = await HeatmapData.findOne({ userId, year }).lean();
  if (!heatmap) {
    heatmap = await require('./heatmap.service').generateHeatmapData(userId, year, timeZone);
  }
  const filteredDays = heatmap.dailyData.filter(day => {
    const dayDate = new Date(day.date);
    return dayDate >= startDate && dayDate <= endDate;
  });
  filteredDays.sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = filteredDays.map(day => formatDate(day.date));
  const problemsSolved = filteredDays.map(day => day.newProblemsSolved || 0);
  const revisionsCompleted = filteredDays.map(day => day.revisionProblems || 0);
  const studyTimeMinutes = filteredDays.map(day => day.totalTimeSpent || 0);
  const goalCompletionRate = filteredDays.map(day => day.goalCompletion || 0);
  return { labels, problemsSolved, revisionsCompleted, studyTimeMinutes, goalCompletionRate };
};

const getMonthlyTrend = async (userId, months = 12, timeZone = 'UTC', includeComparison = true) => {
  const goalChartData = await GoalSnapshotService.getChartData(userId, 'monthly', {
    months,
    includeComparison,
    timeZone,
  });
  const labels = goalChartData.labels;
  const goalsCompleted = goalChartData.user.goalsCompleted;
  const comparison = goalChartData.comparison;
  const now = new Date();
  const endDate = getEndOfDay(now, timeZone);
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  const years = new Set();
  let current = new Date(startDate);
  while (current <= endDate) {
    years.add(current.getUTCFullYear());
    current.setMonth(current.getMonth() + 1);
  }
  const heatmaps = await Promise.all(
    Array.from(years).map(async (year) => {
      let heatmap = await HeatmapData.findOne({ userId, year }).lean();
      if (!heatmap) {
        heatmap = await require('./heatmap.service').generateHeatmapData(userId, year, timeZone);
      }
      return heatmap;
    })
  );
  const monthlyProblems = new Array(months).fill(0);
  for (let i = 0; i < labels.length; i++) {
    const labelDate = new Date(labels[i]);
    const targetMonthStart = getStartOfMonth(labelDate, timeZone);
    const targetMonthEnd = getEndOfMonth(labelDate, timeZone);
    let total = 0;
    for (const heatmap of heatmaps) {
      for (const day of heatmap.dailyData) {
        const dayDate = new Date(day.date);
        if (dayDate >= targetMonthStart && dayDate <= targetMonthEnd) {
          total += day.newProblemsSolved || 0;
        }
      }
    }
    monthlyProblems[i] = total;
  }
  const revisionCompletionRate = await revisionService.getMonthlyRevisionCompletionRate(userId, months, timeZone);
  return {
    labels,
    problemsSolved: monthlyProblems,
    goalsCompleted,
    revisionCompletionRate,
    comparison: includeComparison ? comparison : null,
  };
};

module.exports = {
  getUserStats,
  getCurrentGoals,
  getGoalGraph,
  getRevisionsData,
  getRecentActivity,
  getHeatmapSummary,
  getDailyProblem,
  getUnreadNotificationsCount,
  getRecentNotifications,
  getRecentRevisions,
  getRecentlySolved,
  getWeeklyStudyTime,
  getRevisionCompletionRate,
  getUpcomingRevisionsList,
  getActivePlannedGoals,
  getTopWeakestPattern,
  getCurrentMonthHeatmap,
  getDailyTrend,
  getMonthlyTrend,
};