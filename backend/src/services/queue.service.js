/**
 * src/services/queue.service.js
 *
 * Bull queue setup and processor registration.
 * Uses standard Redis connection (Bull creates its own client, subscriber, bclient).
 * Only one queue remains, so total Redis connections ~4 (well within free tier).
 */

const Bull = require('bull');
const { URL } = require('url');
const config = require('../config');

// Parse REDIS_URL for Bull
const redisUrl = config.redis.url;
if (!redisUrl) {
  console.error('REDIS_URL not defined, queues will not work');
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
  maxRetriesPerRequest: null,   // Required by Bull
  enableReadyCheck: false,      // Required by Bull
};

if (isTLS) {
  redisOptions.tls = { rejectUnauthorized: false };
}

// Create a single queue for all job types
const jobQueue = new Bull('devrhythm-jobs', {
  redis: redisOptions,
  settings: {
    retryProcessDelay: 5000,
    maxStalledCount: 3,
    guardInterval: 5000,
    stalledInterval: 30000,
    lockDuration: 60000,
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
  },
});

// Increase max listeners to avoid warnings
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

jobQueue.on('delayed', (job, err) => {
  if (err && err.message && err.message.includes('Missing key for job')) {
    console.warn(`Delayed job ${job.id} missing key (likely already completed):`, err.message);
  } else if (err) {
    console.error(`Delayed job ${job.id} error:`, err);
  }
});

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
jobQueue.process('sheet.import', handleSheetImport);
jobQueue.process('sheet.create', handleSheetCreate);

const startQueueWorkers = async () => {
  if (!jobQueue) {
    console.error('Queue not available, workers not started');
    return;
  }
  console.log('Main queue workers started (all job types except code.execution)');
};

const stopQueueWorkers = async () => {
  stopHeartbeat();
  if (jobQueue) await jobQueue.close();
  console.log('Main queue workers stopped');
};

module.exports = {
  jobQueue,
  startQueueWorkers,
  stopQueueWorkers,
};