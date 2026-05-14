const express = require('express');
const router = express.Router();
const { getDashboard, dashboardCache } = require('../../controllers/dashboard.controller');
const { auth } = require('../../middleware/auth');
const { attachUserTimeZone } = require('../../middleware/timezone');   
const rateLimiters = require('../../middleware/rateLimiter');

/**
 * GET /api/v1/dashboard
 * Returns aggregated dashboard data.
 * Authentication required.
 * Rate limited to 250 requests per 15 minutes (userLimiter).
 * Cached for 30 seconds (dashboardCache).
 */
router.get(
  '/',
  auth,
  attachUserTimeZone,       
  rateLimiters.userLimiter,
  dashboardCache,
  getDashboard
);

module.exports = router;