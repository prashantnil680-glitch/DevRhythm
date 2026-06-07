/**
 * src/services/slowCodeExecutionQueue.service.js
 *
 * Dedicated Bull queue for slow code execution languages (C++, Java).
 * Isolates slow jobs from fast Python/JavaScript jobs to prevent queue blockage.
 * On startup, clears ALL pending jobs to prevent backlog from previous runs.
 */

const Bull = require('bull');
const { URL } = require('url');
const config = require('../config');
const { handleCodeExecution } = require('./queueHandlers/codeExecution.handler');

// Parse Redis URL (same logic as main queue)
const redisUrl = config.redis.url;
if (!redisUrl) {
  console.error('[SlowCodeExecQueue] REDIS_URL not defined, queue will not work');
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

// Read slow queue specific configuration
const queueConcurrency = config.slowCodeExecutionQueue?.concurrency || 5;
const lockDuration = config.slowCodeExecutionQueue?.lockDuration || 30000;
const stalledInterval = config.slowCodeExecutionQueue?.stalledInterval || 15000;
const maxStalledCount = config.slowCodeExecutionQueue?.maxStalledCount || 2;
// Age threshold for stale jobs (used only for scheduled cleanup, not on startup)
const staleJobAgeMs = Math.max(60000, parseInt(process.env.SLOW_CODE_EXECUTION_STALE_JOB_AGE_MS) || 300000);

// Create dedicated queue for slow code execution
const slowCodeExecutionQueue = new Bull('devrhythm-slow-code-execution', {
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
slowCodeExecutionQueue.setMaxListeners(50);

// Heartbeat to keep Redis connection alive
let heartbeatInterval = null;
const startHeartbeat = () => {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(async () => {
    try {
      const client = await slowCodeExecutionQueue.client;
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

slowCodeExecutionQueue.on('ready', () => {
  console.log('[SlowCodeExecQueue] Bull queue ready, starting heartbeat');
  startHeartbeat();
});

slowCodeExecutionQueue.on('error', (error) => {
  if (error && error.message && error.message.includes('Missing key for job')) {
    return;
  }
  console.error('[SlowCodeExecQueue] Queue error:', error);
});

slowCodeExecutionQueue.on('delayed', (job, err) => {
  if (err && err.message && err.message.includes('Missing key for job')) {
    console.warn(`[SlowCodeExecQueue] Delayed job ${job.id} missing key (likely already completed):`, err.message);
  } else if (err) {
    console.error(`[SlowCodeExecQueue] Delayed job ${job.id} error:`, err);
  }
});

slowCodeExecutionQueue.on('failed', (job, err) => {
  if (err && err.message && err.message.includes('Missing key for job')) {
    console.warn(`[SlowCodeExecQueue] Job ${job.id} (${job.name}) failed (likely already removed):`, err.message);
  } else {
    console.error(`[SlowCodeExecQueue] Job ${job.id} (${job.name}) failed:`, err);
  }
});

/**
 * Clean stale jobs from the slow queue.
 * @param {number} gracePeriodMs - Age in milliseconds; jobs older than this are removed.
 *                                 Use 0 to remove all waiting/delayed jobs.
 * @returns {Promise<number>} Number of jobs cleaned
 */
async function cleanStaleSlowCodeExecutionJobs(gracePeriodMs = null) {
  if (!slowCodeExecutionQueue) {
    console.warn('[SlowCodeExecQueue] Queue not available, cannot clean stale jobs');
    return 0;
  }

  const effectiveGracePeriod = gracePeriodMs !== null ? gracePeriodMs : staleJobAgeMs;

  try {
    const waitingCleaned = await slowCodeExecutionQueue.clean(effectiveGracePeriod, 'wait', 1000);
    const delayedCleaned = await slowCodeExecutionQueue.clean(effectiveGracePeriod, 'delayed', 1000);
    const totalCleaned = waitingCleaned + delayedCleaned;
    if (totalCleaned > 0) {
      console.log(`[SlowCodeExecQueue] Cleaned ${totalCleaned} stale jobs (${waitingCleaned} waiting, ${delayedCleaned} delayed) with grace period ${effectiveGracePeriod}ms`);
    }
    return totalCleaned;
  } catch (err) {
    console.error('[SlowCodeExecQueue] Failed to clean stale jobs:', err.message);
    return 0;
  }
}

/**
 * Register the code execution processor for slow queue.
 */
function registerProcessor() {
  slowCodeExecutionQueue.process('code.execution', queueConcurrency, handleCodeExecution);
  console.log(`[SlowCodeExecQueue] Processor registered with concurrency: ${queueConcurrency}`);
}

/**
 * Start the slow queue workers.
 * Clears ALL pending jobs (grace period 0) before starting workers to eliminate backlog.
 */
async function startSlowCodeExecutionWorkers() {
  if (!slowCodeExecutionQueue) {
    console.error('[SlowCodeExecQueue] Queue not available, workers not started');
    return;
  }

  await slowCodeExecutionQueue.pause();
  try {
    await slowCodeExecutionQueue.obliterate({ force: true });
    console.log('[SlowCodeExecQueue] Obliterated all jobs from the queue');
  } catch (err) {
    console.error('[SlowCodeExecQueue] Failed to obliterate queue:', err.message);
  }
  await slowCodeExecutionQueue.resume();

  registerProcessor();
  console.log('[SlowCodeExecQueue] Workers started');
}

/**
 * Stop the slow queue workers and close connection.
 */
async function stopSlowCodeExecutionWorkers() {
  stopHeartbeat();
  if (slowCodeExecutionQueue) {
    await slowCodeExecutionQueue.close();
    console.log('[SlowCodeExecQueue] Workers stopped');
  }
}

module.exports = {
  slowCodeExecutionQueue,
  startSlowCodeExecutionWorkers,
  stopSlowCodeExecutionWorkers,
  cleanStaleSlowCodeExecutionJobs, // exported for manual admin use
};