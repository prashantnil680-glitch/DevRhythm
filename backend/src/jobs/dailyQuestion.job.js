const cron = require('cron');
const axios = require('axios');
const config = require('../config');
const { client: redisClient } = require('../config/redis');
const { DateTime } = require('luxon');
const { jobQueue } = require('../services/queue.service'); // NEW

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
        // Calculate TTL to expire at next 5:45 AM IST
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
      } else {
        console.warn(`[DailyQuestion] Fetched problem date ${dailyDate} does not match today (${todayUTC}). Will retry next hour.`);
      }
    } else {
      console.error(`[DailyQuestion] Unexpected HTTP status: ${response.status}`);
    }
  } catch (error) {
    console.error('[DailyQuestion] Request failed:', error.message);
  }
};

const dailyQuestionJob = new cron.CronJob('0 * * * *', fetchDailyQuestion);

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