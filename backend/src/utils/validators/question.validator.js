const Joi = require('joi');

const getQuestions = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  platform: Joi.string().valid('LeetCode', 'Codeforces', 'HackerRank', 'AtCoder', 'CodeChef', 'Other'),
  difficulty: Joi.string().valid('Easy', 'Medium', 'Hard'),
  pattern: Joi.string().trim(),
  tags: Joi.array().items(Joi.string().trim()).single(),
  search: Joi.string().trim().min(1).max(100),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'title', 'difficulty', 'platform').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  status: Joi.string().valid('solved')
});

const getQuestionById = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const createQuestion = Joi.object({
  title: Joi.string().trim().required().min(2).max(200),
  problemLink: Joi.string().uri().required(),
  platform: Joi.string().valid('LeetCode', 'Codeforces', 'HackerRank', 'AtCoder', 'CodeChef', 'Other').required(),
  platformQuestionId: Joi.string().allow('').optional(),
  difficulty: Joi.string().valid('Easy', 'Medium', 'Hard').required(),
  tags: Joi.array().items(Joi.string().trim()).default([]),
  pattern: Joi.alternatives().try(
    Joi.string().trim().allow(''),
    Joi.array().items(Joi.string().trim())
  ).optional(),
  solutionLinks: Joi.array().items(Joi.string().uri()).default([]),
  similarQuestions: Joi.array().items(Joi.string().hex().length(24)).default([]),
  contentRef: Joi.string().allow(''),
  testCases: Joi.array().items(Joi.object({
    stdin: Joi.string().allow(''),
    expected: Joi.string().required(),
    isDefault: Joi.boolean().default(true)
  })).default([]),
  starterCode: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  isManual: Joi.boolean().default(false)
}).custom((value, helpers) => {
  if (value.isManual) {
    if (!value.contentRef) {
      return helpers.error('any.required', { message: 'contentRef is required for manual questions' });
    }
    if (!value.testCases || value.testCases.length === 0) {
      return helpers.error('any.required', { message: 'testCases must be a non-empty array for manual questions' });
    }
  }
  return value;
});

const updateQuestion = Joi.object({
  difficulty: Joi.string().valid('Easy', 'Medium', 'Hard'),
  tags: Joi.array().items(Joi.string().trim()),
  pattern: Joi.alternatives().try(
    Joi.string().trim(),
    Joi.array().items(Joi.string().trim())
  ),
  solutionLinks: Joi.array().items(Joi.string().uri()),
  contentRef: Joi.string().allow(''),
  testCases: Joi.array().items(Joi.object({
    stdin: Joi.string().allow(''),
    expected: Joi.string().required(),
    isDefault: Joi.boolean().default(true)
  }))
}).min(1); 

const deleteQuestion = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const getQuestionByPlatformId = Joi.object({
  platform: Joi.string().valid('LeetCode', 'Codeforces', 'HackerRank', 'AtCoder', 'CodeChef', 'Other').required(),
  platformQuestionId: Joi.string().required(),
});

const getSimilarQuestions = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const restoreQuestion = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const permanentDeleteQuestion = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const getDeletedQuestions = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  platform: Joi.string().valid('LeetCode', 'Codeforces', 'HackerRank', 'AtCoder', 'CodeChef', 'Other'),
  difficulty: Joi.string().valid('Easy', 'Medium', 'Hard'),
  pattern: Joi.string().trim(),
  tags: Joi.array().items(Joi.string().trim()).single(),
  search: Joi.string().trim().min(1).max(100),
});

const getQuestionsByPattern = Joi.object({
  patternSlug: Joi.string().pattern(/^[a-z0-9-]+$/).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

module.exports = {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionByPlatformId,
  getSimilarQuestions,
  restoreQuestion,
  permanentDeleteQuestion,
  getDeletedQuestions,
  getQuestionsByPattern,
};