const crypto = require('crypto');
const { DateTime } = require('luxon');
const { executeBatch } = require('../services/codeExecution.service');
const metadataService = require('../services/codeExecution/metadata.service');
const PythonGenerator = require('../services/codeExecution/wrappers/pythonGenerator');
const JavaGenerator = require('../services/codeExecution/wrappers/javaGenerator');
const CppGenerator = require('../services/codeExecution/wrappers/cppGenerator');
const JsGenerator = require('../services/codeExecution/wrappers/jsGenerator');
const { normalizeTestCaseInput } = require('../utils/testCaseNormalizer');
const OutputComparator = require('../utils/helpers/outputComparator');
const { formatResponse } = require('../utils/helpers/response');
const AppError = require('../utils/errors/AppError');
const Question = require('../models/Question');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const CodeExecutionHistory = require('../models/CodeExecutionHistory');
const CodeExecutionJob = require('../models/CodeExecutionJob');
const RevisionSchedule = require('../models/RevisionSchedule');
const ActivityLog = require('../models/ActivityLog');
const { invalidateCache, invalidateProgressCache } = require('../middleware/cache');
const revisionActivityService = require('../services/revisionActivity.service');
const { jobQueue } = require('../services/queue.service');
const constants = require('../config/constants');
const { incrementUserStats } = require('../services/user.service');
const { incrementDailyActivityDirect } = require('../services/heatmap.service');
const { updateUserActivity } = require('../services/user.service');

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
 * Normalizes each test case's stdin to JSON format.
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
 * Save custom test cases to user progress (deduplicated against default cases).
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
 * Clean old execution history: keep 1 all‑passed + 2 latest (any outcome) per language.
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
 * Core execution logic – shared between sync and async endpoints.
 * Returns result object (same as original response data).
 * Does NOT send HTTP response.
 */
const executeCodeCore = async (userId, body, timeZone = 'UTC') => {
  let { language, code, stdin, expected, testCases, questionId } = body;
  language = normalizeLanguage(language);

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new AppError(`Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`, 400);
  }
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    throw new AppError('Code cannot be empty', 400);
  }
  if (!questionId) throw new AppError('questionId is required', 400);

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

  // Queue analytics job (non‑blocking, errors ignored)
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

  // ----- SYNC STATS, HEATMAP, ACTIVE DAYS, ACTIVITY LOG, CONFIDENCE -----
  if (allPassed) {
    // Capture old status before updating
    let progress = await UserQuestionProgress.findOne({ userId, questionId });
    const oldStatus = progress ? progress.status : 'Not Started';
    const now = new Date();

    // Determine if this is the first solve
    const isFirstSolve = (oldStatus !== 'Solved' && oldStatus !== 'Mastered');

    // Update or create progress document
    if (!progress) {
      progress = new UserQuestionProgress({
        userId,
        questionId,
        status: 'Solved',
        attempts: { count: 1, solvedAt: now, lastAttemptAt: now, firstAttemptAt: now },
        totalTimeSpent: 0,
        lastActivityDate: now,
      });
    } else {
      progress.attempts.count = (progress.attempts.count || 0) + 1;
      progress.attempts.lastAttemptAt = now;
      if (progress.status !== 'Solved') {
        progress.status = 'Solved';
        progress.attempts.solvedAt = now;
      }
      progress.lastActivityDate = now;
    }
    await progress.save();

    // Increment user stats only if this is the first time solving this question
    if (isFirstSolve) {
      await incrementUserStats(userId, 1, 0);
    }

    // Update streak and active days
    await updateUserActivity(userId, now, timeZone);

    // Increment heatmap directly with metadata
    await incrementDailyActivityDirect(
      userId,
      now,
      timeZone,
      {
        totalActivities: 1,
        totalSubmissions: 1,
        newProblemsSolved: 1,
        testCaseExecutions: totalCount,
        passedCount: passedCount,
        failedCount: totalCount - passedCount,
      },
      isFirstSolve,
      question.difficulty,
      question.platform
    );

    // Increment confidence synchronously (+0.25, max 5)
    let newConfidence = (progress.confidenceLevel || 0) + 0.25;
    if (newConfidence > 5) newConfidence = 5;
    await UserQuestionProgress.updateOne(
      { userId, questionId },
      { $set: { confidenceLevel: newConfidence } }
    );

    // Create activity log for this solve (every solve)
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
        timeSpent: 0,
        isFirstSolve: isFirstSolve,
      },
      timestamp: now,
    });

    // Invalidate caches
    await invalidateProgressCache(userId);

    // 🚀 NEW: Invalidate cache for the activity day endpoint
    const dateStr = DateTime.fromJSDate(now, { zone: timeZone }).toFormat('yyyy-MM-dd');
    await invalidateCache(`activity:day:user:${userId}:*/activity/day/${dateStr}*`);
    // Also invalidate the 'today' endpoint cache (if any)
    await invalidateCache(`activity:today:user:${userId}:*`);

    // Queue optional background job for other effects (non‑critical)
    if (jobQueue) {
      try {
        await jobQueue.add('question.solved', {
          userId,
          questionId,
          progressId: progress._id,
          timeSpent: 0,
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
};

// ==============================
// SYNC ENDPOINT (original)
// ==============================
const runCode = async (req, res, next) => {
  try {
    const result = await executeCodeCore(req.user._id, req.body, req.userTimeZone);
    return res.json(formatResponse('Code executed successfully', result));
  } catch (error) {
    next(error);
  }
};

// ==============================
// ASYNC ENDPOINTS
// ==============================
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

    const jobDoc = new CodeExecutionJob({
      jobId,
      userId: req.user._id,
      questionId,
      language: normalizedLang,
      code,
      testCases: testCases || (stdin !== undefined ? [{ stdin: stdin || '', expected: expected || '' }] : []),
      status: 'pending',
    });
    await jobDoc.save();

    if (!jobQueue) {
      throw new AppError('Job queue not available', 500);
    }
    const bullJob = await jobQueue.add('code.execution', { jobId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    jobDoc.bullJobId = bullJob.id;
    await jobDoc.save();

    res.status(202).json(formatResponse('Code execution queued', { jobId, status: 'pending' }));
  } catch (error) {
    next(error);
  }
};

const getCodeResult = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const jobDoc = await CodeExecutionJob.findOne({ jobId, userId: req.user._id });
    if (!jobDoc) {
      throw new AppError('Job not found', 404);
    }

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