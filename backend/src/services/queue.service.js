// src/services/queue.service.js
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
    return { host, port, password, db };
  } catch (err) {
    console.error('Invalid Redis URL:', err);
    return null;
  }
})();

if (!redisOptions) {
  console.error('Redis configuration missing, queues will not work');
}

// Create a single queue for all job types
const jobQueue = new Bull('devrhythm-jobs', { redis: redisOptions });

jobQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

jobQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} (${job.data.type}) failed:`, err);
});

// Import handlers directly from their files
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

// Register each job type with its dedicated processor
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

const startQueueWorkers = async () => {
  if (!jobQueue) {
    console.error('Queue not available, workers not started');
    return;
  }
  console.log('Queue workers started');
};

const stopQueueWorkers = async () => {
  if (jobQueue) await jobQueue.close();
  console.log('Queue workers stopped');
};

module.exports = {
  jobQueue,
  startQueueWorkers,
  stopQueueWorkers,
};