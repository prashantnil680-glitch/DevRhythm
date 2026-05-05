const RevisionSchedule = require('../models/RevisionSchedule');
const { getStartOfDay, getEndOfDay, isToday, getStartOfMonth, getEndOfMonth } = require('../utils/helpers/date');

/**
 * Calculate revision stats using aggregation with pendingDue (actual due date)
 */
const calculateRevisionStats = async (userId) => {
  const todayStart = getStartOfDay();
  const todayEnd = getEndOfDay();
  const nextWeekEnd = new Date(todayStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  nextWeekEnd.setHours(23, 59, 59, 999);

  // Total active
  const totalActive = await RevisionSchedule.countDocuments({ userId, status: 'active' });
  const totalCompleted = await RevisionSchedule.countDocuments({ userId, status: 'completed' });

  // Overdue and pending counts based on pendingDue
  const stats = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    {
      $addFields: {
        pendingDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] }
      }
    },
    {
      $facet: {
        totalOverdue: [
          { $match: { pendingDue: { $lt: todayStart } } },
          { $count: 'count' }
        ],
        pendingToday: [
          { $match: { pendingDue: { $gte: todayStart, $lte: todayEnd } } },
          { $count: 'count' }
        ],
        pendingWeek: [
          { $match: { pendingDue: { $gt: todayEnd, $lte: nextWeekEnd } } },
          { $count: 'count' }
        ],
        byRevisionIndex: [
          {
            $group: {
              _id: '$currentRevisionIndex',
              count: { $sum: 1 }
            }
          }
        ],
        completionStats: [
          {
            $project: {
              totalRevisions: { $size: '$schedule' },
              completedCount: { $size: '$completedRevisions' }
            }
          },
          {
            $group: {
              _id: null,
              totalRevisions: { $sum: '$totalRevisions' },
              totalCompleted: { $sum: '$completedCount' }
            }
          }
        ],
        overdueStats: [
          {
            $match: { pendingDue: { $lt: todayStart } }
          },
          {
            $group: {
              _id: null,
              totalOverdueCount: { $sum: '$overdueCount' },
              avgOverdue: { $avg: '$overdueCount' }
            }
          }
        ]
      }
    }
  ]);

  const result = stats[0];
  const totalOverdue = result.totalOverdue[0]?.count || 0;
  const pendingToday = result.pendingToday[0]?.count || 0;
  const pendingWeek = result.pendingWeek[0]?.count || 0;
  const completionStats = result.completionStats[0];
  const overdueStats = result.overdueStats[0];

  const byRevisionIndex = {};
  result.byRevisionIndex.forEach(item => {
    byRevisionIndex[item._id] = item.count;
  });

  const completionRate = completionStats && completionStats.totalRevisions > 0
    ? Math.round((completionStats.totalCompleted / completionStats.totalRevisions) * 100)
    : 0;

  return {
    totalActive,
    totalCompleted,
    totalOverdue,
    pendingToday,
    pendingWeek,
    completionRate,
    averageOverdue: overdueStats?.avgOverdue || 0,
    byRevisionIndex,
  };
};

const calculateUpcomingStats = async (userId, startDate, endDate) => {
  const stats = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    {
      $addFields: {
        pendingDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] }
      }
    },
    { $match: { pendingDue: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$pendingDue' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const byDay = {};
  let totalUpcoming = 0;
  stats.forEach(stat => {
    byDay[stat._id] = stat.count;
    totalUpcoming += stat.count;
  });

  return { totalUpcoming, byDay };
};

const createRevisionSchedule = async (userId, questionId, baseDate, customSchedule = null) => {
  const schedule = customSchedule || [1, 3, 7, 14, 30].map(days => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const revision = await RevisionSchedule.create({
    userId,
    questionId,
    schedule,
    baseDate,
    status: 'active',
  });

  return revision;
};

const markRevisionComplete = async (revisionId, completedAt = new Date(), status = 'completed') => {
  const revision = await RevisionSchedule.findById(revisionId);
  if (!revision) throw new Error('Revision schedule not found');
  if (revision.currentRevisionIndex >= revision.schedule.length) throw new Error('All revisions already completed');

  const scheduledDate = revision.schedule[revision.currentRevisionIndex];
  revision.completedRevisions.push({
    date: scheduledDate,
    completedAt,
    status,
  });
  revision.currentRevisionIndex += 1;
  if (revision.currentRevisionIndex >= revision.schedule.length) revision.status = 'completed';
  revision.updatedAt = new Date();
  await revision.save();
  return revision;
};

const getPendingRevisionsForDate = async (userId, date, timeZone = 'UTC') => {
  const dateStart = getStartOfDay(date, timeZone);
  const dateEnd = getEndOfDay(date, timeZone);
  const pending = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    {
      $addFields: {
        pendingDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] }
      }
    },
    { $match: { pendingDue: { $gte: dateStart, $lte: dateEnd } } },
    { $lookup: { from: 'questions', localField: 'questionId', foreignField: '_id', as: 'question' } },
    { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } }
  ]);
  return pending;
};

const updateOverdueRevisions = async (timeZone = 'UTC') => {
  const today = getStartOfDay(new Date(), timeZone);
  const result = await RevisionSchedule.updateMany(
    {
      status: 'active',
      $expr: {
        $and: [
          { $lt: [{ $arrayElemAt: ['$schedule', '$currentRevisionIndex'] }, today] },
          { $lt: ['$currentRevisionIndex', { $size: '$schedule' }] }
        ]
      }
    },
    {
      $inc: { overdueCount: 1 },
      $set: { status: 'overdue', updatedAt: new Date() }
    }
  );
  return result.modifiedCount;
};

const getRevisionStatusLabel = (revision, index = null, mode = 'actionable', timeZone = 'UTC') => {
  const idx = index !== null ? index : revision.currentRevisionIndex;
  if (revision.status === 'completed') return 'Completed';

  const isCompleted = revision.completedRevisions.some(cr => {
    const crDate = new Date(cr.date);
    const schDate = revision.schedule[idx];
    return crDate.getTime() === schDate.getTime();
  });
  if (isCompleted) return 'Completed';

  const dueDate = revision.schedule[idx];
  const todayStart = getStartOfDay(new Date(), timeZone);
  if (mode === 'display') {
    if (dueDate < todayStart) return 'Overdue';
    if (isToday(dueDate, timeZone)) return 'Pending';
    return 'Upcoming';
  }

  if (idx < revision.currentRevisionIndex) return 'Completed';
  if (idx === revision.currentRevisionIndex) {
    if (dueDate < todayStart) return 'Overdue';
    if (isToday(dueDate, timeZone)) return 'Pending';
    return 'Upcoming';
  }
  return 'Upcoming';
};

const getDetailedRevisionStats = async (userId, timeZone = 'UTC') => {
  const baseStats = await calculateRevisionStats(userId);

  // Trends (daily, weekly, monthly)
  const trends = await RevisionSchedule.aggregate([
    { $match: { userId, status: { $in: ['active', 'completed'] } } },
    { $unwind: '$completedRevisions' },
    { $match: { 'completedRevisions.status': 'completed' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedRevisions.completedAt' } },
        completed: { $sum: 1 },
        timeSpent: { $sum: '$completedRevisions.timeSpent' },
        confidenceAfter: { $push: '$completedRevisions.confidenceAfter' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const dailyTrends = trends.map(day => ({
    date: day._id,
    completed: day.completed,
    timeSpent: day.timeSpent,
    avgConfidence: day.confidenceAfter.filter(c => c != null).length
      ? (day.confidenceAfter.reduce((a,b) => a + b, 0) / day.confidenceAfter.filter(c => c != null).length).toFixed(1)
      : null
  }));

  const today = getStartOfDay(new Date(), timeZone);
  const overdueSchedules = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    {
      $addFields: {
        pendingDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] }
      }
    },
    { $match: { pendingDue: { $lt: today } } }
  ]);

  const distribution = { '1-3days': 0, '4-7days': 0, '8-14days': 0, '15-30days': 0, '30+days': 0 };
  for (const rev of overdueSchedules) {
    const daysOverdue = Math.floor((today - rev.pendingDue) / (1000 * 60 * 60 * 24));
    if (daysOverdue <= 3) distribution['1-3days']++;
    else if (daysOverdue <= 7) distribution['4-7days']++;
    else if (daysOverdue <= 14) distribution['8-14days']++;
    else if (daysOverdue <= 30) distribution['15-30days']++;
    else distribution['30+days']++;
  }

  const allSchedules = await RevisionSchedule.find({ userId })
    .populate('questionId', 'difficulty platform pattern')
    .lean();

  const byDifficulty = {
    Easy: { totalRevisions: 0, completed: 0, totalTimeSpent: 0, confidenceSum: 0, confidenceCount: 0, overdueCount: 0 },
    Medium: { totalRevisions: 0, completed: 0, totalTimeSpent: 0, confidenceSum: 0, confidenceCount: 0, overdueCount: 0 },
    Hard: { totalRevisions: 0, completed: 0, totalTimeSpent: 0, confidenceSum: 0, confidenceCount: 0, overdueCount: 0 },
    Unknown: { totalRevisions: 0, completed: 0, totalTimeSpent: 0, confidenceSum: 0, confidenceCount: 0, overdueCount: 0 }
  };
  const byPlatform = {};
  const byPattern = {};

  for (const schedule of allSchedules) {
    const q = schedule.questionId;
    if (!q) continue;
    const diff = q.difficulty || 'Unknown';
    const platform = q.platform || 'Unknown';
    const patterns = Array.isArray(q.pattern) ? q.pattern : (q.pattern ? [q.pattern] : []);

    if (!byDifficulty[diff]) byDifficulty[diff] = { totalRevisions: 0, completed: 0, totalTimeSpent: 0, confidenceSum: 0, confidenceCount: 0, overdueCount: 0 };
    byDifficulty[diff].totalRevisions += 1;

    if (!byPlatform[platform]) byPlatform[platform] = { totalRevisions: 0, completed: 0, totalTimeSpent: 0, confidenceSum: 0, confidenceCount: 0, overdueCount: 0 };
    byPlatform[platform].totalRevisions += 1;

    for (const pattern of patterns) {
      if (!pattern) continue;
      if (!byPattern[pattern]) byPattern[pattern] = { totalRevisions: 0, completed: 0, totalTimeSpent: 0, confidenceSum: 0, confidenceCount: 0, overdueCount: 0 };
      byPattern[pattern].totalRevisions += 1;
    }

    for (const cr of schedule.completedRevisions) {
      if (cr.status !== 'completed') continue;
      byDifficulty[diff].completed += 1;
      byDifficulty[diff].totalTimeSpent += cr.timeSpent || 0;
      if (cr.confidenceAfter) {
        byDifficulty[diff].confidenceSum += cr.confidenceAfter;
        byDifficulty[diff].confidenceCount += 1;
      }

      byPlatform[platform].completed += 1;
      byPlatform[platform].totalTimeSpent += cr.timeSpent || 0;
      if (cr.confidenceAfter) {
        byPlatform[platform].confidenceSum += cr.confidenceAfter;
        byPlatform[platform].confidenceCount += 1;
      }

      for (const pattern of patterns) {
        if (!pattern) continue;
        byPattern[pattern].completed += 1;
        byPattern[pattern].totalTimeSpent += cr.timeSpent || 0;
        if (cr.confidenceAfter) {
          byPattern[pattern].confidenceSum += cr.confidenceAfter;
          byPattern[pattern].confidenceCount += 1;
        }
      }
    }

    const pendingDue = schedule.schedule[schedule.currentRevisionIndex];
    if (pendingDue && pendingDue < today) {
      byDifficulty[diff].overdueCount += 1;
      byPlatform[platform].overdueCount += 1;
      for (const pattern of patterns) {
        if (pattern) byPattern[pattern].overdueCount += 1;
      }
    }
  }

  const computeStats = (obj) => {
    obj.completionRate = obj.totalRevisions ? (obj.completed / obj.totalRevisions) * 100 : 0;
    obj.averageTimeSpent = obj.completed ? (obj.totalTimeSpent / obj.completed).toFixed(1) : '0.0';
    obj.averageConfidenceAfter = obj.confidenceCount ? (obj.confidenceSum / obj.confidenceCount).toFixed(1) : null;
    return obj;
  };
  for (const diff in byDifficulty) computeStats(byDifficulty[diff]);
  for (const plat in byPlatform) computeStats(byPlatform[plat]);
  for (const pat in byPattern) computeStats(byPattern[pat]);

  const allCompleted = allSchedules.flatMap(s => s.completedRevisions.filter(cr => cr.status === 'completed'));
  const totalMinutesSpent = allCompleted.reduce((sum, cr) => sum + (cr.timeSpent || 0), 0);
  const avgMinutesPerRevision = allCompleted.length ? totalMinutesSpent / allCompleted.length : 0;

  const dayMap = new Map();
  for (const cr of allCompleted) {
    const day = cr.completedAt.toISOString().split('T')[0];
    dayMap.set(day, (dayMap.get(day) || 0) + (cr.timeSpent || 0));
  }
  let mostProductiveDay = null, mostMinutes = 0;
  for (const [day, minutes] of dayMap) {
    if (minutes > mostMinutes) { mostMinutes = minutes; mostProductiveDay = day; }
  }

  const confidenceAfterValues = allCompleted.map(cr => cr.confidenceAfter).filter(v => v != null);
  const overallAvgConfidence = confidenceAfterValues.length ? (confidenceAfterValues.reduce((a,b)=>a+b,0) / confidenceAfterValues.length).toFixed(1) : null;
  const confidenceDist = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  for (const val of confidenceAfterValues) confidenceDist[val]++;

  const improvementByIndex = [];

  const detailedStats = {
    summary: {
      totalActiveSchedules: baseStats.totalActive,
      totalCompletedSchedules: baseStats.totalCompleted,
      totalOverdueSchedules: baseStats.totalOverdue,
      totalRevisionsCompleted: allCompleted.length,
      totalRevisionsPending: baseStats.pendingWeek,
      completionRate: baseStats.completionRate,
      averageOverdueDays: baseStats.averageOverdue,
      maxOverdueDays: 0,
      revisionStreak: { current: 0, longest: 0 }
    },
    byRevisionIndex: Object.entries(baseStats.byRevisionIndex).map(([idx, count]) => ({
      index: parseInt(idx),
      totalQuestions: count,
      completed: 0,
      completionRate: 0,
      skipped: 0,
      averageTimeSpent: 0,
      averageConfidenceAfter: null,
      dropoutRate: 0
    })),
    trends: { daily: dailyTrends, weekly: [], monthly: [] },
    overdueDistribution: distribution,
    byDifficulty,
    byPlatform,
    byPattern: Object.entries(byPattern).map(([name, data]) => ({ 
      patternName: name, 
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      ...data 
    })),
    timeStats: {
      totalMinutesSpent,
      averageMinutesPerRevision: avgMinutesPerRevision.toFixed(1),
      averageMinutesPerDay: 0,
      mostProductiveDay,
      mostProductiveDayMinutes: mostMinutes,
      timeByDifficulty: { Medium: 0, Easy: 0, Hard: 0 }
    },
    confidenceStats: {
      overallAverageAfter: overallAvgConfidence,
      confidenceDistributionAfter: confidenceDist,
      confidenceImprovementByRevisionIndex: improvementByIndex
    },
  };

  return detailedStats;
};

/**
 * Compute monthly revision completion rate for the last N months.
 * For each month, counts:
 *   - Scheduled: number of revision entries whose due date falls in that month.
 *   - Completed on time: number of those that were completed on or before their due date.
 * Returns an array of percentages (0-100) aligned with the last N months (most recent first or last?).
 * The function returns from oldest to newest (ascending) for consistency with monthly trend charts.
 *
 * @param {string} userId - User ObjectId
 * @param {number} months - Number of months to look back (default 12)
 * @param {string} timeZone - IANA timezone
 * @returns {Promise<Array<number>>} - Array of completion percentages (0-100) for each month, oldest to newest.
 */
const getMonthlyRevisionCompletionRate = async (userId, months = 12, timeZone = 'UTC') => {
  const now = new Date();
  // Generate month boundaries: from earliest month to latest month
  const monthBoundaries = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now);
    monthDate.setMonth(now.getMonth() - i);
    monthDate.setDate(1);
    monthDate.setHours(0, 0, 0, 0);
    const start = getStartOfMonth(monthDate, timeZone);
    const end = getEndOfMonth(monthDate, timeZone);
    monthBoundaries.push({ start, end, label: monthDate.toISOString().slice(0, 7) });
  }

  const completionRates = [];

  for (const boundary of monthBoundaries) {
    // Find all revision schedules that have at least one scheduled revision date in this month
    const schedules = await RevisionSchedule.aggregate([
      { $match: { userId } },
      { $unwind: { path: '$schedule', includeArrayIndex: 'schedIndex' } },
      {
        $match: {
          $expr: {
            $and: [
              { $gte: ['$schedule', boundary.start] },
              { $lte: ['$schedule', boundary.end] },
            ],
          },
        },
      },
      {
        $project: {
          questionId: 1,
          scheduleDate: '$schedule',
          schedIndex: 1,
          completedRevisions: 1,
        },
      },
    ]);

    let scheduledCount = 0;
    let completedOnTimeCount = 0;

    for (const s of schedules) {
      scheduledCount++;
      // Check if this specific revision entry has been completed on or before its due date
      const completionEntry = s.completedRevisions.find(cr => {
        const crDate = new Date(cr.date);
        return crDate.getTime() === s.scheduleDate.getTime() && cr.status === 'completed';
      });
      if (completionEntry) {
        const dueDate = s.scheduleDate;
        const completedAt = completionEntry.completedAt;
        if (completedAt <= dueDate) {
          completedOnTimeCount++;
        }
      }
    }

    const rate = scheduledCount > 0 ? Math.round((completedOnTimeCount / scheduledCount) * 100) : 100;
    completionRates.push(rate);
  }

  return completionRates;
};

module.exports = {
  calculateRevisionStats,
  calculateUpcomingStats,
  createRevisionSchedule,
  markRevisionComplete,
  getPendingRevisionsForDate,
  updateOverdueRevisions,
  getRevisionStatusLabel,
  getDetailedRevisionStats,
  getMonthlyRevisionCompletionRate, // newly exported
};