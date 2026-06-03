const Bull = require('bull');
const config = require('../config');

// Parse Redis URL
const redisOptions = (() => {
  if (!config.redis.url) {
    console.error('REDIS_URL not defined, queues will not work');
    return null;
  }
  try {
    const url = new URL(config.redis.url);
    const host = url.hostname;
    const port = parseInt(url.port) || 6379;
    const db = config.redis.db || 0;
    const password = config.redis.password || (url.password ? decodeURIComponent(url.password) : undefined);
    return {
      host,
      port,
      password,
      db,
      maxRetriesPerRequest: 100,        // Increased to handle intermittent ECONNRESET
      enableOfflineQueue: true,         // Queue commands when Redis is down
      retryStrategy: (times) => {
        // Exponential backoff with max 30 seconds
        const delay = Math.min(times * 100, 30000);
        // Log only first attempt and every 50th attempt to avoid spam
        if (times === 1 || times % 50 === 0) {
          console.log(`Redis retry attempt ${times}, waiting ${delay}ms`);
        }
        return delay;
      },
    };
  } catch (err) {
    console.error('Invalid Redis URL:', err);
    return null;
  }
})();

if (!redisOptions) {
  console.error('Redis configuration missing, queues will not work');
}

// Create a single queue for all job types
const jobQueue = new Bull('devrhythm-jobs', {
  redis: redisOptions,
  settings: {
    retryProcessDelay: 5000,   // Wait 5 seconds between retries
    maxStalledCount: 3,        // Max stalled jobs before failing
    guardInterval: 5000,       // Check stalled jobs every 5 seconds
  }
});

// ========== HEARTBEAT: keep Redis connection alive ==========
let heartbeatInterval = null;
const startHeartbeat = () => {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(async () => {
    try {
      const client = await jobQueue.client;
      if (client && client.status === 'ready') {
        await client.ping();
        // Optional: log once per hour to confirm heartbeat
        // console.log('[Redis] Heartbeat PING sent');
      }
    } catch (err) {
      // Silently fail – the queue will handle reconnection
    }
  }, 60000); // every 60 seconds
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
  console.error('Queue error:', error);
});

jobQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} (${job.data.type}) failed:`, err);
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
jobQueue.process('code.execution', handleCodeExecution);
jobQueue.process('sheet.import', handleSheetImport); 
jobQueue.process('sheet.create', handleSheetCreate);

const startQueueWorkers = async () => {
  if (!jobQueue) {
    console.error('Queue not available, workers not started');
    return;
  }
  console.log('Queue workers started');
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
};