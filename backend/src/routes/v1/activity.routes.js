const express = require('express');
const router = express.Router();
const activityController = require('../../controllers/activity.controller');
const { auth } = require('../../middleware/auth');
const validate = require('../../middleware/validator');
const Joi = require('joi');
const { cache } = require('../../middleware/cache');
const rateLimiters = require('../../middleware/rateLimiter');

const getActivityLogsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  action: Joi.string().valid(
    'question_solved', 'question_mastered', 'revision_completed',
    'goal_achieved', 'joined_group', 'created_share', 'followed_user'
  ),
  startDate: Joi.date(),
  endDate: Joi.date(),
  sortBy: Joi.string().valid('timestamp', 'createdAt').default('timestamp'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

router.get('/',
  auth,
  rateLimiters.userLimiter,
  cache(30, 'activity:logs'),
  validate(getActivityLogsSchema, 'query'),
  activityController.getActivityLogs
);

// NEW: Today's solved questions grouped by followed user
router.get('/feed/today-grouped',
  auth,
  rateLimiters.followGetLimiter,
  activityController.getTodayGroupedFeed
);

module.exports = router;