const Joi = require('joi');

// Custom validator for a future date – handles quoted strings and trims whitespace
const futureDate = Joi.string().required().custom((value, helpers) => {
  let clean = value.trim();
  // Remove surrounding double or single quotes if present
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1);
  }
  const date = new Date(clean);
  if (isNaN(date.getTime())) {
    return helpers.message('targetDate must be a valid date string (e.g., 2026-06-15T23:59:59.999Z).');
  }
  const now = new Date();
  if (date <= now) {
    return helpers.message('targetDate must be a future date.');
  }
  return date.toISOString();
});

const sheetIdParam = Joi.object({
  slug: Joi.string().trim().lowercase().required(),
}).unknown(true);

const paginationQuery = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

const createSheetManual = Joi.object({
  name: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(1000).allow('').default(''),
  questions: Joi.array().items(Joi.string().trim().min(1).max(200)).min(1).required(),
  targetDate: futureDate,
  specialTag: Joi.string().trim().max(50).optional(),
  originalSourceName: Joi.string().trim().max(200).optional(),
  originalSourceUrl: Joi.string().trim().uri().max(500).optional(),
});

const joinSheet = Joi.object({
  targetDate: futureDate,
});

const updateTargetDate = Joi.object({
  targetDate: futureDate,
});

const updateSheet = Joi.object({
  name: Joi.string().trim().min(3).max(200),
  description: Joi.string().trim().max(1000).allow(''),
  questions: Joi.array().items(Joi.string().trim().min(1).max(200)).min(1),
  specialTag: Joi.string().trim().max(50).optional(),
  originalSourceName: Joi.string().trim().max(200).optional(),
  originalSourceUrl: Joi.string().trim().uri().max(500).optional(),
}).min(1);

const getSheets = Joi.object({
  ...paginationQuery,
  search: Joi.string().trim().min(1).max(100),
  ownerId: Joi.string().hex().length(24),
  sortBy: Joi.string().valid('createdAt', 'name', 'updatedAt', 'bookmarkCount').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  mySheets: Joi.boolean().default(false),
});

const getUserProgress = Joi.object({
  username: Joi.string().pattern(/^[a-zA-Z0-9._-]{3,30}$/).required(),
}).unknown(true);

const importExcelPreview = Joi.object({
  sheetName: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(1000).allow('').default(''),
  targetDate: futureDate,
  specialTag: Joi.string().trim().max(50).optional(),
  originalSourceName: Joi.string().trim().max(200).optional(),
  originalSourceUrl: Joi.string().trim().uri().max(500).optional(),
}).unknown(true);

module.exports = {
  sheetIdParam,
  createSheetManual,
  joinSheet,
  updateTargetDate,
  updateSheet,
  getSheets,
  getUserProgress,
  importExcelPreview,
};