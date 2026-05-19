const cron = require('cron');
const axios = require('axios');
const config = require('../config');
const { client: redisClient } = require('../config/redis');
const { DateTime } = require('luxon');
const { jobQueue } = require('../services/queue.service');

const getTodayKey = () => {
  const today = new Date().toISOString().split('T')[0];
  return `daily_question_fetched:${today}`;
};

// Returns seconds until next 5:45 AM in the given timezone
const getSecondsUntilNext545 = (timeZone = 'Asia/Kolkata') => {
  const now = DateTime.now().setZone(timeZone);
  let target = now.set({ hour: 5, minute: 45, second: 0, millisecond: 0 });
  if (now >= target) {
    target = target.plus({ days: 1 });
  }
  return Math.floor(target.diff(now).as('seconds'));
};

const fetchDailyQuestion = async (retryCount = 0) => {
  const key = getTodayKey();
  const alreadyFetched = await redisClient.get(key);
  if (alreadyFetched) {
    return;
  }

  const url = `${config.backendUrl}/api/v1/questions/daily?refresh=true`;
  try {
    const response = await axios.get(url, {
      headers: { 'X-Internal-Request': 'true' },
      timeout: 30000,
    });

    if (response.status === 200) {
      const dailyDate = response.data?.data?.dailyProblem?.date;
      const todayUTC = new Date().toISOString().split('T')[0];

      if (dailyDate === todayUTC) {
        // Success – cache until next 5:45 AM IST
        const ttl = getSecondsUntilNext545('Asia/Kolkata');
        await redisClient.setEx(key, ttl, '1');
        console.log(`[DailyQuestion] Cached with TTL ${ttl} seconds (until 5:45 AM IST)`);

        const dailyProblem = response.data?.data?.dailyProblem;
        if (dailyProblem && jobQueue) {
          await jobQueue.add('pod.available', {
            title: dailyProblem.title,
            titleSlug: dailyProblem.platformQuestionId,
            link: dailyProblem.link,
            date: dailyProblem.date,
          });
          console.log(`[DailyQuestion] Queued pod.available job for ${dailyProblem.title}`);
        }
        return;
      } else {
        console.warn(`[DailyQuestion] Fetched problem date ${dailyDate} does not match today (${todayUTC}).`);
        // Schedule a retry if we haven't exceeded max attempts (e.g., 6 retries = 1 hour)
        const MAX_RETRIES = 6;
        if (retryCount < MAX_RETRIES) {
          const delayMinutes = 10; // retry after 10 minutes
          console.log(`[DailyQuestion] Scheduling retry #${retryCount + 1} in ${delayMinutes} minutes.`);
          await jobQueue.add('daily_question.retry', { retryCount: retryCount + 1 }, { delay: delayMinutes * 60 * 1000 });
        } else {
          console.error(`[DailyQuestion] Max retries (${MAX_RETRIES}) reached. Will wait for next hourly run.`);
        }
      }
    } else {
      console.error(`[DailyQuestion] Unexpected HTTP status: ${response.status}`);
    }
  } catch (error) {
    console.error('[DailyQuestion] Request failed:', error.message);
  }
};

// Cron job that runs every hour
const dailyQuestionJob = new cron.CronJob('0 * * * *', () => fetchDailyQuestion());

// Also register a Bull processor for retries
if (jobQueue) {
  jobQueue.process('daily_question.retry', async (job) => {
    const { retryCount } = job.data;
    await fetchDailyQuestion(retryCount);
  });
}

const startDailyQuestionJob = async () => {
  if (!redisClient) {
    console.warn('[DailyQuestion] Redis client not available, job not started');
    return;
  }
  await fetchDailyQuestion();
  dailyQuestionJob.start();
};

const stopDailyQuestionJob = () => {
  dailyQuestionJob.stop();
};

module.exports = {
  startDailyQuestionJob,
  stopDailyQuestionJob,
  fetchDailyQuestion,
};