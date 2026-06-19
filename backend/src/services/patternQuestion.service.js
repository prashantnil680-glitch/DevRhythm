const mongoose = require('mongoose');
const { client: redisClient } = require('../config/redis');
const Question = require('../models/Question');

/**
 * Get actual pattern name from slug using Redis cache.
 */
async function getPatternNameBySlug(slug) {
  if (!slug) return null;

  const cacheKey = `pattern:slug:${slug}`;
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return cached;
    } catch (err) {
      console.warn('Redis error in getPatternNameBySlug:', err.message);
    }
  }

  const allPatterns = await Question.distinct('pattern', { pattern: { $ne: [] } });
  const found = allPatterns.find(p => {
    const generatedSlug = p
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return generatedSlug === slug;
  });

  if (found && redisClient) {
    try {
      await redisClient.setex(cacheKey, 86400, found);
    } catch (err) {
      console.warn('Redis set error:', err.message);
    }
  }
  return found || null;
}

/**
 * Get paginated questions for a pattern with user progress.
 * Sorted by: Mastered → Solved → Attempted → Not Started, then difficulty, then title.
 */
async function getQuestionsByPattern(userId, patternName, page, limit) {
  const skip = (page - 1) * limit;
  const matchStage = { pattern: patternName, isActive: true };
  const pipeline = [{ $match: matchStage }];

  if (userId) {
    const objectIdUserId = new mongoose.Types.ObjectId(userId);
    pipeline.push(
      {
        $lookup: {
          from: 'userquestionprogresses',
          let: { qid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$questionId', '$$qid'] },
                    { $eq: ['$userId', objectIdUserId] }
                  ]
                }
              }
            },
            { $project: { status: 1, 'attempts.solvedAt': 1 } }
          ],
          as: 'userProgress'
        }
      },
      {
        $addFields: {
          userStatus: { $ifNull: [{ $arrayElemAt: ['$userProgress.status', 0] }, 'Not Started'] },
          solvedAt: { $arrayElemAt: ['$userProgress.attempts.solvedAt', 0] }
        }
      },
      {
        $addFields: {
          statusPriority: {
            $switch: {
              branches: [
                { case: { $eq: ['$userStatus', 'Mastered'] }, then: 1 },
                { case: { $eq: ['$userStatus', 'Solved'] }, then: 2 },
                { case: { $eq: ['$userStatus', 'Attempted'] }, then: 3 },
                { case: { $eq: ['$userStatus', 'Not Started'] }, then: 4 }
              ],
              default: 5
            }
          }
        }
      },
      { $sort: { statusPriority: 1, difficulty: 1, title: 1 } }
    );
  } else {
    pipeline.push({ $sort: { difficulty: 1, title: 1 } });
  }

  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            title: 1,
            difficulty: 1,
            platform: 1,
            platformQuestionId: 1,
            problemLink: 1,
            tags: 1,
            pattern: 1,
            ...(userId ? { userStatus: 1, solvedAt: 1 } : {})
          }
        }
      ]
    }
  });

  const result = await Question.aggregate(pipeline);
  const total = result[0]?.metadata[0]?.total || 0;
  const questions = result[0]?.data || [];
  return { total, questions };
}

module.exports = {
  getPatternNameBySlug,
  getQuestionsByPattern
};