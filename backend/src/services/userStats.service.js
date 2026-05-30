const mongoose = require('mongoose');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const RevisionSchedule = require('../models/RevisionSchedule');
const HeatmapData = require('../models/HeatmapData');
const Question = require('../models/Question');
const { getStartOfDay } = require('../utils/helpers/date');
const { DateTime } = require('luxon');

/**
 * Compute user statistics directly from source collections.
 * Returns an object with:
 * - totalSolved: number of unique solved questions (status Solved or Mastered)
 * - totalMastered: number of mastered questions
 * - totalTimeSpent: sum of totalTimeSpent from UserQuestionProgress
 * - totalRevisions: count of completed revisions from RevisionSchedule
 * - activeDays: number of distinct days (in user's timezone) with any solved or revision activity
 * - difficultyBreakdown: { Easy, Medium, Hard } with solved/mastered counts
 * - platformBreakdown: counts per platform
 * - masteryRate: percentage of totalSolved out of total active questions
 *
 * @param {string} userId - User ObjectId (as string)
 * @param {string} timeZone - IANA timezone for active days calculation
 * @returns {Promise<Object>}
 */
const computeUserStats = async (userId, timeZone = 'UTC') => {
  const objectId = new mongoose.Types.ObjectId(userId);

  // 1. Get solved/mastered stats from UserQuestionProgress
  const progressPipeline = [
    { $match: { userId: objectId } },
    {
      $lookup: {
        from: 'questions',
        localField: 'questionId',
        foreignField: '_id',
        as: 'question'
      }
    },
    { $unwind: '$question' },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalSolved: { $sum: { $cond: [{ $in: ['$status', ['Solved', 'Mastered']] }, 1, 0] } },
              totalMastered: { $sum: { $cond: [{ $eq: ['$status', 'Mastered'] }, 1, 0] } },
              totalTimeSpent: { $sum: '$totalTimeSpent' }
            }
          }
        ],
        difficultyBreakdown: [
          {
            $match: { $or: [{ status: 'Solved' }, { status: 'Mastered' }] }
          },
          {
            $group: {
              _id: '$question.difficulty',
              solved: { $sum: 1 },
              mastered: { $sum: { $cond: [{ $eq: ['$status', 'Mastered'] }, 1, 0] } }
            }
          }
        ],
        platformBreakdown: [
          {
            $match: { $or: [{ status: 'Solved' }, { status: 'Mastered' }] }
          },
          {
            $group: {
              _id: '$question.platform',
              count: { $sum: 1 }
            }
          }
        ],
        solvedDates: [
          {
            $match: {
              $or: [
                { status: { $in: ['Solved', 'Mastered'] }, 'attempts.solvedAt': { $exists: true } },
                { 'attempts.solvedAt': { $exists: true } }
              ]
            }
          },
          {
            $project: {
              activityDate: {
                $cond: [
                  { $ifNull: ['$attempts.solvedAt', false] },
                  '$attempts.solvedAt',
                  '$updatedAt'
                ]
              }
            }
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$activityDate' } }
            }
          }
        ]
      }
    }
  ];

  const progressResults = await UserQuestionProgress.aggregate(progressPipeline);
  const data = progressResults[0] || {};

  const totals = data.totals?.[0] || { totalSolved: 0, totalMastered: 0, totalTimeSpent: 0 };

  // difficulty breakdown
  const difficultyBreakdown = {
    Easy: { solved: 0, mastered: 0 },
    Medium: { solved: 0, mastered: 0 },
    Hard: { solved: 0, mastered: 0 }
  };
  (data.difficultyBreakdown || []).forEach(item => {
    const diff = item._id;
    if (difficultyBreakdown[diff]) {
      difficultyBreakdown[diff].solved = item.solved;
      difficultyBreakdown[diff].mastered = item.mastered;
    }
  });

  const platformBreakdown = {};
  (data.platformBreakdown || []).forEach(item => {
    platformBreakdown[item._id] = item.count;
  });

  // 2. Get total revisions completed from RevisionSchedule
  const totalRevisionsResult = await RevisionSchedule.aggregate([
    { $match: { userId: objectId } },
    { $unwind: '$completedRevisions' },
    { $match: { 'completedRevisions.status': 'completed' } },
    { $count: 'total' }
  ]);
  const totalRevisions = totalRevisionsResult[0]?.total || 0;

  // 3. Get revision activity dates for active days
  const revisionActiveDates = await RevisionSchedule.aggregate([
    { $match: { userId: objectId } },
    { $unwind: '$completedRevisions' },
    {
      $match: {
        'completedRevisions.status': 'completed',
        'completedRevisions.completedAt': { $exists: true }
      }
    },
    {
      $project: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$completedRevisions.completedAt' } }
      }
    },
    { $group: { _id: '$date' } }
  ]);

  // Combine solved dates and revision dates
  const solvedDateSet = new Set((data.solvedDates || []).map(d => d._id));
  revisionActiveDates.forEach(d => solvedDateSet.add(d._id));

  // Convert to user's timezone and count distinct local days
  let activeDaysCount = 0;
  if (timeZone !== 'UTC') {
    const localDateSet = new Set();
    for (const utcDateStr of solvedDateSet) {
      const utcDate = new Date(utcDateStr + 'T00:00:00Z');
      const localDate = DateTime.fromJSDate(utcDate, { zone: timeZone }).toFormat('yyyy-MM-dd');
      localDateSet.add(localDate);
    }
    activeDaysCount = localDateSet.size;
  } else {
    activeDaysCount = solvedDateSet.size;
  }

  // 4. Compute mastery rate
  const totalQuestions = await Question.countDocuments({ isActive: true });
  let masteryRate = 0;
  if (totalQuestions > 0) {
    masteryRate = (totals.totalSolved / totalQuestions) * 100;
    masteryRate = Math.round(masteryRate * 100) / 100;
  }

  return {
    totalSolved: totals.totalSolved,
    totalMastered: totals.totalMastered,
    totalTimeSpent: totals.totalTimeSpent,
    totalRevisions,
    activeDays: activeDaysCount,
    difficultyBreakdown,
    platformBreakdown,
    masteryRate
  };
};

/**
 * Compute current and longest streak from heatmap data.
 * @param {string} userId - User ObjectId
 * @param {string} timeZone - IANA timezone (e.g., 'Asia/Kolkata')
 * @returns {Promise<{currentStreak: number, longestStreak: number}>}
 */
const computeUserStreak = async (userId, timeZone = 'UTC') => {
  const year = new Date().getUTCFullYear();
  let heatmap = await HeatmapData.findOne({ userId, year }).lean();
  if (!heatmap) {
    const heatmapService = require('./heatmap.service');
    heatmap = await heatmapService.generateHeatmapData(userId, year, timeZone);
  }
  if (!heatmap || !heatmap.dailyData) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Convert UTC dates to local date strings
  const localActivityMap = new Map();
  for (const day of heatmap.dailyData) {
    const utcDate = new Date(day.date);
    const localDate = DateTime.fromJSDate(utcDate, { zone: timeZone }).toFormat('yyyy-MM-dd');
    const activity = day.totalActivities || 0;
    localActivityMap.set(localDate, activity);
  }

  // Current streak
  let currentStreak = 0;
  const todayLocal = DateTime.now().setZone(timeZone).toFormat('yyyy-MM-dd');
  let currentDate = DateTime.fromISO(todayLocal, { zone: timeZone });
  while (true) {
    const dateStr = currentDate.toFormat('yyyy-MM-dd');
    const activity = localActivityMap.get(dateStr) || 0;
    if (activity > 0) {
      currentStreak++;
      currentDate = currentDate.minus({ days: 1 });
    } else {
      break;
    }
  }

  // Longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate = null;
  const activeDates = Array.from(localActivityMap.entries())
    .filter(([_, activity]) => activity > 0)
    .map(([date]) => date)
    .sort();
  for (const dateStr of activeDates) {
    if (prevDate) {
      const diff = DateTime.fromISO(dateStr).diff(DateTime.fromISO(prevDate), 'days').days;
      if (diff === 1) tempStreak++;
      else tempStreak = 1;
    } else {
      tempStreak = 1;
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    prevDate = dateStr;
  }

  return { currentStreak, longestStreak };
};

module.exports = {
  computeUserStats,
  computeUserStreak
};