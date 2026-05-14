const express = require('express');
const router = express.Router();
const { getDailyTrend, getMonthlyTrend } = require('../../controllers/trends.controller');
const { auth } = require('../../middleware/auth');
const rateLimiters = require('../../middleware/rateLimiter');

// Apply the controller's middleware arrays directly (they include validation and caching)
router.get('/daily',
  auth,
  rateLimiters.userLimiter,
  ...getDailyTrend
);

router.get('/monthly',
  auth,
  rateLimiters.userLimiter,
  ...getMonthlyTrend
);

module.exports = router;