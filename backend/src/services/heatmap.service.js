const HeatmapData = require('../models/HeatmapData');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const RevisionSchedule = require('../models/RevisionSchedule');
const Goal = require('../models/Goal');
const StudyGroup = require('../models/StudyGroup');
const Question = require('../models/Question');
const User = require('../models/User');
const { client: redisClient } = require('../config/redis');
const {
  getStartOfDay,
  getEndOfDay,
  formatDate,
  isSameDay,
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
} = require('../utils/helpers/date');
const { DateTime } = require('luxon');
const { invalidateDashboardCache } = require('../middleware/cache');

const calculateIntensityLevel = (activityCount) => {
  if (activityCount === 0) return 0;
  if (activityCount <= 2) return 1;
  if (activityCount <= 4) return 2;
  if (activityCount <= 9) return 3;
  return 4;
};

const generateDailyData = (year, timeZone = 'UTC') => {
  const dailyData = [];
  const startDate = getStartOfDay(new Date(Date.UTC(year, 0, 1)), timeZone);
  const endDate = getEndOfDay(new Date(Date.UTC(year, 11, 31)), timeZone);
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dailyData.push({
      date: new Date(currentDate),
      dayOfWeek: currentDate.getUTCDay(),
      totalActivities: 0,
      newProblemsSolved: 0,
      revisionProblems: 0,
      totalSubmissions: 0,
      totalTimeSpent: 0,
      difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
      platformBreakdown: { leetcode: 0, hackerrank: 0, codeforces: 0, other: 0 },
      studyGroupActivity: 0,
      dailyGoalAchieved: false,
      goalTarget: 0,
      goalCompletion: 0,
      intensityLevel: 0,
      streakCount: 0,
      testCaseExecutions: 0,
      passedCount: 0,
      failedCount: 0,
      timeSpentEvents: 0,
    });
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  return dailyData;
};

const calculateStreak = (dailyData) => {
  const today = getStartOfDay(new Date());
  let todayIndex = -1;
  for (let i = 0; i < dailyData.length; i++) {
    if (isSameDay(dailyData[i].date, today)) {
      todayIndex = i;
      break;
    }
  }

  let currentStreak = 0;
  if (todayIndex !== -1 && dailyData[todayIndex].totalActivities > 0) {
    currentStreak = 1;
    for (let i = todayIndex - 1; i >= 0; i--) {
      if (dailyData[i].totalActivities > 0) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let longestStreak = 0;
  let tempStreak = 0;
  for (let i = 0; i < dailyData.length; i++) {
    if (dailyData[i].totalActivities > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  return { currentStreak, longestStreak };
};

const aggregateQuestionData = async (userId, startDate, endDate, timeZone = 'UTC') => {
  const progressData = await UserQuestionProgress.aggregate([
    { $match: { userId, updatedAt: { $gte: startDate, $lte: endDate }, status: { $in: ['Solved', 'Mastered'] } } },
    { $lookup: { from: 'questions', localField: 'questionId', foreignField: '_id', as: 'question' } },
    { $unwind: '$question' },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
          difficulty: '$question.difficulty',
          platform: '$question.platform',
        },
        count: { $sum: 1 },
        totalTime: { $sum: '$totalTimeSpent' },
      },
    },
  ]);
  const result = {};
  progressData.forEach((item) => {
    const dateStr = item._id.date;
    if (!result[dateStr]) {
      result[dateStr] = {
        newProblemsSolved: 0,
        totalTimeSpent: 0,
        difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
        platformBreakdown: { leetcode: 0, hackerrank: 0, codeforces: 0, other: 0 },
      };
    }
    result[dateStr].newProblemsSolved += item.count;
    result[dateStr].totalTimeSpent += item.totalTime;
    const difficulty = item._id.difficulty?.toLowerCase();
    if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard')
      result[dateStr].difficultyBreakdown[difficulty] += item.count;
    const platform = item._id.platform?.toLowerCase();
    if (platform === 'leetcode') result[dateStr].platformBreakdown.leetcode += item.count;
    else if (platform === 'hackerrank') result[dateStr].platformBreakdown.hackerrank += item.count;
    else if (platform === 'codeforces') result[dateStr].platformBreakdown.codeforces += item.count;
    else result[dateStr].platformBreakdown.other += item.count;
  });
  return result;
};

const aggregateRevisionData = async (userId, startDate, endDate, timeZone = 'UTC') => {
  const revisionData = await RevisionSchedule.aggregate([
    { $match: { userId, 'completedRevisions.completedAt': { $gte: startDate, $lte: endDate } } },
    { $unwind: '$completedRevisions' },
    { $match: { 'completedRevisions.completedAt': { $gte: startDate, $lte: endDate } } },
    { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$completedRevisions.completedAt' } } }, count: { $sum: 1 } } },
  ]);
  const result = {};
  revisionData.forEach((item) => {
    result[item._id.date] = { revisionProblems: item.count };
  });
  return result;
};

const aggregateGoalData = async (userId, startDate, endDate, timeZone = 'UTC') => {
  const goalData = await Goal.aggregate([
    { $match: { userId, startDate: { $lte: endDate }, endDate: { $gte: startDate }, goalType: 'daily' } },
    {
      $project: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$startDate' } },
        targetCount: 1,
        completedCount: 1,
        status: 1,
      },
    },
  ]);
  const result = {};
  goalData.forEach((goal) => {
    result[goal.date] = {
      dailyGoalAchieved: goal.status === 'completed',
      goalTarget: goal.targetCount,
      goalCompletion: goal.targetCount > 0 ? Math.round((goal.completedCount / goal.targetCount) * 100) : 0,
    };
  });
  return result;
};

const aggregateStudyGroupData = async (userId, startDate, endDate, timeZone = 'UTC') => {
  const studyGroupData = await StudyGroup.aggregate([
    { $match: { 'members.userId': userId, lastActivityAt: { $gte: startDate, $lte: endDate } } },
    { $project: { date: { $dateToString: { format: '%Y-%m-%d', date: '$lastActivityAt' } }, hasActivity: 1 } },
    { $group: { _id: '$date', count: { $sum: 1 } } },
  ]);
  const result = {};
  studyGroupData.forEach((item) => {
    result[item._id] = { studyGroupActivity: item.count };
  });
  return result;
};

const generateCachedRenderData = (dailyData) => {
  const colorScale = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const tooltipData = dailyData.map((day) => ({
    date: day.date,
    summary: `${day.totalActivities} submission${day.totalActivities !== 1 ? 's' : ''} on ${formatDate(day.date)}`,
    details: `New: ${day.newProblemsSolved}, Revisions: ${day.revisionProblems}, Time: ${day.totalTimeSpent}min`,
  }));
  const today = getStartOfDay(new Date());
  const currentDayIndex = dailyData.findIndex((day) => isSameDay(day.date, today));
  return {
    colorScale,
    monthLabels,
    weekLabels,
    tooltipData,
    currentDayIndex: currentDayIndex >= 0 ? currentDayIndex : -1,
  };
};

const calculateFilterViews = (dailyData) => {
  const allActivity = dailyData.map((day) => day.totalActivities);
  const newProblemsOnly = dailyData.map((day) => day.newProblemsSolved);
  const revisionsOnly = dailyData.map((day) => day.revisionProblems);
  const studyGroupOnly = dailyData.map((day) => day.studyGroupActivity);
  const platformViews = {
    leetcode: dailyData.map((day) => day.platformBreakdown.leetcode || 0),
    hackerrank: dailyData.map((day) => day.platformBreakdown.hackerrank || 0),
    codeforces: dailyData.map((day) => day.platformBreakdown.codeforces || 0),
  };
  const difficultyViews = {
    easy: dailyData.map((day) => day.difficultyBreakdown.easy || 0),
    medium: dailyData.map((day) => day.difficultyBreakdown.medium || 0),
    hard: dailyData.map((day) => day.difficultyBreakdown.hard || 0),
  };
  return { allActivity, newProblemsOnly, revisionsOnly, studyGroupOnly, platformViews, difficultyViews };
};

const calculateStatsPanel = (dailyData, year, consistency) => {
  const totalDays = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
  const activeDays = dailyData.filter((day) => day.totalActivities > 0).length;
  const totalProblems = dailyData.reduce((sum, day) => sum + day.newProblemsSolved, 0);
  const goalDays = dailyData.filter((day) => day.goalTarget > 0).length;
  const achievedDays = dailyData.filter((day) => day.dailyGoalAchieved).length;
  return {
    currentStreak: consistency.currentStreak,
    longestStreak: consistency.longestStreak,
    yearlyProblems: totalProblems,
    activeDays: {
      count: activeDays,
      total: totalDays,
      percentage: Math.round((activeDays / totalDays) * 1000) / 10,
    },
    goalCompletion: {
      percentage: goalDays > 0 ? Math.round((achievedDays / goalDays) * 100) : 0,
      achievedDays,
      totalDays: goalDays,
    },
  };
};

const generateHeatmapData = async (userId, year, timeZone = 'UTC') => {
  try {
    const startDate = getStartOfDay(new Date(year, 0, 1), timeZone);
    const endDate = getEndOfDay(new Date(year, 11, 31), timeZone);
    const dailyData = generateDailyData(year, timeZone);
    const [questionData, revisionData, goalData, studyGroupData] = await Promise.all([
      aggregateQuestionData(userId, startDate, endDate, timeZone),
      aggregateRevisionData(userId, startDate, endDate, timeZone),
      aggregateGoalData(userId, startDate, endDate, timeZone),
      aggregateStudyGroupData(userId, startDate, endDate, timeZone),
    ]);
    dailyData.forEach((day) => {
      const dateStr = formatDate(day.date);
      if (questionData[dateStr]) {
        day.newProblemsSolved = questionData[dateStr].newProblemsSolved;
        day.totalTimeSpent = questionData[dateStr].totalTimeSpent;
        day.difficultyBreakdown = questionData[dateStr].difficultyBreakdown;
        day.platformBreakdown = questionData[dateStr].platformBreakdown;
      }
      if (revisionData[dateStr]) day.revisionProblems = revisionData[dateStr].revisionProblems;
      if (goalData[dateStr]) {
        day.dailyGoalAchieved = goalData[dateStr].dailyGoalAchieved;
        day.goalTarget = goalData[dateStr].goalTarget;
        day.goalCompletion = goalData[dateStr].goalCompletion;
      }
      if (studyGroupData[dateStr]) day.studyGroupActivity = studyGroupData[dateStr].studyGroupActivity;
      day.totalActivities = day.newProblemsSolved + day.revisionProblems + day.studyGroupActivity;
      day.totalSubmissions = day.newProblemsSolved + day.revisionProblems;
      day.intensityLevel = calculateIntensityLevel(day.totalActivities);
    });
    const { currentStreak, longestStreak } = calculateStreak(dailyData);
    const activeDaysCount = dailyData.filter((day) => day.totalActivities > 0).length;
    const totalYearlyActivities = dailyData.reduce((sum, day) => sum + day.totalActivities, 0);
    const totalProblemsSolved = dailyData.reduce((sum, day) => sum + day.newProblemsSolved, 0);
    const totalRevisionsCompleted = dailyData.reduce((sum, day) => sum + day.revisionProblems, 0);
    const totalTimeInvested = dailyData.reduce((sum, day) => sum + day.totalTimeSpent, 0);
    const averageDailyActivities = dailyData.length > 0 ? totalYearlyActivities / dailyData.length : 0;
    const consistencyScore = dailyData.length > 0 ? Math.round((activeDaysCount / dailyData.length) * 100) : 0;
    const breakDays = dailyData.length - activeDaysCount;
    let engagementLevel = 'low';
    if (consistencyScore >= 80) engagementLevel = 'very-high';
    else if (consistencyScore >= 60) engagementLevel = 'high';
    else if (consistencyScore >= 40) engagementLevel = 'medium';
    const monthlyDistribution = [];
    for (let month = 0; month < 12; month++) {
      const monthStart = getStartOfDay(new Date(year, month, 1), timeZone);
      const monthEnd = getEndOfDay(new Date(year, month + 1, 0), timeZone);
      const monthDays = dailyData.filter((day) => day.date >= monthStart && day.date <= monthEnd);
      monthlyDistribution.push({
        month: month + 1,
        activityCount: monthDays.reduce((sum, day) => sum + day.totalActivities, 0),
        problemsSolved: monthDays.reduce((sum, day) => sum + day.newProblemsSolved, 0),
      });
    }
    const cachedRenderData = generateCachedRenderData(dailyData);
    const filterViews = calculateFilterViews(dailyData);
    const statsPanel = calculateStatsPanel(dailyData, year, { currentStreak, longestStreak });
    const heatmapData = {
      userId,
      year,
      weekCount: 53,
      firstDate: startDate,
      lastDate: endDate,
      dailyData,
      performance: {
        totalYearlyActivities,
        totalProblemsSolved,
        totalRevisionsCompleted,
        totalTimeInvested,
        averageDailyActivities: parseFloat(averageDailyActivities.toFixed(1)),
        monthlyDistribution,
      },
      consistency: {
        activeDaysCount,
        consistencyScore,
        currentStreak,
        longestStreak,
        breakDays,
        engagementLevel,
      },
      lastUpdated: new Date(),
      updateFrequency: 1,
      syncStatus: 'synced',
      cachedRenderData,
      filterViews,
      statsPanel,
    };
    const heatmap = await HeatmapData.findOneAndUpdate({ userId, year }, heatmapData, { upsert: true, new: true });
    const cacheKey = `heatmap:${userId}:${year}:true`;
    await redisClient.setEx(cacheKey, 15 * 60, JSON.stringify(heatmap.toObject()));
    return heatmap.toObject();
  } catch (error) {
    console.error('Error generating heatmap data:', error);
    throw error;
  }
};

const regenerateHeatmapData = async (userId, year, forceFullRefresh = false, timeZone = 'UTC') => {
  try {
    await HeatmapData.deleteOne({ userId, year });
    const heatmap = await generateHeatmapData(userId, year, timeZone);
    await invalidateDashboardCache(userId);
    return heatmap;
  } catch (error) {
    console.error('Error regenerating heatmap data:', error);
    throw error;
  }
};

const calculateFilteredData = async (userId, year, viewType, timeZone = 'UTC') => {
  const heatmap = await HeatmapData.findOne({ userId, year }).lean();
  if (!heatmap) return [];
  const filteredData = heatmap.dailyData.map((day) => {
    let activityCount = 0;
    switch (viewType) {
      case 'new_problems':
        activityCount = day.newProblemsSolved;
        break;
      case 'revisions':
        activityCount = day.revisionProblems;
        break;
      case 'study_group':
        activityCount = day.studyGroupActivity;
        break;
      case 'leetcode':
        activityCount = day.platformBreakdown.leetcode || 0;
        break;
      case 'hackerrank':
        activityCount = day.platformBreakdown.hackerrank || 0;
        break;
      case 'codeforces':
        activityCount = day.platformBreakdown.codeforces || 0;
        break;
      case 'easy':
        activityCount = day.difficultyBreakdown.easy || 0;
        break;
      case 'medium':
        activityCount = day.difficultyBreakdown.medium || 0;
        break;
      case 'hard':
        activityCount = day.difficultyBreakdown.hard || 0;
        break;
      default:
        activityCount = day.totalActivities;
    }
    return { ...day, totalActivities: activityCount, intensityLevel: calculateIntensityLevel(activityCount) };
  });
  return filteredData;
};

const convertToCSV = (heatmap, includeDetails) => {
  const headers = ['Date', 'Day', 'Total Activities', 'New Problems', 'Revisions', 'Study Group', 'Time Spent (min)'];
  if (includeDetails) {
    headers.push('Easy', 'Medium', 'Hard', 'LeetCode', 'HackerRank', 'CodeForces', 'Goal Achieved', 'Goal %');
  }
  const rows = [headers.join(',')];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  heatmap.dailyData.forEach((day) => {
    const dateStr = formatDate(day.date);
    const dayName = dayNames[day.dayOfWeek];
    const row = [
      `"${dateStr}"`,
      `"${dayName}"`,
      day.totalActivities,
      day.newProblemsSolved,
      day.revisionProblems,
      day.studyGroupActivity,
      day.totalTimeSpent,
    ];
    if (includeDetails) {
      row.push(
        day.difficultyBreakdown.easy || 0,
        day.difficultyBreakdown.medium || 0,
        day.difficultyBreakdown.hard || 0,
        day.platformBreakdown.leetcode || 0,
        day.platformBreakdown.hackerrank || 0,
        day.platformBreakdown.codeforces || 0,
        day.dailyGoalAchieved ? 'Yes' : 'No',
        day.goalCompletion || 0
      );
    }
    rows.push(row.join(','));
  });
  return rows.join('\n');
};

const warmHeatmapCache = async (userId, timeZone = 'UTC') => {
  try {
    const year = new Date().getFullYear();
    const cacheKey = `heatmap:${userId}:${year}:true`;
    const cached = await redisClient.get(cacheKey);
    if (!cached) {
      const heatmap = await HeatmapData.findOne({ userId, year }).lean();
      if (heatmap) await redisClient.setEx(cacheKey, 24 * 60 * 60, JSON.stringify(heatmap));
    }
    const filterTypes = ['all', 'new_problems', 'revisions'];
    for (const filterType of filterTypes) {
      const filterKey = `heatmap:filter:${userId}:${year}:${filterType}:1:53`;
      const filterCached = await redisClient.get(filterKey);
      if (!filterCached && heatmap) {
        const filteredData = await calculateFilteredData(userId, year, filterType, timeZone);
        await redisClient.setEx(filterKey, 30 * 60, JSON.stringify(filteredData));
      }
    }
  } catch (error) {
    console.error('Error warming heatmap cache:', error);
  }
};

const getOrCreateHeatmap = async (userId, year, timeZone = 'UTC') => {
  let heatmap = await HeatmapData.findOne({ userId, year }).lean();
  if (!heatmap) heatmap = await generateHeatmapData(userId, year, timeZone);
  return heatmap;
};

const extractMinimalHeatmap = (heatmap) => {
  const dates = heatmap.dailyData.map((day) => day.date.toISOString().split('T')[0]);
  const intensities = heatmap.dailyData.map((day) => day.intensityLevel);
  return { year: heatmap.year, dates, intensities };
};

const getDailyRedisKey = (userId, dateStr) => `heatmap:daily:${userId}:${dateStr}`;

const incrementDailyActivity = async ({ userId, date, timeZone, increments }) => {
  if (!redisClient) return;
  const dateStr = DateTime.fromJSDate(date, { zone: timeZone }).toFormat('yyyy-MM-dd');
  const key = getDailyRedisKey(userId, dateStr);
  const multi = redisClient.multi();
  for (const [field, delta] of Object.entries(increments)) {
    if (delta && delta !== 0) {
      multi.hIncrBy(key, field, delta);
    }
  }
  multi.expire(key, 7 * 86400);
  await multi.exec();
};

const recalculateConsistency = async (userId, year) => {
  const heatmap = await HeatmapData.findOne({ userId, year }).lean();
  if (!heatmap) return;

  const { dailyData } = heatmap;
  const { currentStreak, longestStreak } = calculateStreak(dailyData);
  const activeDaysCount = dailyData.filter((day) => day.totalActivities > 0).length;
  const totalYearlyActivities = dailyData.reduce((sum, day) => sum + day.totalActivities, 0);
  const totalProblemsSolved = dailyData.reduce((sum, day) => sum + day.newProblemsSolved, 0);
  const totalRevisionsCompleted = dailyData.reduce((sum, day) => sum + day.revisionProblems, 0);
  const totalTimeInvested = dailyData.reduce((sum, day) => sum + day.totalTimeSpent, 0);
  const averageDailyActivities = dailyData.length > 0 ? totalYearlyActivities / dailyData.length : 0;
  const consistencyScore = dailyData.length > 0 ? Math.round((activeDaysCount / dailyData.length) * 100) : 0;
  const breakDays = dailyData.length - activeDaysCount;
  let engagementLevel = 'low';
  if (consistencyScore >= 80) engagementLevel = 'very-high';
  else if (consistencyScore >= 60) engagementLevel = 'high';
  else if (consistencyScore >= 40) engagementLevel = 'medium';

  const updateFields = {
    'consistency.activeDaysCount': activeDaysCount,
    'consistency.consistencyScore': consistencyScore,
    'consistency.currentStreak': currentStreak,
    'consistency.longestStreak': longestStreak,
    'consistency.breakDays': breakDays,
    'consistency.engagementLevel': engagementLevel,
    'performance.totalYearlyActivities': totalYearlyActivities,
    'performance.totalProblemsSolved': totalProblemsSolved,
    'performance.totalRevisionsCompleted': totalRevisionsCompleted,
    'performance.totalTimeInvested': totalTimeInvested,
    'performance.averageDailyActivities': parseFloat(averageDailyActivities.toFixed(1)),
    'lastUpdated': new Date(),
  };

  const statsPanel = calculateStatsPanel(dailyData, year, { currentStreak, longestStreak });
  updateFields.statsPanel = statsPanel;

  await HeatmapData.updateOne({ userId, year }, { $set: updateFields });

  const activeDays = dailyData.filter(day => day.totalActivities > 0).sort((a,b) => b.date - a.date);
  if (activeDays.length > 0) {
    const lastActiveDate = activeDays[0].date;
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          'streak.current': currentStreak,
          'streak.longest': longestStreak,
          'streak.lastActiveDate': lastActiveDate,
        },
      }
    );
    const { invalidateCache } = require('../middleware/cache');
    await invalidateCache(`user:${userId}:profile`);
  }
};

const ensureDayExists = async (userId, year, localDate, timeZone) => {
  const dayStartUTC = getStartOfDay(localDate, timeZone);
  const dayEndUTC = getEndOfDay(localDate, timeZone);
  let heatmap = await HeatmapData.findOne({ userId, year });
  if (!heatmap) {
    heatmap = await generateHeatmapData(userId, year, timeZone);
  }
  const dayExists = heatmap.dailyData.some((d) => d.date >= dayStartUTC && d.date <= dayEndUTC);
  if (!dayExists) {
    const newDay = {
      date: dayStartUTC,
      dayOfWeek: dayStartUTC.getUTCDay(),
      totalActivities: 0,
      newProblemsSolved: 0,
      revisionProblems: 0,
      totalSubmissions: 0,
      totalTimeSpent: 0,
      difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
      platformBreakdown: { leetcode: 0, hackerrank: 0, codeforces: 0, other: 0 },
      studyGroupActivity: 0,
      dailyGoalAchieved: false,
      goalTarget: 0,
      goalCompletion: 0,
      intensityLevel: 0,
      streakCount: 0,
      testCaseExecutions: 0,
      passedCount: 0,
      failedCount: 0,
      timeSpentEvents: 0,
    };
    await HeatmapData.updateOne({ userId, year }, { $push: { dailyData: newDay } });
  }
};

const flushDailyActivitiesToMongoDB = async () => {
  if (!redisClient) return;

  const pattern = 'heatmap:daily:*';
  let cursor = 0;
  let processed = 0;
  const userCache = new Map();
  const usersToRecalc = new Set();

  do {
    const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = reply.cursor;
    const keys = reply.keys;

    if (keys.length === 0) continue;

    const keysByUser = new Map();
    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length !== 4) continue;
      const userId = parts[2];
      const dateStr = parts[3];
      if (!userId || !dateStr) continue;
      if (!keysByUser.has(userId)) keysByUser.set(userId, []);
      keysByUser.get(userId).push({ key, dateStr });
    }

    const userIds = Array.from(keysByUser.keys());
    const users = await User.find({ _id: { $in: userIds } }).select('preferences.timezone').lean();
    for (const user of users) {
      userCache.set(user._id.toString(), user.preferences?.timezone || 'UTC');
    }

    for (const [userId, entries] of keysByUser.entries()) {
      const timeZone = userCache.get(userId) || 'UTC';
      let yearUpdated = null;
      for (const { key, dateStr } of entries) {
        const increments = await redisClient.hGetAll(key);
        if (Object.keys(increments).length === 0) {
          await redisClient.del(key);
          continue;
        }

        const numericIncrements = {};
        for (const [field, val] of Object.entries(increments)) {
          numericIncrements[field] = parseInt(val, 10) || 0;
        }

        const [year, month, day] = dateStr.split('-').map(Number);
        const utcMidnight = new Date(Date.UTC(year, month - 1, day));
        yearUpdated = year;

        const update = { $inc: {} };
        const fieldMapping = {
          totalActivities: 'dailyData.$.totalActivities',
          totalSubmissions: 'dailyData.$.totalSubmissions',
          totalTimeSpentMinutes: 'dailyData.$.totalTimeSpent',
          newProblemsSolved: 'dailyData.$.newProblemsSolved',
          revisionProblems: 'dailyData.$.revisionProblems',
          studyGroupActivity: 'dailyData.$.studyGroupActivity',
          testCaseExecutions: 'dailyData.$.testCaseExecutions',
          passedCount: 'dailyData.$.passedCount',
          failedCount: 'dailyData.$.failedCount',
          timeSpentEvents: 'dailyData.$.timeSpentEvents',
        };

        for (const [field, value] of Object.entries(numericIncrements)) {
          const mongoField = fieldMapping[field];
          if (mongoField) update.$inc[mongoField] = value;
        }

        if (Object.keys(update.$inc).length > 0) {
          const filter = { userId, year, 'dailyData.date': utcMidnight };
          const result = await HeatmapData.updateOne(filter, update);
          if (result.matchedCount === 0) {
            await ensureDayExists(userId, year, utcMidnight, timeZone);
            await HeatmapData.updateOne(filter, update);
          }
        }

        await redisClient.del(key);
        processed++;
      }
      if (yearUpdated !== null) {
        usersToRecalc.add(`${userId}:${yearUpdated}`);
      }
    }
  } while (cursor !== 0);

  for (const userKey of usersToRecalc) {
    const [userId, year] = userKey.split(':');
    await recalculateConsistency(userId, parseInt(year));
  }
};

/**
 * Retrieve a single day's aggregated activity for a user.
 * Ensures the heatmap exists for the given year, then returns the daily entry.
 *
 * @param {string} userId - User ObjectId
 * @param {Date|string} date - Target date (will be converted to start of day in user's timezone)
 * @param {string} timeZone - IANA timezone (e.g., 'Asia/Kolkata')
 * @returns {Promise<Object|null>} - Day data object or null if date is outside the year range
 */
const getDayData = async (userId, date, timeZone = 'UTC') => {
  const targetDate = getStartOfDay(new Date(date), timeZone);
  const year = targetDate.getUTCFullYear();

  // Ensure heatmap exists for the year
  let heatmap = await HeatmapData.findOne({ userId, year }).lean();
  if (!heatmap) {
    heatmap = await generateHeatmapData(userId, year, timeZone);
  }

  // Find the daily entry
  const dayEntry = heatmap.dailyData.find((day) => isSameDay(day.date, targetDate, timeZone));
  if (!dayEntry) {
    // Day is out of range for the year (e.g., Dec 31 2025 but year is 2024) – return null
    return null;
  }

  // Compute date string and day of week
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][targetDate.getUTCDay()];

  return {
    date: formatDate(targetDate),
    dayOfWeek,
    problemsSolved: dayEntry.newProblemsSolved,
    revisionsCompleted: dayEntry.revisionProblems,
    studyTimeMinutes: dayEntry.totalTimeSpent,
    goalAchieved: dayEntry.dailyGoalAchieved,
    goalTarget: dayEntry.goalTarget,
    goalCompletion: dayEntry.goalCompletion,
    submissions: dayEntry.totalSubmissions,
    testCaseExecutions: dayEntry.testCaseExecutions || 0,
    passedCount: dayEntry.passedCount || 0,
    failedCount: dayEntry.failedCount || 0,
    activityBreakdown: {
      easy: dayEntry.difficultyBreakdown.easy,
      medium: dayEntry.difficultyBreakdown.medium,
      hard: dayEntry.difficultyBreakdown.hard,
      leetcode: dayEntry.platformBreakdown.leetcode,
      hackerrank: dayEntry.platformBreakdown.hackerrank,
      codeforces: dayEntry.platformBreakdown.codeforces,
      other: dayEntry.platformBreakdown.other,
    },
  };
};

module.exports = {
  calculateIntensityLevel,
  generateHeatmapData,
  regenerateHeatmapData,
  calculateFilteredData,
  convertToCSV,
  warmHeatmapCache,
  getOrCreateHeatmap,
  extractMinimalHeatmap,
  incrementDailyActivity,
  flushDailyActivitiesToMongoDB,
  getDayData, // newly exported
};