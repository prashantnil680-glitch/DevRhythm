/**
 * src/services/queueMonitor.service.js
 *
 * Bull queue monitoring service for the main queue.
 * Provides real-time metrics for queue depth, worker utilization, and job counts.
 */

const { jobQueue } = require('./queue.service');

/**
 * Helper: Get metrics for a given queue.
 * @param {Bull} queue - Bull queue instance
 * @param {string} queueName - Name for logging
 * @returns {Promise<Object>} Queue metrics
 */
async function getQueueMetricsForQueue(queue, queueName) {
  if (!queue) {
    console.warn(`[QueueMonitor] ${queueName} not available`);
    return {
      timestamp: new Date().toISOString(),
      counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
      jobsByType: {},
      error: 'Queue not available',
    };
  }

  try {
    const [waitingCount, activeCount, completedCount, failedCount, delayedCount] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    // Get waiting jobs to count by type (limit to first 1000 to avoid performance issues)
    const waitingJobs = await queue.getJobs(['waiting'], 0, 1000);
    const jobsByType = {};
    for (const job of waitingJobs) {
      const jobName = job.name;
      jobsByType[jobName] = (jobsByType[jobName] || 0) + 1;
    }

    return {
      timestamp: new Date().toISOString(),
      counts: {
        waiting: waitingCount,
        active: activeCount,
        completed: completedCount,
        failed: failedCount,
        delayed: delayedCount,
      },
      jobsByType,
    };
  } catch (err) {
    console.error(`[QueueMonitor] Failed to get metrics for ${queueName}:`, err);
    return {
      timestamp: new Date().toISOString(),
      counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
      jobsByType: {},
      error: err.message,
    };
  }
}

/**
 * Get metrics for the main queue (all non‑code jobs).
 * @returns {Promise<Object>}
 */
async function getMainQueueMetrics() {
  return getQueueMetricsForQueue(jobQueue, 'main queue');
}

/**
 * Get detailed information about stalled jobs in a queue.
 * @param {Bull} queue - Bull queue instance
 * @param {string} queueName - Name for logging
 * @returns {Promise<Array>} List of stalled jobs (simplified)
 */
async function getStalledJobsForQueue(queue, queueName) {
  if (!queue) return [];

  try {
    const stalled = await queue.getJobs(['failed']);
    // Filter jobs that failed due to stall (heuristic: check failReason)
    const stalledJobs = stalled.filter(job => {
      const failReason = job.failedReason || '';
      return failReason.includes('stalled') || failReason.includes('lock');
    });
    return stalledJobs.map(job => ({
      id: job.id,
      name: job.name,
      failedReason: job.failedReason,
      timestamp: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    }));
  } catch (err) {
    console.error(`[QueueMonitor] Failed to get stalled jobs for ${queueName}:`, err);
    return [];
  }
}

/**
 * Get stalled jobs for main queue.
 */
async function getMainQueueStalledJobs() {
  return getStalledJobsForQueue(jobQueue, 'main queue');
}

/**
 * Get health summary for a queue.
 * @param {Bull} queue - Bull queue instance
 * @param {string} queueName - Name for logging
 * @returns {Promise<Object>}
 */
async function getQueueHealthForQueue(queue, queueName) {
  if (!queue) {
    return {
      status: 'unavailable',
      waitingCount: 0,
      activeCount: 0,
      stalledCount: 0,
      error: 'Queue not available',
    };
  }

  try {
    const metrics = await getQueueMetricsForQueue(queue, queueName);
    const stalledJobs = await getStalledJobsForQueue(queue, queueName);
    const waitingCount = metrics.counts.waiting;
    const activeCount = metrics.counts.active;
    const stalledCount = stalledJobs.length;

    let status = 'healthy';
    if (waitingCount > 50) {
      status = 'congested';
    } else if (waitingCount > 20) {
      status = 'moderate';
    }
    if (stalledCount > 10) {
      status = 'stalled';
    }

    return {
      status,
      waitingCount,
      activeCount,
      stalledCount,
      lastUpdated: metrics.timestamp,
    };
  } catch (err) {
    return {
      status: 'unavailable',
      error: err.message,
    };
  }
}

/**
 * Get health for main queue.
 */
async function getMainQueueHealth() {
  return getQueueHealthForQueue(jobQueue, 'main queue');
}

module.exports = {
  getMainQueueMetrics,
  getMainQueueHealth,
  getMainQueueStalledJobs,
};