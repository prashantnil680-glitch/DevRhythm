/**
 * src/controllers/codeExecution.controller.js
 *
 * Handles code execution requests.
 * All submissions are processed asynchronously via Bull queue.
 */

const crypto = require('crypto');
const { enqueueExecution, getExecutionStatus } = require('../services/queue.service');
const { executeCodeCore, SUPPORTED_LANGUAGES, normalizeLanguage } = require('../services/codeExecution/coreExecutor');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const Question = require('../models/Question');
const CodeExecutionJob = require('../models/CodeExecutionJob');
const { jobQueue } = require('../services/queue.service');

/**
 * SYNC ENDPOINT (now returns job ID immediately).
 * POST /api/v1/code/execute
 */
const runCode = async (req, res, next) => {
  try {
    const { language, code, questionId, testCases, stdin, expected } = req.body;
    const normalizedLang = normalizeLanguage(language);
    if (!SUPPORTED_LANGUAGES.includes(normalizedLang)) {
      throw new AppError(`Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`, 400);
    }
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      throw new AppError('Code cannot be empty', 400);
    }
    if (!questionId) throw new AppError('questionId is required', 400);

    const question = await Question.findById(questionId).select('_id');
    if (!question) throw new AppError('Question not found', 404);

    let finalTestCases = testCases;
    if (stdin !== undefined && !testCases) {
      finalTestCases = [{ stdin: stdin || '', expected: expected || '' }];
    }

    const jobId = await enqueueExecution({
      userId: req.user._id,
      language: normalizedLang,
      code,
      questionId,
      testCases: finalTestCases || [],
      timezone: req.userTimeZone || 'UTC',
    });

    res.status(202).json(formatResponse('Code execution queued', { jobId, status: 'pending' }));
  } catch (error) {
    next(error);
  }
};

/**
 * ASYNC ENDPOINT (direct queue submission)
 * POST /api/v1/code/execute-async
 */
const executeCodeAsync = async (req, res, next) => {
  try {
    const { language, code, testCases, questionId, stdin, expected } = req.body;
    const normalizedLang = normalizeLanguage(language);
    if (!SUPPORTED_LANGUAGES.includes(normalizedLang)) {
      throw new AppError(`Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`, 400);
    }
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      throw new AppError('Code cannot be empty', 400);
    }
    if (!questionId) throw new AppError('questionId is required', 400);

    const question = await Question.findById(questionId).select('_id');
    if (!question) throw new AppError('Question not found', 404);

    const jobId = crypto.randomUUID();
    const finalTestCases = testCases || (stdin !== undefined ? [{ stdin: stdin || '', expected: expected || '' }] : []);

    const jobDoc = new CodeExecutionJob({
      jobId,
      userId: req.user._id,
      questionId,
      language: normalizedLang,
      code,
      testCases: finalTestCases,
      status: 'pending',
      timezone: req.userTimeZone || 'UTC',
    });
    await jobDoc.save();

    if (!jobQueue) {
      throw new AppError('Job queue not available', 500);
    }
    await jobQueue.add('code.execution', { jobId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    jobDoc.bullJobId = jobDoc.id; // Bull job id not needed, but store something
    await jobDoc.save();

    res.status(202).json(formatResponse('Code execution queued', { jobId, status: 'pending' }));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/code/result/:jobId
 */
const getCodeResult = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    // Use lean() and bypass any Mongoose caching
    const jobDoc = await CodeExecutionJob.findOne({ jobId }).lean();
    if (!jobDoc) {
      console.warn(`[Poll] Job ${jobId} not found in DB`);
      throw new AppError('Job not found', 404);
    }
    if (jobDoc.userId.toString() !== req.user._id.toString()) {
      console.warn(`[Poll] User mismatch: job.user=${jobDoc.userId}, req.user=${req.user._id}`);
      throw new AppError('Unauthorized', 403);
    }

    console.log(`[Poll] Job ${jobId} status=${jobDoc.status}, result=${!!jobDoc.result}`);

    if (jobDoc.status === 'completed') {
      return res.json(formatResponse('Code execution completed', {
        status: 'completed',
        result: jobDoc.result,
      }));
    } else if (jobDoc.status === 'failed') {
      return res.json(formatResponse('Code execution failed', {
        status: 'failed',
        error: jobDoc.errorMessage,
      }));
    } else {
      return res.json(formatResponse('Code execution in progress', {
        status: jobDoc.status,
        progress: jobDoc.progress,
      }));
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  runCode,
  executeCodeAsync,
  getCodeResult,
};