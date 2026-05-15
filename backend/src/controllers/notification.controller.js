const Notification = require('../models/Notification');
const { formatResponse } = require('../utils/helpers/response');
const { getPaginationParams, paginate } = require('../utils/helpers/pagination');
const AppError = require('../utils/errors/AppError');
const { invalidateCache, invalidateDashboardCache } = require('../middleware/cache');

/**
 * Get notifications for the authenticated user
 * Supports filtering by date range and categories
 */
const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { unreadOnly, type, startDate, endDate, category, search } = req.query;
    const query = { userId: req.user._id };

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Type filter (exact match)
    if (type) {
      query.type = type;
    } else if (category) {
      const categoryMap = {
        revision: ['revision_reminder_daily', 'revision_reminder_urgent', 'revision_completed'],
        goal: ['goal_completion'],
        solved: ['question_solved', 'question_mastered'],
        pod: ['pod_available', 'pod_solved'],
        social: ['new_follower'],
      };
      const categories = category.split(',').map(c => c.trim());
      let types = [];
      for (const cat of categories) {
        if (categoryMap[cat]) types.push(...categoryMap[cat]);
      }
      if (types.length) query.type = { $in: types };
    }

    if (unreadOnly === 'true') query.readAt = null;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { message: searchRegex }
      ];
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query)
    ]);

    const unreadCount = unreadOnly !== 'true'
      ? await Notification.countDocuments({ userId: req.user._id, readAt: null })
      : undefined;

    res.json(formatResponse('Notifications retrieved', { notifications, unreadCount }, { pagination: paginate(total, page, limit) }));
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a specific notification as read and set expiry (3 days from now)
 */
const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: req.user._id, readAt: null },
      { readAt: new Date(), expiresAt },
      { new: true }
    );
    if (!notification) throw new AppError('Notification not found', 404);

    await invalidateCache(`notifications:${req.user._id}:*`);
    await invalidateDashboardCache(req.user._id);
    res.json(formatResponse('Notification marked as read', { notification }));
  } catch (error) {
    next(error);
  }
};

/**
 * Mark multiple notifications as read and set expiry (3 days from now)
 */
const markMultipleAsRead = async (req, res, next) => {
  try {
    const { notificationIds } = req.body;
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new AppError('notificationIds must be a non-empty array', 400);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);

    const result = await Notification.updateMany(
      { _id: { $in: notificationIds }, userId: req.user._id, readAt: null },
      { readAt: new Date(), expiresAt }
    );

    await invalidateCache(`notifications:${req.user._id}:*`);
    await invalidateDashboardCache(req.user._id);
    res.json(formatResponse(`${result.modifiedCount} notifications marked as read`));
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read and set expiry (3 days from now)
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);

    const result = await Notification.updateMany(
      { userId: req.user._id, readAt: null },
      { readAt: new Date(), expiresAt }
    );

    await invalidateCache(`notifications:${req.user._id}:*`);
    await invalidateDashboardCache(req.user._id);
    res.json(formatResponse(`All ${result.modifiedCount} notifications marked as read`));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification (soft delete by setting expiresAt to now)
 */
const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findOneAndDelete({ _id: notificationId, userId: req.user._id });
    if (!notification) throw new AppError('Notification not found', 404);

    await invalidateCache(`notifications:${req.user._id}:*`);
    await invalidateDashboardCache(req.user._id);
    res.json(formatResponse('Notification deleted'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread count only
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, readAt: null });
    res.json(formatResponse('Unread count retrieved', { unreadCount: count }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount
};