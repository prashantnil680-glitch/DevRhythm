const Notification = require('../models/Notification');
const Question = require('../models/Question');
const { invalidateCache } = require('../middleware/cache');
const { invalidateDashboardCache } = require('../middleware/cache');

/**
 * Create an in-app notification.
 * Automatically enriches data with platformQuestionId if questionId is present.
 */
const createNotification = async ({ userId, type, title, message, data = {}, channel = 'in-app', scheduledAt = new Date() }) => {
  // If data contains a questionId but no platformQuestionId, fetch it
  if (data.questionId && !data.platformQuestionId) {
    try {
      const question = await Question.findById(data.questionId).select('platformQuestionId').lean();
      if (question && question.platformQuestionId) {
        data.platformQuestionId = question.platformQuestionId;
      }
    } catch (err) {
      console.warn(`Failed to fetch platformQuestionId for question ${data.questionId}:`, err.message);
    }
  }

  const status = channel === 'in-app' ? 'sent' : 'pending';
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    data,
    channel,
    status,
    scheduledAt
  });

  await invalidateCache(`notifications:${userId}:*`);
  await invalidateDashboardCache(userId);
  return notification;
};

/**
 * Send bulk notifications (creates notifications only, all in-app).
 */
const sendBulkNotifications = async (userIds, notificationData) => {
  const notifications = userIds.map(userId => ({
    userId,
    ...notificationData,
    channel: 'in-app',
    status: 'sent',
    scheduledAt: new Date()
  }));

  const inserted = await Notification.insertMany(notifications);

  for (const userId of userIds) {
    await invalidateCache(`notifications:${userId}:*`);
    await invalidateDashboardCache(userId);
  }

  return inserted;
};

module.exports = {
  createNotification,
  sendBulkNotifications,
};