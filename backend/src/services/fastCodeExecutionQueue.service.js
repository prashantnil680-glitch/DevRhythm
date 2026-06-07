/**
 * src/services/fastCodeExecutionQueue.service.js
 *
 * Dedicated Bull queue for fast code execution languages (Python, JavaScript).
 * Isolates fast jobs from slow C++/Java jobs to reduce queue wait time.
 * On startup, clears ALL pending jobs to prevent backlog from previous runs.
 */

const Bull = require('bull');
const { URL } = require('url');
const config = require('../config');
const { handleCodeExecution } = require('./queueHandlers/codeExecution.handler');

// Parse Redis URL (same logic as main queue)
const redisUrl = config.redis.url;
if (!redisUrl) {
  console.error('[FastCodeExecQueue] REDIS_URL not defined, queue will not work');
  process.exit(1);
}

const parsedUrl = new URL(redisUrl);
const isTLS = parsedUrl.protocol === 'rediss:';

const redisOptions = {
  host: parsedUrl.hostname,
  port: Number(parsedUrl.port) || 6379,
  password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
  db: config.redis.db || 0,
  connectTimeout: 10000,
};

if (isTLS) {
  redisOptions.tls = { rejectUnauthorized: false };
}

// Read fast queue specific configuration
const queueConcurrency = config.fastCodeExecutionQueue?.concurrency || 15;
const lockDuration = config.fastCodeExecutionQueue?.lockDuration || 30000;
const stalledInterval = config.fastCodeExecutionQueue?.stalledInterval || 15000;
const maxStalledCount = config.fastCodeExecutionQueue?.maxStalledCount || 2;
// Age threshold for stale jobs (used only for scheduled cleanup, not on startup)
const staleJobAgeMs = Math.max(60000, parseInt(process.env.FAST_CODE_EXECUTION_STALE_JOB_AGE_MS) || 120000);

// Create dedicated queue for fast code execution
const fastCodeExecutionQueue = new Bull('devrhythm-fast-code-execution', {
  redis: redisOptions,
  settings: {
    retryProcessDelay: 5000,
    maxStalledCount: maxStalledCount,
    guardInterval: 5000,
    stalledInterval: stalledInterval,
    lockDuration: lockDuration,
    lockRenewTime: Math.floor(lockDuration / 2),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    timeout: config.codeExecution?.interactiveTimeout || 30000,
    removeOnComplete: true,
    removeOnFail: true,
  },
});

// Increase max listeners to avoid warnings
fastCodeExecutionQueue.setMaxListeners(50);

// Heartbeat to keep Redis connection alive
let heartbeatInterval = null;
const startHeartbeat = () => {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(async () => {
    try {
      const client = await fastCodeExecutionQueue.client;
      if (client && client.status === 'ready') {
        await client.ping();
      }
    } catch (err) {
      // Silent fail – queue will reconnect
    }
  }, 60000);
};

const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

fastCodeExecutionQueue.on('ready', () => {
  console.log('[FastCodeExecQueue] Bull queue ready, starting heartbeat');
  startHeartbeat();
});

fastCodeExecutionQueue.on('error', (error) => {
  if (error && error.message && error.message.includes('Missing key for job')) {
    return;
  }
  console.error('[FastCodeExecQueue] Queue error:', error);
});

fastCodeExecutionQueue.on('delayed', (job, err) => {
  if (err && err.message && err.message.includes('Missing key for job')) {
    console.warn(`[FastCodeExecQueue] Delayed job ${job.id} missing key (likely already completed):`, err.message);
  } else if (err) {
    console.error(`[FastCodeExecQueue] Delayed job ${job.id} error:`, err);
  }
});

fastCodeExecutionQueue.on('failed', (job, err) => {
  if (err && err.message && err.message.includes('Missing key for job')) {
    console.warn(`[FastCodeExecQueue] Job ${job.id} (${job.name}) failed (likely already removed):`, err.message);
  } else {
    console.error(`[FastCodeExecQueue] Job ${job.id} (${job.name}) failed:`, err);
  }
});

/**
 * Clean stale jobs from the fast queue.
 * @param {number} gracePeriodMs - Age in milliseconds; jobs older than this are removed.
 *                                 Use 0 to remove all waiting/delayed jobs.
 * @returns {Promise<number>} Number of jobs cleaned
 */
async function cleanStaleFastCodeExecutionJobs(gracePeriodMs = null) {
  if (!fastCodeExecutionQueue) {
    console.warn('[FastCodeExecQueue] Queue not available, cannot clean stale jobs');
    return 0;
  }

  const effectiveGracePeriod = gracePeriodMs !== null ? gracePeriodMs : staleJobAgeMs;

  try {
    const waitingCleaned = await fastCodeExecutionQueue.clean(effectiveGracePeriod, 'wait', 1000);
    const delayedCleaned = await fastCodeExecutionQueue.clean(effectiveGracePeriod, 'delayed', 1000);
    const totalCleaned = waitingCleaned + delayedCleaned;
    if (totalCleaned > 0) {
      console.log(`[FastCodeExecQueue] Cleaned ${totalCleaned} stale jobs (${waitingCleaned} waiting, ${delayedCleaned} delayed) with grace period ${effectiveGracePeriod}ms`);
    }
    return totalCleaned;
  } catch (err) {
    console.error('[FastCodeExecQueue] Failed to clean stale jobs:', err.message);
    return 0;
  }
}

/**
 * Register the code execution processor for fast queue.
 */
function registerProcessor() {
  fastCodeExecutionQueue.process('code.execution', queueConcurrency, handleCodeExecution);
  console.log(`[FastCodeExecQueue] Processor registered with concurrency: ${queueConcurrency}`);
}

/**
 * Start the fast queue workers.
 * Clears ALL pending jobs (grace period 0) before starting workers to eliminate backlog.
 */
async function startFastCodeExecutionWorkers() {
  if (!fastCodeExecutionQueue) {
    console.error('[FastCodeExecQueue] Queue not available, workers not started');
    return;
  }

  // Pause the queue to prevent any processing during obliteration
  await fastCodeExecutionQueue.pause();
  try {
    // Obliterate removes all jobs (active, waiting, delayed, completed, failed) and cleans up
    await fastCodeExecutionQueue.obliterate({ force: true });
    console.log('[FastCodeExecQueue] Obliterated all jobs from the queue');
  } catch (err) {
    console.error('[FastCodeExecQueue] Failed to obliterate queue:', err.message);
  }
  // Resume the queue (or we can leave it paused and then resume after registering processor)
  await fastCodeExecutionQueue.resume();

  registerProcessor();
  console.log('[FastCodeExecQueue] Workers started');
}

/**
 * Stop the fast queue workers and close connection.
 */
async function stopFastCodeExecutionWorkers() {
  stopHeartbeat();
  if (fastCodeExecutionQueue) {
    await fastCodeExecutionQueue.close();
    console.log('[FastCodeExecQueue] Workers stopped');
  }
}

module.exports = {
  fastCodeExecutionQueue,
  startFastCodeExecutionWorkers,
  stopFastCodeExecutionWorkers,
  cleanStaleFastCodeExecutionJobs, // exported for manual admin use
};