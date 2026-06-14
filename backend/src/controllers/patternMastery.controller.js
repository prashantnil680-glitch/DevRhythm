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
 * Compute confidence level from solvedCount.
 * Formula: 1 + floor(solvedCount / 5), capped at 5.
 */
const computeConfidence = (solvedCount) => {
  return Math.min(5, 1 + Math.floor((solvedCount || 0) / 5));
};

/**
 * Generate a default pattern mastery object for a user who has no progress in that pattern.
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
    
    // For confidence-based sorting, we need to compute confidence after fetching all matching patterns
    if (sortBy === 'confidenceLevel') {
      // Fetch all matching patterns (no pagination yet)
      let allPatterns = await PatternMastery.find(query).lean();
      
      // Override confidenceLevel with computed value from solvedCount
      allPatterns = allPatterns.map(p => ({
        ...p,
        confidenceLevel: computeConfidence(p.solvedCount)
      }));
      
      // Apply filters on computed confidence if minConfidence/maxConfidence provided
      if (minConfidence || maxConfidence) {
        allPatterns = allPatterns.filter(p => {
          if (minConfidence && p.confidenceLevel < minConfidence) return false;
          if (maxConfidence && p.confidenceLevel > maxConfidence) return false;
          return true;
        });
      }
      
      // Sort by confidence (and secondary by solvedCount for consistency)
      const sortOrderMultiplier = sortOrder === 'desc' ? -1 : 1;
      allPatterns.sort((a, b) => {
        if (a.confidenceLevel !== b.confidenceLevel) {
          return (a.confidenceLevel - b.confidenceLevel) * sortOrderMultiplier;
        }
        return (a.solvedCount - b.solvedCount) * sortOrderMultiplier;
      });
      
      const total = allPatterns.length;
      const paginatedPatterns = allPatterns.slice(skip, skip + limit);
      
      // Populate platformQuestionId in recentQuestions
      for (const pattern of paginatedPatterns) {
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
      
      res.json(formatResponse('Pattern mastery list retrieved', { patterns: paginatedPatterns }, { pagination: paginate(total, page, limit) }));
      return;
    }
    
    // For all other sort fields, use database sorting (fields already indexed)
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    let patterns = await PatternMastery.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Override confidenceLevel with computed value from solvedCount
    patterns = patterns.map(p => ({
      ...p,
      confidenceLevel: computeConfidence(p.solvedCount)
    }));
    
    // Populate platformQuestionId in recentQuestions
    for (const pattern of patterns) {
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
    
    const total = await PatternMastery.countDocuments(query);
    res.json(formatResponse('Pattern mastery list retrieved', { patterns }, { pagination: paginate(total, page, limit) }));
  } catch (error) { next(error); }
};

const getPatternMastery = async (req, res, next) => {
  try {
    let rawPatternName = req.params.patternName;
    if (!rawPatternName) throw new AppError('Pattern name is required', 400);
    
    const patternSlug = slugify(rawPatternName);
    let pattern = await PatternMastery.findOne({ userId: req.user._id, patternSlug }).lean();
    if (!pattern) {
      pattern = await PatternMastery.findOne({ userId: req.user._id, patternName: rawPatternName }).lean();
    }
    
    if (!pattern) {
      pattern = getDefaultPatternMastery(req.user._id, rawPatternName);
      return res.json(formatResponse('Pattern mastery retrieved', { pattern }));
    }

    // Override confidenceLevel
    pattern.confidenceLevel = computeConfidence(pattern.solvedCount);

    // Populate platformQuestionId in recentQuestions
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
    const userId = req.user._id;

    // Get all pattern mastery documents for the user
    let patterns = await PatternMastery.find({ userId }).lean();

    // Recompute confidence for all patterns based on solvedCount
    patterns = patterns.map(p => ({
      ...p,
      confidenceLevel: computeConfidence(p.solvedCount)
    }));

    const totalPatterns = patterns.length;
    
    // ✅ CORRECT: Count distinct solved questions (unique question IDs)
    const uniqueSolvedQuestions = await UserQuestionProgress.distinct('questionId', {
      userId,
      status: { $in: ['Solved', 'Mastered'] }
    });
    const totalSolved = uniqueSolvedQuestions.length;

    const totalMastered = patterns.reduce((sum, p) => sum + p.masteredCount, 0);
    const averageConfidence = totalPatterns
      ? patterns.reduce((sum, p) => sum + p.confidenceLevel, 0) / totalPatterns
      : 0;
    const averageMasteryRate = totalPatterns
      ? patterns.reduce((sum, p) => sum + p.masteryRate, 0) / totalPatterns
      : 0;

    // Determine strongest pattern: highest masteryRate, then solvedCount
    let strongestPattern = null;
    if (patterns.length) {
      strongestPattern = patterns.reduce((best, current) => {
        if (current.masteryRate > best.masteryRate) return current;
        if (current.masteryRate === best.masteryRate && current.solvedCount > best.solvedCount) return current;
        return best;
      }, patterns[0]);
      strongestPattern = {
        patternName: strongestPattern.patternName,
        patternSlug: strongestPattern.patternSlug,
        solvedCount: strongestPattern.solvedCount,
        masteredCount: strongestPattern.masteredCount,
        masteryRate: Math.round(strongestPattern.masteryRate),
        confidenceLevel: strongestPattern.confidenceLevel
      };
    }

    // Determine weakest pattern: lowest masteryRate, then solvedCount
    let weakestPattern = null;
    if (patterns.length) {
      weakestPattern = patterns.reduce((worst, current) => {
        if (current.masteryRate < worst.masteryRate) return current;
        if (current.masteryRate === worst.masteryRate && current.solvedCount < worst.solvedCount) return current;
        return worst;
      }, patterns[0]);
      weakestPattern = {
        patternName: weakestPattern.patternName,
        patternSlug: weakestPattern.patternSlug,
        solvedCount: weakestPattern.solvedCount,
        masteredCount: weakestPattern.masteredCount,
        masteryRate: Math.round(weakestPattern.masteryRate),
        confidenceLevel: weakestPattern.confidenceLevel
      };
    }

    const patternsByConfidence = {
      1: patterns.filter(p => p.confidenceLevel === 1).length,
      2: patterns.filter(p => p.confidenceLevel === 2).length,
      3: patterns.filter(p => p.confidenceLevel === 3).length,
      4: patterns.filter(p => p.confidenceLevel === 4).length,
      5: patterns.filter(p => p.confidenceLevel === 5).length
    };

    const stats = {
      totalPatterns,
      totalSolved,          // ✅ now equals unique solved questions
      totalMastered,
      averageConfidence: parseFloat(averageConfidence.toFixed(2)),
      averageMasteryRate: parseFloat(averageMasteryRate.toFixed(2)),
      strongestPattern,
      weakestPattern,
      patternsByConfidence
    };

    res.json(formatResponse('Pattern mastery stats retrieved', { stats }));
  } catch (error) {
    next(error);
  }
};

const getRecommendations = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const focus = req.query.focus || 'weakest';
    
    let patterns = await PatternMastery.find({ userId: req.user._id }).lean();
    patterns = patterns.map(p => ({ ...p, confidenceLevel: computeConfidence(p.solvedCount) }));
    
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
    // Recompute confidence for all patterns based on solvedCount
    patterns = patterns.map(p => ({
      ...p,
      confidenceLevel: computeConfidence(p.solvedCount)
    }));
    
    let weakest = [];
    if (metric === 'confidence') {
      // Sort by confidence ascending, then solvedCount ascending
      weakest = patterns.sort((a, b) => {
        if (a.confidenceLevel !== b.confidenceLevel) return a.confidenceLevel - b.confidenceLevel;
        return a.solvedCount - b.solvedCount;
      }).slice(0, limit);
    } else if (metric === 'masteryRate') {
      weakest = patterns.sort((a, b) => a.masteryRate - b.masteryRate).slice(0, limit);
    } else if (metric === 'lastPracticed') {
      weakest = patterns
        .sort((a, b) => new Date(a.lastPracticed || 0) - new Date(b.lastPracticed || 0))
        .slice(0, limit);
    }

    // Populate platformQuestionId in recentQuestions
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
    // Recompute confidence
    patterns = patterns.map(p => ({
      ...p,
      confidenceLevel: computeConfidence(p.solvedCount)
    }));
    
    let strongest = [];
    if (metric === 'confidence') {
      strongest = patterns.sort((a, b) => {
        if (b.confidenceLevel !== a.confidenceLevel) return b.confidenceLevel - a.confidenceLevel;
        return b.solvedCount - a.solvedCount;
      }).slice(0, limit);
    } else if (metric === 'masteryRate') {
      strongest = patterns.sort((a, b) => b.masteryRate - a.masteryRate).slice(0, limit);
    } else if (metric === 'lastPracticed') {
      strongest = patterns
        .filter(p => p.lastPracticed)
        .sort((a, b) => new Date(b.lastPracticed) - new Date(a.lastPracticed))
        .slice(0, limit);
    }

    // Populate platformQuestionId in recentQuestions
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
    
    let patterns = await PatternMastery.find(query).lean();
    patterns = patterns.map(p => ({ ...p, confidenceLevel: computeConfidence(p.solvedCount) }));
    
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
    let patterns = await PatternMastery.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Override confidence for public view
    patterns = patterns.map(p => ({
      ...p,
      confidenceLevel: computeConfidence(p.solvedCount)
    }));
    
    const total = await PatternMastery.countDocuments(query);
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
  getUserPatternMastery,
};