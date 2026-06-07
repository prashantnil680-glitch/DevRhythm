const express = require('express');
const router = express.Router();
const { refreshNewLeetCodeProblems, repairIncompleteQuestions } = require('../../services/leetcodeSync.service');
const config = require('../../config');
const {
  getMainQueueMetrics,
  getMainQueueHealth,
  getCodeExecutionQueueMetrics,
  getCodeExecutionQueueHealth,
} = require('../../services/queueMonitor.service');
const { clearStaleCodeExecutionLocks } = require('../../services/queue.service');

// Simple API key middleware
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-admin-key'];
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// ========== LeetCode endpoints ==========
router.post('/leetcode/refresh', requireApiKey, async (req, res, next) => {
  try {
    const refreshResult = await refreshNewLeetCodeProblems();
    const repairResult = await repairIncompleteQuestions();
    res.json({
      success: true,
      message: 'LeetCode refresh and repair completed',
      data: {
        newProblems: refreshResult,
        incompleteRepairs: repairResult,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/leetcode/repair-missing', requireApiKey, async (req, res, next) => {
  try {
    const Question = require('../../models/Question');
    const { jobQueue } = require('../../services/queue.service');

    const missing = await Question.find({
      platform: 'LeetCode',
      $or: [
        { contentRef: { $exists: false } },
        { contentRef: '' },
        { testCases: { $size: 0 } },
      ],
    }).select('platformQuestionId problemLink').lean();

    if (!missing.length) {
      return res.json({ success: true, message: 'No missing details found', data: { count: 0 } });
    }

    let queued = 0;
    for (const q of missing) {
      await jobQueue.add('leetcode.fetch_details', {
        platformQuestionId: q.platformQuestionId,
        url: q.problemLink,
      });
      queued++;
    }

    res.json({
      success: true,
      message: `Re-queued detail fetch for ${queued} problems`,
      data: { queued, slugs: missing.map(m => m.platformQuestionId) },
    });
  } catch (error) {
    next(error);
  }
});

// ========== Queue monitoring endpoints ==========

// Main queue (non‑code jobs)
router.get('/queue/main-metrics', requireApiKey, async (req, res, next) => {
  try {
    const metrics = await getMainQueueMetrics();
    res.json({
      success: true,
      message: 'Main queue metrics retrieved successfully',
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/queue/main-health', requireApiKey, async (req, res, next) => {
  try {
    const health = await getMainQueueHealth();
    res.json({
      success: true,
      message: 'Main queue health retrieved successfully',
      data: health,
    });
  } catch (error) {
    next(error);
  }
});

// Dedicated code execution queue
router.get('/queue/code-metrics', requireApiKey, async (req, res, next) => {
  try {
    const metrics = await getCodeExecutionQueueMetrics();
    res.json({
      success: true,
      message: 'Code execution queue metrics retrieved successfully',
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/queue/code-health', requireApiKey, async (req, res, next) => {
  try {
    const health = await getCodeExecutionQueueHealth();
    res.json({
      success: true,
      message: 'Code execution queue health retrieved successfully',
      data: health,
    });
  } catch (error) {
    next(error);
  }
});

// Manual lock cleanup (affects code execution queue locks)
router.post('/queue/clear-locks', requireApiKey, async (req, res, next) => {
  try {
    const deletedCount = await clearStaleCodeExecutionLocks();
    res.json({
      success: true,
      message: `Cleared ${deletedCount} stale code execution locks`,
      data: { deletedCount },
    });
  } catch (error) {
    next(error);
  }
});

// ========== Heatmap rebuild endpoint ==========
router.post('/heatmap/rebuild', requireApiKey, async (req, res, next) => {
  try {
    const { dryRun = false, userId = null } = req.body;
    const { rebuildHeatmap } = require('../../scripts/rebuildHeatmap');
    const result = await rebuildHeatmap(dryRun, userId);
    res.json({
      success: true,
      message: dryRun ? 'Heatmap rebuild dry run completed' : 'Heatmap rebuild completed successfully',
      data: result,
    });
  } catch (error) {
    console.error('[Admin] Heatmap rebuild error:', error);
    next(error);
  }
});

router.post('/queue/fast/clear', requireApiKey, async (req, res) => {
  const cleaned = await fastCodeExecutionQueue.clean(0, 'wait');
  const active = await fastCodeExecutionQueue.clean(0, 'active');
  res.json({ cleaned: cleaned.length, active: active.length });
});

module.exports = router;