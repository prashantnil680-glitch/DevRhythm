const Joi = require('joi');

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
  questions: Joi.array()
    .items(Joi.string().trim().min(1).max(200))
    .min(1)
    .required(),
  targetDate: Joi.date().iso().greater('now').required().messages({
    'any.required': 'targetDate is required to create a sheet. Please provide a future date as your completion deadline.',
    'date.greater': 'targetDate must be a future date.',
    // 'date.base': 'targetDate must be a valid ISO date (e.g., 2026-06-15T23:59:59.999Z).',
  }),
});

const joinSheet = Joi.object({
  targetDate: Joi.date().iso().greater('now').required(),
});

const updateSheet = Joi.object({
  name: Joi.string().trim().min(3).max(200),
  description: Joi.string().trim().max(1000).allow(''),
  questions: Joi.array().items(Joi.string().trim().min(1).max(200)).min(1),
}).min(1);

const getSheets = Joi.object({
  ...paginationQuery,
  search: Joi.string().trim().min(1).max(100),
  ownerId: Joi.string().hex().length(24),
  sortBy: Joi.string().valid('createdAt', 'name', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const getUserProgress = Joi.object({
  username: Joi.string().pattern(/^[a-zA-Z0-9._-]{3,30}$/).required(),
}).unknown(true);

const importExcelPreview = Joi.object({
  sheetName: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(1000).allow('').default(''),
  targetDate: Joi.date().iso().greater('now').required().messages({
    'any.required': 'targetDate is required to create a sheet. Please provide a future date as your completion deadline.',
    'date.greater': 'targetDate must be a future date.',
    // 'date.base': 'targetDate must be a valid ISO date (e.g., 2026-06-15T23:59:59.999Z).',
  }),
}).unknown(true);

const updateTargetDate = Joi.object({
  targetDate: Joi.date().iso().greater('now').required().messages({
    'any.required': 'targetDate is required.',
    'date.greater': 'targetDate must be a future date.',
    'date.base': 'targetDate must be a valid ISO date (e.g., 2026-06-15T23:59:59.999Z).',
  }),
});

module.exports = {
  sheetIdParam,
  createSheetManual,
  joinSheet,
  updateSheet,
  getSheets,
  getUserProgress,
  importExcelPreview,
  updateTargetDate,
};