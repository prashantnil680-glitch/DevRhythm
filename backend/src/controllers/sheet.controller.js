const SheetService = require('../services/sheet.service');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const Question = require('../models/Question');

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
 * Get a single sheet by slug (public).
 * GET /api/v1/sheets/:slug
 */
const getSheetBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const currentUserId = req.user ? req.user._id : null;
    const sheetData = await SheetService.getSheetBySlug(slug, currentUserId);
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
    // First, fetch sheet data with current user to check membership
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
 * GET /api/v1/sheets/:slug/progress/:userId
 */
const getUserProgress = async (req, res, next) => {
  try {
    const { slug, username } = req.params;
    const result = await SheetService.getUserProgress(slug, req.user._id, username);
    res.json(formatResponse('User progress retrieved', result));
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
 * Get another user's progress in chart format.
 * GET /api/v1/sheets/:slug/progress/:username/chart
 */
const getUserProgressChart = async (req, res, next) => {
  try {
    const { slug, username } = req.params;
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
 * Import Excel/JSON file to create a sheet.
 * POST /api/v1/sheets/import
 */
const importSheet = async (req, res, next) => {
  // Set a timeout to prevent hanging indefinitely (e.g., 30 seconds)
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
    if (!req.file) {
      clearTimeout(timeout);
      throw new AppError('No file uploaded', 400);
    }

    const { sheetName, description, targetDate, specialTag, originalSourceName, originalSourceUrl } = req.body;
    const { parseExcelFile } = require('../services/excelParser.service');
    const parsedRows = await parseExcelFile(req.file.buffer, req.file.originalname);
    
    const identifiers = parsedRows.map(row => row.platformQuestionId || row.title).filter(Boolean);
    
    if (identifiers.length === 0) {
      clearTimeout(timeout);
      throw new AppError('No valid question titles or slugs found in the file', 400);
    }
    
    const sheet = await SheetService.createSheet(
      req.user._id,
      sheetName,
      description || '',
      identifiers,
      targetDate,
      specialTag,
      originalSourceName,
      originalSourceUrl
    );
    
    clearTimeout(timeout);
    res.status(201).json(formatResponse('Sheet imported successfully', {
      sheet,
      totalRows: parsedRows.length,
      matchedCount: identifiers.length,
    }));
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
    // Generic error fallback
    console.error('[ImportSheet] Error:', error);
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

module.exports = {
  createSheet,
  getSheets,
  getSheetBySlug,
  joinSheet,
  leaveSheet,
  getMyProgress,
  getUserProgress,
  getMyProgressChart,
  getUserProgressChart,
  updateSheet,
  deleteSheet,
  importSheet,
  updateTargetDate,
};