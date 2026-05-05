const dashboardService = require('../services/dashboard.service');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const Joi = require('joi');
const { cache } = require('../middleware/cache');

// Validation schemas
const dailyQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(90).default(30),
});

const monthlyQuerySchema = Joi.object({
  months: Joi.number().integer().min(1).max(60).default(12),
  includeComparison: Joi.boolean().default(true),
});

/**
 * GET /api/v1/trends/daily
 * Returns daily activity trends for the last N days.
 * Query parameters:
 *   - days: number of days (default 30, max 90)
 */
const getDailyTrend = async (req, res, next) => {
  try {
    const { days } = req.query;
    const timeZone = req.userTimeZone || 'UTC';
    const userId = req.user._id;

    const trendData = await dashboardService.getDailyTrend(userId, days, timeZone);

    res.json(formatResponse('Daily trends retrieved successfully', trendData, {
      period: `${days} days`,
      timezone: timeZone,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/trends/monthly
 * Returns monthly aggregated trends for the last M months.
 * Query parameters:
 *   - months: number of months (default 12, max 60)
 *   - includeComparison: boolean (default true) – include global average goals
 */
const getMonthlyTrend = async (req, res, next) => {
  try {
    const { months, includeComparison } = req.query;
    const timeZone = req.userTimeZone || 'UTC';
    const userId = req.user._id;

    const trendData = await dashboardService.getMonthlyTrend(userId, months, timeZone, includeComparison);

    res.json(formatResponse('Monthly trends retrieved successfully', trendData, {
      period: `${months} months`,
      timezone: timeZone,
      includeComparison,
    }));
  } catch (error) {
    next(error);
  }
};

// Apply caching with user‑specific keys
const dailyCache = cache(60, 'trends:daily');       // 1 minute
const monthlyCache = cache(300, 'trends:monthly'); // 5 minutes

module.exports = {
  getDailyTrend: [dailyCache, validate(dailyQuerySchema, 'query'), getDailyTrend],
  getMonthlyTrend: [monthlyCache, validate(monthlyQuerySchema, 'query'), getMonthlyTrend],
};

// Helper to reuse existing validate middleware
function validate(schema, property = 'query') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false });
    if (error) {
      const errors = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, ''),
      }));
      throw new AppError('Validation failed', 400, { errors });
    }
    req[property] = value;
    next();
  };
}