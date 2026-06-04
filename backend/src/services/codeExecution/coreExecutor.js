/**
 * src/services/codeExecution/coreExecutor.js
 *
 * Core code execution logic (atomic, race‑free).
 * Shared between the controller (for potential sync fallback) and the queue handler.
 * No circular dependencies – imports only services and models.
 */

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
const { atomicUpdateQuestionProgressOnSolve, atomicIncrementHeatmapDay, atomicIncrementUserStats } = require('../../utils/atomicUpdate');
const { validatePythonSyntax } = require('../../utils/pythonSyntaxValidator');
const { validateCppSyntax } = require('../../utils/cppSyntaxValidator');
const { getPythonImports, getCppIncludes } = require('../../utils/autoImports');

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
 * Core execution logic – atomic and race‑free.
 * @returns {Promise<object>} Result object.
 */
async function executeCodeCore(userId, body, timeZone = 'UTC') {
  let { language, code, stdin, expected, testCases, questionId } = body;
  language = normalizeLanguage(language);

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new AppError(`Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`, 400);
  }
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    throw new AppError('Code cannot be empty', 400);
  }
  if (!questionId) throw new AppError('questionId is required', 400);

  // ========== AUTO-INJECT IMPORTS FOR PYTHON ==========
  if (language === 'python') {
    const autoImports = getPythonImports();
    if (!code.includes('# === Auto-injected imports (LeetCode‑style) ===')) {
      code = autoImports + '\n\n' + code;
    }
  }
  // ========== END AUTO-INJECT ==========

  // ========== AUTO-INJECT INCLUDES FOR C++ ==========
  if (language === 'cpp') {
    const autoIncludes = getCppIncludes();
    const hasIncludes = /^\s*#include\s*[<"]/m.test(code);
    if (!hasIncludes && !code.includes('// === Auto-injected includes (LeetCode‑style) ===')) {
      code = autoIncludes + '\n\n' + code;
    }
  }
  // ========== END AUTO-INJECT ==========

  const [question, userProgress] = await Promise.all([
    Question.findById(questionId).lean(),
    UserQuestionProgress.findOne({ userId, questionId }),
  ]);
  if (!question) throw new AppError('Question not found', 404);

  let metadata;
  try {
    metadata = await metadataService.getExecutionMetadata(questionId, language);
  } catch (err) {
    console.error(`[CodeExecution] Metadata extraction failed for question ${questionId}, language ${language}:`, err);
    throw new AppError(`Failed to extract problem metadata: ${err.message}. Please ensure the starter code is valid.`, 400);
  }

  const defaultTestCases = (question.testCases || []).map(tc => ({
    stdin: tc.stdin || '',
    expected: tc.expected,
  }));
  const finalTestCases = buildTestCases(question, userProgress, testCases, stdin, expected);
  if (finalTestCases.length === 0) throw new AppError('No test cases available for this question', 400);

  // ========== SYNTAX VALIDATION (Python & C++) ==========
  if (language === 'python') {
    const syntaxError = validatePythonSyntax(code);
    if (syntaxError) {
      const failedResults = finalTestCases.map(tc => ({
        input: tc.stdin,
        output: '',
        expected: tc.expected,
        error: syntaxError,
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
    const syntaxError = validateCppSyntax(code);
    if (syntaxError) {
      const failedResults = finalTestCases.map(tc => ({
        input: tc.stdin,
        output: '',
        expected: tc.expected,
        error: syntaxError,
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
  // ========== END SYNTAX VALIDATION ==========

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
  try {
    const { executeBatch } = require('../codeExecution.service');
    batchResults = await executeBatch({
      language,
      code: fullCode,
      testCases: finalTestCases,
    });
  } catch (execError) {
    console.error('Execution provider error:', execError);
    const failedResults = finalTestCases.map(tc => ({
      input: tc.stdin,
      output: '',
      expected: tc.expected,
      error: `Code execution service error: ${execError.message}`,
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
  const results = batchResults.map((res, idx) => {
    const testCase = finalTestCases[idx];
    const actualOutput = res.stdout || '';
    const expectedOutput = testCase.expected || '';
    const errorMessage = res.stderr || '';

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
      // If JSON parsing fails, fall back to string comparison
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

    return {
      input: testCase.stdin,
      output: actualOutput,
      expected: expectedOutput,
      error: errorMessage || (res.exitCode !== 0 ? `Execution failed with exit code ${res.exitCode}` : ''),
      exitCode: res.exitCode ?? (errorMessage ? 1 : 0),
      passed,
    };
  });

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = finalTestCases.length;
  const allPassed = passedCount === totalCount;

  // Queue analytics job (lazy-loaded jobQueue)
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

  await CodeExecutionHistory.create({
    userId,
    questionId,
    language,
    code,
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

  await cleanupExecutionHistory(userId, questionId, language);

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
    await invalidateCache(`question-details:*:${questionId}:*`);
  }

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

  // ----- ATOMIC UPDATES FOR SYNC STATS, HEATMAP, ETC. -----
  if (allPassed) {
    const now = new Date();
    const totalActiveQuestions = await Question.countDocuments({ isActive: true });

    const { progress: updatedProgress, isFirstSolve } = await atomicUpdateQuestionProgressOnSolve(
      userId,
      questionId,
      now,
      (body.timeSpent || 0)
    );

    if (isFirstSolve) {
      await atomicIncrementUserStats(userId, 1, body.timeSpent || 0, totalActiveQuestions);
    }

    await updateUserActivity(userId, now, timeZone);

    const year = now.getUTCFullYear();
    const { getStartOfDay } = require('../../utils/helpers/date');
    const dayStart = getStartOfDay(now, timeZone);
    const heatmapIncrements = {
      totalActivities: 1,
      totalSubmissions: 1,
      totalTimeSpentMinutes: body.timeSpent || 0,
      ...(isFirstSolve ? { newProblemsSolved: 1 } : {}),
      testCaseExecutions: totalCount,
      passedCount: passedCount,
      failedCount: totalCount - passedCount,
    };
    await atomicIncrementHeatmapDay(userId, year, dayStart, heatmapIncrements);

    // Increment confidence
    const progressDoc = await UserQuestionProgress.findOne({ userId, questionId });
    const newConfidence = Math.min(5, (progressDoc?.confidenceLevel || 0) + 0.25);
    await UserQuestionProgress.updateOne(
      { userId, questionId },
      { $set: { confidenceLevel: newConfidence } }
    );

    await ActivityLog.create({
      userId,
      action: 'question_solved',
      targetId: questionId,
      targetModel: 'Question',
      metadata: {
        title: question.title,
        platformQuestionId: question.platformQuestionId,
        difficulty: question.difficulty,
        platform: question.platform,
        pattern: question.pattern,
        timeSpent: body.timeSpent || 0,
        isFirstSolve,
      },
      timestamp: now,
    });

    await invalidateProgressCache(userId);

    const dateStr = DateTime.fromJSDate(now, { zone: timeZone }).toFormat('yyyy-MM-dd');
    await invalidateCache(`activity:day:user:${userId}:*/activity/day/${dateStr}*`);
    await invalidateCache(`activity:today:user:${userId}:*`);

    if (jobQueue) {
      try {
        await jobQueue.add('question.solved', {
          userId,
          questionId,
          progressId: updatedProgress?._id,
          timeSpent: body.timeSpent || 0,
          solvedAt: now,
          source: 'test_case',
        });
      } catch (queueErr) {
        console.error('Failed to queue question.solved job:', queueErr.message);
      }
    }

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
  }

  return responseData;
}

module.exports = {
  executeCodeCore,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
};