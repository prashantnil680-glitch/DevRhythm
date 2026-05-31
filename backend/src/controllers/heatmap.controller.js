const { DateTime } = require('luxon');
const HeatmapData = require('../models/HeatmapData');
const User = require('../models/User');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const RevisionSchedule = require('../models/RevisionSchedule');
const Goal = require('../models/Goal');
const StudyGroup = require('../models/StudyGroup');
const heatmapService = require('../services/heatmap.service');
const { formatResponse } = require('../utils/helpers/response');
const { getPaginationParams, paginate } = require('../utils/helpers/pagination');
const { getStartOfDay, getEndOfDay, formatDate } = require('../utils/helpers/date');
const AppError = require('../utils/errors/AppError');
const { invalidateCache } = require('../middleware/cache');
const config = require('../config');
const { client: redisClient } = require('../config/redis');
const { calculateIntensityLevel } = heatmapService;

/**
 * Convert a UTC date to user's local ISO string with offset.
 * Example output: "2026-05-30T00:00:00+05:30"
 */
const toLocalISOString = (utcDate, timeZone) => {
  if (!utcDate) return null;
  if (!timeZone) timeZone = 'UTC';
  const dt = DateTime.fromJSDate(new Date(utcDate), { zone: 'UTC' });
  return dt.setZone(timeZone).toISO({ includeOffset: true });
};

/**
 * Convert dailyData array to local dates and recompute dayOfWeek.
 */
const convertDailyDataToLocal = (dailyData, timeZone) => {
  if (!dailyData) return [];
  return dailyData.map(day => {
    const localDateStr = toLocalISOString(day.date, timeZone);
    const localDateObj = DateTime.fromISO(localDateStr);
    return {
      ...day,
      date: localDateStr,
      // dayOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      dayOfWeek: localDateObj.weekday % 7,
    };
  });
};

/**
 * Generate tooltip data from dailyData (works with both Date objects and strings).
 */
const generateTooltipData = (dailyData) => {
  return dailyData.map(day => {
    // Convert date to string safely
    const dateStr = day.date && typeof day.date.toISOString === 'function'
      ? day.date.toISOString()
      : String(day.date);
    return {
      date: dateStr,
      summary: `${day.totalActivities} submission${day.totalActivities !== 1 ? 's' : ''} on ${dateStr.split('T')[0]}`,
      details: `New: ${day.newProblemsSolved}, Revisions: ${day.revisionProblems}, Submissions: ${day.totalSubmissions}, Study: ${day.studyGroupActivity}, Time: ${day.totalTimeSpent}min`
    };
  });
};

const getHeatmap = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const includeCache = req.query.includeCache !== 'false';
    const timeZone = req.userTimeZone;

    let heatmap = await HeatmapData.findOne({
      userId: req.user._id,
      year
    }).lean();

    if (!heatmap) {
      heatmap = await heatmapService.generateHeatmapData(req.user._id, year, timeZone);
    }

    if (!heatmap) {
      throw new AppError('Heatmap data not found', 404, {
        code: 'HEATMAP_NOT_FOUND',
        details: 'No heatmap data exists for the specified year'
      });
    }

    // Convert dailyData dates to user's local timezone
    const localDailyData = convertDailyDataToLocal(heatmap.dailyData, timeZone);
    heatmap.dailyData = localDailyData;

    // Recalculate intensity levels based on totalActivities
    if (heatmap.dailyData) {
      heatmap.dailyData = heatmap.dailyData.map(day => ({
        ...day,
        intensityLevel: calculateIntensityLevel(day.totalActivities || 0)
      }));
    }

    const response = {
      year: heatmap.year,
      weekCount: heatmap.weekCount,
      firstDate: heatmap.firstDate,
      lastDate: heatmap.lastDate,
      dailyData: heatmap.dailyData,
      performance: heatmap.performance,
      consistency: heatmap.consistency,
      statsPanel: heatmap.statsPanel
    };

    const freshTooltipData = generateTooltipData(heatmap.dailyData);
    const freshRenderData = heatmapService.generateCachedRenderData(heatmap.dailyData);

    if (includeCache && freshRenderData) {
      response.cachedRenderData = {
        ...freshRenderData,
        tooltipData: freshTooltipData
      };
    } else {
      response.cachedRenderData = {
        tooltipData: freshTooltipData,
        colorScale: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
        monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        weekLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        currentDayIndex: freshRenderData?.currentDayIndex ?? -1
      };
    }

    res.json(formatResponse('Heatmap data retrieved successfully', response, {
      year,
      lastUpdated: heatmap.lastUpdated
    }));
  } catch (error) {
    next(error);
  }
};

const getHeatmapByYear = async (req, res, next) => {
  try {
    const year = parseInt(req.params.year);
    const includeCache = req.query.includeCache !== 'false';
    const timeZone = req.userTimeZone;

    if (year < 2000 || year > 2100) {
      throw new AppError('Invalid year specified', 400);
    }

    let heatmap = await HeatmapData.findOne({
      userId: req.user._id,
      year
    }).lean();

    if (!heatmap) {
      heatmap = await heatmapService.generateHeatmapData(req.user._id, year, timeZone);
    }

    if (!heatmap) {
      throw new AppError('Heatmap data not found for year ' + year, 404, {
        code: 'HEATMAP_NOT_FOUND',
        details: 'No heatmap data exists for the specified year',
        suggestedAction: 'Refresh heatmap data'
      });
    }

    // Convert dailyData dates to user's local timezone
    const localDailyData = convertDailyDataToLocal(heatmap.dailyData, timeZone);
    heatmap.dailyData = localDailyData;

    // Recalculate intensity levels
    if (heatmap.dailyData) {
      heatmap.dailyData = heatmap.dailyData.map(day => ({
        ...day,
        intensityLevel: calculateIntensityLevel(day.totalActivities || 0)
      }));
    }

    const response = {
      year: heatmap.year,
      weekCount: heatmap.weekCount,
      firstDate: heatmap.firstDate,
      lastDate: heatmap.lastDate,
      dailyData: heatmap.dailyData,
      performance: heatmap.performance,
      consistency: heatmap.consistency,
      statsPanel: heatmap.statsPanel
    };

    const freshTooltipData = generateTooltipData(heatmap.dailyData);
    const freshRenderData = heatmapService.generateCachedRenderData(heatmap.dailyData);

    if (includeCache && freshRenderData) {
      response.cachedRenderData = {
        ...freshRenderData,
        tooltipData: freshTooltipData
      };
    } else {
      response.cachedRenderData = {
        tooltipData: freshTooltipData,
        colorScale: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
        monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        weekLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        currentDayIndex: freshRenderData?.currentDayIndex ?? -1
      };
    }

    res.json(formatResponse('Heatmap data retrieved successfully', response, {
      year,
      lastUpdated: heatmap.lastUpdated
    }));
  } catch (error) {
    next(error);
  }
};

const refreshHeatmap = async (req, res, next) => {
  try {
    const year = parseInt(req.body.year) || new Date().getFullYear();
    const forceFullRefresh = req.body.forceFullRefresh === true;
    const timeZone = req.userTimeZone;

    if (year < 2000 || year > 2100) {
      throw new AppError('Invalid year specified', 400);
    }

    const jobId = `heatmap_refresh_${req.user._id}_${year}_${Date.now()}`;
    const estimatedCompletion = new Date(Date.now() + 5 * 60 * 1000);

    await invalidateCache(`heatmap:${req.user._id}:${year}:*`);
    await invalidateCache(`heatmap:stats:${req.user._id}:${year}`);
    await invalidateCache(`heatmap:filter:${req.user._id}:${year}:*`);

    heatmapService.regenerateHeatmapData(req.user._id, year, forceFullRefresh, timeZone)
      .catch(err => console.error('Heatmap regeneration failed:', err));

    res.status(202).json(formatResponse('Heatmap recalculation started', {
      jobId,
      estimatedCompletion
    }, {
      year,
      refreshType: forceFullRefresh ? 'full' : 'incremental'
    }));
  } catch (error) {
    next(error);
  }
};

const getHeatmapStats = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const timeZone = req.userTimeZone;

    const heatmap = await HeatmapData.findOne({
      userId: req.user._id,
      year
    }).lean();

    if (!heatmap || !heatmap.statsPanel) {
      const generated = await heatmapService.generateHeatmapData(req.user._id, year, timeZone);
      if (!generated) {
        throw new AppError('Heatmap data not found', 404);
      }

      res.json(formatResponse('Heatmap statistics retrieved', generated.statsPanel, {
        year,
        calculatedAt: new Date()
      }));
      return;
    }

    res.json(formatResponse('Heatmap statistics retrieved', heatmap.statsPanel, {
      year,
      calculatedAt: heatmap.lastUpdated
    }));
  } catch (error) {
    next(error);
  }
};

const getFilteredHeatmap = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const viewType = req.query.viewType || 'all';
    const weekStart = parseInt(req.query.weekStart) || 1;
    const weekEnd = parseInt(req.query.weekEnd) || 53;
    const timeZone = req.userTimeZone;

    const validViewTypes = [
      'all', 'new_problems', 'revisions', 'study_group',
      'leetcode', 'hackerrank', 'codeforces', 'easy', 'medium', 'hard'
    ];

    if (!validViewTypes.includes(viewType)) {
      throw new AppError('Invalid view type', 400);
    }

    const heatmap = await HeatmapData.findOne({
      userId: req.user._id,
      year
    }).lean();

    if (!heatmap) {
      throw new AppError('Heatmap data not found', 404);
    }

    let filteredData = [];
    let totalActivities = 0;
    let maxInDay = 0;

    if (viewType === 'all') {
      filteredData = heatmap.dailyData;
    } else if (heatmap.filterViews && heatmap.filterViews[viewType]) {
      filteredData = heatmap.dailyData.map((day, index) => ({
        ...day,
        totalActivities: heatmap.filterViews[viewType][index] || 0,
        intensityLevel: calculateIntensityLevel(heatmap.filterViews[viewType][index] || 0)
      }));
    } else {
      filteredData = await heatmapService.calculateFilteredData(req.user._id, year, viewType, timeZone);
    }

    filteredData.forEach(day => {
      totalActivities += day.totalActivities;
      if (day.totalActivities > maxInDay) maxInDay = day.totalActivities;
    });

    const consistencyScore = heatmap.consistency?.consistencyScore || 0;
    const averagePerDay = filteredData.length > 0 ? totalActivities / filteredData.length : 0;

    res.json(formatResponse('Filtered heatmap data retrieved', {
      viewType,
      dailyData: filteredData,
      summary: {
        totalActivities,
        averagePerDay: parseFloat(averagePerDay.toFixed(1)),
        maxInDay,
        consistencyScore: parseFloat(consistencyScore.toFixed(1))
      }
    }, {
      year,
      filterApplied: viewType,
      weekRange: `${weekStart}-${weekEnd}`
    }));
  } catch (error) {
    next(error);
  }
};

const exportHeatmap = async (req, res, next) => {
  try {
    const year = parseInt(req.body.year) || new Date().getFullYear();
    const format = req.body.format || 'json';
    const includeDetails = req.body.includeDetails === true;

    const heatmap = await HeatmapData.findOne({
      userId: req.user._id,
      year
    }).lean();

    if (!heatmap) {
      throw new AppError('Heatmap data not found for export', 404);
    }

    const exportId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let exportData;
    if (format === 'csv') {
      exportData = heatmapService.convertToCSV(heatmap, includeDetails);
    } else {
      exportData = includeDetails ? heatmap : {
        year: heatmap.year,
        dailyData: heatmap.dailyData.map(day => ({
          date: day.date,
          totalActivities: day.totalActivities,
          newProblemsSolved: day.newProblemsSolved,
          revisionProblems: day.revisionProblems,
          intensityLevel: day.intensityLevel
        })),
        performance: heatmap.performance,
        consistency: heatmap.consistency
      };
    }

    const size = Buffer.byteLength(JSON.stringify(exportData), 'utf8');
    const sizeKB = (size / 1024).toFixed(1);

    const downloadUrl = `${config.backendUrl}/api/v1/heatmap/export/${exportId}?format=${format}`;

    await redisClient.setEx(`export:${exportId}`, 24 * 60 * 60, JSON.stringify({
      userId: req.user._id.toString(),
      userDisplayName: req.user.displayName,
      year,
      format,
      data: exportData,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    }));

    res.json(formatResponse('Heatmap export generated', {
      exportId,
      downloadUrl,
      expiresAt,
      format,
      size: `${sizeKB}KB`
    }, {
      year,
      exportedAt: new Date()
    }));
  } catch (error) {
    next(error);
  }
};

const downloadExport = async (req, res, next) => {
  try {
    const { exportId } = req.params;
    const format = req.query.format || 'json';

    const exportKey = `export:${exportId}`;
    const exportData = await redisClient.get(exportKey);

    if (!exportData) {
      throw new AppError('Export not found or expired', 404);
    }

    const parsedExport = JSON.parse(exportData);

    if (parsedExport.userId !== req.user._id.toString()) {
      throw new AppError('Unauthorized to access this export', 403);
    }

    const safeDisplayName = (parsedExport.userDisplayName || req.user.displayName || 'User')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);

    const filename = `DevRhythm_${safeDisplayName}_${parsedExport.year}.${format}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(parsedExport.data);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(parsedExport.data, null, 2));
    }
  } catch (error) {
    next(error);
  }
};

const getPublicUserHeatmap = async (req, res, next) => {
  try {
    const { userId, year } = req.params;
    const simple = req.query.simple === 'true';
    const includeCache = req.query.includeCache !== 'false';
    const parsedYear = parseInt(year);
    if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      throw new AppError('Invalid year', 400);
    }

    const user = await User.findById(userId).select('_id preferences.timezone');
    if (!user) throw new AppError('User not found', 404);

    const userTimeZone = user.preferences?.timezone || 'UTC';

    const heatmap = await heatmapService.getOrCreateHeatmap(userId, parsedYear, userTimeZone);
    if (!heatmap) throw new AppError('Heatmap data not found', 404);

    // Recalculate intensity levels
    if (heatmap.dailyData) {
      heatmap.dailyData = heatmap.dailyData.map(day => ({
        ...day,
        intensityLevel: calculateIntensityLevel(day.totalActivities || 0)
      }));
    }

    let response;
    if (simple) {
      response = heatmapService.extractMinimalHeatmap(heatmap);
    } else {
      response = {
        year: heatmap.year,
        weekCount: heatmap.weekCount,
        firstDate: heatmap.firstDate,
        lastDate: heatmap.lastDate,
        dailyData: heatmap.dailyData,
        performance: heatmap.performance,
        consistency: heatmap.consistency,
        statsPanel: heatmap.statsPanel,
      };
      // Use the safe generateTooltipData function
      const freshTooltipData = generateTooltipData(heatmap.dailyData);
      if (includeCache && heatmap.cachedRenderData) {
        response.cachedRenderData = {
          ...heatmap.cachedRenderData,
          tooltipData: freshTooltipData
        };
      } else {
        response.cachedRenderData = {
          tooltipData: freshTooltipData,
          colorScale: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
          monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          weekLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          currentDayIndex: heatmap.cachedRenderData?.currentDayIndex ?? -1
        };
      }
    }
    res.json(formatResponse('Public heatmap retrieved successfully', response, {
      userId,
      year: parsedYear,
      lastUpdated: heatmap.lastUpdated,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHeatmap,
  getHeatmapByYear,
  refreshHeatmap,
  getHeatmapStats,
  getFilteredHeatmap,
  exportHeatmap,
  downloadExport,
  getPublicUserHeatmap
};