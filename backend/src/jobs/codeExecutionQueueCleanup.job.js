/**
 * src/jobs/codeExecutionQueueCleanup.job.js
 *
 * Scheduled job to automatically clean stale jobs from the dedicated code execution queue.
 * Runs every 5 minutes to prevent backlog accumulation.
 */

const cron = require('cron');
const { cleanStaleCodeExecutionJobs } = require('../services/codeExecutionQueue.service');

// Default schedule: every 5 minutes
const DEFAULT_CRON = '*/5 * * * *';
const cronSchedule = process.env.CODE_EXECUTION_CLEANUP_CRON || DEFAULT_CRON;

const cleanupJob = new cron.CronJob(cronSchedule, async () => {
  try {
    const cleanedCount = await cleanStaleCodeExecutionJobs();
    if (cleanedCount > 0) {
      console.log(`[CodeExecCleanup] Removed ${cleanedCount} stale jobs at ${new Date().toISOString()}`);
    }
  } catch (error) {
    console.error('[CodeExecCleanup] Failed to run cleanup:', error);
  }
});

/**
 * Start the automatic cleanup job.
 */
const startCodeExecutionCleanupJob = () => {
  if (process.env.DISABLE_CODE_EXECUTION_CLEANUP === 'true') {
    console.log('[CodeExecCleanup] Auto-cleanup disabled by environment variable');
    return;
  }
  cleanupJob.start();
  console.log(`[CodeExecCleanup] Scheduled job started (cron: ${cronSchedule})`);
};

/**
 * Stop the cleanup job.
 */
const stopCodeExecutionCleanupJob = () => {
  cleanupJob.stop();
  console.log('[CodeExecCleanup] Scheduled job stopped');
};

// Manual trigger for testing
const runCleanupNow = async () => {
  console.log('[CodeExecCleanup] Manual cleanup triggered');
  return cleanStaleCodeExecutionJobs();
};

module.exports = {
  startCodeExecutionCleanupJob,
  stopCodeExecutionCleanupJob,
  runCleanupNow,
};