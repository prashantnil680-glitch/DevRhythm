const express = require('express');
const router = express.Router();
const patternMasteryController = require('../../controllers/patternMastery.controller');
const { auth } = require('../../middleware/auth');
const validate = require('../../middleware/validator');
const Joi = require('joi');
const { cache } = require('../../middleware/cache');
const rateLimiters = require('../../middleware/rateLimiter');

router.get('/', 
  auth, 
  rateLimiters.patternMasteryLimiter,  // updated
  validate(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    minConfidence: Joi.number().integer().min(1).max(5),
    maxConfidence: Joi.number().integer().min(1).max(5),
    minSolved: Joi.number().integer().min(0),
    minMasteryRate: Joi.number().min(0).max(100),
    sortBy: Joi.string().valid('confidenceLevel', 'masteryRate', 'solvedCount', 'lastPracticed').default('confidenceLevel'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    search: Joi.string().trim().min(1).max(50)
  }), 'query'), 
  cache(30, 'pattern-mastery:list'),   
  patternMasteryController.getPatternMasteryList
);

router.get('/stats', 
  auth, 
  rateLimiters.patternMasteryLimiter,  // updated
  cache(60, 'pattern-mastery:stats'),   
  patternMasteryController.getPatternStats
);

router.get('/recommendations', 
  auth, 
  rateLimiters.patternMasteryLimiter,  // updated
  validate(Joi.object({
    limit: Joi.number().integer().min(1).max(10).default(5),
    focus: Joi.string().valid('weakest', 'needsPractice', 'highestPotential').default('weakest')
  }), 'query'), 
  cache(300, 'pattern-mastery:recommendations'),   
  patternMasteryController.getRecommendations
);

router.get('/weakest', 
  auth, 
  rateLimiters.patternMasteryLimiter,  // updated
  validate(Joi.object({
    limit: Joi.number().integer().min(1).max(20).default(5),
    metric: Joi.string().valid('confidence', 'masteryRate', 'lastPracticed').default('confidence')
  }), 'query'), 
  cache(60, 'pattern-mastery:weakest'),   
  patternMasteryController.getWeakestPatterns
);

router.get('/strongest', 
  auth, 
  rateLimiters.patternMasteryLimiter,  // updated
  validate(Joi.object({
    limit: Joi.number().integer().min(1).max(20).default(5),
    metric: Joi.string().valid('confidence', 'masteryRate', 'lastPracticed').default('confidence')
  }), 'query'), 
  cache(60, 'pattern-mastery:strongest'),   
  patternMasteryController.getStrongestPatterns
);

router.get('/progress', 
  auth, 
  rateLimiters.patternMasteryLimiter,  // updated
  validate(Joi.object({
    patternName: Joi.string().trim(),
    startDate: Joi.date(),
    endDate: Joi.date(),
    period: Joi.string().valid('week', 'month', 'quarter').default('month')
  }), 'query'), 
  cache(300, 'pattern-mastery:progress'),   
  patternMasteryController.getPatternProgress
);

router.get('/:patternName', 
  auth, 
  rateLimiters.patternMasteryLimiter,  // updated
  validate(Joi.object({
    patternName: Joi.string().trim().required()
  }), 'params'), 
  cache(30, 'pattern-mastery:pattern'), 
  patternMasteryController.getPatternMastery
);

module.exports = router;