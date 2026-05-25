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
const RevisionSchedule = require('../models/RevisionSchedule');
const { invalidateCache, invalidateProgressCache } = require('../middleware/cache');
const revisionActivityService = require('../services/revisionActivity.service');
const { jobQueue } = require('../services/queue.service');
const constants = require('../config/constants');

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

const runCode = async (req, res, next) => {
  try {
    let { language, code, stdin, expected, testCases, questionId } = req.body;
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
      UserQuestionProgress.findOne({ userId: req.user._id, questionId }),
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

    // Log a snippet of the generated code in development for debugging
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
      return res.json(formatResponse('Code execution failed', {
        questionId,
        results: failedResults,
        passedCount: 0,
        totalCount: finalTestCases.length,
        allPassed: false,
        defaultTestCasesCount: defaultTestCases.length,
        userCustomTestCasesCount: (userProgress?.customTestCases || []).length,
        customTestCasesCount: 0,
      }));
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

    if (jobQueue) {
      await jobQueue.add('test_case.executed', {
        userId: req.user._id,
        questionId,
        passedCount,
        failedCount: totalCount - passedCount,
        totalTestCases: totalCount,
        allPassed,
        executedAt: new Date(),
        language,
      });
    }

    let customToSave = [];
    if (testCases && Array.isArray(testCases)) customToSave = testCases;
    else if (stdin !== undefined) customToSave = [{ stdin: stdin || '', expected: expected || '' }];
    await saveCustomTestCases(req.user._id, questionId, customToSave, defaultTestCases);

    await CodeExecutionHistory.create({
      userId: req.user._id,
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

    await cleanupExecutionHistory(req.user._id, questionId, language);

    const existingRevision = await RevisionSchedule.findOne({ userId: req.user._id, questionId });
    if (!existingRevision && allPassed) {
      const timeZone = req.user.preferences?.timezone || 'UTC';
      const solvedLocal = DateTime.fromJSDate(new Date(), { zone: timeZone });
      const scheduleDays = constants.REVISION_SCHEDULE;
      const scheduleUTC = scheduleDays.map(days => solvedLocal.startOf('day').plus({ days }).toUTC().toJSDate());
      await RevisionSchedule.create({
        userId: req.user._id,
        questionId,
        schedule: scheduleUTC,
        baseDate: new Date(),
        status: 'active',
        currentRevisionIndex: 0,
        completedRevisions: [],
      });
      await invalidateCache(`revisions:*:user:${req.user._id}:*`);
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

    if (allPassed) {
      let progress = await UserQuestionProgress.findOne({ userId: req.user._id, questionId });
      if (!progress) {
        progress = new UserQuestionProgress({
          userId: req.user._id,
          questionId,
          status: 'Solved',
          attempts: { count: 1, solvedAt: new Date(), lastAttemptAt: new Date(), firstAttemptAt: new Date() },
          totalTimeSpent: 0,
        });
      } else if (progress.status !== 'Solved') {
        progress.status = 'Solved';
        progress.attempts.solvedAt = new Date();
        progress.attempts.lastAttemptAt = new Date();
        progress.attempts.count = (progress.attempts.count || 0) + 1;
      }
      await progress.save();
      await invalidateProgressCache(req.user._id);

      if (jobQueue) {
        await jobQueue.add('question.solved', {
          userId: req.user._id,
          questionId,
          progressId: progress._id,
          timeSpent: 0,
          solvedAt: new Date(),
          source: 'test_case',
        });
      }

      await revisionActivityService.recordCodeSubmission(req.user._id, questionId, new Date());

      const revisionResult = await revisionActivityService.checkAndCompleteRevision(
        req.user._id,
        questionId,
        new Date(),
        'auto',
        { targetDate: new Date() }
      );
      if (revisionResult.completed) {
        responseData.revisionCompleted = true;
        responseData.revisionMessage = revisionResult.message;
        responseData.revisionOutOfOrder = revisionResult.outOfOrder || false;
        responseData.revisionOverdueCompleted = revisionResult.overdueCompleted || false;
      }
    }

    return res.json(formatResponse('Code executed successfully', responseData));
  } catch (error) {
    console.error('Code execution error:', error);
    next(error);
  }
};

module.exports = { runCode };