const mongoose = require('mongoose');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const RevisionSchedule = require('../models/RevisionSchedule');
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

module.exports = {
  computeUserStats
};