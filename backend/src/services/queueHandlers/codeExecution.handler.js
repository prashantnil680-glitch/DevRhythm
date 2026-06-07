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
const { invalidateCache } = require('../../middleware/cache');
const TimingLogger = require('../../utils/timingLogger');
const config = require('../../config');

/**
 * Acquire a distributed lock for a given jobId.
 * @param {string} jobId
 * @param {number} ttlSeconds
 * @returns {Promise<boolean>} True if lock acquired, false otherwise.
 */
async function acquireLock(jobId, ttlSeconds) {
  if (!redisClient) return false;
  const lockKey = `lock:code-execution:${jobId}`;
  try {
    const result = await redisClient.set(lockKey, '1', { NX: true, EX: ttlSeconds });
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

  const lockTtl = config.codeExecution?.lockTtlSeconds || 30;
  const lockAcquired = await acquireLock(jobId, lockTtl);

  if (!lockAcquired) {
    console.warn(`[CodeExecutionWorker] Lock not acquired for job ${jobId} (already being processed). Skipping.`);
    return;
  }

  console.log(`[CodeExecutionWorker] Lock acquired for job ${jobId} (TTL: ${lockTtl}s)`);

  const timing = new TimingLogger(jobId);
  const now = Date.now();

  console.log(`[CodeExecutionWorker] Processing job ${jobId} (attempt ${job.attemptsMade + 1})`);

  const jobDoc = await CodeExecutionJob.findOne({ jobId });
  if (!jobDoc) {
    console.error(`[CodeExecutionWorker] Job ${jobId} not found in database`);
    await releaseLock(jobId);
    throw new Error(`Job ${jobId} not found in database`);
  }

  const createdAt = new Date(jobDoc.createdAt).getTime();
  const waitTime = now - createdAt;
  timing.record('queue.wait_time', waitTime);
  console.log(`[Timing] ${jobId} | worker picked up | time since creation: ${waitTime}ms`);

  jobDoc.status = 'processing';
  jobDoc.startedAt = new Date();
  jobDoc.bullJobId = job.id;
  await jobDoc.save();

  let tempDir = null;
  let result = null;

  try {
    tempDir = await createTempDir();

    const executionBody = {
      language: jobDoc.language,
      code: jobDoc.code,
      questionId: jobDoc.questionId,
      testCases: jobDoc.testCases,
      timeSpent: 0,
    };

    result = await executeCodeCore(
      jobDoc.userId,
      executionBody,
      jobDoc.timezone || 'UTC',
      timing
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
    await releaseLock(jobId);
  }

  // Non‑blocking cache invalidation (fire and forget)
  setImmediate(async () => {
    try {
      timing.start('persistence.cache_invalidation');
      await invalidateCache(`code-execution:${jobId}`);
      await invalidateCache(`question-details:*:${jobDoc.questionId}*`);
      timing.end('persistence.cache_invalidation');
    } catch (cacheErr) {
      console.error(`[CodeExecutionWorker] Cache invalidation failed for job ${jobId}:`, cacheErr.message);
    } finally {
      timing.summary();
    }
  });
};

module.exports = { handleCodeExecution };