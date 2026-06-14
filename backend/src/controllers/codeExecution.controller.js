/**
 * src/controllers/codeExecution.controller.js
 *
 * Handles code execution requests SYNCHRONOUSLY (no Bull queue).
 * Executes code directly and returns result in the HTTP response.
 * Syntax validation is performed synchronously for fast rejection.
 */

const { executeCodeCore, SUPPORTED_LANGUAGES, normalizeLanguage } = require('../services/codeExecution/coreExecutor');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const Question = require('../models/Question');
const CodeExecutionHistory = require('../models/CodeExecutionHistory');
const { validatePythonSyntax } = require('../utils/pythonSyntaxValidator');
const { validateCppSyntax } = require('../utils/cppSyntaxValidator');
const { normalizeTestCaseInput } = require('../utils/testCaseNormalizer');
const { normalizeCode } = require('../utils/codeNormalizer');
const crypto = require('crypto');

/**
 * Helper to get normalized code hash for matching.
 */
function getNormalizedCodeHash(code) {
  const normalized = normalizeCode(code);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Helper to normalize test cases for matching.
 * Returns a string key (e.g., normalized stdin strings joined).
 */
function normalizeTestCasesForMatch(testCases) {
  if (!testCases || !Array.isArray(testCases)) return '';
  return testCases.map(tc => {
    const normalizedStdin = normalizeTestCaseInput(tc.stdin || '');
    return `${normalizedStdin}|${tc.expected || ''}`;
  }).join('||');
}

/**
 * SYNC ENDPOINT – executes code and returns result directly.
 * POST /api/v1/code/execute
 */
const runCode = async (req, res, next) => {
  try {
    const { language, code, questionId, testCases, stdin, expected, timeSpent = 0 } = req.body;
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

    // Synchronous syntax validation (fast fail)
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

    // Prepare test cases array for comparison
    let finalTestCases = testCases;
    if (stdin !== undefined && !testCases) {
      finalTestCases = [{ stdin: stdin || '', expected: expected || '' }];
    }
    if (!finalTestCases || finalTestCases.length === 0) {
      throw new AppError('No test cases provided', 400);
    }

    // ========== EXECUTION HISTORY REUSE LOGIC ==========
    const userId = req.user._id;
    const normalizedCodeHash = getNormalizedCodeHash(code);
    const testCasesKey = normalizeTestCasesForMatch(finalTestCases);

    const existingHistory = await CodeExecutionHistory.findOne({
      userId,
      questionId,
      language: normalizedLang,
      normalizedCodeHash,
    })
      .sort({ executedAt: -1 })
      .lean();

    let historyMatched = false;
    let matchedResult = null;

    if (existingHistory) {
      const storedTestCasesKey = normalizeTestCasesForMatch(
        existingHistory.testCases.map(tc => ({ stdin: tc.stdin, expected: tc.expected }))
      );
      if (storedTestCasesKey === testCasesKey) {
        historyMatched = true;
        matchedResult = existingHistory;
      }
    }

    if (historyMatched && matchedResult) {
      const UserQuestionProgress = require('../models/UserQuestionProgress');
      const User = require('../models/User');

      // Increment totalTimeSpent in progress
      await UserQuestionProgress.updateOne(
        { userId, questionId },
        { $inc: { totalTimeSpent: timeSpent }, $set: { lastActivityDate: new Date() } },
        { upsert: true }
      );

      // Increment totalTimeSpent in user stats
      await User.updateOne(
        { _id: userId },
        { $inc: { 'stats.totalTimeSpent': timeSpent } }
      );

      // Update lastActivityDate for heatmap (async, don't await)
      const { updateUserActivity } = require('../services/user.service');
      updateUserActivity(userId, new Date(), req.userTimeZone || 'UTC').catch(err => {
        console.warn('Failed to update user activity on history match:', err.message);
      });

      const resultData = {
        questionId: matchedResult.questionId,
        results: matchedResult.testCases.map(tc => ({
          input: tc.stdin,
          output: tc.output,
          expected: tc.expected,
          error: tc.error,
          exitCode: tc.exitCode,
          passed: tc.passed,
        })),
        passedCount: matchedResult.summary.passedCount,
        totalCount: matchedResult.summary.totalCount,
        allPassed: matchedResult.summary.allPassed,
        defaultTestCasesCount: matchedResult.summary.defaultTestCasesCount,
        userCustomTestCasesCount: matchedResult.summary.userCustomTestCasesCount,
        customTestCasesCount: matchedResult.summary.customTestCasesCount,
      };

      return res.json(formatResponse('Code execution completed (cached result)', resultData));
    }
    // ========== END REUSE LOGIC ==========

    // Build execution body
    const executionBody = {
      language: normalizedLang,
      code,
      questionId,
      testCases: finalTestCases,
      stdin,
      expected,
      timeSpent,
    };

    // Execute code directly (synchronous call)
    const result = await executeCodeCore(req.user._id, executionBody, req.userTimeZone || 'UTC');

    res.json(formatResponse('Code execution completed', result));
  } catch (error) {
    next(error);
  }
};

/**
 * ASYNC ENDPOINT (kept for backward compatibility, but now also synchronous)
 * POST /api/v1/code/execute-async
 */
const executeCodeAsync = async (req, res, next) => {
  // Delegate to same logic
  return runCode(req, res, next);
};

/**
 * GET /api/v1/code/result/:jobId – DEPRECATED (no more jobs)
 * Returns 410 Gone to indicate queue is no longer used.
 */
const getCodeResult = async (req, res, next) => {
  res.status(410).json(formatResponse('Queue has been removed. Code execution is now synchronous.', null, null, {
    code: 'QUEUE_REMOVED',
    message: 'The asynchronous queue has been deprecated. Please use POST /code/execute directly.',
  }));
};

module.exports = {
  runCode,
  executeCodeAsync,
  getCodeResult,
};