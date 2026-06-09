const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const router = express.Router();
const sheetController = require('../../controllers/sheet.controller');
const draftController = require('../../controllers/draft.controller');
const fileController = require('../../controllers/file.controller');
const { auth, optionalAuth } = require('../../middleware/auth');
const validate = require('../../middleware/validator');
const { cache } = require('../../middleware/cache');
const rateLimiters = require('../../middleware/rateLimiter');
const sheetValidator = require('../../utils/validators/sheet.validator');

// Configure multer for memory storage (no disk write)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/json', // .json
    ];
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowedExts = ['xlsx', 'xls', 'csv', 'json'];
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload .xlsx, .xls, .csv, or .json'), false);
    }
  },
});

// ========== Public routes (with optional auth) ==========
router.get(
  '/',
  optionalAuth,
  rateLimiters.publicLimiter,
  cache(60, 'sheets:list'),
  validate(sheetValidator.getSheets, 'query'),
  sheetController.getSheets
);

// ========== Draft routes ==========
router.get(
  '/drafts',
  auth,
  rateLimiters.userLimiter,
  validate(Joi.object({ type: Joi.string().valid('manual', 'import').required() }), 'query'),
  draftController.getDraft
);

router.post(
  '/drafts',
  auth,
  rateLimiters.userLimiter,
  validate(Joi.object({
    type: Joi.string().valid('manual', 'import').required(),
    data: Joi.object().required(),
  }), 'body'),
  draftController.saveDraft
);

router.delete(
  '/drafts',
  auth,
  rateLimiters.userLimiter,
  validate(Joi.object({ type: Joi.string().valid('manual', 'import').required() }), 'query'),
  draftController.deleteDraft
);

// ========== File upload & management routes ==========
router.post(
  '/upload-file',
  auth,
  rateLimiters.userLimiter,
  fileController.uploadFile
);

router.get(
  '/uploaded-files',
  auth,
  rateLimiters.userLimiter,
  fileController.listFiles
);

router.delete(
  '/uploaded-files/:publicId',
  auth,
  rateLimiters.userLimiter,
  validate(Joi.object({ publicId: Joi.string().required() }), 'params'),
  fileController.deleteFile
);

// ========== Authenticated routes (specific paths) ==========
router.get(
  '/bookmarks',
  auth,
  rateLimiters.userLimiter,
  cache(30, 'sheets:bookmarks'),
  validate(sheetValidator.getSheets, 'query'),
  sheetController.getBookmarkedSheets
);

router.post(
  '/',
  auth,
  rateLimiters.groupCreateLimiter,
  validate(sheetValidator.createSheetManual),
  sheetController.createSheet
);

// Async manual sheet creation with progress tracking
router.post(
  '/async',
  auth,
  rateLimiters.groupCreateLimiter,
  validate(sheetValidator.createSheetManual),
  sheetController.createSheetAsync
);

// Get progress for async sheet creation
router.get(
  '/create/progress/:jobId',
  auth,
  rateLimiters.userLimiter,
  validate(Joi.object({ jobId: Joi.string().uuid().required() }), 'params'),
  sheetController.getSheetCreateProgress
);

router.post(
  '/import',
  auth,
  rateLimiters.groupCreateLimiter,
  upload.single('file'),
  validate(sheetValidator.importExcelPreview, 'body'),
  sheetController.importSheet
);

// Async import with progress tracking
router.post(
  '/import/async',
  auth,
  rateLimiters.groupCreateLimiter,
  upload.single('file'),
  validate(sheetValidator.importExcelPreview, 'body'),
  sheetController.importSheetAsync
);

// Get import progress
router.get(
  '/import/progress/:jobId',
  auth,
  rateLimiters.userLimiter,
  validate(Joi.object({ jobId: Joi.string().uuid().required() }), 'params'),
  sheetController.getImportProgress
);

router.get('/count', rateLimiters.publicLimiter, cache(300, 'sheets:count'), sheetController.getSheetsCount);

// ========== Progress routes (order matters) ==========
router.get(
  '/:slug/progress/me',
  auth,
  rateLimiters.progressLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  sheetController.getMyProgress
);

router.get(
  '/:slug/progress/me/chart',
  auth,
  rateLimiters.progressLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  sheetController.getMyProgressChart
);

// 🔓 Made public (optionalAuth) for community chart on public sheet pages
router.get(
  '/:slug/progress/chart',
  optionalAuth,
  rateLimiters.progressLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  sheetController.getSheetProgressChart
);

router.get(
  '/:slug/progress/:username',
  auth,
  rateLimiters.progressLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  validate(sheetValidator.getUserProgress, 'params'),
  validate(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(100).empty('').optional(),
    status: Joi.string().valid('solved', 'unsolved', 'all').empty('').default('all'),
    revisionStatus: Joi.string().valid('completed', 'pending', 'all').empty('').default('all'),
    difficulty: Joi.string().valid('easy', 'medium', 'hard').empty('').optional(),
    sortBy: Joi.string().valid('title', 'difficulty', 'lastUpdated', 'solved', 'revisionCompleted').empty('').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').empty('').default('asc'),
  }), 'query'),
  sheetController.getUserProgress
);

router.get(
  '/:slug/progress/:username/chart',
  auth,
  rateLimiters.progressLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  validate(sheetValidator.getUserProgress, 'params'),
  sheetController.getUserProgressChart
);

// ========== Rank route (must be before /:slug) ==========
// 🔓 Made public (optionalAuth) for public sheet rank display
router.get(
  '/:slug/rank',
  optionalAuth,
  rateLimiters.rankParticipantsLimiter,
  cache(30, 'sheet:rank'),
  validate(sheetValidator.sheetIdParam, 'params'),
  sheetController.getSheetRank
);

// ========== Participants list route (must be before /:slug) ==========
// 🔓 Made public (optionalAuth) for public participant list
router.get(
  '/:slug/participants',
  optionalAuth,
  rateLimiters.rankParticipantsLimiter,
  cache(30, 'sheet:participants'),
  validate(sheetValidator.sheetIdParam, 'params'),
  validate(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }), 'query'),
  sheetController.getSheetParticipants
);

// ========== Dynamic routes (with slug parameter) ==========
router.get(
  '/:slug',
  optionalAuth,
  rateLimiters.publicLimiter,
  cache(60, 'sheet'),
  validate(sheetValidator.sheetIdParam, 'params'),
  sheetController.getSheetBySlug
);

router.post(
  '/:slug/join',
  auth,
  rateLimiters.groupJoinLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  validate(sheetValidator.joinSheet),
  sheetController.joinSheet
);

router.delete(
  '/:slug/leave',
  auth,
  rateLimiters.groupLeaveLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  sheetController.leaveSheet
);

router.put(
  '/:slug',
  auth,
  rateLimiters.groupUpdateLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  validate(sheetValidator.updateSheet),
  sheetController.updateSheet
);

router.delete(
  '/:slug',
  auth,
  rateLimiters.groupDeleteLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  sheetController.deleteSheet
);

router.patch(
  '/:slug/target-date',
  auth,
  rateLimiters.userLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  validate(sheetValidator.updateTargetDate),
  sheetController.updateTargetDate
);

router.post(
  '/:slug/bookmark',
  auth,
  rateLimiters.userLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  sheetController.toggleBookmark
);

module.exports = router;