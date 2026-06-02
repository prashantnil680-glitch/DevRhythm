const express = require('express');
const multer = require('multer');
const router = express.Router();
const sheetController = require('../../controllers/sheet.controller');
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

router.post(
  '/import',
  auth,
  rateLimiters.groupCreateLimiter,
  upload.single('file'),
  validate(sheetValidator.importExcelPreview, 'body'),
  sheetController.importSheet
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

router.get(
  '/:slug/progress/me',
  auth,
  rateLimiters.userLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  sheetController.getMyProgress
);

router.get(
  '/:slug/progress/:username',
  auth,
  rateLimiters.userLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  validate(sheetValidator.getUserProgress, 'params'),
  sheetController.getUserProgress
);

router.get(
  '/:slug/progress/me/chart',
  auth,
  rateLimiters.userLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  sheetController.getMyProgressChart
);

router.get(
  '/:slug/progress/:username/chart',
  auth,
  rateLimiters.userLimiter,
  validate(sheetValidator.sheetIdParam, 'params'),
  validate(sheetValidator.getUserProgress, 'params'),
  sheetController.getUserProgressChart
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