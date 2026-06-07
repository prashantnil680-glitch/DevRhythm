/**
 * src/controllers/codeExecution.controller.js
 *
 * Handles code execution requests.
 * All submissions are processed asynchronously via dedicated Bull queues.
 * Fast languages (Python, JavaScript) go to fast queue.
 * Slow languages (C++, Java) go to slow queue.
 * Syntax validation is performed synchronously to avoid queuing invalid code.
 */

const crypto = require('crypto');
const { fastCodeExecutionQueue } = require('../services/fastCodeExecutionQueue.service');
const { slowCodeExecutionQueue } = require('../services/slowCodeExecutionQueue.service');
const { executeCodeCore, SUPPORTED_LANGUAGES, normalizeLanguage } = require('../services/codeExecution/coreExecutor');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const Question = require('../models/Question');
const CodeExecutionJob = require('../models/CodeExecutionJob');
const { validatePythonSyntax } = require('../utils/pythonSyntaxValidator');
const { validateCppSyntax } = require('../utils/cppSyntaxValidator');

// Language classification
const FAST_LANGUAGES = ['python', 'javascript'];
const SLOW_LANGUAGES = ['cpp', 'java'];

/**
 * Determine which queue to use based on language.
 * @param {string} language - Normalized language (python, javascript, cpp, java)
 * @returns {Bull.Queue} The appropriate Bull queue
 */
function getQueueForLanguage(language) {
  if (FAST_LANGUAGES.includes(language)) {
    return fastCodeExecutionQueue;
  }
  if (SLOW_LANGUAGES.includes(language)) {
    return slowCodeExecutionQueue;
  }
  // Fallback to fast queue (should never happen due to SUPPORTED_LANGUAGES check)
  return fastCodeExecutionQueue;
}

/**
 * SYNC ENDPOINT (returns job ID immediately).
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

    // ========== SYNCHRONOUS SYNTAX VALIDATION ==========
    let syntaxError = null;
    if (normalizedLang === 'python') {
      syntaxError = validatePythonSyntax(code);
    } else if (normalizedLang === 'cpp') {
      syntaxError = validateCppSyntax(code);
    }

    if (syntaxError) {
      return res.status(400).json(formatResponse('Syntax error in code', null, null, {
        code: 'SYNTAX_ERROR',
        message: syntaxError,
        language: normalizedLang,
      }));
    }
    // ========== END SYNCHRONOUS VALIDATION ==========

    let finalTestCases = testCases;
    if (stdin !== undefined && !testCases) {
      finalTestCases = [{ stdin: stdin || '', expected: expected || '' }];
    }

    const jobId = crypto.randomUUID();

    // Create job document in database
    await CodeExecutionJob.create({
      jobId,
      userId: req.user._id,
      questionId,
      language: normalizedLang,
      code,
      testCases: finalTestCases || [],
      status: 'pending',
      timezone: req.userTimeZone || 'UTC',
    });

    // Select appropriate queue based on language
    const targetQueue = getQueueForLanguage(normalizedLang);
    const queueName = targetQueue === fastCodeExecutionQueue ? 'fast' : 'slow';

    // Add job to the selected queue
    await targetQueue.add('code.execution', { jobId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      timeout: 30000,
      removeOnComplete: true,
      removeOnFail: true,
    });

    console.log(`[CodeExecution] Job ${jobId} enqueued to ${queueName} queue (language: ${normalizedLang})`);

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

    // ========== SYNCHRONOUS SYNTAX VALIDATION ==========
    let syntaxError = null;
    if (normalizedLang === 'python') {
      syntaxError = validatePythonSyntax(code);
    } else if (normalizedLang === 'cpp') {
      syntaxError = validateCppSyntax(code);
    }

    if (syntaxError) {
      return res.status(400).json(formatResponse('Syntax error in code', null, null, {
        code: 'SYNTAX_ERROR',
        message: syntaxError,
        language: normalizedLang,
      }));
    }
    // ========== END SYNCHRONOUS VALIDATION ==========

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

    const targetQueue = getQueueForLanguage(normalizedLang);
    const queueName = targetQueue === fastCodeExecutionQueue ? 'fast' : 'slow';

    await targetQueue.add('code.execution', { jobId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      timeout: 30000,
      removeOnComplete: true,
      removeOnFail: true,
    });

    console.log(`[CodeExecution] Job ${jobId} enqueued to ${queueName} queue (language: ${normalizedLang})`);

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