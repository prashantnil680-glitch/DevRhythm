const express = require('express');
const router = express.Router();
const { getTodayActivity, getDayActivityByDate } = require('../../controllers/activityDay.controller');
const { auth } = require('../../middleware/auth');
const { attachUserTimeZone } = require('../../middleware/timezone');
const rateLimiters = require('../../middleware/rateLimiter');

// GET /api/v1/activity/today - current day's activity
router.get('/today',
  auth,
  attachUserTimeZone,
  rateLimiters.userLimiter,
  ...getTodayActivity
);

// GET /api/v1/activity/day/:date - activity for a specific date (YYYY-MM-DD)
router.get('/day/:date',
  auth,
  attachUserTimeZone,
  rateLimiters.userLimiter,
  ...getDayActivityByDate
);

module.exports = router;