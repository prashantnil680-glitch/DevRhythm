const mongoose = require('mongoose');
const User = require('../models/User');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const Question = require('../models/Question');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const { computeUserStats } = require('../services/userStats.service');
const { computeUserStreak } = require('../services/userStats.service'); // ADD THIS

/**
 * Get detailed statistics for the current user (including breakdowns)
 * Now recalculates totalSolved, masteryRate, and streak live.
 */
const getUserDetailedStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const timeZone = req.user.preferences?.timezone || 'UTC';

    // ========== LIVE COUNT OF UNIQUE SOLVED QUESTIONS ==========
    const solvedQuestionIds = await UserQuestionProgress.distinct('questionId', {
      userId,
      status: { $in: ['Solved', 'Mastered'] }
    });
    const totalSolvedLive = solvedQuestionIds.length;

    // Recalculate mastery rate based on total active questions
    const totalActiveQuestions = await Question.countDocuments({ isActive: true });
    let masteryRateLive = 0;
    if (totalActiveQuestions > 0) {
      masteryRateLive = (totalSolvedLive / totalActiveQuestions) * 100;
      masteryRateLive = Math.min(100, Math.round(masteryRateLive * 100) / 100);
    }
    // =============================================================

    // ========== LIVE STREAK (from heatmap) ==========
    const computedStreak = await computeUserStreak(userId, timeZone);
    // =================================================

    // Get other stats (revisions, time spent, etc.) – these can remain from computeUserStats
    const computed = await computeUserStats(userId, timeZone);

    // Override the values with live recomputed ones
    computed.totalSolved = totalSolvedLive;
    computed.masteryRate = masteryRateLive;

    const user = await User.findById(userId).select('preferences'); // we don't need stored streak anymore
    if (!user) throw new AppError('User not found', 404);

    // Build the final stats object – use live streak, but keep other fields from computed
    const detailedStats = {
      ...computed,
      streak: {
        current: computedStreak.currentStreak,
        longest: computedStreak.longestStreak,
        lastActiveDate: user.streak?.lastActiveDate || null // keep original date if needed
      },
      preferences: user.preferences
    };

    res.json(formatResponse('Detailed user statistics retrieved', { stats: detailedStats }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get public stats for another user (rich details, minimal fields)
 * (No change)
 */
const getPublicUserStats = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const timeZone = req.user?.preferences?.timezone || 'UTC';

    const user = await User.findById(userId)
      .select('-email -providerId -preferences -authProvider -__v')
      .lean();
    if (!user) throw new AppError('User not found', 404);
    if (user.privacy !== 'public') throw new AppError('User stats are private', 403);

    const computed = await computeUserStats(userId, timeZone);

    const publicStats = {
      totalSolved: computed.totalSolved,
      totalMastered: computed.totalMastered,
      totalTimeSpent: computed.totalTimeSpent,
      totalRevisions: computed.totalRevisions,
      activeDays: computed.activeDays,
      masteryRate: computed.masteryRate,
      streak: user.streak,
      difficultyBreakdown: computed.difficultyBreakdown,
      platformBreakdown: computed.platformBreakdown
    };

    if (publicStats.masteryRate) {
      publicStats.masteryRate = Math.round(publicStats.masteryRate * 100) / 100;
    }

    res.json(formatResponse('Public user stats retrieved', {
      stats: publicStats,
      userId: user._id
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserDetailedStats,
  getPublicUserStats
};