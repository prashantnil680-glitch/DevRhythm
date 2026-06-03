const SheetDraft = require('../models/SheetDraft');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const { manualDraftSchema, importDraftSchema } = require('../utils/validators/draft.validator');

/**
 * Get current user's draft for a given type.
 * GET /api/v1/sheets/drafts?type=manual|import
 */
const getDraft = async (req, res, next) => {
  try {
    const { type } = req.query;
    if (!type || !['manual', 'import'].includes(type)) {
      throw new AppError('Invalid draft type. Must be "manual" or "import".', 400);
    }
    const draft = await SheetDraft.findOne({ userId: req.user._id, type });
    res.json(formatResponse('Draft retrieved', draft || null));
  } catch (error) {
    next(error);
  }
};

/**
 * Save or update current user's draft.
 * POST /api/v1/sheets/drafts
 * Body: { type, data }
 */
const saveDraft = async (req, res, next) => {
  try {
    const { type, data } = req.body;
    if (!type || !['manual', 'import'].includes(type)) {
      throw new AppError('Invalid draft type. Must be "manual" or "import".', 400);
    }

    // Use external schemas
    const schema = type === 'manual' ? manualDraftSchema : importDraftSchema;
    const { error, value } = schema.validate(data, { abortEarly: false });
    if (error) {
      const errors = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, ''),
      }));
      throw new AppError('Validation failed', 400, { errors });
    }

    const draft = await SheetDraft.findOneAndUpdate(
      { userId: req.user._id, type },
      { $set: { data: value, updatedAt: new Date() } },
      { upsert: true, new: true }
    );

    res.json(formatResponse('Draft saved successfully', { draftId: draft._id, updatedAt: draft.updatedAt }));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete current user's draft for a given type.
 * DELETE /api/v1/sheets/drafts?type=manual|import
 */
const deleteDraft = async (req, res, next) => {
  try {
    const { type } = req.query;
    if (!type || !['manual', 'import'].includes(type)) {
      throw new AppError('Invalid draft type. Must be "manual" or "import".', 400);
    }
    const result = await SheetDraft.deleteOne({ userId: req.user._id, type });
    res.json(formatResponse('Draft deleted successfully', { deleted: result.deletedCount > 0 }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDraft,
  saveDraft,
  deleteDraft,
};