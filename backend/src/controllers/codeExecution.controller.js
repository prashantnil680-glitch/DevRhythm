/**
 * src/controllers/codeExecution.controller.js
 *
 * Handles code execution requests SYNCHRONOUSLY (no Bull queue).
 * Executes code immediately and returns result in the HTTP response.
 * Syntax validation is performed synchronously for fast rejection.
 */

const { executeCodeCore, SUPPORTED_LANGUAGES, normalizeLanguage } = require('../services/codeExecution/coreExecutor');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const Question = require('../models/Question');
const { validatePythonSyntax } = require('../utils/pythonSyntaxValidator');
const { validateCppSyntax } = require('../utils/cppSyntaxValidator');
const { analyzeCppError } = require('../utils/cppErrorAnalyzer');

/**
 * Helper to enrich C++ error messages.
 * @param {string} errorMsg - The original error message.
 * @param {string} language - The programming language.
 * @returns {string} Enriched error message.
 */
function enrichCppError(errorMsg, language) {
  if (language !== 'cpp' || !errorMsg) return errorMsg;
  const analysis = analyzeCppError(errorMsg);
  if (analysis.hint) {
    return `${errorMsg}\n\nHint: ${analysis.hint}`;
  }
  return errorMsg;
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

    // ========== EARLY SYNTAX VALIDATION (FAST FAIL) ==========
    let syntaxError = null;
    if (normalizedLang === 'python') {
      syntaxError = validatePythonSyntax(code);
    } else if (normalizedLang === 'cpp') {
      syntaxError = validateCppSyntax(code);  // Now uses -std=c++14
    }
    if (syntaxError) {
      // Enrich C++ syntax errors with user-friendly hints
      const enrichedError = enrichCppError(syntaxError, normalizedLang);
      return res.status(400).json(formatResponse('Syntax error in code', null, null, {
        code: 'SYNTAX_ERROR',
        message: enrichedError,
        language: normalizedLang,
      }));
    }

    const question = await Question.findById(questionId).select('_id');
    if (!question) throw new AppError('Question not found', 404);

    let finalTestCases = testCases;
    if (stdin !== undefined && !testCases) {
      finalTestCases = [{ stdin: stdin || '', expected: expected || '' }];
    }

    // Build execution body
    const executionBody = {
      language: normalizedLang,
      code,
      questionId,
      testCases: finalTestCases || [],
      stdin,
      expected,
      timeSpent,
    };

    // Execute code directly
    const result = await executeCodeCore(req.user._id, executionBody, req.userTimeZone || 'UTC');

    // Add C++ standard metadata to response if language is C++
    const meta = {};
    if (normalizedLang === 'cpp') {
      meta.cppStandard = 'C++14';
      meta.compiler = 'g++-15 (default standard)';
    }

    res.json(formatResponse('Code execution completed', result, meta));
  } catch (error) {
    // Enrich any error thrown from the core (if it's C++ related)
    const lang = req.body.language ? normalizeLanguage(req.body.language) : '';
    if (lang === 'cpp' && error.message) {
      error.message = enrichCppError(error.message, 'cpp');
    }
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