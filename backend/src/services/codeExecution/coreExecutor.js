/**
 * src/services/codeExecution/coreExecutor.js
 *
 * Core code execution logic (atomic, race‑free).
 * Shared between the controller (for potential sync fallback) and the queue handler.
 * No circular dependencies – imports only services and models.
 */

const crypto = require('crypto');
const { DateTime } = require('luxon');
const metadataService = require('./metadata.service');
const PythonGenerator = require('./wrappers/pythonGenerator');
const JavaGenerator = require('./wrappers/javaGenerator');
const CppGenerator = require('./wrappers/cppGenerator');
const JsGenerator = require('./wrappers/jsGenerator');
const { normalizeTestCaseInput } = require('../../utils/testCaseNormalizer');
const OutputComparator = require('../../utils/helpers/outputComparator');
const AppError = require('../../utils/errors/AppError');
const Question = require('../../models/Question');
const UserQuestionProgress = require('../../models/UserQuestionProgress');
const CodeExecutionHistory = require('../../models/CodeExecutionHistory');
const RevisionSchedule = require('../../models/RevisionSchedule');
const ActivityLog = require('../../models/ActivityLog');
const { invalidateCache, invalidateProgressCache } = require('../../middleware/cache');
const revisionActivityService = require('../revisionActivity.service');
const constants = require('../../config/constants');
const { incrementUserStats } = require('../user.service');
const { incrementDailyActivityDirect } = require('../heatmap.service');
const { updateUserActivity } = require('../user.service');
const { atomicUpdateQuestionProgressOnSolve, atomicIncrementUserStats } = require('../../utils/atomicUpdate');
const { validatePythonSyntax } = require('../../utils/pythonSyntaxValidator');
const { validateCppSyntax } = require('../../utils/cppSyntaxValidator');
const { getPythonImports, getCppIncludes, prependCppAutoIncludes } = require('../../utils/autoImports');
const { client: redisClient } = require('../../config/redis');
const { analyzeCppError } = require('../../utils/cppErrorAnalyzer');

// Lazy load jobQueue to avoid circular dependency
let cachedJobQueue = null;
function getJobQueue() {
  if (!cachedJobQueue) {
    const { jobQueue } = require('../queue.service');
    cachedJobQueue = jobQueue;
  }
  return cachedJobQueue;
}

const SUPPORTED_LANGUAGES = ['cpp', 'python', 'java', 'javascript'];
const GENERATORS = {
  python: new PythonGenerator(),
  java: new JavaGenerator(),
  cpp: new CppGenerator(),
  javascript: new JsGenerator(),
};

/**
 * Compute SHA256 hash of code for caching.
 */
function getCodeHash(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Get cached syntax validation result.
 * @returns {Promise<{error: string|null, cached: boolean}>}
 */
async function getCachedSyntaxValidation(language, codeHash) {
  if (!redisClient) return { error: null, cached: false };
  try {
    const cacheKey = `syntax:valid:${language}:${codeHash}`;
    const cached = await redisClient.get(cacheKey);
    if (cached !== null) {
      const parsed = JSON.parse(cached);
      return { error: parsed.error, cached: true };
    }
  } catch (err) {
    console.warn('[SyntaxCache] Redis get error:', err.message);
  }
  return { error: null, cached: false };
}

/**
 * Store syntax validation result in cache.
 */
async function setCachedSyntaxValidation(language, codeHash, error) {
  if (!redisClient) return;
  try {
    const cacheKey = `syntax:valid:${language}:${codeHash}`;
    const value = JSON.stringify({ error: error || null });
    await redisClient.setex(cacheKey, 300, value); // TTL 5 minutes
  } catch (err) {
    console.error('[SyntaxCache] Failed to cache syntax validation:', err.message);
    // Do not throw – caching failure should not block execution.
  }
}

const normalizeLanguage = (lang) => {
  const lower = lang.toLowerCase();
  if (lower === 'c++') return 'cpp';
  if (lower === 'python3') return 'python';
  if (lower === 'javascript') return 'javascript';
  if (lower === 'java') return 'java';
  return lower;
};

const normalizeForCompare = (str) => (str || '').replace(/\s+/g, ' ').trim();

/**
 * Build the complete set of test cases to run (default + custom + request).
 */
const buildTestCases = (question, userProgress, requestTestCases, stdin, expected) => {
  const defaultTestCases = (question.testCases || []).map(tc => ({
    stdin: normalizeTestCaseInput(tc.stdin || tc.input),
    expected: tc.expected || tc.expectedOutput,
  }));

  const userCustomTestCases = (userProgress?.customTestCases || []).map(tc => ({
    stdin: normalizeTestCaseInput(tc.stdin),
    expected: tc.expected,
  }));

  const requestTests = (requestTestCases && Array.isArray(requestTestCases)) ? requestTestCases.map(tc => ({
    stdin: normalizeTestCaseInput(tc.stdin),
    expected: tc.expected,
  })) : [];

  const singleTest = (stdin !== undefined && !requestTestCases) ? [{
    stdin: normalizeTestCaseInput(stdin),
    expected: expected || '',
  }] : [];

  const allTests = [...defaultTestCases, ...userCustomTestCases, ...requestTests, ...singleTest];

  const uniqueMap = new Map();
  for (const tc of allTests) {
    const key = `${normalizeForCompare(tc.stdin)}|${normalizeForCompare(tc.expected)}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, tc);
  }
  return Array.from(uniqueMap.values());
};

/**
 * Save custom test cases to user progress.
 */
const saveCustomTestCases = async (userId, questionId, testCases, defaultTestCases) => {
  if (!testCases || testCases.length === 0) {
    await UserQuestionProgress.findOneAndUpdate(
      { userId, questionId },
      { $set: { customTestCases: [] } },
      { upsert: true }
    );
    return;
  }

  const defaultSet = new Set(
    defaultTestCases.map(tc => `${normalizeForCompare(tc.stdin)}|${normalizeForCompare(tc.expected)}`)
  );
  const uniqueCustom = testCases.filter(tc => {
    const key = `${normalizeForCompare(tc.stdin)}|${normalizeForCompare(tc.expected)}`;
    return !defaultSet.has(key);
  });

  await UserQuestionProgress.findOneAndUpdate(
    { userId, questionId },
    { $set: { customTestCases: uniqueCustom.map(tc => ({ stdin: tc.stdin, expected: tc.expected, updatedAt: new Date() })) } },
    { upsert: true }
  );
};

/**
 * Clean old execution history.
 */
const cleanupExecutionHistory = async (userId, questionId, language) => {
  const records = await CodeExecutionHistory.find({ userId, questionId, language }).sort({ executedAt: -1 });
  const passedRecords = records.filter(r => r.summary?.allPassed === true);
  const nonPassedRecords = records.filter(r => r.summary?.allPassed !== true);

  const toDelete = [];
  if (passedRecords.length > 1) toDelete.push(...passedRecords.slice(1).map(r => r._id));
  if (nonPassedRecords.length > 2) toDelete.push(...nonPassedRecords.slice(2).map(r => r._id));

  if (toDelete.length) await CodeExecutionHistory.deleteMany({ _id: { $in: toDelete } });
};

/**
 * Merge starter metadata with user‑code metadata, overriding parameter types
 * when the user provides a more specific type.
 * @param {object} starter - Metadata from starter code.
 * @param {object} user - Metadata from user code.
 * @returns {object} Merged metadata object.
 */
function mergeMetadata(starter, user) {
  if (!starter) return user || starter;
  if (!user) return starter;

  const merged = { ...starter };

  if (starter.methodName && user.methodName && starter.methodName !== user.methodName) {
    console.warn(`[Merge] Method name mismatch: starter="${starter.methodName}", user="${user.methodName}". Using starter.`);
  }

  if (starter.parameters && Array.isArray(starter.parameters)) {
    const userParams = user.parameters || [];
    const userParamMap = new Map(userParams.map(p => [p.name, p.type]));

    merged.parameters = starter.parameters.map(param => {
      const userType = userParamMap.get(param.name);
      if (userType && userType !== 'Any' && userType !== 'object' && userType !== 'None') {
        const isUseful = /(?:TreeNode|ListNode|Node|NestedInteger|List\[.*\]|Optional\[.*\])/.test(userType);
        if (isUseful) {
          console.log(`[Merge] Overriding parameter "${param.name}" type: "${param.type}" → "${userType}"`);
          return { ...param, type: userType };
        }
      }
      return param;
    });
  }

  return merged;
}

/**
 * Helper function to enrich C++ error messages with a user‑friendly hint.
 * @param {string} errorMsg - The original error message.
 * @param {string} language - The programming language ('cpp', 'python', etc.).
 * @returns {string} The enriched error message.
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
 * Core execution logic – atomic and race‑free.
 * @returns {Promise<object>} Result object.
 */
async function executeCodeCore(userId, body, timeZone = 'UTC', timing = null) {
  if (!timing) {
    timing = { start: () => {}, end: () => {}, record: () => {} };
  }

  let { language, code, stdin, expected, testCases, questionId } = body;
  
  const originalUserCode = code;

  language = normalizeLanguage(language);

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new AppError(`Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`, 400);
  }
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    throw new AppError('Code cannot be empty', 400);
  }
  if (!questionId) throw new AppError('questionId is required', 400);

  // Auto‑inject imports/includes
  if (language === 'python') {
    const autoImports = getPythonImports();
    if (!code.includes('# === Auto-injected imports (LeetCode‑style) ===')) {
      code = autoImports + '\n\n' + code;
    }
  }
  if (language === 'cpp') {
    code = prependCppAutoIncludes(code);
  }

  const [question, userProgress] = await Promise.all([
    Question.findById(questionId).lean(),
    UserQuestionProgress.findOne({ userId, questionId }),
  ]);
  if (!question) throw new AppError('Question not found', 404);

  // Metadata extraction
  timing.start('validation.metadata_extraction');
  let metadata;
  try {
    const starterMetadata = await metadataService.getExecutionMetadata(questionId, language);
    const userMetadata = metadataService.extractFromCode(code, language);
    metadata = mergeMetadata(starterMetadata, userMetadata);
    timing.end('validation.metadata_extraction');
  } catch (err) {
    timing.end('validation.metadata_extraction');
    console.error(`[CodeExecution] Metadata extraction failed for question ${questionId}, language ${language}:`, err);
    throw new AppError(`Failed to extract problem metadata: ${err.message}. Please ensure the starter code is valid.`, 400);
  }
  timing.end('validation.ast_parsing');

  const defaultTestCases = (question.testCases || []).map(tc => ({
    stdin: tc.stdin || '',
    expected: tc.expected,
  }));
  timing.start('test_cases.preparation');
  const finalTestCases = buildTestCases(question, userProgress, testCases, stdin, expected);
  if (finalTestCases.length === 0) throw new AppError('No test cases available for this question', 400);
  timing.end('test_cases.preparation');
  timing.record('test_cases.count', finalTestCases.length, { count: finalTestCases.length });

  const codeHash = getCodeHash(code);
  let syntaxError = null;

  // Syntax validation with caching (Python & C++)
  if (language === 'python') {
    timing.start('validation.syntax_validation');
    const { error: cachedError, cached } = await getCachedSyntaxValidation('python', codeHash);
    if (cached) {
      syntaxError = cachedError;
    } else {
      syntaxError = validatePythonSyntax(code);
      await setCachedSyntaxValidation('python', codeHash, syntaxError);
    }
    timing.end('validation.syntax_validation');
    if (syntaxError) {
      const failedResults = finalTestCases.map(tc => ({
        input: tc.stdin,
        output: '',
        expected: tc.expected,
        error: enrichCppError(syntaxError, language), // Will be no‑op for python
        exitCode: 1,
        passed: false,
      }));
      return {
        questionId,
        results: failedResults,
        passedCount: 0,
        totalCount: finalTestCases.length,
        allPassed: false,
        defaultTestCasesCount: defaultTestCases.length,
        userCustomTestCasesCount: (userProgress?.customTestCases || []).length,
        customTestCasesCount: 0,
      };
    }
  }

  if (language === 'cpp') {
    timing.start('validation.syntax_validation');
    const { error: cachedError, cached } = await getCachedSyntaxValidation('cpp', codeHash);
    if (cached) {
      syntaxError = cachedError;
    } else {
      syntaxError = validateCppSyntax(code);
      await setCachedSyntaxValidation('cpp', codeHash, syntaxError);
    }
    timing.end('validation.syntax_validation');
    if (syntaxError) {
      const failedResults = finalTestCases.map(tc => ({
        input: tc.stdin,
        output: '',
        expected: tc.expected,
        error: enrichCppError(syntaxError, language),
        exitCode: 1,
        passed: false,
      }));
      return {
        questionId,
        results: failedResults,
        passedCount: 0,
        totalCount: finalTestCases.length,
        allPassed: false,
        defaultTestCasesCount: defaultTestCases.length,
        userCustomTestCasesCount: (userProgress?.customTestCases || []).length,
        customTestCasesCount: 0,
      };
    }
  }

  timing.start('validation.normalization');
  timing.end('validation.normalization');

  const generator = GENERATORS[language];
  if (!generator) throw new AppError(`No wrapper generator for language: ${language}`, 500);
  let fullCode;
  try {
    fullCode = generator.generateWrapper(code, metadata, finalTestCases);
  } catch (err) {
    console.error(`[CodeExecution] Wrapper generation failed for language ${language}:`, err);
    throw new AppError(`Wrapper generation failed: ${err.message}`, 400);
  }

  if (process.env.NODE_ENV === 'development' && language === 'python') {
    console.log(`[CodeExecution] Generated Python code (first 500 chars):\n${fullCode.substring(0, 500)}`);
  }

  let batchResults;
  timing.start('compiler.provider_request');
  const compilerStart = Date.now();
  try {
    const { executeBatch } = require('../codeExecution.service');
    batchResults = await executeBatch({
      language,
      code: fullCode,
      testCases: finalTestCases,
    });
    const compilerDuration = Date.now() - compilerStart;
    timing.end('compiler.provider_request');
    timing.record('compiler.external_api_duration', compilerDuration);
  } catch (execError) {
    timing.end('compiler.provider_request');
    console.error('Execution provider error:', execError);
    const errorMsg = enrichCppError(`Code execution service error: ${execError.message}`, language);
    const failedResults = finalTestCases.map(tc => ({
      input: tc.stdin,
      output: '',
      expected: tc.expected,
      error: errorMsg,
      exitCode: -1,
      passed: false,
    }));
    return {
      questionId,
      results: failedResults,
      passedCount: 0,
      totalCount: finalTestCases.length,
      allPassed: false,
      defaultTestCasesCount: defaultTestCases.length,
      userCustomTestCasesCount: (userProgress?.customTestCases || []).length,
      customTestCasesCount: 0,
    };
  }

  const isOrderIrrelevant = question.contentRef ? /any order/i.test(question.contentRef) : false;
  timing.start('processing.result_parsing');
  const results = batchResults.map((res, idx) => {
    const testCase = finalTestCases[idx];
    const actualOutput = res.stdout || '';
    const expectedOutput = testCase.expected || '';
    let errorMessage = res.stderr || '';

    // Enrich C++ errors with hints if present
    if (language === 'cpp' && errorMessage) {
      errorMessage = enrichCppError(errorMessage, language);
    }

    let actualParsed = null;
    let expectedParsed = null;
    let passed = false;

    try {
      if (actualOutput.trim() !== '') {
        actualParsed = JSON.parse(actualOutput);
      }
      if (expectedOutput.trim() !== '') {
        expectedParsed = JSON.parse(expectedOutput);
      }
    } catch (e) {
      // Fallback to string comparison
    }

    if (actualParsed !== null && expectedParsed !== null) {
      passed = OutputComparator.compare(actualParsed, expectedParsed, {
        unordered: isOrderIrrelevant,
        floatTolerance: 1e-9,
      });
    } else {
      const normalizedActual = (actualOutput || '').replace(/\s/g, '');
      const normalizedExpected = (expectedOutput || '').replace(/\s/g, '');
      passed = normalizedActual === normalizedExpected;
    }

    // If there is an error (stderr) and the test didn't pass, we already have the enriched error.
    // If there is no error but exit code is non‑zero, we add a generic message.
    const finalError = errorMessage || (res.exitCode !== 0 ? `Execution failed with exit code ${res.exitCode}` : '');

    return {
      input: testCase.stdin,
      output: actualOutput,
      expected: expectedOutput,
      error: finalError,
      exitCode: res.exitCode ?? (finalError ? 1 : 0),
      passed,
    };
  });
  timing.end('processing.result_parsing');

  timing.start('processing.pass_fail_calculation');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = finalTestCases.length;
  const allPassed = passedCount === totalCount;
  timing.end('processing.pass_fail_calculation');

  // Queue analytics job
  const jobQueue = getJobQueue();
  if (jobQueue) {
    try {
      await jobQueue.add('test_case.executed', {
        userId,
        questionId,
        passedCount,
        failedCount: totalCount - passedCount,
        totalTestCases: totalCount,
        allPassed,
        executedAt: new Date(),
        language,
      });
    } catch (queueErr) {
      console.error('Failed to queue test_case.executed job:', queueErr.message);
    }
  }

  let customToSave = [];
  if (testCases && Array.isArray(testCases)) customToSave = testCases;
  else if (stdin !== undefined) customToSave = [{ stdin: stdin || '', expected: expected || '' }];
  await saveCustomTestCases(userId, questionId, customToSave, defaultTestCases);

  timing.start('persistence.result_storage');
  await CodeExecutionHistory.create({
    userId,
    questionId,
    language,
    code: originalUserCode,
    testCases: results.map(r => ({
      stdin: r.input,
      expected: r.expected,
      output: r.output,
      error: r.error,
      exitCode: r.exitCode,
      passed: r.passed,
    })),
    summary: {
      passedCount,
      totalCount,
      allPassed,
      defaultTestCasesCount: defaultTestCases.length,
      userCustomTestCasesCount: (userProgress?.customTestCases || []).length,
      customTestCasesCount: customToSave.length,
    },
  });
  timing.end('persistence.result_storage');

  await cleanupExecutionHistory(userId, questionId, language);

  timing.start('processing.revision_update');
  const existingRevision = await RevisionSchedule.findOne({ userId, questionId });
  if (!existingRevision && allPassed) {
    const solvedLocal = DateTime.fromJSDate(new Date(), { zone: timeZone });
    const scheduleDays = constants.REVISION_SCHEDULE;
    const scheduleUTC = scheduleDays.map(days => solvedLocal.startOf('day').plus({ days }).toUTC().toJSDate());
    await RevisionSchedule.create({
      userId,
      questionId,
      schedule: scheduleUTC,
      baseDate: new Date(),
      status: 'active',
      currentRevisionIndex: 0,
      completedRevisions: [],
    });
    await invalidateCache(`revisions:*:user:${userId}:*`);
    // Also invalidate question details cache for the new revision
    await invalidateCache(`question-details:user:${userId}:*`);
    await invalidateCache(`question-details:user:${userId}:*/questions/${questionId}/details*`);
  }
  timing.end('processing.revision_update');

  const responseData = {
    questionId,
    results,
    passedCount,
    totalCount,
    allPassed,
    defaultTestCasesCount: defaultTestCases.length,
    userCustomTestCasesCount: (userProgress?.customTestCases || []).length,
    customTestCasesCount: customToSave.length,
  };

  // ----- ATOMIC UPDATES FOR SYNC STATS, HEATMAP, ETC. (ActivityLog removed) -----
  if (allPassed) {
    const now = new Date();
    const totalActiveQuestions = await Question.countDocuments({ isActive: true });

    timing.start('processing.question_solved_update');
    const { progress: updatedProgress, isFirstSolve } = await atomicUpdateQuestionProgressOnSolve(
      userId,
      questionId,
      now,
      body.timeSpent || 0
    );

    if (isFirstSolve) {
      await atomicIncrementUserStats(userId, 1, body.timeSpent || 0, totalActiveQuestions);
    }
    timing.end('processing.question_solved_update');

    await updateUserActivity(userId, now, timeZone);

    // ##### REMOVED: Direct ActivityLog.create – now handled by question.solved queue handler #####
    // No longer create ActivityLog here to avoid duplication.

    await invalidateProgressCache(userId);

    if (jobQueue) {
      await jobQueue.add('question.solved', {
        userId,
        questionId,
        progressId: updatedProgress?._id,
        timeSpent: body.timeSpent || 0,
        solvedAt: now,
        source: 'test_case',
      });
    }

    timing.start('processing.confidence_update');
    await revisionActivityService.recordCodeSubmission(userId, questionId, now);
    const revisionResult = await revisionActivityService.checkAndCompleteRevision(
      userId,
      questionId,
      now,
      'auto',
      { targetDate: now }
    );
    if (revisionResult.completed) {
      responseData.revisionCompleted = true;
      responseData.revisionMessage = revisionResult.message;
      responseData.revisionOutOfOrder = revisionResult.outOfOrder || false;
      responseData.revisionOverdueCompleted = revisionResult.overdueCompleted || false;
    }

    const pastResult = await revisionActivityService.completeAllPastSessionsForQuestion(userId, questionId);
    if (pastResult.completed > 0) {
      responseData.pastRevisionsCompleted = pastResult.completed;
      console.log(`[CodeExecution] Completed ${pastResult.completed} past revision session(s) for question ${questionId}`);
    }

    timing.end('processing.confidence_update');
  }

  // ------------------------------------------------------------------
  // INVALIDATE QUESTION DETAILS CACHE (always after successful execution)
  // This ensures that the latest execution history, progress, and revision
  // status are reflected in the question details endpoint.
  // ------------------------------------------------------------------
  // We invalidate even if some tests failed, because the execution history
  // and attempts were still updated.
  await invalidateCache(`question-details:user:${userId}:*`);
  await invalidateCache(`question-details:user:${userId}:*/questions/${questionId}/details*`);

  return responseData;
}

module.exports = {
  executeCodeCore,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
};