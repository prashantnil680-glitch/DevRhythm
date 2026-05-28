const User = require('../models/User');
const Question = require('../models/Question');
const { invalidateCache } = require('../middleware/cache');
const { getStartOfDay } = require('../utils/helpers/date');
const { DateTime } = require('luxon');

const getLocalDateStr = (date, timeZone) => {
  return DateTime.fromJSDate(date, { zone: timeZone }).toFormat('yyyy-MM-dd');
};

/**
 * Update user's streak and active days based on activity date.
 * This function is called when a user solves a question, attempts code, etc.
 * @param {string} userId - User ObjectId
 * @param {Date} activityDate - Date of activity (will be converted to user's local time)
 * @param {string} timeZone - IANA timezone (e.g., 'Asia/Kolkata')
 * @returns {Promise<User|null>} Updated user document
 */
const updateUserActivity = async (userId, activityDate = new Date(), timeZone = 'UTC') => {
  const user = await User.findById(userId);
  if (!user) return null;

  const todayLocal = getLocalDateStr(new Date(), timeZone);
  const activityLocal = getLocalDateStr(activityDate, timeZone);

  // Only update if activity is on or before today (ignore future)
  if (activityLocal > todayLocal) return user;

  const lastActiveLocal = user.streak.lastActiveDate
    ? getLocalDateStr(user.streak.lastActiveDate, timeZone)
    : null;

  if (!lastActiveLocal) {
    // First activity ever
    user.streak.current = 1;
    user.streak.longest = 1;
    user.stats.activeDays = 1;
  } else if (lastActiveLocal !== activityLocal) {
    // Check if last active was yesterday (in user's local timezone)
    const activityDateObj = new Date(activityDate);
    const yesterdayLocal = getLocalDateStr(
      new Date(activityDateObj.setDate(activityDateObj.getDate() - 1)),
      timeZone
    );
    if (lastActiveLocal === yesterdayLocal) {
      user.streak.current += 1;
      if (user.streak.current > user.streak.longest) {
        user.streak.longest = user.streak.current;
      }
    } else {
      user.streak.current = 1;
    }
    user.stats.activeDays += 1;
  }
  // else same day → do nothing

  // Store last active date as the start of the local day in UTC (for consistency)
  const localStartUTC = getStartOfDay(activityDate, timeZone);
  user.streak.lastActiveDate = localStartUTC;

  await user.save();
  await invalidateCache(`user:${userId}:profile`);
  return user;
};

/**
 * Increment user stats synchronously (solved count and total time spent)
 * Used when a question is solved successfully via code execution.
 * Also recalculates mastery rate based on total solved / total questions.
 * 
 * @param {string} userId - User ObjectId
 * @param {number} deltaSolved - Number of newly solved questions (usually 1)
 * @param {number} deltaTimeSpent - Minutes spent on this solve (optional)
 * @returns {Promise<object>} Updated user stats
 */
const incrementUserStats = async (userId, deltaSolved = 1, deltaTimeSpent = 0) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // Increment stats
  user.stats.totalSolved = (user.stats.totalSolved || 0) + deltaSolved;
  user.stats.totalTimeSpent = (user.stats.totalTimeSpent || 0) + deltaTimeSpent;

  // Recalculate mastery rate: solved / total active questions * 100
  const totalQuestions = await Question.countDocuments({ isActive: true });
  let masteryRate = 0;
  if (totalQuestions > 0) {
    masteryRate = (user.stats.totalSolved / totalQuestions) * 100;
    masteryRate = Math.min(100, Math.round(masteryRate * 100) / 100);
  }
  user.stats.masteryRate = masteryRate;

  await user.save();
  
  // Invalidate user cache so dashboard reflects new stats
  await invalidateCache(`user:${userId}:profile`);
  await invalidateCache(`dashboard:user:${userId}`);
  
  return {
    totalSolved: user.stats.totalSolved,
    totalTimeSpent: user.stats.totalTimeSpent,
    masteryRate: user.stats.masteryRate
  };
};

module.exports = {
  updateUserActivity,
  incrementUserStats,
};