const mongoose = require('mongoose');
const User = require('../models/User');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const { computeUserStats } = require('../services/userStats.service');

/**
 * Get detailed statistics for the current user (including breakdowns)
 */
const getUserDetailedStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const timeZone = req.user.preferences?.timezone || 'UTC';

    const computed = await computeUserStats(userId, timeZone);

    const user = await User.findById(userId).select('streak preferences');
    if (!user) throw new AppError('User not found', 404);

    const detailedStats = {
      ...computed,
      streak: user.streak,
      preferences: user.preferences
    };

    res.json(formatResponse('Detailed user statistics retrieved', { stats: detailedStats }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get public stats for another user (rich details, minimal fields)
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