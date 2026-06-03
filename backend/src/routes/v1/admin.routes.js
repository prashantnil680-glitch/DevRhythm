const express = require('express');
const router = express.Router();
const { refreshNewLeetCodeProblems, repairIncompleteQuestions } = require('../../services/leetcodeSync.service');
const config = require('../../config');

// Simple API key middleware
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-admin-key'];
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

router.post('/leetcode/refresh', requireApiKey, async (req, res, next) => {
  try {
    // 1. Refresh new problems
    const refreshResult = await refreshNewLeetCodeProblems();
    
    // 2. Repair incomplete questions
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

module.exports = router;