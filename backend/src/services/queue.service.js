/**
 * src/services/queue.service.js
 *
 * Bull queue setup and processor registration.
 * Also exports enqueueExecution and getExecutionStatus for code execution.
 */

const Bull = require('bull');
const crypto = require('crypto');
const { URL } = require('url');
const config = require('../config');
const CodeExecutionJob = require('../models/CodeExecutionJob');

// Parse REDIS_URL manually to ensure TLS works correctly with Upstash
const redisUrl = config.redis.url;
if (!redisUrl) {
  console.error('REDIS_URL not defined, queues will not work');
  process.exit(1);
}

const parsedUrl = new URL(redisUrl);
const isTLS = parsedUrl.protocol === 'rediss:';

// Bull-compatible Redis options – no maxRetriesPerRequest, no enableReadyCheck, no retryStrategy
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

// Create a single queue for all job types with global removeOnComplete
const jobQueue = new Bull('devrhythm-jobs', {
  redis: redisOptions,
  settings: {
    retryProcessDelay: 5000,
    maxStalledCount: 3,
    guardInterval: 5000,
    stalledInterval: 30000,      // Check for stalled jobs every 30 seconds
    lockDuration: 60000,         // Lock a job for 60 seconds while processing
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
  },
});

// Increase max listeners to avoid MaxListenersExceededWarning
jobQueue.setMaxListeners(50);

// ========== HEARTBEAT: keep Redis connection alive ==========
let heartbeatInterval = null;
const startHeartbeat = () => {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(async () => {
    try {
      const client = await jobQueue.client;
      if (client && client.status === 'ready') {
        await client.ping();
      }
    } catch (err) {
      // Silently fail – the queue will handle reconnection
    }
  }, 60000);
};

const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

jobQueue.on('ready', () => {
  console.log('Bull queue ready, starting heartbeat');
  startHeartbeat();
});

jobQueue.on('error', (error) => {
  if (error && error.message && error.message.includes('Missing key for job')) {
    return;
  }
  console.error('Queue error:', error);
});

// Suppress 'Missing key for job delayed' errors (log as warning)
jobQueue.on('delayed', (job, err) => {
  if (err && err.message && err.message.includes('Missing key for job')) {
    console.warn(`Delayed job ${job.id} missing key (likely already completed):`, err.message);
  } else if (err) {
    console.error(`Delayed job ${job.id} error:`, err);
  }
});

// Custom failed handler: treat 'Missing key' as warning (job already cleaned up)
jobQueue.on('failed', (job, err) => {
  if (err && err.message && err.message.includes('Missing key for job')) {
    console.warn(`Job ${job.id} (${job.name}) failed (likely already removed):`, err.message);
  } else {
    console.error(`Job ${job.id} (${job.name}) failed:`, err);
  }
});

// ========== IMPORT HANDLERS ==========
const { handleQuestionSolved } = require('./queueHandlers/questionSolved.handler');
const { handleQuestionMastered } = require('./queueHandlers/questionMastered.handler');
const { handleQuestionAttempted } = require('./queueHandlers/questionAttempted.handler');
const { handleGoalCompleted } = require('./queueHandlers/goalCompleted.handler');
const { handleFollowerNew } = require('./queueHandlers/followerNew.handler');
const { handleRevisionCompleted } = require('./queueHandlers/revisionCompleted.handler');
const { handleGroupJoined } = require('./queueHandlers/groupJoined.handler');
const { handleGroupGoalProgress } = require('./queueHandlers/groupGoalProgress.handler');
const { handleGroupGoalCompleted } = require('./queueHandlers/groupGoalCompleted.handler');
const { handleGroupChallengeProgress } = require('./queueHandlers/groupChallengeProgress.handler');
const { handleGroupChallengeCompleted } = require('./queueHandlers/groupChallengeCompleted.handler');
const { handleRevisionSchedule } = require('./queueHandlers/revisionSchedule.handler');
const { handleQuestionExtractTestCases } = require('./queueHandlers/questionExtractTestCases.handler');
const { handleUserTimezoneChange } = require('./queueHandlers/userTimezoneChange.handler');
const { handleTestCaseExecuted } = require('./queueHandlers/testCaseExecuted.handler');
const { handleTimeThresholdReached } = require('./queueHandlers/timeThresholdReached.handler');
const { handleConfidenceIncrement } = require('./queueHandlers/confidenceIncrement.handler');
const { handlePodAvailable } = require('./queueHandlers/podAvailable.handler');
const { handleFetchLeetcodeDetails } = require('./queueHandlers/fetchLeetcodeDetails.handler');
const { handleCodeExecution } = require('./queueHandlers/codeExecution.handler');
const { handleSheetImport } = require('./queueHandlers/sheetImport.handler');
const { handleSheetCreate } = require('./queueHandlers/sheetCreate.handler');

// ========== REGISTER PROCESSORS ==========
jobQueue.process('question.solved', handleQuestionSolved);
jobQueue.process('question.mastered', handleQuestionMastered);
jobQueue.process('question.attempted', handleQuestionAttempted);
jobQueue.process('goal.completed', handleGoalCompleted);
jobQueue.process('follower.new', handleFollowerNew);
jobQueue.process('revision.completed', handleRevisionCompleted);
jobQueue.process('group.joined', handleGroupJoined);
jobQueue.process('group.goal_progress', handleGroupGoalProgress);
jobQueue.process('group.goal_completed', handleGroupGoalCompleted);
jobQueue.process('group.challenge_progress', handleGroupChallengeProgress);
jobQueue.process('group.challenge_completed', handleGroupChallengeCompleted);
jobQueue.process('revision.schedule', handleRevisionSchedule);
jobQueue.process('question.extract_testcases', handleQuestionExtractTestCases);
jobQueue.process('user.timezone_change', handleUserTimezoneChange);
jobQueue.process('test_case.executed', handleTestCaseExecuted);
jobQueue.process('time.threshold_reached', handleTimeThresholdReached);
jobQueue.process('confidence.increment', handleConfidenceIncrement);
jobQueue.process('pod.available', handlePodAvailable);
jobQueue.process('leetcode.fetch_details', handleFetchLeetcodeDetails);

const CODE_EXECUTION_CONCURRENCY = config.codeExecution?.maxConcurrentJobs || 5;
jobQueue.process('code.execution', CODE_EXECUTION_CONCURRENCY, handleCodeExecution);

jobQueue.process('sheet.import', handleSheetImport);
jobQueue.process('sheet.create', handleSheetCreate);

// ========== QUEUE HELPERS FOR CODE EXECUTION ==========

/**
 * Enqueues a code execution job.
 * @param {object} params - { userId, language, code, questionId, testCases, timezone }
 * @returns {Promise<string>} jobId
 */
async function enqueueExecution({ userId, language, code, questionId, testCases, timezone = 'UTC' }) {
  if (!jobQueue) throw new Error('Job queue not available');

  const jobId = crypto.randomUUID();

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

  await jobQueue.add(
    'code.execution',
    { jobId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      timeout: config.codeExecution?.interactiveTimeout || 30000,
      removeOnComplete: true,
      removeOnFail: true,
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

const startQueueWorkers = async () => {
  if (!jobQueue) {
    console.error('Queue not available, workers not started');
    return;
  }
  console.log(`Queue workers started (code.execution concurrency: ${CODE_EXECUTION_CONCURRENCY})`);
};

const stopQueueWorkers = async () => {
  stopHeartbeat();
  if (jobQueue) await jobQueue.close();
  console.log('Queue workers stopped');
};

module.exports = {
  jobQueue,
  startQueueWorkers,
  stopQueueWorkers,
  enqueueExecution,
  getExecutionStatus,
};