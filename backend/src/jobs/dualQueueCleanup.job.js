/**
 * src/jobs/dualQueueCleanup.job.js
 *
 * Scheduled job to automatically clean stale jobs from both fast and slow
 * dedicated code execution queues. Runs every minute to prevent backlog accumulation.
 */

const cron = require('cron');
const { cleanStaleFastCodeExecutionJobs } = require('../services/fastCodeExecutionQueue.service');
const { cleanStaleSlowCodeExecutionJobs } = require('../services/slowCodeExecutionQueue.service');

// Default schedule: every minute
const DEFAULT_CRON = '* * * * *';
const cronSchedule = process.env.DUAL_QUEUE_CLEANUP_CRON || DEFAULT_CRON;

const cleanupJob = new cron.CronJob(cronSchedule, async () => {
  try {
    const fastCleaned = await cleanStaleFastCodeExecutionJobs();
    const slowCleaned = await cleanStaleSlowCodeExecutionJobs();
    const totalCleaned = fastCleaned + slowCleaned;
    if (totalCleaned > 0) {
      console.log(`[DualQueueCleanup] Removed ${fastCleaned} stale jobs from fast queue, ${slowCleaned} from slow queue at ${new Date().toISOString()}`);
    }
  } catch (error) {
    console.error('[DualQueueCleanup] Failed to run cleanup:', error);
  }
});

/**
 * Start the automatic cleanup job.
 */
const startDualQueueCleanupJob = () => {
  if (process.env.DISABLE_DUAL_QUEUE_CLEANUP === 'true') {
    console.log('[DualQueueCleanup] Auto-cleanup disabled by environment variable');
    return;
  }
  cleanupJob.start();
  console.log(`[DualQueueCleanup] Scheduled job started (cron: ${cronSchedule})`);
};

/**
 * Stop the cleanup job.
 */
const stopDualQueueCleanupJob = () => {
  cleanupJob.stop();
  console.log('[DualQueueCleanup] Scheduled job stopped');
};

// Manual trigger for testing
const runCleanupNow = async () => {
  console.log('[DualQueueCleanup] Manual cleanup triggered');
  const fast = await cleanStaleFastCodeExecutionJobs();
  const slow = await cleanStaleSlowCodeExecutionJobs();
  return { fast, slow };
};

module.exports = {
  startDualQueueCleanupJob,
  stopDualQueueCleanupJob,
  runCleanupNow,
};