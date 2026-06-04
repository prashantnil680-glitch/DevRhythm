/**
 * src/services/queueHandlers/codeExecution.handler.js
 *
 * Bull queue processor for asynchronous code execution.
 * Now uses executeCodeCore from coreExecutor (no circular dependency).
 */

const CodeExecutionJob = require('../../models/CodeExecutionJob');
const { executeCodeCore } = require('../codeExecution/coreExecutor');
const { createTempDir, cleanup } = require('../codeExecution/tempFileManager');

const handleCodeExecution = async (job) => {
  const { jobId } = job.data;

  if (!jobId) {
    throw new Error('Missing jobId in code execution job');
  }

  console.log(`[CodeExecutionWorker] Processing job ${jobId} (attempt ${job.attemptsMade + 1})`);

  const jobDoc = await CodeExecutionJob.findOne({ jobId });
  if (!jobDoc) {
    throw new Error(`Job ${jobId} not found in database`);
  }

  jobDoc.status = 'processing';
  jobDoc.startedAt = new Date();
  jobDoc.bullJobId = job.id;
  await jobDoc.save();

  let tempDir = null;
  try {
    tempDir = await createTempDir();

    const executionBody = {
      language: jobDoc.language,
      code: jobDoc.code,
      questionId: jobDoc.questionId,
      testCases: jobDoc.testCases,
      timeSpent: 0,
    };

    const result = await executeCodeCore(
      jobDoc.userId,
      executionBody,
      jobDoc.timezone || 'UTC'
    );

    jobDoc.status = 'completed';
    jobDoc.result = result;
    jobDoc.completedAt = new Date();
    jobDoc.progress = 100;
    await jobDoc.save();

    console.log(`[CodeExecutionWorker] Job ${jobId} completed successfully`);
  } catch (err) {
    console.error(`[CodeExecutionWorker] Job ${jobId} failed:`, err.message);
    jobDoc.status = 'failed';
    jobDoc.errorMessage = err.message;
    jobDoc.completedAt = new Date();
    await jobDoc.save();
    throw err;
  } finally {
    if (tempDir) {
      await cleanup(tempDir).catch(e => console.warn(`Failed to cleanup temp dir ${tempDir}:`, e.message));
    }
  }
};

module.exports = { handleCodeExecution };