const Joi = require('joi');

const manualDraftSchema = Joi.object({
  name: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(1000).allow('').optional(),
  targetDate: Joi.date().iso().required(),
  specialTag: Joi.string().trim().max(50).allow('').optional(),
  originalSourceName: Joi.string().trim().max(200).allow('').optional(),
  originalSourceUrl: Joi.string().trim().uri().max(500).allow('').optional(),
  selectedQuestions: Joi.array().items(
    Joi.object({
      id: Joi.string().hex().length(24).required(),
      title: Joi.string().trim().required(),
    })
  ).default([]),
});

const importDraftSchema = Joi.object({
  sheetName: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(1000).allow('').optional(),
  targetDate: Joi.date().iso().required(),
  specialTag: Joi.string().trim().max(50).allow('').optional(),
  originalSourceName: Joi.string().trim().max(200).allow('').optional(),
  originalSourceUrl: Joi.string().trim().uri().max(500).allow('').optional(),
  fileId: Joi.string().trim().max(200).allow('', null).optional(),
  fileName: Joi.string().trim().max(255).allow('', null).optional(),
});

module.exports = {
  manualDraftSchema,
  importDraftSchema,
};