/**
 * src/services/queueHandlers/codeExecution.handler.js
 *
 * Bull queue processor for asynchronous code execution.
 * Uses a distributed lock to prevent duplicate processing of the same jobId.
 */

const CodeExecutionJob = require('../../models/CodeExecutionJob');
const { executeCodeCore } = require('../codeExecution/coreExecutor');
const { createTempDir, cleanup } = require('../codeExecution/tempFileManager');
const { client: redisClient } = require('../../config/redis');

const LOCK_TTL_SECONDS = 60; // 60 seconds lock TTL

/**
 * Acquire a distributed lock for a given jobId.
 * @param {string} jobId
 * @returns {Promise<boolean>} True if lock acquired, false otherwise.
 */
async function acquireLock(jobId) {
  if (!redisClient) return false;
  const lockKey = `lock:code-execution:${jobId}`;
  try {
    // Use SET NX EX to atomically set the lock if it doesn't exist
    const result = await redisClient.set(lockKey, '1', { NX: true, EX: LOCK_TTL_SECONDS });
    return result === 'OK';
  } catch (err) {
    console.error(`[CodeExecutionWorker] Failed to acquire lock for job ${jobId}:`, err.message);
    return false;
  }
}

/**
 * Release the distributed lock.
 * @param {string} jobId
 */
async function releaseLock(jobId) {
  if (!redisClient) return;
  const lockKey = `lock:code-execution:${jobId}`;
  try {
    await redisClient.del(lockKey);
  } catch (err) {
    console.error(`[CodeExecutionWorker] Failed to release lock for job ${jobId}:`, err.message);
  }
}

const handleCodeExecution = async (job) => {
  const { jobId } = job.data;

  if (!jobId) {
    throw new Error('Missing jobId in code execution job');
  }

  // Try to acquire distributed lock
  const lockAcquired = await acquireLock(jobId);
  if (!lockAcquired) {
    console.warn(`[CodeExecutionWorker] Lock not acquired for job ${jobId} (already being processed). Skipping.`);
    return;
  }

  console.log(`[CodeExecutionWorker] Processing job ${jobId} (attempt ${job.attemptsMade + 1})`);

  const jobDoc = await CodeExecutionJob.findOne({ jobId });
  if (!jobDoc) {
    console.error(`[CodeExecutionWorker] Job ${jobId} not found in database`);
    await releaseLock(jobId);
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
    throw err; // Re-throw to let Bull handle retries
  } finally {
    if (tempDir) {
      await cleanup(tempDir).catch(e => console.warn(`Failed to cleanup temp dir ${tempDir}:`, e.message));
    }
    await releaseLock(jobId);
  }
};

module.exports = { handleCodeExecution };