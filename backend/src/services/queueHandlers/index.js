// src/services/queueHandlers/index.js
const { handleQuestionSolved } = require('./questionSolved.handler');
const { handleQuestionMastered } = require('./questionMastered.handler');
const { handleQuestionAttempted } = require('./questionAttempted.handler');
const { handleGoalCompleted } = require('./goalCompleted.handler');
const { handleFollowerNew } = require('./followerNew.handler');
const { handleRevisionCompleted } = require('./revisionCompleted.handler');
const { handleGroupJoined } = require('./groupJoined.handler');
const { handleGroupGoalProgress } = require('./groupGoalProgress.handler');
const { handleGroupGoalCompleted } = require('./groupGoalCompleted.handler');
const { handleGroupChallengeProgress } = require('./groupChallengeProgress.handler');
const { handleGroupChallengeCompleted } = require('./groupChallengeCompleted.handler');
const { handleRevisionSchedule } = require('./revisionSchedule.handler');
const { handleQuestionExtractTestCases } = require('./questionExtractTestCases.handler');
const { handleUserTimezoneChange } = require('./userTimezoneChange.handler');
const { handleTestCaseExecuted } = require('./testCaseExecuted.handler');
const { handleTimeThresholdReached } = require('./timeThresholdReached.handler');
const { handleConfidenceIncrement } = require('./confidenceIncrement.handler');
// REMOVED: const { handleRevisionAutoComplete } = require('./revisionAutoComplete.handler');

const processJob = async (job) => {
  const { type } = job.data;
  console.log(`Processing job type: ${type}, jobId: ${job.id}`);

  switch (type) {
    case 'question.solved':
      await handleQuestionSolved(job);
      break;
    case 'question.mastered':
      await handleQuestionMastered(job);
      break;
    case 'question.attempted':
      await handleQuestionAttempted(job);
      break;
    case 'goal.completed':
      await handleGoalCompleted(job);
      break;
    case 'follower.new':
      await handleFollowerNew(job);
      break;
    case 'revision.schedule':
      await handleRevisionSchedule(job);
      break;
    case 'revision.completed':
      await handleRevisionCompleted(job);
      break;
    case 'group.joined':
      await handleGroupJoined(job);
      break;
    case 'group.goal_progress':
      await handleGroupGoalProgress(job);
      break;
    case 'group.goal_completed':
      await handleGroupGoalCompleted(job);
      break;
    case 'group.challenge_progress':
      await handleGroupChallengeProgress(job);
      break;
    case 'group.challenge_completed':
      await handleGroupChallengeCompleted(job);
      break;
    case 'question.extract_testcases':
      await handleQuestionExtractTestCases(job);
      break;
    case 'user.timezone_change':
      await handleUserTimezoneChange(job);
      break;
    case 'test_case.executed':
      await handleTestCaseExecuted(job);
      break;
    case 'time.threshold_reached':
      await handleTimeThresholdReached(job);
      break;
    case 'confidence.increment':
      await handleConfidenceIncrement(job);
      break;
    // REMOVED: case 'revision.auto_complete':
    default:
      console.error(`Unknown job type: ${type}`);
      throw new Error(`Unknown job type: ${type}`);
  }
};

module.exports = { processJob };