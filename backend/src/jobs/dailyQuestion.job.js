const cron = require('cron');
const config = require('../config');
const { client: redisClient } = require('../config/redis');
const { DateTime } = require('luxon');
const leetcodeService = require('../services/leetcode.service');
const Question = require('../models/Question');
const { jobQueue } = require('../services/queue.service');
const { extractTestCasesFromHtml } = require('../services/queueHandlers/questionExtractTestCases.handler');

const getTodayKey = () => {
  const today = new Date().toISOString().split('T')[0];
  return `daily_question_fetched:${today}`;
};

// Returns seconds until next 5:45 AM in IST (Asia/Kolkata)
const getSecondsUntilNext545 = (timeZone = 'Asia/Kolkata') => {
  const now = DateTime.now().setZone(timeZone);
  let target = now.set({ hour: 5, minute: 45, second: 0, millisecond: 0 });
  if (now >= target) {
    target = target.plus({ days: 1 });
  }
  return Math.floor(target.diff(now).as('seconds'));
};

const fetchAndStoreDailyQuestion = async () => {
  const key = getTodayKey();

  // Acquire Redis lock to prevent multiple instances from fetching simultaneously
  let acquired = false;
  try {
    // Use string-based options for compatibility
    const result = await redisClient.set(key, '1', 'EX', getSecondsUntilNext545('Asia/Kolkata'), 'NX');
    acquired = result === 'OK';
  } catch (err) {
    console.error('[DailyQuestion] Redis lock failed:', err.message);
    // If Redis is down, proceed anyway (risk of duplicate fetches)
    acquired = true;
  }

  if (!acquired) {
    // console.log('[DailyQuestion] Already fetched today (lock held), skipping');
    return;
  }

  try {
    // Fetch the problem of the day directly from LeetCode
    const daily = await leetcodeService.getDailyProblem(true);
    if (!daily) {
      console.warn('[DailyQuestion] No daily problem returned from LeetCode');
      await redisClient.del(key);
      return;
    }

    // Check if the question already exists in our database
    let question = await Question.findOne({
      platform: 'LeetCode',
      platformQuestionId: daily.titleSlug,
    });

    if (!question) {
      // Auto-create the question with basic metadata
      const fullDetails = await leetcodeService.fetchProblemDetails(daily.link);
      let extractedTestCases = [];
      if (fullDetails.description) {
        extractedTestCases = extractTestCasesFromHtml(fullDetails.description);
      }
      const starterCode = {};
      if (fullDetails.codeSnippets) {
        Object.entries(fullDetails.codeSnippets).forEach(([lang, code]) => {
          starterCode[lang.toLowerCase()] = code;
        });
      }
      question = new Question({
        title: daily.title,
        problemLink: daily.link,
        platform: 'LeetCode',
        platformQuestionId: daily.titleSlug,
        difficulty: daily.difficulty,
        tags: daily.tags || [],
        pattern: daily.tags || [],
        source: 'leetcode',
        contentRef: fullDetails.description || '',
        testCases: extractedTestCases,
        starterCode: starterCode,
        isActive: true,
      });
      await question.save();
      console.log(`[DailyQuestion] Auto-created question: ${daily.title} (${daily.titleSlug})`);

      if (extractedTestCases.length === 0 && fullDetails.description) {
        await jobQueue.add('question.extract_testcases', { questionId: question._id });
      }
    } else {
      console.log(`[DailyQuestion] Question already exists: ${daily.title}`);
    }

    // Send pod.available notification to all users
    if (jobQueue) {
      await jobQueue.add('pod.available', {
        title: daily.title,
        titleSlug: daily.titleSlug,
        link: daily.link,
        date: daily.date,
      });
      console.log(`[DailyQuestion] Queued pod.available for ${daily.title}`);
    }
  } catch (error) {
    console.error('[DailyQuestion] Failed to fetch/store daily problem:', error.message);
    // Remove lock so next hour can retry
    await redisClient.del(key);
  }
};

// Cron job that runs every hour
const dailyQuestionJob = new cron.CronJob('0 * * * *', () => fetchAndStoreDailyQuestion());

const startDailyQuestionJob = async () => {
  if (!redisClient) {
    console.warn('[DailyQuestion] Redis client not available, job not started');
    return;
  }
  // Run once immediately on startup
  await fetchAndStoreDailyQuestion();
  dailyQuestionJob.start();
};

const stopDailyQuestionJob = () => {
  dailyQuestionJob.stop();
};

module.exports = {
  startDailyQuestionJob,
  stopDailyQuestionJob,
  fetchDailyQuestion: fetchAndStoreDailyQuestion,
};