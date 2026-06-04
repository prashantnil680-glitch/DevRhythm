/**
 * src/services/codeExecution/executionQueue.js
 *
 * Bull queue wrapper for async code execution.
 * Uses the shared jobQueue from ../queue.service.js.
 */

const { jobQueue } = require('../queue.service');
const config = require('../../config');
const CodeExecutionJob = require('../../models/CodeExecutionJob');
const { createTempDir, cleanup } = require('./tempFileManager');
const { executeBatch } = require('../codeExecution.service');

// Default concurrency from environment or config
const DEFAULT_CONCURRENCY = config.codeExecution?.maxConcurrentJobs || 5;
const JOB_TIMEOUT_MS = config.codeExecution?.interactiveTimeout || 30000;
const JOB_REMOVE_ON_COMPLETE = true; // Remove job from Redis after completion/failure

/**
 * Registers the code.execution processor with Bull.
 * Should be called once during worker startup (already done in queue.service.js,
 * but we re-export the processor registration function for clarity).
 */
function registerCodeExecutionProcessor(concurrency = DEFAULT_CONCURRENCY) {
  if (jobQueue) {
    jobQueue.process('code.execution', concurrency, async (job) => {
      const { jobId } = job.data;
      if (!jobId) throw new Error('Missing jobId in code.execution job');

      console.log(`[ExecutionQueue] Processing job ${jobId} (attempt ${job.attemptsMade + 1})`);

      // Fetch job document from database
      const jobDoc = await CodeExecutionJob.findOne({ jobId });
      if (!jobDoc) throw new Error(`Job ${jobId} not found in database`);

      // Mark as processing
      jobDoc.status = 'processing';
      jobDoc.startedAt = new Date();
      jobDoc.bullJobId = job.id;
      await jobDoc.save();

      // Create isolated temp directory for this job
      let tempDir = null;
      try {
        tempDir = await createTempDir();

        // Prepare metadata and test cases (similar to executeCodeCore but without race conditions)
        const { language, code, questionId, testCases, userId } = jobDoc;

        // For interactive problems, we will later call interactiveRouter; for now, use batch execution.
        // Since interactive detection requires metadata, we fetch it here.
        const metadataService = require('./metadata.service');
        let metadata;
        try {
          metadata = await metadataService.getExecutionMetadata(questionId, language);
        } catch (err) {
          throw new Error(`Metadata extraction failed: ${err.message}`);
        }

        const isInteractive = metadata.interactive === true;

        // Build final test cases (same logic as controller but we reuse existing helper)
        // To avoid code duplication, we'll import the necessary utilities.
        // However, to keep this file focused, we assume the caller (controller)
        // has already prepared the test cases and stored them in jobDoc.testCases.
        // The testCases field in jobDoc already contains normalized test cases.
        const finalTestCases = jobDoc.testCases || [];

        if (finalTestCases.length === 0 && !isInteractive) {
          throw new Error('No test cases available for this question');
        }

        let result;
        if (isInteractive) {
          // Delegate to interactiveRouter (to be implemented in Phase 2)
          // For now, throw a clear error indicating interactive is not yet supported.
          throw new Error('Interactive problems are not yet supported in async execution. Please use sync endpoint for now.');
          // In Phase 2, we will call:
          // const interactiveRouter = require('./interactiveRouter.service');
          // result = await interactiveRouter.executeInteractive({ ... });
        } else {
          // Standard batch execution using existing executeBatch
          // We need to generate the full wrapper code.
          const generators = {
            python: require('./wrappers/pythonGenerator'),
            java: require('./wrappers/javaGenerator'),
            cpp: require('./wrappers/cppGenerator'),
            javascript: require('./wrappers/jsGenerator'),
          };
          const Generator = generators[language];
          if (!Generator) throw new Error(`No wrapper generator for language: ${language}`);
          const generator = new Generator();
          const fullCode = generator.generateWrapper(code, metadata, finalTestCases);

          // Execute using provider
          const batchResults = await executeBatch({
            language,
            code: fullCode,
            testCases: finalTestCases,
          });

          // Transform results to match expected output (same as controller)
          const results = batchResults.map((res, idx) => {
            const testCase = finalTestCases[idx];
            const actualOutput = res.stdout || '';
            const expectedOutput = testCase.expected || '';
            const errorMessage = res.stderr || '';
            // Simplified comparison (can be enhanced with OutputComparator)
            const passed = actualOutput.trim() === expectedOutput.trim();
            return {
              input: testCase.stdin,
              output: actualOutput,
              expected: expectedOutput,
              error: errorMessage,
              exitCode: res.exitCode ?? (errorMessage ? 1 : 0),
              passed,
            };
          });

          const passedCount = results.filter(r => r.passed).length;
          const allPassed = passedCount === finalTestCases.length;

          result = {
            questionId,
            results,
            passedCount,
            totalCount: finalTestCases.length,
            allPassed,
            defaultTestCasesCount: 0, // We don't have this info here; could be stored in jobDoc
            userCustomTestCasesCount: 0,
            customTestCasesCount: 0,
          };
        }

        // Update job document with successful result
        jobDoc.status = 'completed';
        jobDoc.result = result;
        jobDoc.completedAt = new Date();
        jobDoc.progress = 100;
        await jobDoc.save();

        console.log(`[ExecutionQueue] Job ${jobId} completed successfully`);
      } catch (err) {
        console.error(`[ExecutionQueue] Job ${jobId} failed:`, err.message);
        jobDoc.status = 'failed';
        jobDoc.errorMessage = err.message;
        jobDoc.completedAt = new Date();
        await jobDoc.save();
        throw err; // Re-throw to let Bull handle retries
      } finally {
        if (tempDir) {
          await cleanup(tempDir).catch(e => console.warn(`Failed to cleanup temp dir ${tempDir}:`, e.message));
        }
      }
    });

    // Optional: Configure job removal to prevent Redis memory bloat
    if (JOB_REMOVE_ON_COMPLETE) {
      // This is a global setting; can also be set per job when adding.
      // We'll rely on the job's TTL (expiration) instead.
    }
    console.log(`[ExecutionQueue] Code execution processor registered with concurrency ${concurrency}`);
  } else {
    console.error('[ExecutionQueue] jobQueue not available, processor not registered');
  }
}

/**
 * Enqueues a code execution job.
 * @param {object} params - { userId, language, code, questionId, testCases, timezone }
 * @returns {Promise<string>} jobId
 */
async function enqueueExecution({ userId, language, code, questionId, testCases, timezone = 'UTC' }) {
  if (!jobQueue) throw new Error('Job queue not available');

  const jobId = require('crypto').randomUUID();

  // Create job document in database
  await CodeExecutionJob.create({
    jobId,
    userId,
    questionId,
    language,
    code,
    testCases: testCases || [],
    status: 'pending',
    timezone,
  });

  // Add to Bull queue with retry options and timeout
  await jobQueue.add(
    'code.execution',
    { jobId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      timeout: JOB_TIMEOUT_MS,
      removeOnComplete: JOB_REMOVE_ON_COMPLETE,
      removeOnFail: JOB_REMOVE_ON_COMPLETE,
    }
  );

  return jobId;
}

/**
 * Retrieves execution status and result.
 * @param {string} jobId
 * @returns {Promise<object|null>} Job document or null if not found.
 */
async function getExecutionStatus(jobId) {
  return CodeExecutionJob.findOne({ jobId });
}

module.exports = {
  registerCodeExecutionProcessor,
  enqueueExecution,
  getExecutionStatus,
};