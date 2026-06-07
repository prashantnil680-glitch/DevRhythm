/**
 * src/services/codeExecutionQueue.service.js
 *
 * Dedicated Bull queue for code execution jobs.
 * Isolates CPU‑intensive code execution from other background jobs.
 * Includes automatic stale job cleanup on startup.
 */

const Bull = require('bull');
const { URL } = require('url');
const config = require('../config');
const { handleCodeExecution } = require('./queueHandlers/codeExecution.handler');

// Parse Redis URL (same logic as main queue)
const redisUrl = config.redis.url;
if (!redisUrl) {
  console.error('[CodeExecQueue] REDIS_URL not defined, queue will not work');
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

// Read queue‑specific configuration with defaults
const queueConcurrency = config.codeExecutionQueue?.concurrency || 10;
const lockDuration = config.codeExecutionQueue?.lockDuration || 60000;
const stalledInterval = config.codeExecutionQueue?.stalledInterval || 30000;
const maxStalledCount = config.codeExecutionQueue?.maxStalledCount || 3;
// Age threshold for stale jobs (default 5 minutes)
const staleJobAgeMs = Math.max(60000, parseInt(process.env.CODE_EXECUTION_STALE_JOB_AGE_MS) || 300000);

// Create dedicated queue for code execution
const codeExecutionQueue = new Bull('devrhythm-code-execution', {
  redis: redisOptions,
  settings: {
    retryProcessDelay: 5000,
    maxStalledCount: maxStalledCount,
    guardInterval: 5000,
    stalledInterval: stalledInterval,
    lockDuration: lockDuration,
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
codeExecutionQueue.setMaxListeners(50);

// Heartbeat to keep Redis connection alive
let heartbeatInterval = null;
const startHeartbeat = () => {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(async () => {
    try {
      const client = await codeExecutionQueue.client;
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

codeExecutionQueue.on('ready', () => {
  console.log('[CodeExecQueue] Bull queue ready, starting heartbeat');
  startHeartbeat();
});

codeExecutionQueue.on('error', (error) => {
  if (error && error.message && error.message.includes('Missing key for job')) {
    return;
  }
  console.error('[CodeExecQueue] Queue error:', error);
});

codeExecutionQueue.on('delayed', (job, err) => {
  if (err && err.message && err.message.includes('Missing key for job')) {
    console.warn(`[CodeExecQueue] Delayed job ${job.id} missing key (likely already completed):`, err.message);
  } else if (err) {
    console.error(`[CodeExecQueue] Delayed job ${job.id} error:`, err);
  }
});

codeExecutionQueue.on('failed', (job, err) => {
  if (err && err.message && err.message.includes('Missing key for job')) {
    console.warn(`[CodeExecQueue] Job ${job.id} (${job.name}) failed (likely already removed):`, err.message);
  } else {
    console.error(`[CodeExecQueue] Job ${job.id} (${job.name}) failed:`, err);
  }
});

/**
 * Clean stale jobs from the dedicated queue.
 * Removes jobs that have been waiting or delayed for longer than staleJobAgeMs.
 * @returns {Promise<number>} Number of jobs cleaned
 */
async function cleanStaleCodeExecutionJobs() {
  if (!codeExecutionQueue) {
    console.warn('[CodeExecQueue] Queue not available, cannot clean stale jobs');
    return 0;
  }

  try {
    const gracePeriodMs = staleJobAgeMs;
    // Bull uses 'wait' for waiting jobs, not 'waiting'
    const waitingCleaned = await codeExecutionQueue.clean(gracePeriodMs, 'wait', 1000);
    const delayedCleaned = await codeExecutionQueue.clean(gracePeriodMs, 'delayed', 1000);
    const totalCleaned = waitingCleaned + delayedCleaned;
    if (totalCleaned > 0) {
      console.log(`[CodeExecQueue] Cleaned ${totalCleaned} stale jobs (${waitingCleaned} waiting, ${delayedCleaned} delayed) older than ${gracePeriodMs}ms`);
    }
    return totalCleaned;
  } catch (err) {
    console.error('[CodeExecQueue] Failed to clean stale jobs:', err.message);
    return 0;
  }
}

/**
 * Register the code execution processor.
 */
function registerProcessor() {
  codeExecutionQueue.process('code.execution', queueConcurrency, handleCodeExecution);
  console.log(`[CodeExecQueue] Processor registered with concurrency: ${queueConcurrency}`);
}

/**
 * Start the dedicated queue workers.
 * Cleans stale jobs before starting workers.
 */
async function startCodeExecutionWorkers() {
  if (!codeExecutionQueue) {
    console.error('[CodeExecQueue] Queue not available, workers not started');
    return;
  }

  // Clean stale jobs before starting
  await cleanStaleCodeExecutionJobs();

  registerProcessor();
  console.log('[CodeExecQueue] Workers started');
}

/**
 * Stop the dedicated queue workers and close connection.
 */
async function stopCodeExecutionWorkers() {
  stopHeartbeat();
  if (codeExecutionQueue) {
    await codeExecutionQueue.close();
    console.log('[CodeExecQueue] Workers stopped');
  }
}

module.exports = {
  codeExecutionQueue,
  startCodeExecutionWorkers,
  stopCodeExecutionWorkers,
  cleanStaleCodeExecutionJobs,
};