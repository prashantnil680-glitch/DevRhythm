const SheetService = require('../services/sheet.service');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const Question = require('../models/Question');
const { client: redisClient } = require('../config/redis');
const { jobQueue } = require('../services/queue.service');
const crypto = require('crypto');
const cloudinaryDownload = require('../services/cloudinaryDownload.service');
const UserFile = require('../models/UserFile');
const cloudinary = require('../config/cloudinary');

// ========== Helper: Get file buffer from either multer or Cloudinary ==========
const getFileBuffer = async (file, fileId, userId) => {
  if (file) {
    return {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
  if (fileId) {
    // Try exact match in UserFile
    let userFile = await UserFile.findOne({ publicId: fileId, userId });
    let buffer, mimetype, size;
    let originalname;

    if (userFile) {
      // Use stored metadata
      const fetched = await cloudinaryDownload.fetchFile(fileId);
      buffer = fetched.buffer;
      mimetype = fetched.mimetype;
      size = fetched.size;
      originalname = userFile.fileName;
    } else {
      // Fallback: fetch directly from Cloudinary (trust folder contains userId)
      const fetched = await cloudinaryDownload.fetchFile(fileId);
      buffer = fetched.buffer;
      mimetype = fetched.mimetype;
      size = fetched.size;
      // Derive original filename from publicId (last part after '/')
      const parts = fileId.split('/');
      let fileName = parts[parts.length - 1];
      // Optionally, we could try to get the original name from the draft's fileName if available, but we'll use this.
      originalname = fileName;
      
      // Optionally, create a missing UserFile record (async, don't await to avoid delay)
      UserFile.create({
        userId,
        publicId: fileId,
        fileName: originalname,
        mimeType: mimetype,
        size,
        url: cloudinary.url(fileId, { resource_type: 'raw', secure: true }),
      }).catch(err => console.warn('Failed to create missing UserFile record:', err.message));
    }
    
    return { buffer, originalname, mimetype, size };
  }
  throw new AppError('No file or fileId provided', 400);
};

/**
 * Create a sheet manually (provide question titles/slugs/IDs and target date).
 * POST /api/v1/sheets
 */
const createSheet = async (req, res, next) => {
  try {
    const { name, description, questions, targetDate, specialTag, originalSourceName, originalSourceUrl } = req.body;
    const sheet = await SheetService.createSheet(
      req.user._id,
      name,
      description,
      questions,
      targetDate,
      specialTag,
      originalSourceName,
      originalSourceUrl
    );
    res.status(201).json(formatResponse('Sheet created successfully', { sheet }));
  } catch (error) {
    if (error.statusCode === 409 && error.data) {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        message: error.message,
        data: error.data,
        meta: { timestamp: new Date().toISOString() },
        error: null,
      });
    }
    if (error.statusCode === 400 && error.data) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: error.message,
        data: error.data,
        meta: { timestamp: new Date().toISOString() },
        error: null,
      });
    }
    next(error);
  }
};

/**
 * Get list of sheets (public) with pagination and filters.
 * GET /api/v1/sheets
 */
const getSheets = async (req, res, next) => {
  try {
    const { search, ownerId, sortBy, sortOrder, page, limit, mySheets } = req.query;
    const currentUserId = req.user ? req.user._id : null;
    const result = await SheetService.getSheetsList(
      { search, ownerId, sortBy, sortOrder, mySheets: mySheets === 'true' },
      { page, limit },
      currentUserId
    );
    res.json(formatResponse('Sheets retrieved successfully', result.sheets, { pagination: result.pagination }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get total count of sheets (public).
 * GET /api/v1/sheets/count
 */
const getSheetsCount = async (req, res, next) => {
  try {
    const total = await SheetService.getSheetsCount();
    res.json(formatResponse('Sheets count retrieved', { total }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single sheet by slug (public).
 * GET /api/v1/sheets/:slug
 */
const getSheetBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const currentUserId = req.user ? req.user._id : null;
    const queryOptions = {
      page: parseInt(req.query.page, 10),
      limit: parseInt(req.query.limit, 10),
      search: req.query.search,
      solveStatus: req.query.solveStatus,
      revisionStatus: req.query.revisionStatus,
      difficulty: req.query.difficulty,
    };
    const sheetData = await SheetService.getSheetBySlug(slug, currentUserId, queryOptions);
    res.json(formatResponse('Sheet retrieved successfully', sheetData));
  } catch (error) {
    next(error);
  }
};

/**
 * Join a sheet (authenticated). For non‑owner participants.
 * POST /api/v1/sheets/:slug/join
 */
const joinSheet = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { targetDate } = req.body;
    const membership = await SheetService.joinSheet(req.user._id, slug, targetDate);
    res.status(201).json(formatResponse('Joined sheet successfully', { membership }));
  } catch (error) {
    if (error.statusCode === 409 && error.data) {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        message: error.message,
        data: error.data,
        meta: { timestamp: new Date().toISOString() },
        error: null,
      });
    }
    next(error);
  }
};

/**
 * Leave a sheet (authenticated).
 * DELETE /api/v1/sheets/:slug/leave
 */
const leaveSheet = async (req, res, next) => {
  try {
    const { slug } = req.params;
    await SheetService.leaveSheet(req.user._id, slug);
    res.json(formatResponse('Left sheet successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's progress in a sheet.
 * GET /api/v1/sheets/:slug/progress/me
 */
const getMyProgress = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const sheetData = await SheetService.getSheetBySlug(slug, req.user._id);
    if (!sheetData.hasJoined) {
      throw new AppError('You have not joined this sheet', 403);
    }
    const username = req.user.username;
    const progressData = await SheetService.getUserProgress(slug, req.user._id, username);
    res.json(formatResponse('Your progress retrieved', progressData));
  } catch (error) {
    next(error);
  }
};

/**
 * Get another user's progress in a sheet.
 * GET /api/v1/sheets/:slug/progress/:username
 */
const getUserProgress = async (req, res, next) => {
  try {
    const { slug, username } = req.params;
    if (username === 'Anonymous User') {
      throw new AppError('The original creator has been anonymised and their progress is no longer publicly available.', 404);
    }
    const progress = await SheetService.getUserProgress(slug, req.user._id, username);
    res.json(formatResponse('User progress retrieved', progress));
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's progress in chart format.
 * GET /api/v1/sheets/:slug/progress/me/chart
 */
const getMyProgressChart = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const username = req.user.username;
    const chartData = await SheetService.getUserProgressChart(slug, req.user._id, username);
    res.json(formatResponse('Chart data retrieved', chartData));
  } catch (error) {
    next(error);
  }
};

/**
 * Get aggregated progress chart for all participants.
 * GET /api/v1/sheets/:slug/progress/chart
 */
const getSheetProgressChart = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const chartData = await SheetService.getSheetProgressChartData(slug);
    res.json(formatResponse('Sheet progress chart data retrieved', chartData));
  } catch (error) {
    next(error);
  }
};

/**
 * Get another user's progress in chart format.
 * GET /api/v1/sheets/:slug/progress/:username/chart
 */
const getUserProgressChart = async (req, res, next) => {
  try {
    const { slug, username } = req.params;
    if (username === 'Anonymous User') {
      throw new AppError('The original creator has been anonymised and their progress is no longer publicly available.', 404);
    }
    const chartData = await SheetService.getUserProgressChart(slug, req.user._id, username);
    res.json(formatResponse('Chart data retrieved', chartData));
  } catch (error) {
    next(error);
  }
};

/**
 * Update sheet metadata (owner only).
 * PUT /api/v1/sheets/:slug
 */
const updateSheet = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const updates = req.body;
    const updatedSheet = await SheetService.updateSheet(req.user._id, slug, updates);
    res.json(formatResponse('Sheet updated successfully', { sheet: updatedSheet }));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete (soft delete) a sheet (owner only).
 * DELETE /api/v1/sheets/:slug
 */
const deleteSheet = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await SheetService.deleteSheet(req.user._id, slug);
    res.json(formatResponse('Sheet deleted successfully (owner removed)', result));
  } catch (error) {
    next(error);
  }
};

/**
 * Import Excel/JSON file to create a sheet (synchronous, for small files).
 * Supports either file upload or fileId (from Cloudinary).
 * POST /api/v1/sheets/import
 */
const importSheet = async (req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      return res.status(504).json({
        success: false,
        statusCode: 504,
        message: 'Request timeout. The file may be too large or malformed.',
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: null,
      });
    }
  }, 30000);

  try {
    const { sheetName, description, targetDate, specialTag, originalSourceName, originalSourceUrl, fileId } = req.body;
    const { buffer, originalname, mimetype, size } = await getFileBuffer(req.file, fileId);

    const { parseExcelFile } = require('../services/excelParser.service');
    const parsedRows = await parseExcelFile(buffer, originalname);
    
    const identifiers = parsedRows.map(row => row.platformQuestionId || row.title).filter(Boolean);
    
    if (identifiers.length === 0) {
      clearTimeout(timeout);
      throw new AppError('No valid question titles or slugs found in the file', 400);
    }
    
    const { resolvedIds, unresolved } = await SheetService.resolveQuestionIdentifiersPartial(identifiers);
    
    if (resolvedIds.length === 0) {
      clearTimeout(timeout);
      throw new AppError('None of the questions could be matched. Please check the file content.', 400);
    }
    
    const sheet = await SheetService.createSheet(
      req.user._id,
      sheetName,
      description || '',
      resolvedIds.map(id => id.toString()),
      targetDate,
      specialTag,
      originalSourceName,
      originalSourceUrl
    );
    
    clearTimeout(timeout);
    
    const message = unresolved.length
      ? `Sheet imported successfully. ${resolvedIds.length} questions were added. ${unresolved.length} questions could not be matched and were skipped.`
      : `Sheet imported successfully with all ${resolvedIds.length} questions.`;
    
    res.status(201).json({
      success: true,
      statusCode: 201,
      message,
      data: {
        sheet,
        totalRows: parsedRows.length,
        matchedCount: resolvedIds.length,
        skippedCount: unresolved.length,
        unresolved: unresolved.length ? unresolved : undefined,
      },
      meta: { timestamp: new Date().toISOString() },
      error: null,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error.statusCode === 409 && error.data) {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        message: error.message,
        data: error.data,
        meta: { timestamp: new Date().toISOString() },
        error: null,
      });
    }
    if (error.statusCode === 400 && error.data) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: error.message,
        data: error.data,
        meta: { timestamp: new Date().toISOString() },
        error: null,
      });
    }
    console.error('[ImportSheet] Error:', error);
    next(error);
  }
};

/**
 * Import Excel/JSON file asynchronously (with progress tracking).
 * Supports either file upload or fileId (from Cloudinary).
 * POST /api/v1/sheets/import/async
 */
const importSheetAsync = async (req, res, next) => {
  try {
    const { sheetName, description, targetDate, specialTag, originalSourceName, originalSourceUrl, fileId } = req.body;
    const userId = req.user._id;
    let fileInfo = null;

    if (req.file) {
      fileInfo = {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      };
    } else if (fileId) {
      // Try to find existing UserFile record
      let userFile = await UserFile.findOne({ publicId: fileId, userId });
      if (userFile) {
        const fetched = await cloudinaryDownload.fetchFile(fileId);
        fileInfo = {
          buffer: fetched.buffer,
          originalname: userFile.fileName,
          mimetype: fetched.mimetype,
          size: fetched.size,
        };
      } else {
        // No database record – fetch directly from Cloudinary
        const fetched = await cloudinaryDownload.fetchFile(fileId);
        const parts = fileId.split('/');
        const derivedName = parts[parts.length - 1];
        fileInfo = {
          buffer: fetched.buffer,
          originalname: derivedName,
          mimetype: fetched.mimetype,
          size: fetched.size,
        };
        // Create missing UserFile record asynchronously (only if userId exists)
        if (userId) {
          UserFile.create({
            userId,
            publicId: fileId,
            fileName: derivedName,
            mimeType: fetched.mimetype,
            size: fetched.size,
            url: cloudinary.url(fileId, { resource_type: 'raw', secure: true }),
          }).catch(err => console.warn('[ImportSheetAsync] Failed to create missing UserFile record:', err.message));
        }
      }
    } else {
      throw new AppError('No file or fileId provided', 400);
    }

    const { parseExcelFile } = require('../services/excelParser.service');
    const parsedRows = await parseExcelFile(fileInfo.buffer, fileInfo.originalname);
    const identifiers = parsedRows.map(row => row.platformQuestionId || row.title).filter(Boolean);

    if (identifiers.length === 0) {
      throw new AppError('No valid question titles or slugs found in the file', 400);
    }

    // Generate unique job ID
    const jobId = crypto.randomUUID();
    const progressKey = `import:progress:${jobId}`;

    // Store initial progress in Redis
    const initialProgress = {
      stage: 'queued',
      totalQuestions: identifiers.length,
      processed: 0,
      matched: 0,
      skipped: 0,
      unresolved: [],
      currentQuestion: null,
      startedAt: new Date().toISOString(),
    };
    await redisClient.setEx(progressKey, 3600, JSON.stringify(initialProgress)); // 1 hour TTL

    // Add job to Bull queue
    await jobQueue.add('sheet.import', {
      jobId,
      userId,
      sheetName,
      description: description || '',
      identifiers,
      targetDate,
      specialTag,
      originalSourceName,
      originalSourceUrl,
    });

    res.status(202).json({
      success: true,
      statusCode: 202,
      message: 'Import started. Use GET /import/progress/{jobId} to track progress.',
      data: { jobId },
      meta: { timestamp: new Date().toISOString() },
      error: null,
    });
  } catch (error) {
    if (error.statusCode === 400 && error.data) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: error.message,
        data: error.data,
        meta: { timestamp: new Date().toISOString() },
        error: null,
      });
    }
    console.error('[ImportSheetAsync] Error:', error);
    next(error);
  }
};

/**
 * Get import progress for a given jobId.
 * GET /api/v1/sheets/import/progress/:jobId
 */
const getImportProgress = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const progressKey = `import:progress:${jobId}`;
    const progressData = await redisClient.get(progressKey);
    
    if (!progressData) {
      throw new AppError('Import job not found or expired', 404);
    }
    
    const progress = JSON.parse(progressData);
    res.json(formatResponse('Import progress retrieved', progress));
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle bookmark for a sheet.
 * POST /api/v1/sheets/:slug/bookmark
 */
const toggleBookmark = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await SheetService.toggleBookmark(req.user._id, slug);
    res.json(formatResponse(result.isBookmarked ? 'Sheet bookmarked' : 'Sheet unbookmarked', result));
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's bookmarked sheets, most recent first.
 * GET /api/v1/sheets/bookmarks
 */
const getBookmarkedSheets = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const result = await SheetService.getBookmarkedSheets(req.user._id, { page, limit }, search);
    res.json(formatResponse('Bookmarked sheets retrieved', result.sheets, { pagination: result.pagination }));
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user's target date for a sheet.
 * PATCH /api/v1/sheets/:slug/target-date
 */
const updateTargetDate = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { targetDate } = req.body;
    const updated = await SheetService.updateTargetDate(req.user._id, slug, targetDate);
    res.json(formatResponse('Target date updated successfully', updated));
  } catch (error) {
    next(error);
  }
};

/**
 * Get sheet rank (top 4 participants and current user's rank).
 * GET /api/v1/sheets/:slug/rank
 */
const getSheetRank = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const rankData = await SheetService.getSheetRank(slug, req.user._id);
    res.json(formatResponse('Sheet rank retrieved', rankData));
  } catch (error) {
    next(error);
  }
};

/**
 * Create a sheet asynchronously (with progress tracking).
 * POST /api/v1/sheets/async
 */
const createSheetAsync = async (req, res, next) => {
  try {
    const { name, description, questions, targetDate, specialTag, originalSourceName, originalSourceUrl } = req.body;
    const userId = req.user._id;

    const jobId = crypto.randomUUID();
    const progressKey = `sheet:create:progress:${jobId}`;

    const initialProgress = {
      stage: 'queued',
      totalQuestions: questions.length,
      processed: 0,
      matched: 0,
      skipped: 0,
      unresolved: [],
      currentQuestion: null,
      startedAt: new Date().toISOString(),
    };
    await redisClient.setEx(progressKey, 3600, JSON.stringify(initialProgress));

    await jobQueue.add('sheet.create', {
      jobId,
      userId,
      name,
      description,
      questionIdentifiers: questions,
      targetDate,
      specialTag,
      originalSourceName,
      originalSourceUrl,
    });

    res.status(202).json({
      success: true,
      statusCode: 202,
      message: 'Sheet creation started. Use GET /sheets/create/progress/{jobId} to track progress.',
      data: { jobId },
      meta: { timestamp: new Date().toISOString() },
      error: null,
    });
  } catch (error) {
    if (error.statusCode === 400 && error.data) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: error.message,
        data: error.data,
        meta: { timestamp: new Date().toISOString() },
        error: null,
      });
    }
    next(error);
  }
};

/**
 * Get progress of an async sheet creation job.
 * GET /api/v1/sheets/create/progress/:jobId
 */
const getSheetCreateProgress = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const progressKey = `sheet:create:progress:${jobId}`;
    const progressData = await redisClient.get(progressKey);
    
    if (!progressData) {
      throw new AppError('Sheet creation job not found or expired', 404);
    }
    
    const progress = JSON.parse(progressData);
    res.json(formatResponse('Sheet creation progress retrieved', progress));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSheet,
  getSheets,
  getSheetsCount,
  getSheetBySlug,
  joinSheet,
  leaveSheet,
  getMyProgress,
  getUserProgress,
  getMyProgressChart,
  getSheetProgressChart,
  getUserProgressChart,
  updateSheet,
  deleteSheet,
  importSheet,
  importSheetAsync,
  getImportProgress,
  toggleBookmark,
  getBookmarkedSheets,
  updateTargetDate,
  getSheetRank,
  createSheetAsync,
  getSheetCreateProgress,
};