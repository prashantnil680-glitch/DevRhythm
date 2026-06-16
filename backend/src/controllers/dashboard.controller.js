const dashboardService = require('../services/dashboard.service');
const { formatResponse } = require('../utils/helpers/response');
const { cache } = require('../middleware/cache');
const User = require('../models/User');

/**
 * GET /api/v1/dashboard
 * Returns dashboard data in a well-organized structure:
 *
 * - summary: core user stats (totalSolved, masteryRate, streaks)
 * - productivity: heatmap summary + weekly study time + current month heatmap
 * - goals: current daily/weekly goals, goal graph, planned goals
 * - revisions: pending, upcoming, completion rate, recent revisions
 * - activity: mixed timeline and recently solved questions
 * - dailyChallenge: LeetCode problem of the day with user progress
 * - notifications: unread count and recent notifications
 * - insights: weakest pattern for actionable improvement
 * - totalUsers: total number of active users (for community context)
 *
 * All lists limited to 4–5 items; no personal details.
 * Response cached 30 seconds.
 */
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const timeZone = req.userTimeZone || 'UTC';

    const [
      userStats,
      currentGoals,
      goalGraph,
      revisionsData,
      recentActivity,
      heatmapSummary,
      dailyProblem,
      unreadCount,
      recentNotifications,
      recentRevisions,
      recentlySolved,
      weeklyStudyTime,
      revisionCompletionRate,
      upcomingRevisionsList,
      activePlannedGoals,
      weakestPattern,
      currentMonthHeatmap,
      totalUsers
    ] = await Promise.all([
      dashboardService.getUserStats(req.user),
      dashboardService.getCurrentGoals(userId, timeZone),
      dashboardService.getGoalGraph(userId, timeZone),
      dashboardService.getRevisionsData(userId, timeZone),
      dashboardService.getRecentActivity(userId, timeZone),
      dashboardService.getHeatmapSummary(userId),
      dashboardService.getDailyProblem(userId),
      dashboardService.getUnreadNotificationsCount(userId),
      dashboardService.getRecentNotifications(userId),
      dashboardService.getRecentRevisions(userId, timeZone),
      dashboardService.getRecentlySolved(userId),
      dashboardService.getWeeklyStudyTime(userId, timeZone),
      dashboardService.getRevisionCompletionRate(userId, timeZone),
      dashboardService.getUpcomingRevisionsList(userId, timeZone, 5),
      dashboardService.getActivePlannedGoals(userId, 2),
      dashboardService.getTopWeakestPattern(userId),
      dashboardService.getCurrentMonthHeatmap(userId, timeZone),
      User.countDocuments({ isActive: true })
    ]);

    const responseData = {
      summary: userStats,
      productivity: {
        heatmap: heatmapSummary,
        weeklyStudyTime: weeklyStudyTime,
        currentMonthHeatmap
      },
      goals: {
        current: currentGoals,
        graph: goalGraph,
        planned: activePlannedGoals
      },
      revisions: {
        pendingTodayCount: revisionsData.pendingTodayCount,
        pendingToday: revisionsData.pendingToday,
        upcomingCount: revisionsData.upcomingCount,
        upcoming: upcomingRevisionsList,
        completionRate: revisionCompletionRate,
        recent: recentRevisions
      },
      activity: {
        timeline: recentActivity,
        recentlySolved
      },
      dailyChallenge: dailyProblem,
      notifications: {
        unreadCount,
        recent: recentNotifications
      },
      insights: {
        weakestPattern
      },
      totalUsers
    };

    res.json(formatResponse('Dashboard data retrieved', responseData));
  } catch (error) {
    next(error);
  }
};

// Apply cache middleware (30 seconds) with user-specific key pattern
const dashboardCache = cache(30, 'dashboard:user');

module.exports = {
  getDashboard,
  dashboardCache
};