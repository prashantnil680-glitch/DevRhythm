const heatmapService = require('../services/heatmap.service');
const progressService = require('../services/progress.service');
const revisionActivityService = require('../services/revisionActivity.service');
const { formatResponse } = require('../utils/helpers/response');
const { getStartOfDay, formatDate } = require('../utils/helpers/date');
const AppError = require('../utils/errors/AppError');
const Joi = require('joi');
const { cache } = require('../middleware/cache');

// Validation for date parameter (YYYY-MM-DD)
const dateParamSchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
});

// Helper to get day data with lists
const getDayActivity = async (userId, targetDate, timeZone) => {
  // 1. Aggregated data from heatmap
  const dayAggregated = await heatmapService.getDayData(userId, targetDate, timeZone);
  if (!dayAggregated) {
    throw new AppError('No data available for the specified date', 404);
  }

  // 2. Solved questions list
  const solvedQuestions = await progressService.getDaySolvedQuestions(userId, targetDate, timeZone);

  // 3. Completed revisions list
  const completedRevisions = await revisionActivityService.getDayRevisions(userId, targetDate, timeZone);

  return {
    ...dayAggregated,
    questionsSolved: solvedQuestions,
    revisionsCompletedList: completedRevisions,
  };
};

/**
 * GET /api/v1/activity/today
 */
const getTodayActivity = async (req, res, next) => {
  try {
    const timeZone = req.userTimeZone || 'UTC';
    const userId = req.user._id;
    const today = new Date();

    const activity = await getDayActivity(userId, today, timeZone);

    res.json(formatResponse('Today\'s activity retrieved successfully', activity, {
      timezone: timeZone,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/activity/day/:date
 * @param {string} date - Date in YYYY-MM-DD format (interpreted in user's timezone)
 */
const getDayActivityByDate = async (req, res, next) => {
  try {
    const { date } = req.params;
    const timeZone = req.userTimeZone || 'UTC';
    const userId = req.user._id;

    // Validate date format
    const { error } = dateParamSchema.validate({ date });
    if (error) {
      throw new AppError('Invalid date format. Use YYYY-MM-DD', 400);
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new AppError('Invalid date', 400);
    }

    const activity = await getDayActivity(userId, targetDate, timeZone);

    res.json(formatResponse(`Activity for ${date} retrieved successfully`, activity, {
      timezone: timeZone,
    }));
  } catch (error) {
    next(error);
  }
};

// Apply caching (5 minutes for today, 1 hour for past dates)
const todayCache = cache(300, 'activity:today');        // 5 minutes
const dayCache = cache(3600, 'activity:day');          // 1 hour

module.exports = {
  getTodayActivity: [todayCache, getTodayActivity],
  getDayActivityByDate: [dayCache, getDayActivityByDate],
};