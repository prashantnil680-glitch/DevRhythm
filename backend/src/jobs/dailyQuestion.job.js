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

const fetchDailyQuestion = async () => {
  const key = getTodayKey();

  let acquired = false;
  try {
    const result = await redisClient.set(key, '1', {
      NX: true,
      EX: getSecondsUntilNext545('Asia/Kolkata'),
    });
    acquired = result === 'OK';
  } catch (err) {
    console.error('[DailyQuestion] Redis SET NX failed:', err.message);
    // If Redis is down, we still attempt the fetch (but risk duplicates)
    acquired = true;
  }

  if (!acquired) {
    console.log('[DailyQuestion] Already fetched today (or another instance is fetching), skipping');
    return;
  }

  const url = `${config.backendUrl}/api/v1/questions/daily?refresh=true`;
  try {
    const response = await axios.get(url, {
      headers: { 'X-Internal-Request': 'true' },
      timeout: 30000,
    });

    if (response.status === 200) {
      const dailyProblem = response.data?.data?.dailyProblem;
      if (dailyProblem) {
        console.log(`[DailyQuestion] Successfully fetched and cached (TTL until 5:45 AM IST)`);

        if (jobQueue) {
          await jobQueue.add('pod.available', {
            title: dailyProblem.title,
            titleSlug: dailyProblem.platformQuestionId,
            link: dailyProblem.link,
            date: dailyProblem.date,
          });
          console.log(`[DailyQuestion] Queued pod.available job for ${dailyProblem.title}`);
        }
      } else {
        console.warn('[DailyQuestion] Response missing dailyProblem');
        await redisClient.del(key);
      }
    } else {
      console.error(`[DailyQuestion] Unexpected HTTP status: ${response.status}`);
      await redisClient.del(key);
    }
  } catch (error) {
    console.error('[DailyQuestion] Request failed:', error.message);
    await redisClient.del(key);
  }
};

// Cron job that runs every hour
const dailyQuestionJob = new cron.CronJob('0 * * * *', () => fetchDailyQuestion());

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