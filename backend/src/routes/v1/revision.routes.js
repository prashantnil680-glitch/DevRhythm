const express = require('express');
const router = express.Router();
const revisionController = require('../../controllers/revision.controller');
const { auth } = require('../../middleware/auth');
const { attachUserTimeZone } = require('../../middleware/timezone');
const validate = require('../../middleware/validator');
const { cache } = require('../../middleware/cache');
const { progressValidator } = require('../../utils/validators');
const rateLimiters = require('../../middleware/rateLimiter');
const Joi = require('joi');

router.get('/', 
  auth, 
  attachUserTimeZone,   
  rateLimiters.userLimiter, 
  cache(30, 'revisions:list'), 
  validate(progressValidator.getRevisions, 'query'), 
  revisionController.getRevisions
);

router.get('/today', 
  auth, 
  attachUserTimeZone,   
  rateLimiters.userLimiter, 
  cache(60, 'revisions:today'), 
  validate(progressValidator.getToday, 'query'), 
  revisionController.getTodayRevisions
);

router.get('/upcoming', 
  auth, 
  attachUserTimeZone,   
  rateLimiters.userLimiter, 
  cache(60, 'revisions:upcoming'), 
  validate(progressValidator.getUpcoming, 'query'), 
  revisionController.getUpcomingRevisions
);

router.get('/question/:questionId', 
  auth, 
  attachUserTimeZone,   
  rateLimiters.userLimiter, 
  cache(30, 'revisions:question'), 
  validate(progressValidator.getQuestionRevision, 'params'), 
  revisionController.getQuestionRevision
);

router.get('/by-platform/:platform/:platformQuestionId',
  auth,
  attachUserTimeZone,   
  rateLimiters.userLimiter,
  cache(30, 'revisions:question'),
  validate(Joi.object({
    platform: Joi.string().valid('LeetCode', 'Codeforces', 'HackerRank', 'AtCoder', 'CodeChef', 'Other').required(),
    platformQuestionId: Joi.string().required()
  }), 'params'),
  revisionController.getQuestionRevisionByPlatform
);

router.post('/question/:questionId', auth, rateLimiters.progressUpdateLimiter, validate(progressValidator.createRevision, 'body'), revisionController.createRevision);
router.post('/:revisionId/complete', auth, rateLimiters.revisionCompleteLimiter, validate(progressValidator.completeRevision, 'body'), revisionController.completeRevision);
router.post('/question/:questionId/complete', auth, rateLimiters.revisionCompleteLimiter, validate(progressValidator.completeRevision, 'body'), revisionController.completeQuestionRevision);

// Complete a specific past revision by date 
router.post('/question/:questionId/complete-past',
  auth,
  rateLimiters.revisionCompleteLimiter,
  validate(Joi.object({
    date: Joi.date().required(),
    confidence: Joi.number().integer().min(1).max(5).optional()
  })),
  revisionController.completePastRevision
);

router.post('/:questionId/time-spent', 
  auth, 
  attachUserTimeZone,
  rateLimiters.revisionCompleteLimiter, 
  validate(Joi.object({ minutes: Joi.number().integer().min(1).max(480).required() }), 'body'), 
  revisionController.recordTimeSpent
);

router.put('/:revisionId/reschedule', auth, rateLimiters.progressUpdateLimiter, validate(progressValidator.rescheduleRevision, 'body'), revisionController.rescheduleRevision);
router.delete('/:revisionId', auth, rateLimiters.progressUpdateLimiter, revisionController.deleteRevision);
router.delete('/question/:questionId', auth, rateLimiters.progressUpdateLimiter, revisionController.deleteQuestionRevision);

router.get('/stats',
  auth,
  attachUserTimeZone,   
  rateLimiters.revisionStatsLimiter,
  cache(30, 'revisions:stats'),
  (req, res, next) => {
    if (req.query.detailed === 'true') {
      return revisionController.getDetailedRevisionStats(req, res, next);
    }
    return revisionController.getRevisionStats(req, res, next);
  }
);

router.get('/overdue', 
  auth, 
  attachUserTimeZone,   
  rateLimiters.userLimiter, 
  cache(30, 'revisions:overdue'), 
  validate(progressValidator.getOverdue, 'query'), 
  revisionController.getOverdueRevisions
);

module.exports = router;