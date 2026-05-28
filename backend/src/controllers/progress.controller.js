const UserQuestionProgress = require('../models/UserQuestionProgress');
const Question = require('../models/Question');
const progressService = require('../services/progress.service');
const patternMasteryService = require('../services/patternMastery.service');
const { formatResponse } = require('../utils/helpers/response');
const { getPaginationParams, paginate } = require('../utils/helpers/pagination');
const { getStartOfDay, getEndOfDay } = require('../utils/helpers/date');
const AppError = require('../utils/errors/AppError');
const { invalidateProgressCache, invalidateCache, invalidateDashboardCache } = require('../middleware/cache');
const { jobQueue } = require('../services/queue.service');
const { incrementDailyActivityDirect } = require('../services/heatmap.service');

const updateProgressPatternMastery = async (userId, questionId) => {
  try {
    const progress = await UserQuestionProgress.findOne({ userId, questionId });
    if (progress) {
      await patternMasteryService.updatePatternMasteryFromProgress(userId, progress._id);
    }
  } catch (error) {
    console.error('Pattern mastery sync failed:', error);
  }
};

const invalidateQuestionDetailsCache = async (userId, questionId) => {
  await invalidateCache(`question-details:user:${userId}:*/questions/${questionId}/details`);
  await invalidateCache(`question-details:platform:*`);
};

const getProgress = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, questionId, sortBy, sortOrder, minConfidence, maxConfidence } = req.query;
    const query = { userId: req.user._id };
    
    if (status) query.status = status;
    if (questionId) query.questionId = questionId;
    if (minConfidence || maxConfidence) {
      query.confidenceLevel = {};
      if (minConfidence) query.confidenceLevel.$gte = parseInt(minConfidence);
      if (maxConfidence) query.confidenceLevel.$lte = parseInt(maxConfidence);
    }

    const sort = {};
    if (sortBy === 'attempts') sort['attempts.count'] = sortOrder === 'asc' ? 1 : -1;
    else sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [progress, total] = await Promise.all([
      UserQuestionProgress.find(query)
        .populate('questionId', '_id title problemLink platform platformQuestionId difficulty tags pattern')
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .select('-__v')
        .lean(),
      UserQuestionProgress.countDocuments(query)
    ]);

    res.json(formatResponse('Progress records retrieved successfully', { progress }, { pagination: paginate(total, page, limit) }));
  } catch (error) { next(error); }
};

const getQuestionProgress = async (req, res, next) => {
  try {
    const progress = await UserQuestionProgress.findOne({
      userId: req.user._id,
      questionId: req.params.questionId
    }).select('-__v').lean();

    if (!progress) throw new AppError('Progress record not found', 404);
    res.json(formatResponse('Question progress retrieved successfully', { progress }));
  } catch (error) { next(error); }
};

const createOrUpdateProgress = async (req, res, next) => {
  try {
    const { status, notes, keyInsights, savedCode, timeSpent } = req.body;
    const userId = req.user._id;
    const questionId = req.params.questionId;

    if (status === 'Mastered') {
      throw new AppError('Mastered status is automatically assigned and cannot be set manually', 400);
    }

    const question = await Question.findById(questionId);
    if (!question) throw new AppError('Question not found', 404);

    let progress = await UserQuestionProgress.findOne({ userId, questionId });
    const oldStatus = progress ? progress.status : null;

    const updateData = {
      updatedAt: new Date()
    };
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (keyInsights !== undefined) updateData.keyInsights = keyInsights;
    if (savedCode) updateData.savedCode = { ...savedCode, lastUpdated: new Date() };
    if (req.body.personalDifficulty !== undefined) updateData.personalDifficulty = req.body.personalDifficulty;
    if (req.body.personalContentRef !== undefined) updateData.personalContentRef = req.body.personalContentRef;

    if (status === 'Solved' && (!progress || progress.status !== 'Solved')) {
      updateData['attempts.solvedAt'] = new Date();
    }

    if (timeSpent) {
      updateData.$inc = { totalTimeSpent: timeSpent };
    }

    let newProgress;
    if (progress) {
      newProgress = await UserQuestionProgress.findOneAndUpdate(
        { userId, questionId },
        updateData,
        { new: true }
      );
    } else {
      const attemptData = { count: 0 };
      if (status && status !== 'Not Started') {
        attemptData.firstAttemptAt = new Date();
        attemptData.lastAttemptAt = new Date();
        attemptData.count = 1;
        if (status === 'Solved') {
          attemptData.solvedAt = new Date();
        }
      }
      newProgress = await UserQuestionProgress.create({
        userId,
        questionId,
        status: status || 'Not Started',
        attempts: attemptData,
        notes,
        keyInsights,
        savedCode: savedCode ? { ...savedCode, lastUpdated: new Date() } : undefined,
        totalTimeSpent: timeSpent || 0,
        personalDifficulty: req.body.personalDifficulty,
      });
    }

    if (newProgress) {
      if (status === 'Solved' && oldStatus !== 'Solved') {
        if (jobQueue) {
          await jobQueue.add('question.solved', {
            userId,
            questionId,
            progressId: newProgress._id,
            timeSpent: timeSpent || 0,
            solvedAt: new Date(),
          });
        }
      }
    }

    await invalidateProgressCache(userId);
    await invalidateQuestionDetailsCache(userId, questionId);
    await invalidateDashboardCache(userId);
    await updateProgressPatternMastery(userId, questionId);

    const statusCode = newProgress.createdAt === newProgress.updatedAt ? 201 : 200;
    res.status(statusCode).json(formatResponse(
      newProgress.createdAt === newProgress.updatedAt ? 'Progress created successfully' : 'Progress updated successfully',
      { progress: newProgress }
    ));
  } catch (error) {
    console.error('[createOrUpdateProgress] Error:', error);
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (status === 'Mastered') {
      throw new AppError('Mastered status is automatically assigned and cannot be set manually', 400);
    }

    const userId = req.user._id;
    const questionId = req.params.questionId;

    const oldProgress = await UserQuestionProgress.findOne({ userId, questionId });
    const oldStatus = oldProgress ? oldProgress.status : null;

    const progress = await UserQuestionProgress.findOneAndUpdate(
      { userId, questionId },
      {
        $set: {
          status: req.body.status,
          updatedAt: new Date()
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (req.body.status === 'Solved' && oldStatus !== 'Solved') {
      if (jobQueue) {
        await jobQueue.add('question.solved', {
          userId,
          questionId,
          progressId: progress._id,
          timeSpent: 0,
          solvedAt: new Date()
        });
      }
    }

    await invalidateProgressCache(userId);
    await invalidateQuestionDetailsCache(userId, questionId);
    await invalidateDashboardCache(userId);
    await updateProgressPatternMastery(userId, questionId);

    res.json(formatResponse('Status updated successfully', { progress }));
  } catch (error) {
    next(error);
  }
};

const updateCode = async (req, res, next) => {
  try {
    const { language, code } = req.body;
    const userId = req.user._id;
    const questionId = req.params.questionId;
    
    const progress = await UserQuestionProgress.findOneAndUpdate(
      { userId, questionId },
      {
        $set: {
          savedCode: { language, code, lastUpdated: new Date() },
          updatedAt: new Date()
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await invalidateProgressCache(userId);
    await invalidateQuestionDetailsCache(userId, questionId);
    await invalidateDashboardCache(userId);
    await updateProgressPatternMastery(userId, questionId);

    res.json(formatResponse('Code updated successfully', { progress }));
  } catch (error) { next(error); }
};

const updateNotes = async (req, res, next) => {
  try {
    const { notes, keyInsights } = req.body;
    const userId = req.user._id;
    const questionId = req.params.questionId;
    
    const updateData = { updatedAt: new Date() };
    if (notes !== undefined) updateData.notes = notes;
    if (keyInsights !== undefined) updateData.keyInsights = keyInsights;
    
    const progress = await UserQuestionProgress.findOneAndUpdate(
      { userId, questionId },
      { $set: updateData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await invalidateProgressCache(userId);
    await invalidateQuestionDetailsCache(userId, questionId);
    await invalidateDashboardCache(userId);
    await updateProgressPatternMastery(userId, questionId);

    res.json(formatResponse('Notes updated successfully', { progress }));
  } catch (error) { next(error); }
};

const updateConfidence = async (req, res, next) => {
  next(new AppError('Confidence level is automatically calculated and cannot be set manually', 400));
};

const recordAttempt = async (req, res, next) => {
  try {
    const { timeSpent, successful } = req.body;
    const userId = req.user._id;
    const questionId = req.params.questionId;
    const timeZone = req.userTimeZone || 'UTC';

    const update = {
      $inc: { 'attempts.count': 1, totalTimeSpent: timeSpent },
      $set: { 
        'attempts.lastAttemptAt': new Date(),
        updatedAt: new Date()
      }
    };

    if (successful) {
      update.$set.status = 'Solved';
      update.$set['attempts.solvedAt'] = new Date();
    } else {
      update.$set.status = 'Attempted';
    }

    const progress = await UserQuestionProgress.findOneAndUpdate(
      { userId, questionId },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!progress.attempts.firstAttemptAt) {
      progress.attempts.firstAttemptAt = new Date();
      await progress.save();
    }

    // Update heatmap directly
    const activityDate = new Date();
    await incrementDailyActivityDirect(userId, activityDate, timeZone, {
      totalActivities: 1,
      totalSubmissions: 1,
      totalTimeSpentMinutes: timeSpent,
    });

    if (jobQueue) {
      if (successful) {
        await jobQueue.add('question.solved', {
          userId,
          questionId,
          progressId: progress._id,
          timeSpent,
          solvedAt: new Date(),
        });
      } else {
         await jobQueue.add('question.attempted', {
          userId,
          questionId,
          progressId: progress._id,
          timeSpent,
          attemptedAt: new Date(),
        });
      }
    }

    await invalidateProgressCache(userId);
    await invalidateQuestionDetailsCache(userId, questionId);
    await invalidateDashboardCache(userId);
    await updateProgressPatternMastery(userId, questionId);

    res.json(formatResponse('Attempt recorded successfully', { progress }));
  } catch (error) {
    next(error);
  }
};

const recordRevision = async (req, res, next) => {
  try {
    const { timeSpent } = req.body;
    const userId = req.user._id;
    const questionId = req.params.questionId;
    const timeZone = req.userTimeZone || 'UTC';
    
    const update = {
      $inc: { revisionCount: 1, totalTimeSpent: timeSpent },
      $set: { 
        lastRevisedAt: new Date(),
        updatedAt: new Date()
      }
    };

    const progress = await UserQuestionProgress.findOneAndUpdate(
      { userId, questionId },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Update heatmap directly
    const activityDate = new Date();
    await incrementDailyActivityDirect(userId, activityDate, timeZone, {
      totalActivities: 1,
      totalSubmissions: 1,
      revisionProblems: 1,
      totalTimeSpentMinutes: timeSpent,
    });

    await invalidateProgressCache(userId);
    await invalidateQuestionDetailsCache(userId, questionId);
    await invalidateDashboardCache(userId);
    await updateProgressPatternMastery(userId, questionId);

    res.json(formatResponse('Revision recorded successfully', { progress }));
  } catch (error) { next(error); }
};

const deleteProgress = async (req, res, next) => {
  try {
    const progress = await UserQuestionProgress.findOneAndDelete({
      userId: req.user._id,
      questionId: req.params.questionId
    });

    if (!progress) throw new AppError('Progress record not found', 404);

    await invalidateProgressCache(req.user._id);
    await invalidateQuestionDetailsCache(req.user._id, req.params.questionId);
    await invalidateDashboardCache(req.user._id);
    await patternMasteryService.updatePatternMasteryFromProgress(req.user._id, progress._id);

    res.json(formatResponse('Progress deleted successfully'));
  } catch (error) { next(error); }
};

const getProgressStats = async (req, res, next) => {
  try {
    const stats = await progressService.calculateProgressStats(req.user._id);
    res.json(formatResponse('Progress statistics retrieved successfully', { stats }));
  } catch (error) { next(error); }
};

const getRecentProgress = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const progress = await progressService.getUserRecentProgress(req.user._id, limit);
    res.json(formatResponse('Recent progress retrieved successfully', { progress }));
  } catch (error) { next(error); }
};

const getQuestionsByPersonalDifficulty = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page, limit, skip } = getPaginationParams(req);
    const { sortOrder, personalDifficulty: filterDifficulty } = req.query;

    const query = { userId };
    if (filterDifficulty) {
      query.personalDifficulty = filterDifficulty;
    }

    const sort = { personalDifficulty: sortOrder === 'asc' ? 1 : -1 };

    const [progressRecords, total] = await Promise.all([
      UserQuestionProgress.find(query)
        .populate({
          path: 'questionId',
          select: '_id title problemLink platform difficulty tags pattern',
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      UserQuestionProgress.countDocuments(query),
    ]);

    const questions = progressRecords.map(record => ({
      question: record.questionId,
      personalDifficulty: record.personalDifficulty,
      status: record.status,
      confidenceLevel: record.confidenceLevel,
    }));

    res.json(formatResponse(
      'Questions sorted by personal difficulty retrieved',
      { questions },
      { pagination: paginate(total, page, limit) }
    ));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProgress,
  getQuestionProgress,
  createOrUpdateProgress,
  updateStatus,
  updateCode,
  updateNotes,
  updateConfidence,
  recordAttempt,
  recordRevision,
  deleteProgress,
  getProgressStats,
  getRecentProgress,
  getQuestionsByPersonalDifficulty
};