const { DateTime } = require('luxon');
const RevisionSchedule = require('../models/RevisionSchedule');
const Question = require('../models/Question');
const User = require('../models/User');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const { formatResponse, paginate, getPaginationParams, getStartOfDay, getEndOfDay, formatDate, isToday } = require("../utils/helpers");
const AppError = require('../utils/errors/AppError');
const { invalidateCache } = require('../middleware/cache');
const revisionService = require('../services/revision.service');
const heatmapService = require('../services/heatmap.service');
const revisionActivityService = require('../services/revisionActivity.service');
const { updateUserActivity } = require('../services/user.service');
const { incrementDailyActivityDirect } = require('../services/heatmap.service');
const { jobQueue } = require('../services/queue.service');
const { client: redisClient } = require('../config/redis');
const constants = require('../config/constants');

/**
 * Helper to get user timezone from request (fallback to DB preference, then UTC)
 */
const getUserTimeZone = (req) => {
  if (req.userTimeZone) return req.userTimeZone;
  if (req.user && req.user.preferences && req.user.preferences.timezone) {
    return req.user.preferences.timezone;
  }
  return 'UTC';
};

/**
 * Convert a UTC date to user's local ISO string with offset.
 * Example output: "2026-05-15T00:00:00+05:30"
 */
const toLocalISOString = (utcDate, timeZone) => {
  if (!utcDate) return null;
  if (!timeZone) timeZone = 'UTC';
  const dt = DateTime.fromJSDate(new Date(utcDate), { zone: 'UTC' });
  return dt.setZone(timeZone).toISO({ includeOffset: true });
};

/**
 * Convert all date fields in a revision object to local timezone.
 */
const convertRevisionDatesToLocal = (revision, timeZone) => {
  if (!revision) return revision;
  const converted = { ...revision };
  if (Array.isArray(converted.schedule)) {
    converted.schedule = converted.schedule.map(d => toLocalISOString(d, timeZone));
  }
  if (converted.baseDate) converted.baseDate = toLocalISOString(converted.baseDate, timeZone);
  if (converted.createdAt) converted.createdAt = toLocalISOString(converted.createdAt, timeZone);
  if (converted.updatedAt) converted.updatedAt = toLocalISOString(converted.updatedAt, timeZone);
  if (Array.isArray(converted.completedRevisions)) {
    converted.completedRevisions = converted.completedRevisions.map(cr => ({
      ...cr,
      date: toLocalISOString(cr.date, timeZone),
      completedAt: toLocalISOString(cr.completedAt, timeZone)
    }));
  }
  if (Array.isArray(converted.scheduleStatuses)) {
    converted.scheduleStatuses = converted.scheduleStatuses.map(ss => ({
      ...ss,
      date: toLocalISOString(ss.date, timeZone)
    }));
  }
  return converted;
};

const calculateSpacedRepetitionSchedule = (baseDate, schedule = constants.REVISION_SCHEDULE) => {
  return schedule.map(days => {
    const date = new Date(baseDate);
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  });
};

const getRevisions = async (req, res, next) => {
  try {
    const timeZone = getUserTimeZone(req);
    const { page, limit, skip } = getPaginationParams(req);
    const { status, questionId, sortBy = 'schedule', sortOrder = 'asc' } = req.query;
    
    const query = { userId: req.user._id };
    if (status) query.status = status;
    if (questionId) query.questionId = questionId;
    
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const [revisions, total] = await Promise.all([
      RevisionSchedule.find(query)
        .populate({
          path: 'questionId',
          select: 'title platform difficulty tags platformQuestionId', 
        })
        .sort(sort)
        .skip(skip)
        .limit(limit),
      RevisionSchedule.countDocuments(query),
    ]);
    
    const enhancedRevisions = revisions.map(rev => {
      const revObj = rev.toObject();
      revObj.currentStatus = revisionService.getRevisionStatusLabel(rev, null, 'actionable', timeZone);
      revObj.scheduleStatuses = rev.schedule.map((date, idx) => ({
        date,
        status: revisionService.getRevisionStatusLabel(rev, idx, 'display', timeZone)
      }));
      return convertRevisionDatesToLocal(revObj, timeZone);
    });
    
    res.json(formatResponse('Revision schedules retrieved successfully', {
      revisions: enhancedRevisions,
    }, {
      pagination: paginate(total, page, limit),
    }));
  } catch (error) {
    next(error);
  }
};

const getTodayRevisions = async (req, res, next) => {
  try {
    const timeZone = getUserTimeZone(req);
    const todayStart = getStartOfDay(new Date(), timeZone);
    const todayEnd = getEndOfDay(new Date(), timeZone);
    
    const pendingRevisions = await RevisionSchedule.aggregate([
      { $match: { userId: req.user._id, status: 'active' } },
      {
        $addFields: {
          pendingDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] }
        }
      },
      { $match: { pendingDue: { $gte: todayStart, $lte: todayEnd } } },
      {
        $lookup: {
          from: 'questions',
          localField: 'questionId',
          foreignField: '_id',
          as: 'question'
        }
      },
      { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          questionId: { $ifNull: ['$question._id', null] },
          title: { $ifNull: ['$question.title', null] },
          platform: { $ifNull: ['$question.platform', null] },
          platformQuestionId: { $ifNull: ['$question.platformQuestionId', null] },
          difficulty: { $ifNull: ['$question.difficulty', null] },
          tags: { $ifNull: ['$question.tags', []] },
          scheduledDate: '$pendingDue',
          revisionIndex: '$currentRevisionIndex',
          overdue: { $lt: ['$pendingDue', todayStart] }
        }
      }
    ]);
    
    const stats = await revisionService.calculateRevisionStats(req.user._id);
    
    const enhancedRevisions = pendingRevisions.map(rev => ({
      _id: rev._id,
      questionId: rev.questionId,
      scheduledDate: toLocalISOString(rev.scheduledDate, timeZone),
      revisionIndex: rev.revisionIndex,
      overdue: rev.overdue,
      status: rev.overdue ? 'Overdue' : 'Pending'
    }));
    
    res.json(formatResponse('Today\'s pending revisions retrieved', {
      pendingRevisions: enhancedRevisions,
      stats,
    }));
  } catch (error) {
    next(error);
  }
};

const getUpcomingRevisions = async (req, res, next) => {
  try {
    const timeZone = getUserTimeZone(req);
    let startDate = req.query.startDate ? new Date(req.query.startDate) : getStartOfDay(new Date(), timeZone);
    let endDate = req.query.endDate ? new Date(req.query.endDate) : getEndOfDay(new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000), timeZone);
    
    const upcoming = await RevisionSchedule.aggregate([
      { $match: { userId: req.user._id, status: 'active' } },
      {
        $addFields: {
          pendingDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] }
        }
      },
      { $match: { pendingDue: { $gte: startDate, $lte: endDate } } },
      {
        $lookup: {
          from: 'questions',
          localField: 'questionId',
          foreignField: '_id',
          as: 'question'
        }
      },
      { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'userquestionprogresses',
          let: { uid: '$userId', qid: '$questionId' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$userId', '$$uid'] }, { $eq: ['$questionId', '$$qid'] } ] } } },
            { $limit: 1 }
          ],
          as: 'progress'
        }
      },
      { $unwind: { path: '$progress', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$pendingDue' } },
          date: { $first: '$pendingDue' },
          count: { $sum: 1 },
          questions: {
            $push: {
              _id: '$_id',
              questionId: {
                _id: '$question._id',
                platformQuestionId: '$question.platformQuestionId',
                title: '$question.title',
                platform: '$question.platform',
                difficulty: '$question.difficulty'
              },
              revisionIndex: '$currentRevisionIndex',
              scheduledDate: '$pendingDue',
              totalTimeSpent: { $ifNull: ['$progress.totalTimeSpent', 0] },
              attempts: { $ifNull: ['$progress.attempts.count', 0] },
              confidenceAfter: { $ifNull: ['$progress.confidenceLevel', null] }
            }
          }
        }
      },
      { $sort: { date: 1 } }
    ]);
    
    const now = new Date();
    const todayStart = getStartOfDay(now, timeZone);
    const todayEnd = getEndOfDay(now, timeZone);
    
    const convertedUpcoming = upcoming.map(group => ({
      ...group,
      date: toLocalISOString(group.date, timeZone),
      questions: group.questions.map(q => {
        const scheduledDateLocal = new Date(toLocalISOString(q.scheduledDate, timeZone));
        const isToday = scheduledDateLocal >= todayStart && scheduledDateLocal <= todayEnd;
        const status = isToday ? 'Pending' : 'Upcoming';
        return {
          ...q,
          scheduledDate: toLocalISOString(q.scheduledDate, timeZone),
          status
        };
      })
    }));
    
    const stats = await revisionService.calculateUpcomingStats(req.user._id, startDate, endDate);
    
    res.json(formatResponse('Upcoming revisions retrieved', {
      upcomingRevisions: convertedUpcoming,
      stats,
    }));
  } catch (error) {
    next(error);
  }
};

const getQuestionRevision = async (req, res, next) => {
  try {
    const timeZone = getUserTimeZone(req);
    const revision = await RevisionSchedule.findOne({
      userId: req.user._id,
      questionId: req.params.questionId,
    }).populate({
      path: 'questionId',
      select: 'platformQuestionId title difficulty platform', 
    });
    
    if (!revision) {
      throw new AppError('Revision schedule not found', 404);
    }
  
    const revObj = revision.toObject();
    revObj.currentStatus = revisionService.getRevisionStatusLabel(revision, null, 'actionable', timeZone);
    revObj.scheduleStatuses = revision.schedule.map((date, idx) => ({
      date,
      status: revisionService.getRevisionStatusLabel(revision, idx, 'display', timeZone)
    }));
    
    const convertedRev = convertRevisionDatesToLocal(revObj, timeZone);
    
    res.json(formatResponse('Revision schedule retrieved successfully', {
      revision: convertedRev,
    }));
  } catch (error) {
    next(error);
  }
};

const getQuestionRevisionByPlatform = async (req, res, next) => {
  try {
    const timeZone = getUserTimeZone(req);
    const { platform, platformQuestionId } = req.params;
    const question = await Question.findOne({ platform, platformQuestionId, isActive: true });
    if (!question) throw new AppError('Question not found', 404);

    const revision = await RevisionSchedule.findOne({
      userId: req.user._id,
      questionId: question._id,
    }).populate({
      path: 'questionId',
      select: 'platformQuestionId title difficulty platform', 
    });

    if (!revision) throw new AppError('Revision schedule not found', 404);

    const revObj = revision.toObject();
    revObj.currentStatus = revisionService.getRevisionStatusLabel(revision, null, 'actionable', timeZone);
    revObj.scheduleStatuses = revision.schedule.map((date, idx) => ({
      date,
      status: revisionService.getRevisionStatusLabel(revision, idx, 'display', timeZone)
    }));

    const convertedRev = convertRevisionDatesToLocal(revObj, timeZone);

    res.json(formatResponse('Revision schedule retrieved successfully', { revision: convertedRev }));
  } catch (error) {
    next(error);
  }
};

const createRevision = async (req, res, next) => {
  try {
    let { baseDate = new Date(), schedule } = req.body;
    const timeZone = getUserTimeZone(req);
    
    let baseDateObj;
    if (baseDate instanceof Date) {
      baseDateObj = baseDate;
    } else {
      baseDateObj = new Date(baseDate);
    }
    
    if (isNaN(baseDateObj.getTime())) {
      throw new AppError('Invalid baseDate format. Use ISO string like: 2026-02-01T08:00:00.000Z', 400);
    }
    
    const existing = await RevisionSchedule.findOne({
      userId: req.user._id,
      questionId: req.params.questionId,
    });
    
    if (existing) {
      throw new AppError('Revision schedule already exists for this question', 409);
    }
    
    const question = await Question.findById(req.params.questionId);
    if (!question) {
      throw new AppError('Question not found', 404);
    }

    const progress = await UserQuestionProgress.findOne({
      userId: req.user._id,
      questionId: req.params.questionId,
      status: { $in: ['Solved', 'Mastered'] }
    });
    if (!progress) {
      throw new AppError('Cannot create revision schedule for an unsolved question. Please solve it first.', 400);
    }
    
    const revision = await revisionService.createRevisionSchedule(
      req.user._id,
      req.params.questionId,
      baseDateObj,
      schedule,
      timeZone
    );
    
    await invalidateCache(`revisions:*:user:${req.user._id}:*`);
    
    res.status(201).json(formatResponse('Revision schedule created successfully', {
      revision,
    }));
  } catch (error) {
    console.error('DEBUG: Error in createRevision:', error);
    next(error);
  }
};

const completeRevision = async (req, res, next) => {
  try {
    const { revisionId } = req.params;
    const skipOverdue = req.query.skipOverdue === 'true';
    const allowOverdue = req.query.overdue === 'true';

    const revision = await RevisionSchedule.findOne({ _id: revisionId, userId: req.user._id });
    if (!revision) throw new AppError('Revision schedule not found', 404);

    const result = await revisionActivityService.checkAndCompleteRevision(
      req.user._id,
      revision.questionId,
      new Date(),
      'manual',
      { skipOverdue, allowOverdue }
    );

    if (!result.completed) {
      throw new AppError(result.message, 400);
    }

    if (jobQueue) {
      await jobQueue.add('confidence.increment', {
        userId: req.user._id,
        questionId: revision.questionId,
        action: 'revision_completed',
      });
    }

    res.json(formatResponse(result.message, {
      revisionCompleted: true,
      overdueCompleted: result.overdueCompleted || false,
      skippedCount: result.skippedCount || 0
    }));
  } catch (error) {
    next(error);
  }
};

const completeQuestionRevision = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const skipOverdue = req.query.skipOverdue === 'true';
    const allowOverdue = req.query.overdue === 'true';

    const result = await revisionActivityService.checkAndCompleteRevision(
      req.user._id,
      questionId,
      new Date(),
      'manual',
      { skipOverdue, allowOverdue }
    );

    if (!result.completed) {
      throw new AppError(result.message, 400);
    }

    if (jobQueue) {
      await jobQueue.add('confidence.increment', {
        userId: req.user._id,
        questionId,
        action: 'revision_completed',
      });
    }

    res.json(formatResponse(result.message, {
      revisionCompleted: true,
      overdueCompleted: result.overdueCompleted || false,
      skippedCount: result.skippedCount || 0
    }));
  } catch (error) {
    next(error);
  }
};

const completePastRevision = async (req, res, next) => {
  const lockKey = `lock:complete-past:user:${req.user._id}`;
  let lockAcquired = false;

  try {
    const { questionId } = req.params;
    const { date, confidence } = req.body;

    if (confidence !== undefined) {
      throw new AppError('Manual confidence update is not allowed. Confidence is automatically incremented.', 400);
    }
    if (!date) {
      throw new AppError('Date is required', 400);
    }
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new AppError('Invalid date format. Use ISO string or YYYY-MM-DD', 400);
    }

    const question = await Question.findById(questionId).select('title').lean();
    if (!question) {
      throw new AppError('Question not found', 404);
    }

    const lockValue = JSON.stringify({
      questionId,
      title: question.title,
      startedAt: new Date().toISOString(),
    });
    let lockSet = await redisClient.set(lockKey, lockValue, { NX: true });
    if (!lockSet) {
      const existingLockRaw = await redisClient.get(lockKey);
      let stale = false;
      let existingTitle = 'another question';
      if (existingLockRaw) {
        try {
          const existingLock = JSON.parse(existingLockRaw);
          existingTitle = existingLock.title || existingLock.questionId || 'another question';
          const startedAt = new Date(existingLock.startedAt);
          if (Date.now() - startedAt > 120000) stale = true;
        } catch (e) {}
      }
      if (stale) {
        await redisClient.set(lockKey, lockValue);
      } else {
        return res.status(409).json(formatResponse(
          `Another revision completion for "${existingTitle}" is already in progress. Please try again later.`,
          null,
          null,
          { code: 'CONCURRENT_OPERATION', currentQuestion: existingTitle }
        ));
      }
    }
    lockAcquired = true;

    let session;
    try {
      session = await revisionActivityService.getRevisionSession(req.user._id, questionId, targetDate);
      if (!session) {
        await revisionActivityService.startRevisionSession(req.user._id, questionId, targetDate);
        return res.status(202).json(formatResponse('Revision session started. Open the question page to track active time.', null));
      }
    } catch (err) {
      if (err.message === 'You already have an active revision session for another question. Please complete it first.') {
        return res.status(409).json(formatResponse(err.message, null, null, { code: 'ACTIVE_SESSION_EXISTS' }));
      }
      throw err;
    }

    const result = await revisionActivityService.completePastRevision(
      req.user._id,
      questionId,
      targetDate,
      confidence
    );

    if (!result.completed) {
      throw new AppError(result.message, 400);
    }

    if (jobQueue) {
      await jobQueue.add('confidence.increment', {
        userId: req.user._id,
        questionId,
        action: 'past_revision_completed',
      });
    }

    res.json(formatResponse(result.message, { revision: result.revision }));
  } catch (error) {
    next(error);
  } finally {
    if (lockAcquired) {
      await redisClient.del(lockKey);
    }
  }
};

const recordTimeSpent = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const { minutes } = req.body;
    const today = new Date();
    const timeZone = req.userTimeZone || 'UTC';

    // Update revision activity (Redis)
    await revisionActivityService.recordTimeSpent(req.user._id, questionId, today, minutes);

    // Update heatmap directly (time spent)
    try {
      await incrementDailyActivityDirect(req.user._id, today, timeZone, {
        totalTimeSpentMinutes: minutes
      });
    } catch (heatmapErr) {
      console.error('Failed to update heatmap time:', heatmapErr);
      // Don't fail the request – time already recorded in revision service
    }

    // Update UserQuestionProgress totalTimeSpent
    let progress = await UserQuestionProgress.findOne({
      userId: req.user._id,
      questionId
    });

    if (!progress) {
      progress = new UserQuestionProgress({
        userId: req.user._id,
        questionId,
        totalTimeSpent: minutes,
        status: 'Not Started',
      });
    } else {
      progress.totalTimeSpent += minutes;
    }

    const isTimeThresholdReached = progress.totalTimeSpent >= 20;
    const isNotSolved = progress.status !== 'Solved' && progress.status !== 'Mastered';
    if (isTimeThresholdReached && isNotSolved && progress.status === 'Not Started') {
      progress.status = 'Attempted';
    }

    await progress.save();

    // ========== NEW SYNC UPDATES ==========
    // 1. Update User.stats.totalTimeSpent
    await User.updateOne(
      { _id: req.user._id },
      { $inc: { 'stats.totalTimeSpent': minutes } }
    );

    // 2. Update streak and active days
    await updateUserActivity(req.user._id, today, timeZone);

    // ========== END NEW SYNC UPDATES ==========

    // Check any pending revision sessions (existing logic)
    const pattern = `revision:session:${req.user._id}:${questionId}:*`;
    let cursor = 0;
    let keys = [];
    do {
      const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      keys.push(...reply.keys);
    } while (cursor !== 0);

    let anyCompleted = false;
    for (const key of keys) {
      const parts = key.split(':');
      const targetDateStr = parts[parts.length - 1];
      if (targetDateStr) {
        const targetDate = new Date(targetDateStr);
        const completed = await revisionActivityService.addActiveSecondsToSession(
          req.user._id,
          questionId,
          targetDate,
          minutes * 60
        );
        if (completed) anyCompleted = true;
      }
    }

    if (anyCompleted && jobQueue) {
      await jobQueue.add('confidence.increment', {
        userId: req.user._id,
        questionId,
        action: 'active_time_reached',
      });
    }

    const revisionResult = await revisionActivityService.checkAndCompleteRevision(
      req.user._id,
      questionId,
      today,
      'auto'
    );

    if (revisionResult.completed) {
      if (jobQueue) {
        await jobQueue.add('confidence.increment', {
          userId: req.user._id,
          questionId,
          action: 'revision_completed_standard',
        });
      }
      return res.json(formatResponse(revisionResult.message, { revisionCompleted: true }));
    }

    res.json(formatResponse('Time recorded successfully', { minutes }));
  } catch (error) {
    next(error);
  }
};

const rescheduleRevision = async (req, res, next) => {
  try {
    const timeZone = getUserTimeZone(req);
    const { newDate } = req.body;
    // revisionIndex is accepted but ignored when all revisions are completed.
    // It is kept for backward compatibility with the frontend.

    if (!newDate) {
      throw new AppError('newDate is required', 400);
    }

    const revision = await RevisionSchedule.findOne({
      _id: req.params.revisionId,
      userId: req.user._id,
    });

    if (!revision) {
      throw new AppError('Revision schedule not found', 404);
    }

    // Check if all scheduled revisions have been completed.
    const allCompleted = revision.completedRevisions.length === revision.schedule.length;

    if (!allCompleted) {
      throw new AppError(
        'Cannot reschedule until all revisions (including overdue) are completed. ' +
        'Please complete all pending revisions first.',
        400
      );
    }

    // Generate new schedule based on the provided newDate (local date in user's timezone)
    const baseLocal = DateTime.fromJSDate(new Date(newDate), { zone: timeZone }).startOf('day');
    const scheduleUTC = constants.REVISION_SCHEDULE.map(days => {
      return baseLocal.plus({ days }).toUTC().toJSDate();
    });

    // Reset the revision schedule document
    revision.schedule = scheduleUTC;
    revision.baseDate = baseLocal.toUTC().toJSDate();
    revision.completedRevisions = [];
    revision.currentRevisionIndex = 0;
    revision.status = 'active';
    revision.overdueCount = 0;
    revision.overdueActive = false;
    revision.updatedAt = new Date();

    await revision.save();

    // Invalidate caches for the user's revisions
    await invalidateCache(`revisions:*:user:${req.user._id}:*`);

    res.json({
      success: true,
      statusCode: 200,
      message: 'Revision schedule has been reset and a new schedule created.',
      data: { revision },
      meta: { timestamp: new Date().toISOString() },
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

const deleteRevision = async (req, res, next) => {
  try {
    const revision = await RevisionSchedule.findOneAndDelete({
      _id: req.params.revisionId,
      userId: req.user._id,
    });
    
    if (!revision) {
      throw new AppError('Revision schedule not found', 404);
    }
    
    await invalidateCache(`revisions:*:user:${req.user._id}:*`);
    
    res.json(formatResponse('Revision schedule deleted successfully'));
  } catch (error) {
    next(error);
  }
};

const deleteQuestionRevision = async (req, res, next) => {
  try {
    const revision = await RevisionSchedule.findOneAndDelete({
      userId: req.user._id,
      questionId: req.params.questionId,
    });
    
    if (!revision) {
      throw new AppError('Revision schedule not found', 404);
    }
    
    await invalidateCache(`revisions:*:user:${req.user._id}:*`);
    
    res.json(formatResponse('Revision schedule deleted successfully'));
  } catch (error) {
    next(error);
  }
};

const fetchOverdueRevisionsForStats = async (userId, timeZone, limit = 50) => {
  const todayStart = getStartOfDay(new Date(), timeZone);
  const overdue = await RevisionSchedule.aggregate([
    { $match: { userId, status: { $in: ['active', 'overdue'] } } },
    {
      $addFields: {
        pendingDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] },
        alreadyCompleted: {
          $in: [
            { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] },
            '$completedRevisions.date'
          ]
        }
      }
    },
    { $match: { pendingDue: { $lt: todayStart }, alreadyCompleted: false } },
    { $sort: { pendingDue: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'questions',
        localField: 'questionId',
        foreignField: '_id',
        as: 'question'
      }
    },
    { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        questionId: '$question._id',
        platformQuestionId: '$question.platformQuestionId',
        title: { $ifNull: ['$question.title', 'Unknown'] },
        difficulty: '$question.difficulty',
        platform: '$question.platform',
        currentRevisionIndex: 1,
        nextRevisionDue: '$pendingDue',
        totalTimeSpent: { $ifNull: ['$progress.totalTimeSpent', 0] },
        confidenceLevel: { $arrayElemAt: ['$completedRevisions.confidenceAfter', -1] },
        status: { $literal: 'overdue' }
      }
    }
  ]);
  return overdue;
};

const fetchUpcomingRevisionsForStats = async (userId, timeZone, limit = 20) => {
  const startDate = getStartOfDay(new Date(), timeZone);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 30);
  endDate.setHours(23, 59, 59, 999);

  const upcoming = await RevisionSchedule.aggregate([
    { $match: { userId, status: 'active' } },
    {
      $addFields: {
        pendingDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] }
      }
    },
    { $match: { pendingDue: { $gte: startDate, $lte: endDate } } },
    { $sort: { pendingDue: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'questions',
        localField: 'questionId',
        foreignField: '_id',
        as: 'question'
      }
    },
    { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        questionId: '$question._id',
        platformQuestionId: '$question.platformQuestionId',
        title: { $ifNull: ['$question.title', 'Unknown'] },
        platform: '$question.platform',
        difficulty: '$question.difficulty',
        scheduledDate: '$pendingDue',
        revisionIndex: '$currentRevisionIndex',
        status: { $literal: 'Upcoming' }
      }
    }
  ]);
  return upcoming;
};

const getRevisionStats = async (req, res, next) => {
  try {
    const detailed = req.query.detailed === 'true';
    const timeZone = getUserTimeZone(req);
    
    let stats;
    if (detailed) {
      stats = await revisionService.getDetailedRevisionStats(req.user._id, timeZone);
      
      const [overdueRevisions, upcomingRevisions] = await Promise.all([
        fetchOverdueRevisionsForStats(req.user._id, timeZone, 5),
        fetchUpcomingRevisionsForStats(req.user._id, timeZone, 5)
      ]);
      if (stats.overdueRevisions) {
        stats.overdueRevisions = stats.overdueRevisions.map(rev => ({
          ...rev,
          nextRevisionDue: toLocalISOString(rev.nextRevisionDue, timeZone)
        }));
      }
      if (stats.upcomingRevisions) {
        stats.upcomingRevisions = stats.upcomingRevisions.map(rev => ({
          ...rev,
          scheduledDate: toLocalISOString(rev.scheduledDate, timeZone)
        }));
      }
      stats.overdueRevisions = overdueRevisions.map(rev => ({
        ...rev,
        nextRevisionDue: toLocalISOString(rev.nextRevisionDue, timeZone)
      }));
      stats.upcomingRevisions = upcomingRevisions.map(rev => ({
        ...rev,
        scheduledDate: toLocalISOString(rev.scheduledDate, timeZone)
      }));
    } else {
      stats = await revisionService.calculateRevisionStats(req.user._id);
    }
    
    res.json(formatResponse(
      detailed ? 'Detailed revision statistics retrieved' : 'Revision statistics retrieved',
      { stats }
    ));
  } catch (error) {
    next(error);
  }
};

const getOverdueRevisions = async (req, res, next) => {
  try {
    const timeZone = getUserTimeZone(req);
    const { page, limit, skip } = getPaginationParams(req);
    const today = getStartOfDay(new Date(), timeZone);
    
    const overdue = await RevisionSchedule.aggregate([
      { $match: { userId: req.user._id, status: { $in: ['active', 'overdue'] } } },
      {
        $addFields: {
          pendingDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] },
          alreadyCompleted: {
            $in: [
              { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] },
              '$completedRevisions.date'
            ]
          }
        }
      },
      { $match: { pendingDue: { $lt: today }, alreadyCompleted: false } },
      { $sort: { pendingDue: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'questions',
          localField: 'questionId',
          foreignField: '_id',
          as: 'question'
        }
      },
      { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'userquestionprogresses',
          let: { uid: '$userId', qid: '$questionId' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$userId', '$$uid'] }, { $eq: ['$questionId', '$$qid'] } ] } } },
            { $limit: 1 }
          ],
          as: 'progress'
        }
      },
      { $unwind: { path: '$progress', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          questionId: '$question._id',
          platformQuestionId: '$question.platformQuestionId',
          title: { $ifNull: ['$question.title', 'Unknown'] },
          platform: '$question.platform',
          difficulty: '$question.difficulty',
          tags: '$question.tags',
          scheduledDate: '$pendingDue',
          overdue: { $literal: true },
          currentRevisionIndex: 1,
          totalTimeSpent: { $ifNull: ['$progress.totalTimeSpent', 0] },
          confidenceAfter: { $ifNull: ['$progress.confidenceLevel', null] },
          attempts: { $ifNull: ['$progress.attempts.count', 0] }
        }
      }
    ]);
    
    const convertedOverdue = overdue.map(rev => ({
      ...rev,
      scheduledDate: toLocalISOString(rev.scheduledDate, timeZone)
    }));
    
    const totalResult = await RevisionSchedule.aggregate([
      { $match: { userId: req.user._id, status: { $in: ['active', 'overdue'] } } },
      {
        $addFields: {
          pendingDue: { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] },
          alreadyCompleted: {
            $in: [
              { $arrayElemAt: ['$schedule', '$currentRevisionIndex'] },
              '$completedRevisions.date'
            ]
          }
        }
      },
      { $match: { pendingDue: { $lt: today }, alreadyCompleted: false } },
      { $count: 'count' }
    ]);
    const totalCount = totalResult[0]?.count || 0;
    
    res.json(formatResponse('Overdue revisions retrieved', {
      revisions: convertedOverdue,
    }, {
      pagination: paginate(totalCount, page, limit),
    }));
  } catch (error) {
    next(error);
  }
};

const getDetailedRevisionStats = async (req, res, next) => {
  req.query.detailed = 'true';
  return getRevisionStats(req, res, next);
};

module.exports = {
  getRevisions,
  getTodayRevisions,
  getUpcomingRevisions,
  getQuestionRevision,
  getQuestionRevisionByPlatform,
  createRevision,
  completeRevision,
  completeQuestionRevision,
  completePastRevision,
  recordTimeSpent,
  rescheduleRevision,
  deleteRevision,
  deleteQuestionRevision,
  getRevisionStats,
  getOverdueRevisions,
  getDetailedRevisionStats,
  calculateSpacedRepetitionSchedule,
};