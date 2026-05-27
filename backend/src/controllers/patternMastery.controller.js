const mongoose = require('mongoose');
const PatternMastery = require('../models/PatternMastery');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const Question = require('../models/Question');
const { formatResponse } = require('../utils/helpers/response');
const { getPaginationParams, paginate } = require('../utils/helpers/pagination');
const { getStartOfDay, getEndOfDay, getDaysBetween } = require('../utils/helpers/date');
const { slugify } = require('../utils/helpers/string');
const AppError = require('../utils/errors/AppError');
const { invalidateCache } = require('../middleware/cache');

/**
 * Generate a default pattern mastery object for a user who has no progress in that pattern.
 * This object is NOT saved to the database – only returned in responses.
 */
const getDefaultPatternMastery = (userId, patternName) => {
  const patternSlug = slugify(patternName);
  const now = new Date();
  return {
    _id: null,
    userId: userId,
    patternName: patternName,
    patternSlug: patternSlug,
    solvedCount: 0,
    masteredCount: 0,
    totalAttempts: 0,
    successfulAttempts: 0,
    successRate: 0,
    masteryRate: 0,
    confidenceLevel: 1,
    totalTimeSpent: 0,
    averageTimePerQuestion: 0,
    lastPracticed: null,
    lastUpdated: now,
    recentQuestions: [],
    difficultyBreakdown: {
      easy: { solved: 0, mastered: 0, totalTime: 0 },
      medium: { solved: 0, mastered: 0, totalTime: 0 },
      hard: { solved: 0, mastered: 0, totalTime: 0 }
    },
    platformDistribution: {
      LeetCode: 0,
      HackerRank: 0,
      CodeForces: 0,
      Other: 0
    },
    trend: {
      last7Days: { solved: 0, mastered: 0, successRate: 0 },
      last30Days: { solved: 0, mastered: 0, successRate: 0 },
      improvementRate: 0
    },
    createdAt: now,
    updatedAt: now,
    visibility: 'public',
    description: `Problems using the ${patternName} pattern`,
    title: patternName,
    tags: []
  };
};

const getPatternMasteryList = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { minConfidence, maxConfidence, minSolved, minMasteryRate, sortBy = 'confidenceLevel', sortOrder = 'desc', search } = req.query;
    const query = { userId: req.user._id };
    
    if (minConfidence) query.confidenceLevel = { $gte: parseInt(minConfidence) };
    if (maxConfidence) query.confidenceLevel = { ...query.confidenceLevel, $lte: parseInt(maxConfidence) };
    if (minSolved) query.solvedCount = { $gte: parseInt(minSolved) };
    if (minMasteryRate) query.masteryRate = { $gte: parseFloat(minMasteryRate) };
    if (search) query.patternName = { $regex: search, $options: 'i' };
    
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const [patterns, total] = await Promise.all([
      PatternMastery.find(query).sort(sort).skip(skip).limit(limit).lean(),
      PatternMastery.countDocuments(query)
    ]);
    
    res.json(formatResponse('Pattern mastery list retrieved', { patterns }, { pagination: paginate(total, page, limit) }));
  } catch (error) { next(error); }
};

const getPatternMastery = async (req, res, next) => {
  try {
    let rawPatternName = req.params.patternName;
    if (!rawPatternName) {
      throw new AppError('Pattern name is required', 400);
    }
    
    const patternSlug = slugify(rawPatternName);
    
    let pattern = await PatternMastery.findOne({
      userId: req.user._id,
      patternSlug: patternSlug
    }).lean();
    
    if (!pattern) {
      pattern = await PatternMastery.findOne({
        userId: req.user._id,
        patternName: rawPatternName
      }).lean();
    }
    
    // If still not found, return a default object (all zeros) instead of 404
    if (!pattern) {
      pattern = getDefaultPatternMastery(req.user._id, rawPatternName);
      // For default object, no need to populate recentQuestions (empty array)
      return res.json(formatResponse('Pattern mastery retrieved', { pattern }));
    }

    // For existing pattern, populate platformQuestionId for recentQuestions if missing
    if (pattern.recentQuestions && pattern.recentQuestions.length > 0) {
      const missingIds = pattern.recentQuestions
        .filter(rq => !rq.platformQuestionId && rq.questionId)
        .map(rq => rq.questionId);
      
      if (missingIds.length > 0) {
        const questions = await Question.find(
          { _id: { $in: missingIds } },
          { _id: 1, platformQuestionId: 1 }
        ).lean();
        
        const platformIdMap = new Map(
          questions.map(q => [q._id.toString(), q.platformQuestionId])
        );
        
        pattern.recentQuestions = pattern.recentQuestions.map(rq => {
          if (!rq.platformQuestionId && rq.questionId) {
            const qid = rq.questionId.toString();
            if (platformIdMap.has(qid)) {
              rq.platformQuestionId = platformIdMap.get(qid);
            }
          }
          return rq;
        });
      }
    }
    
    res.json(formatResponse('Pattern mastery retrieved', { pattern }));
  } catch (error) { next(error); }
};

const getPatternStats = async (req, res, next) => {
  try {
    const patterns = await PatternMastery.find({ userId: req.user._id }).lean();
    
    const stats = {
      totalPatterns: patterns.length,
      totalSolved: patterns.reduce((sum, p) => sum + p.solvedCount, 0),
      totalMastered: patterns.reduce((sum, p) => sum + p.masteredCount, 0),
      averageConfidence: patterns.length ? patterns.reduce((sum, p) => sum + p.confidenceLevel, 0) / patterns.length : 0,
      averageMasteryRate: patterns.length ? patterns.reduce((sum, p) => sum + p.masteryRate, 0) / patterns.length : 0,
      strongestPattern: patterns.length ? patterns.reduce((a, b) => a.masteryRate > b.masteryRate ? a : b) : null,
      weakestPattern: patterns.length ? patterns.reduce((a, b) => a.masteryRate < b.masteryRate ? a : b) : null,
      patternsByConfidence: {
        1: patterns.filter(p => p.confidenceLevel === 1).length,
        2: patterns.filter(p => p.confidenceLevel === 2).length,
        3: patterns.filter(p => p.confidenceLevel === 3).length,
        4: patterns.filter(p => p.confidenceLevel === 4).length,
        5: patterns.filter(p => p.confidenceLevel === 5).length
      }
    };
    
    res.json(formatResponse('Pattern mastery stats retrieved', { stats }));
  } catch (error) { next(error); }
};

const getRecommendations = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const focus = req.query.focus || 'weakest';
    
    const patterns = await PatternMastery.find({ userId: req.user._id }).lean();
    
    let recommendations = [];
    if (focus === 'weakest') {
      recommendations = patterns
        .sort((a, b) => a.confidenceLevel - b.confidenceLevel || a.masteryRate - b.masteryRate)
        .slice(0, limit);
    } else if (focus === 'needsPractice') {
      recommendations = patterns
        .filter(p => p.lastPracticed && getDaysBetween(p.lastPracticed, new Date()) > 7)
        .sort((a, b) => getDaysBetween(a.lastPracticed, new Date()) - getDaysBetween(b.lastPracticed, new Date()))
        .slice(0, limit);
    } else if (focus === 'highestPotential') {
      recommendations = patterns
        .filter(p => p.solvedCount > 0 && p.masteryRate < 50)
        .sort((a, b) => (b.solvedCount - a.solvedCount) || (b.masteryRate - a.masteryRate))
        .slice(0, limit);
    }
    
    res.json(formatResponse('Pattern recommendations retrieved', { recommendations }));
  } catch (error) { next(error); }
};

const getWeakestPatterns = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const metric = req.query.metric || 'confidence';
    
    let patterns = await PatternMastery.find({ userId: req.user._id }).lean();
    
    let weakest = [];
    if (metric === 'confidence') {
      weakest = patterns.sort((a, b) => a.confidenceLevel - b.confidenceLevel).slice(0, limit);
    } else if (metric === 'masteryRate') {
      weakest = patterns.sort((a, b) => a.masteryRate - b.masteryRate).slice(0, limit);
    } else if (metric === 'lastPracticed') {
      weakest = patterns
        .sort((a, b) => new Date(a.lastPracticed || 0) - new Date(b.lastPracticed || 0))
        .slice(0, limit);
    }

    // Ensure platformQuestionId is present in recentQuestions
    for (const pattern of weakest) {
      if (pattern.recentQuestions && pattern.recentQuestions.length > 0) {
        const missingIds = pattern.recentQuestions
          .filter(rq => !rq.platformQuestionId && rq.questionId)
          .map(rq => rq.questionId);
        
        if (missingIds.length > 0) {
          const questions = await Question.find(
            { _id: { $in: missingIds } },
            { _id: 1, platformQuestionId: 1 }
          ).lean();
          
          const platformIdMap = new Map(
            questions.map(q => [q._id.toString(), q.platformQuestionId])
          );
          
          pattern.recentQuestions = pattern.recentQuestions.map(rq => {
            if (!rq.platformQuestionId && rq.questionId) {
              const qid = rq.questionId.toString();
              if (platformIdMap.has(qid)) {
                rq.platformQuestionId = platformIdMap.get(qid);
              }
            }
            return rq;
          });
        }
      }
    }
    
    res.json(formatResponse('Weakest patterns retrieved', { weakest }));
  } catch (error) { next(error); }
};

const getStrongestPatterns = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const metric = req.query.metric || 'confidence';
    
    let patterns = await PatternMastery.find({ userId: req.user._id }).lean();
    
    let strongest = [];
    if (metric === 'confidence') {
      strongest = patterns.sort((a, b) => b.confidenceLevel - a.confidenceLevel).slice(0, limit);
    } else if (metric === 'masteryRate') {
      strongest = patterns.sort((a, b) => b.masteryRate - a.masteryRate).slice(0, limit);
    } else if (metric === 'lastPracticed') {
      strongest = patterns
        .filter(p => p.lastPracticed)
        .sort((a, b) => new Date(b.lastPracticed) - new Date(a.lastPracticed))
        .slice(0, limit);
    }

    // Ensure platformQuestionId is present in recentQuestions
    for (const pattern of strongest) {
      if (pattern.recentQuestions && pattern.recentQuestions.length > 0) {
        const missingIds = pattern.recentQuestions
          .filter(rq => !rq.platformQuestionId && rq.questionId)
          .map(rq => rq.questionId);
        
        if (missingIds.length > 0) {
          const questions = await Question.find(
            { _id: { $in: missingIds } },
            { _id: 1, platformQuestionId: 1 }
          ).lean();
          
          const platformIdMap = new Map(
            questions.map(q => [q._id.toString(), q.platformQuestionId])
          );
          
          pattern.recentQuestions = pattern.recentQuestions.map(rq => {
            if (!rq.platformQuestionId && rq.questionId) {
              const qid = rq.questionId.toString();
              if (platformIdMap.has(qid)) {
                rq.platformQuestionId = platformIdMap.get(qid);
              }
            }
            return rq;
          });
        }
      }
    }
    
    res.json(formatResponse('Strongest patterns retrieved', { strongest }));
  } catch (error) { next(error); }
};

const getPatternProgress = async (req, res, next) => {
  try {
    const { patternName, startDate, endDate, period = 'month' } = req.query;
    const query = { userId: req.user._id };
    if (patternName) query.patternName = patternName;
    
    const patterns = await PatternMastery.find(query).lean();
    
    const now = new Date();
    let progressData = [];
    
    patterns.forEach(pattern => {
      const progress = {
        patternName: pattern.patternName,
        solvedCount: pattern.solvedCount,
        masteredCount: pattern.masteredCount,
        masteryRate: pattern.masteryRate,
        confidenceLevel: pattern.confidenceLevel,
        lastPracticed: pattern.lastPracticed,
        trend: pattern.trend
      };
      
      if (period === 'week') {
        progress.weeklyChange = pattern.trend.last7Days.improvementRate;
      } else if (period === 'month') {
        progress.monthlyChange = pattern.trend.last30Days.improvementRate;
      }
      
      progressData.push(progress);
    });
    
    res.json(formatResponse('Pattern progress retrieved', { progress: progressData }));
  } catch (error) { next(error); }
};

const syncPatternMastery = async (userId, questionProgress) => {
  try {
    const question = await Question.findById(questionProgress.questionId);
    if (!question || !question.pattern) return;
    
    const patternName = question.pattern;
    let patternMastery = await PatternMastery.findOne({ userId, patternName });
    
    if (!patternMastery) {
      patternMastery = new PatternMastery({
        userId,
        patternName,
        patternSlug: slugify(patternName),
        solvedCount: 0,
        masteredCount: 0,
        totalAttempts: 0,
        successfulAttempts: 0,
        confidenceLevel: 1,
        lastPracticed: new Date()
      });
    }
    
    const patternProgress = await UserQuestionProgress.find({
      userId,
      questionId: { $in: await Question.find({ pattern: patternName }).distinct('_id') }
    }).populate('questionId');
    
    const solvedProgress = patternProgress.filter(p => p.status === 'Solved' || p.status === 'Mastered');
    const masteredProgress = patternProgress.filter(p => p.status === 'Mastered');
    
    patternMastery.solvedCount = solvedProgress.length;
    patternMastery.masteredCount = masteredProgress.length;
    patternMastery.totalAttempts = patternProgress.reduce((sum, p) => sum + (p.attempts?.count || 0), 0);
    patternMastery.successfulAttempts = solvedProgress.length;
    patternMastery.totalTimeSpent = patternProgress.reduce((sum, p) => sum + (p.totalTimeSpent || 0), 0);
    
    patternMastery.successRate = patternMastery.totalAttempts > 0
      ? (patternMastery.successfulAttempts / patternMastery.totalAttempts) * 100
      : 0;
    
    const totalPatternQuestions = await Question.countDocuments({ pattern: patternName });
    patternMastery.masteryRate = totalPatternQuestions > 0
      ? (patternMastery.masteredCount / totalPatternQuestions) * 100
      : 0;
    
    patternMastery.averageTimePerQuestion = patternMastery.solvedCount > 0
      ? patternMastery.totalTimeSpent / patternMastery.solvedCount
      : 0;
    
    patternMastery.lastPracticed = new Date();
    patternMastery.lastUpdated = new Date();
    
    await patternMastery.save();
    await invalidateCache(`pattern-mastery:*:user:${userId}:*`);
    
    return patternMastery;
  } catch (error) {
    console.error('Pattern mastery sync error:', error);
  }
};

const getUserPatternMastery = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sort = req.query.sort || '-confidenceLevel';
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    const query = { userId };

    const [patterns, total] = await Promise.all([
      PatternMastery.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      PatternMastery.countDocuments(query)
    ]);

    res.json(formatResponse(
      'User pattern mastery retrieved',
      { patterns },
      { pagination: paginate(total, page, limit) }
    ));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPatternMasteryList,
  getPatternMastery,
  getPatternStats,
  getRecommendations,
  getWeakestPatterns,
  getStrongestPatterns,
  getPatternProgress,
  syncPatternMastery,
  getUserPatternMastery
};