const express = require('express');
const router = express.Router();
const questionController = require('../../controllers/question.controller');
const { getQuestionsByPattern } = require('../../controllers/question.controller');
const { auth, optionalAuth } = require('../../middleware/auth');
const { attachUserTimeZone } = require('../../middleware/timezone'); 
const validate = require('../../middleware/validator');
const { questionValidator } = require('../../utils/validators');
const { cache } = require('../../middleware/cache');
const rateLimiters = require('../../middleware/rateLimiter');
const Joi = require('joi');

// LeetCode endpoints (no caching – rate-limited instead)
router.get('/search-leetcode',
  auth,
  rateLimiters.leetcodeSearchLimiter,
  validate(Joi.object({ 
    q: Joi.string().min(2).required(),
    type: Joi.string().valid('name', 'tag').default('name')
  }), 'query'),
  questionController.searchLeetCodeQuestions
);

router.post('/fetch-leetcode',
  auth,
  rateLimiters.leetcodeFetchLimiter,
  validate(Joi.object({ url: Joi.string().uri().required() })),
  questionController.fetchLeetCodeQuestion
);

// Daily problem (no caching – refreshes daily)
router.get('/daily',
  auth,
  rateLimiters.userLimiter,
  questionController.getDailyProblemAndGoal
);

// Main list endpoint – cached 30 seconds
router.get('/',
  optionalAuth,
  rateLimiters.userLimiter,
  cache(30, 'questions:list'),
  validate(questionValidator.getQuestions, 'query'),
  questionController.getQuestions
);

// Static metadata endpoints – cached longer (30 minutes)
router.get('/patterns',
  optionalAuth,
  rateLimiters.userLimiter,
  cache(1800, 'questions:patterns'),
  questionController.getPatterns
);

router.get('/tags',
  optionalAuth,
  rateLimiters.userLimiter,
  cache(1800, 'questions:tags'),
  questionController.getTags
);

router.get('/statistics',
  optionalAuth,
  rateLimiters.userLimiter,
  cache(3600, 'questions:statistics'),
  questionController.getStatistics
);

// Deleted questions (authenticated only, short cache)
router.get('/deleted',
  auth,
  rateLimiters.userLimiter,
  cache(300, 'questions:deleted'),
  validate(questionValidator.getQuestions, 'query'),
  questionController.getDeletedQuestions
);

// Single question by platform ID – cached 1 hour (rarely changes)
router.get('/platform/:platform/:platformQuestionId',
  optionalAuth,
  rateLimiters.userLimiter,
  cache(3600, 'question:platform'),
  validate(questionValidator.getQuestionByPlatformId, 'params'),
  questionController.getQuestionByPlatformId
);

// Question details by platform ID (with user progress) – cached 30 seconds
router.get('/platform/:platform/:platformQuestionId/details',
  optionalAuth,
  attachUserTimeZone,  
  rateLimiters.userLimiter,
  cache(30, 'question-details:platform'),
  validate(Joi.object({
    platform: Joi.string().valid('LeetCode', 'Codeforces', 'HackerRank', 'AtCoder', 'CodeChef', 'Other').required(),
    platformQuestionId: Joi.string().required()
  }), 'params'),
  questionController.getQuestionDetailsByPlatform
);

// Single question by ID – cached 1 hour
router.get('/:id',
  auth,
  rateLimiters.userLimiter,
  cache(3600, 'question'),
  validate(questionValidator.getQuestionById, 'params'),
  questionController.getQuestionById
);

// Detailed question with user progress – cached 30 seconds
router.get('/:id/details',
  auth,
  attachUserTimeZone,  
  rateLimiters.userLimiter,
  cache(30, 'question-details'),
  validate(Joi.object({ id: Joi.string().hex().length(24).required() }), 'params'),
  questionController.getQuestionDetails
);

// Similar questions – cached 1 hour
router.get('/similar/:id',
  auth,
  rateLimiters.userLimiter,
  cache(3600, 'question:similar'),
  validate(questionValidator.getSimilarQuestions, 'params'),
  validate(Joi.object({ limit: Joi.number().integer().min(1).max(50).optional() }), 'query'),
  questionController.getSimilarQuestions
);

// Create, update, delete (no caching – immediate consistency required)
router.post('/',
  auth,
  rateLimiters.questionCreateLimiter,
  validate(questionValidator.createQuestion),
  questionController.createQuestion
);

router.put('/:id',
  auth,
  rateLimiters.questionUpdateLimiter,
  validate(questionValidator.updateQuestion),
  questionController.updateQuestion
);

router.delete('/:id',
  auth,
  rateLimiters.questionDeleteLimiter,
  validate(questionValidator.deleteQuestion, 'params'),
  questionController.deleteQuestion
);

router.post('/:id/restore',
  auth,
  rateLimiters.questionUpdateLimiter,
  validate(questionValidator.restoreQuestion, 'params'),
  questionController.restoreQuestion
);

router.delete('/:id/permanent',
  auth,
  rateLimiters.questionDeleteLimiter,
  validate(questionValidator.permanentDeleteQuestion, 'params'),
  questionController.permanentDeleteQuestion
);

// Get questions by pattern/tag slug (requires authentication, short cache)
router.get('/pattern/:patternSlug',
  auth,
  rateLimiters.userLimiter,
  cache(30, 'questions:pattern'),
  validate(Joi.object({
    patternSlug: Joi.string().pattern(/^[a-z0-9-]+$/).required()
  }), 'params'),
  validate(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }), 'query'),
  getQuestionsByPattern
);

module.exports = router;