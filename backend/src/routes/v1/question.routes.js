const express = require('express');
const router = express.Router();
const questionController = require('../../controllers/question.controller');
const { getQuestionsByPattern } = require('../../controllers/question.controller');
const { auth } = require('../../middleware/auth');
const { attachUserTimeZone } = require('../../middleware/timezone'); 
const validate = require('../../middleware/validator');
const { questionValidator } = require('../../utils/validators');
const { cache } = require('../../middleware/cache');
const rateLimiters = require('../../middleware/rateLimiter');
const Joi = require('joi');

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

router.get('/daily',
  auth,
  rateLimiters.userLimiter,
  questionController.getDailyProblemAndGoal
);

router.get('/', auth, rateLimiters.userLimiter, cache(300, 'questions:list'), validate(questionValidator.getQuestions, 'query'), questionController.getQuestions);
router.get('/patterns', auth, rateLimiters.userLimiter, cache(1800, 'questions:patterns'), questionController.getPatterns);
router.get('/tags', auth, rateLimiters.userLimiter, cache(1800, 'questions:tags'), questionController.getTags);
router.get('/statistics', auth, rateLimiters.userLimiter, cache(3600, 'questions:statistics'), questionController.getStatistics);
router.get('/deleted', auth, rateLimiters.userLimiter, cache(300, 'questions:deleted'), validate(questionValidator.getQuestions, 'query'), questionController.getDeletedQuestions);
router.get('/platform/:platform/:platformQuestionId', auth, rateLimiters.userLimiter, cache(3600, 'question:platform'), validate(questionValidator.getQuestionByPlatformId, 'params'), questionController.getQuestionByPlatformId);
router.get('/platform/:platform/:platformQuestionId/details',
  auth,
  attachUserTimeZone,  
  rateLimiters.userLimiter,
  cache(30, 'question-details:platform'),
  validate(Joi.object({
    platform: Joi.string().valid('LeetCode', 'Codeforces', 'HackerRank', 'AtCoder', 'CodeChef', 'Other').required(),
    platformQuestionId: Joi.string().required()
  }), 'params'),
  questionController.getQuestionDetailsByPlatform
);
router.get('/:id', auth, rateLimiters.userLimiter, cache(3600, 'question'), validate(questionValidator.getQuestionById, 'params'), questionController.getQuestionById);
router.get('/:id/details',
  auth,
  attachUserTimeZone,  
  rateLimiters.userLimiter,
  cache(30, 'question-details'),
  validate(Joi.object({ id: Joi.string().hex().length(24).required() }), 'params'),
  questionController.getQuestionDetails
);
router.get('/similar/:id', auth, rateLimiters.userLimiter, cache(3600, 'question:similar'), validate(questionValidator.getSimilarQuestions, 'params'), validate(Joi.object({ limit: Joi.number().integer().min(1).max(50).optional() }), 'query'), questionController.getSimilarQuestions);
router.post('/', auth, rateLimiters.questionCreateLimiter, validate(questionValidator.createQuestion), questionController.createQuestion);
router.put('/:id', auth, rateLimiters.questionUpdateLimiter, validate(questionValidator.updateQuestion), questionController.updateQuestion);
router.delete('/:id', auth, rateLimiters.questionDeleteLimiter, validate(questionValidator.deleteQuestion, 'params'), questionController.deleteQuestion);
router.post('/:id/restore', auth, rateLimiters.questionUpdateLimiter, validate(questionValidator.restoreQuestion, 'params'), questionController.restoreQuestion);
router.delete('/:id/permanent', auth, rateLimiters.questionDeleteLimiter, validate(questionValidator.permanentDeleteQuestion, 'params'), questionController.permanentDeleteQuestion);

// NEW ROUTE: Get questions by pattern/tag slug
router.get('/pattern/:patternSlug',
  auth,  // require authentication (user must be logged in)
  rateLimiters.userLimiter,
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